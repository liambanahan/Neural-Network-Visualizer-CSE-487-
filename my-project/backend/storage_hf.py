import os
import json
import logging
from typing import Any, Dict, List, Optional

from huggingface_hub import HfApi, CommitOperationAdd, CommitOperationDelete, create_commit, hf_hub_url

logger = logging.getLogger(__name__)


GALLERY_FILE_PATH = "gallery/gallery.json"


def build_dataset_resolve_url(repo_id: str, path_in_repo: str, revision: str = "main") -> str:
    """
    Build a CDN-resolved URL for a file stored in a Hugging Face dataset repo.
    """
    return hf_hub_url(repo_id=repo_id, filename=path_in_repo, repo_type="dataset", revision=revision)


class HFStorageClient:
    """
    Simple helper around huggingface_hub for storing run artifacts and gallery metadata
    in a Dataset repository.

    Repo format:
      - runs/YYYY/MM/DD/<job_id>/content.jpg
      - runs/YYYY/MM/DD/<job_id>/style.jpg
      - runs/YYYY/MM/DD/<job_id>/result.jpg
      - gallery/gallery.json
    """

    def __init__(self, dataset_repo: str, hf_token: Optional[str] = None, revision: str = "main"):
        if not dataset_repo:
            raise ValueError("HF_DATASET_REPO is not set. Please configure the dataset repository id.")
        self.dataset_repo = dataset_repo
        self.revision = revision
        self.api = HfApi(token=hf_token) if hf_token else HfApi()

    def load_gallery(self) -> List[Dict[str, Any]]:
        """
        Download and parse gallery.json from the dataset. If missing, return [].
        """
        try:
            # Try to get the raw file content via the hub URL
            url = build_dataset_resolve_url(self.dataset_repo, GALLERY_FILE_PATH, self.revision)
            import requests  # local import to avoid hard dependency elsewhere
            headers = {}
            if self.api.token:
                headers["Authorization"] = f"Bearer {self.api.token}"
            resp = requests.get(url, timeout=10, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.info("Gallery not found at %s (status %s). Initializing empty gallery.", url, resp.status_code)
            return []
        except Exception as e:
            logger.error("Failed to load gallery from HF: %s", str(e))
            return []

    def save_gallery(self, gallery: List[Dict[str, Any]]) -> None:
        """
        Commit a new version of gallery.json to the dataset repo.
        """
        try:
            payload = json.dumps(gallery, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            operations = [
                CommitOperationAdd(path_in_repo=GALLERY_FILE_PATH, path_or_fileobj=payload)
            ]
            create_commit(
                repo_id=self.dataset_repo,
                repo_type="dataset",
                operations=operations,
                commit_message="Update gallery.json",
                revision=self.revision,
                token=self.api.token,
            )
        except Exception as e:
            logger.error("Failed to save gallery to HF: %s", str(e))
            raise

    def upload_file(self, local_path: str, dst_path: str) -> str:
        """
        Upload a local file to the dataset repo at dst_path. Returns the path_in_repo.
        """
        if not os.path.exists(local_path):
            raise FileNotFoundError(local_path)

        try:
            with open(local_path, "rb") as f:
                operations = [
                    CommitOperationAdd(path_in_repo=dst_path, path_or_fileobj=f)
                ]
                create_commit(
                    repo_id=self.dataset_repo,
                    repo_type="dataset",
                    operations=operations,
                    commit_message=f"Upload {dst_path}",
                    revision=self.revision,
                    token=self.api.token,
                )
            return dst_path
        except Exception as e:
            logger.error("Failed to upload %s to HF at %s: %s", local_path, dst_path, str(e))
            raise

    def delete_run_artifacts(self, gallery_item: Dict[str, Any]) -> None:
        """
        Attempt to delete the three image artifacts associated with a run.
        This parses resolve URLs to determine paths in repo.
        """
        def extract_path(url: Optional[str]) -> Optional[str]:
            if not url:
                return None
            marker = "/resolve/"
            if marker in url:
                try:
                    # url ends with .../resolve/<rev>/<path_in_repo>
                    parts = url.split(marker, 1)[1].split("/", 1)
                    if len(parts) == 2:
                        return parts[1]
                except Exception:
                    return None
            return None

        paths: List[str] = []
        for key in ("contentImageUrl", "styleImageUrl", "resultImageUrl"):
            p = extract_path(gallery_item.get(key))
            if p:
                paths.append(p)

        if not paths:
            return

        try:
            operations = [CommitOperationDelete(path) for path in paths]
            create_commit(
                repo_id=self.dataset_repo,
                repo_type="dataset",
                operations=operations,
                commit_message=f"Delete artifacts for run {gallery_item.get('id', '')}",
                revision=self.revision,
                token=self.api.token,
            )
        except Exception as e:
            logger.error("Failed to delete artifacts %s: %s", paths, str(e))

