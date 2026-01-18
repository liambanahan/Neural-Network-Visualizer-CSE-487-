import os
import uuid
import json
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
from pydantic import BaseModel
from typing import Dict, Optional, Any
import asyncio
from datetime import datetime
import time
import math
import tempfile

from style_transfer import transfer_style
from storage_hf import (
    HFStorageClient,
    build_dataset_resolve_url
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Custom JSON encoder to handle infinity
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, float):
            if math.isinf(obj):
                return "Infinity" if obj > 0 else "-Infinity"
            if math.isnan(obj):
                return "NaN"
        return super().default(obj)

# Custom JSONResponse that uses our custom encoder
class CustomJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            cls=CustomJSONEncoder,
        ).encode("utf-8")

# Initialize FastAPI
app = FastAPI(title="Neural Style Transfer API", default_response_class=CustomJSONResponse)

# HF storage configuration
HF_DATASET_REPO = os.getenv("HF_DATASET_REPO", "")  # e.g. username/style-transfer-data
HF_TOKEN = os.getenv("HF_TOKEN", "")
storage_client = HFStorageClient(dataset_repo=HF_DATASET_REPO, hf_token=HF_TOKEN)

# Setup CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

"""
With Hugging Face storage, images are served via absolute URLs from the
dataset CDN, so we no longer mount local static directories.
"""

# Keep track of running jobs using asyncio.Queue for thread-safe updates
job_queues = {}
active_jobs = {}

class StyleTransferProgress(BaseModel):
    job_id: str
    status: str
    progress: Optional[int] = 0
    style_loss: Optional[float] = None
    content_loss: Optional[float] = None
    result_url: Optional[str] = None
    error: Optional[str] = None

# Helper function to generate unique file paths
def get_unique_filename(directory, extension=".jpg"):
    return os.path.join(directory, f"{uuid.uuid4()}{extension}")

def load_gallery():
    try:
        return storage_client.load_gallery()
    except Exception as e:
        logger.error(f"Error loading gallery data from HF: {str(e)}")
        return []

def save_gallery(gallery_data):
    try:
        storage_client.save_gallery(gallery_data)
    except Exception as e:
        logger.error(f"Error saving gallery data to HF: {str(e)}")

# Background task for style transfer
async def run_style_transfer_task(
    job_id: str,
    content_local_path: str,
    style_local_path: str,
    output_local_path: str,
    style_weight: float,
    content_weight: float,
    num_steps: int,
    layer_weights: Dict[str, float]
):
    try:
        # Create a queue for this job if it doesn't exist
        if job_id not in job_queues:
            job_queues[job_id] = asyncio.Queue()

        queue = job_queues[job_id]
        start_time = time.time()
        best_loss = float('inf')
        style_loss = 0
        content_loss = 0
        
        # Update job status
        await queue.put({
            "status": "processing",
            "progress": 0,
            "style_loss": None,
            "content_loss": None
        })
        
        # Define a callback that will update the job status
        def on_progress(progress):
            nonlocal style_loss, content_loss, best_loss
            # Calculate total loss as the sum of style and content loss
            total_loss = progress["style_loss"] + progress["content_loss"]
            
            # Update the best loss if this one is better
            if total_loss < best_loss:
                best_loss = total_loss
                
            progress_data = {
                "status": "processing",
                "progress": progress["iteration"] / num_steps * 100,
                "style_loss": progress["style_loss"],
                "content_loss": progress["content_loss"]
            }
            style_loss = progress["style_loss"]
            content_loss = progress["content_loss"]
            
            # Use asyncio.run_coroutine_threadsafe to safely put data in the queue from a different thread
            loop = asyncio.get_event_loop()
            asyncio.run_coroutine_threadsafe(queue.put(progress_data), loop)
        
        # Run the style transfer
        result_path, model_best_loss = transfer_style(
            content_path=content_local_path,
            style_path=style_local_path,
            output_path=output_local_path,
            style_weight=style_weight,
            content_weight=content_weight,
            num_steps=num_steps,
            layer_weights=layer_weights,
            progress_callback=on_progress
        )
        
        processing_time = time.time() - start_time
        
        # If best_loss is still infinity, use the model's best loss or the sum of final losses
        if math.isinf(best_loss):
            best_loss = model_best_loss if not math.isinf(model_best_loss) else style_loss + content_loss
            
        # Upload artifacts to Hugging Face dataset and build absolute URLs
        date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
        base_prefix = f"runs/{date_prefix}/{job_id}"

        content_ds_path = storage_client.upload_file(
            local_path=content_local_path,
            dst_path=f"{base_prefix}/content.jpg"
        )
        style_ds_path = storage_client.upload_file(
            local_path=style_local_path,
            dst_path=f"{base_prefix}/style.jpg"
        )
        result_ds_path = storage_client.upload_file(
            local_path=output_local_path,
            dst_path=f"{base_prefix}/result.jpg"
        )

        content_url = build_dataset_resolve_url(storage_client.dataset_repo, content_ds_path)
        style_url = build_dataset_resolve_url(storage_client.dataset_repo, style_ds_path)
        result_url = build_dataset_resolve_url(storage_client.dataset_repo, result_ds_path)

        # Save to gallery
        gallery_item = {
            "id": job_id,
            "timestamp": datetime.utcnow().isoformat(),
            "contentImageUrl": content_url,
            "styleImageUrl": style_url,
            "resultImageUrl": result_url,
            "bestLoss": style_loss + content_loss,
            "styleLoss": style_loss,
            "contentLoss": content_loss,
            "processingTime": processing_time,
            "parameters": {
                "styleWeight": style_weight,
                "contentWeight": content_weight,
                "numSteps": num_steps,
                "layerWeights": layer_weights
            }
        }
        
        gallery = load_gallery()
        gallery.append(gallery_item)
        save_gallery(gallery)
        
        # Update job status with result
        await queue.put({
            "status": "completed",
            "progress": 100,
            "style_loss": style_loss,
            "content_loss": content_loss,
            "result_url": result_url
        })
        
    except Exception as e:
        logger.error(f"Error in style transfer: {str(e)}")
        await queue.put({
            "status": "failed",
            "error": str(e)
        })
    finally:
        # Keep the last status update in active_jobs
        try:
            last_status = queue.get_nowait()
            active_jobs[job_id] = last_status
        except asyncio.QueueEmpty:
            pass

@app.post("/api/transfer")
async def create_style_transfer(
    background_tasks: BackgroundTasks,
    content_image: UploadFile = File(...),
    style_image: UploadFile = File(...),
    style_weight: float = Form(1000000.0),
    content_weight: float = Form(1.0),
    num_steps: int = Form(300),
    layer_weights: str = Form("{}"),
):
    try:
        # Parse layer weights from JSON string
        layer_weights_dict = json.loads(layer_weights)
        
        # Save uploaded files temporarily to local disk for processing
        temp_dir = tempfile.gettempdir()
        content_path = get_unique_filename(temp_dir)
        style_path = get_unique_filename(temp_dir)
        output_path = get_unique_filename(temp_dir)

        with open(content_path, "wb") as content_file:
            content_file.write(await content_image.read())

        with open(style_path, "wb") as style_file:
            style_file.write(await style_image.read())
        
        # Create a unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job status
        active_jobs[job_id] = {
            "status": "pending",
            "progress": 0,
            "style_loss": None,
            "content_loss": None,
            "result_url": None,
            "error": None
        }
        
        # Start style transfer in the background
        background_tasks.add_task(
            run_style_transfer_task,
            job_id,
            content_path,
            style_path,
            output_path,
            style_weight,
            content_weight,
            num_steps,
            layer_weights_dict
        )
        
        return {
            "job_id": job_id,
            "status": "pending"
        }
    
    except Exception as e:
        logger.error(f"Error creating style transfer: {str(e)}")
        return CustomJSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/api/transfer/{job_id}")
async def get_transfer_status(job_id: str):
    if job_id not in active_jobs and job_id not in job_queues:
        return CustomJSONResponse(
            status_code=404,
            content={"error": "Job not found"}
        )
    
    # Try to get the latest status from the queue
    if job_id in job_queues:
        try:
            # Get the latest status without removing it from the queue
            status = job_queues[job_id].get_nowait()
            job_queues[job_id].put_nowait(status)  # Put it back
            active_jobs[job_id] = status  # Update active_jobs with latest status
        except asyncio.QueueEmpty:
            # If queue is empty, use the last known status from active_jobs
            pass
    
    job_status = active_jobs[job_id]
    
    # Return appropriate response based on job status
    if job_status["status"] == "completed" and job_status.get("result_url"):
        # Clean up the queue for completed jobs
        if job_id in job_queues:
            del job_queues[job_id]
        return {
            "job_id": job_id,
            "status": "completed",
            "progress": 100,
            "style_loss": job_status.get("style_loss"),
            "content_loss": job_status.get("content_loss"),
            "result_url": job_status["result_url"]
        }
    elif job_status["status"] == "failed":
        # Clean up the queue for failed jobs
        if job_id in job_queues:
            del job_queues[job_id]
        return {
            "job_id": job_id,
            "status": "failed",
            "error": job_status.get("error", "Unknown error")
        }
    else:
        return {
            "job_id": job_id,
            "status": job_status["status"],
            "progress": job_status.get("progress", 0),
            "style_loss": job_status.get("style_loss"),
            "content_loss": job_status.get("content_loss")
        }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/gallery")
async def get_gallery_items():
    try:
        gallery = load_gallery()
        # Replace any infinity values before sending response
        for item in gallery:
            if 'bestLoss' in item and isinstance(item['bestLoss'], float) and math.isinf(item['bestLoss']):
                item['bestLoss'] = 999999999 if item['bestLoss'] > 0 else -999999999
            if 'styleLoss' in item and isinstance(item['styleLoss'], float) and math.isinf(item['styleLoss']):
                item['styleLoss'] = 999999999 if item['styleLoss'] > 0 else -999999999
            if 'contentLoss' in item and isinstance(item['contentLoss'], float) and math.isinf(item['contentLoss']):
                item['contentLoss'] = 999999999 if item['contentLoss'] > 0 else -999999999
        return gallery
    except Exception as e:
        logger.error(f"Error getting gallery items: {str(e)}")
        return CustomJSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/api/gallery/{item_id}")
async def get_gallery_item(item_id: str):
    try:
        gallery = load_gallery()
        item = next((item for item in gallery if item["id"] == item_id), None)
        if item is None:
            return CustomJSONResponse(status_code=404, content={"error": "Item not found"})
        
        # Replace any infinity values before sending response
        if 'bestLoss' in item and isinstance(item['bestLoss'], float) and math.isinf(item['bestLoss']):
            item['bestLoss'] = 999999999 if item['bestLoss'] > 0 else -999999999
        if 'styleLoss' in item and isinstance(item['styleLoss'], float) and math.isinf(item['styleLoss']):
            item['styleLoss'] = 999999999 if item['styleLoss'] > 0 else -999999999
        if 'contentLoss' in item and isinstance(item['contentLoss'], float) and math.isinf(item['contentLoss']):
            item['contentLoss'] = 999999999 if item['contentLoss'] > 0 else -999999999
            
        return item
    except Exception as e:
        logger.error(f"Error getting gallery item: {str(e)}")
        return CustomJSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.delete("/api/gallery/{item_id}")
async def delete_gallery_item(item_id: str):
    try:
        gallery = load_gallery()
        item_to_delete = next((item for item in gallery if item["id"] == item_id), None)
        
        if not item_to_delete:
            return CustomJSONResponse(
                status_code=404, 
                content={"error": "Item not found"}
            )
            
        # Remove from gallery first
        gallery = [item for item in gallery if item["id"] != item_id]
        save_gallery(gallery)

        # Attempt to delete artifacts from dataset
        try:
            storage_client.delete_run_artifacts(item_to_delete)
        except Exception as e:
            logger.error(f"Error deleting dataset artifacts for {item_id}: {str(e)}")
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting gallery item: {str(e)}")
        return CustomJSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 