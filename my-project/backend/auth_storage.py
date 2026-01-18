import os
import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid

from huggingface_hub import HfApi, CommitOperationAdd, create_commit, hf_hub_url

logger = logging.getLogger(__name__)

USERS_FILE_PATH = "auth/users.json"
REQUESTS_FILE_PATH = "auth/requests.json"


def build_dataset_resolve_url(repo_id: str, path_in_repo: str, revision: str = "main") -> str:
    """
    Build a CDN-resolved URL for a file stored in a Hugging Face dataset repo.
    """
    return hf_hub_url(repo_id=repo_id, filename=path_in_repo, repo_type="dataset", revision=revision)


class AuthStorageClient:
    """
    Helper for managing user authentication data and permission requests
    in a Hugging Face dataset repository.
    
    Repo format:
      - auth/users.json
      - auth/requests.json
    """

    def __init__(self, dataset_repo: str, hf_token: Optional[str] = None, revision: str = "main"):
        if not dataset_repo:
            raise ValueError("HF_DATASET_REPO is not set. Please configure the dataset repository id.")
        self.dataset_repo = dataset_repo
        self.revision = revision
        self.api = HfApi(token=hf_token) if hf_token else HfApi()

    def load_users(self) -> List[Dict[str, Any]]:
        """
        Download and parse users.json from the dataset. If missing, return [].
        """
        try:
            url = build_dataset_resolve_url(self.dataset_repo, USERS_FILE_PATH, self.revision)
            import requests
            headers = {}
            if self.api.token:
                headers["Authorization"] = f"Bearer {self.api.token}"
            resp = requests.get(url, timeout=10, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("users", [])
            logger.info("Users file not found at %s (status %s). Initializing empty users list.", url, resp.status_code)
            return []
        except Exception as e:
            logger.error("Failed to load users from HF: %s", str(e))
            return []

    def save_users(self, users: List[Dict[str, Any]]) -> None:
        """
        Commit a new version of users.json to the dataset repo.
        """
        try:
            payload = json.dumps({"users": users}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            operations = [
                CommitOperationAdd(path_in_repo=USERS_FILE_PATH, path_or_fileobj=payload)
            ]
            create_commit(
                repo_id=self.dataset_repo,
                repo_type="dataset",
                operations=operations,
                commit_message="Update users.json",
                revision=self.revision,
                token=self.api.token,
            )
        except Exception as e:
            logger.error("Failed to save users to HF: %s", str(e))
            raise

    def load_requests(self) -> List[Dict[str, Any]]:
        """
        Download and parse requests.json from the dataset. If missing, return [].
        """
        try:
            url = build_dataset_resolve_url(self.dataset_repo, REQUESTS_FILE_PATH, self.revision)
            import requests
            headers = {}
            if self.api.token:
                headers["Authorization"] = f"Bearer {self.api.token}"
            resp = requests.get(url, timeout=10, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("requests", [])
            logger.info("Requests file not found at %s (status %s). Initializing empty requests list.", url, resp.status_code)
            return []
        except Exception as e:
            logger.error("Failed to load requests from HF: %s", str(e))
            return []

    def save_requests(self, requests: List[Dict[str, Any]]) -> None:
        """
        Commit a new version of requests.json to the dataset repo.
        """
        try:
            payload = json.dumps({"requests": requests}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            operations = [
                CommitOperationAdd(path_in_repo=REQUESTS_FILE_PATH, path_or_fileobj=payload)
            ]
            create_commit(
                repo_id=self.dataset_repo,
                repo_type="dataset",
                operations=operations,
                commit_message="Update requests.json",
                revision=self.revision,
                token=self.api.token,
            )
        except Exception as e:
            logger.error("Failed to save requests to HF: %s", str(e))
            raise

    def add_user(self, email: str, password_hash: str) -> None:
        """
        Add a new user to the users list.
        """
        users = self.load_users()
        # Check if user already exists
        if any(user.get("email") == email for user in users):
            raise ValueError(f"User with email {email} already exists")
        
        users.append({
            "email": email,
            "password_hash": password_hash
        })
        self.save_users(users)

    def get_user(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Get a user by email.
        """
        users = self.load_users()
        return next((user for user in users if user.get("email") == email), None)

    def delete_user(self, email: str) -> None:
        """
        Delete a user by email.
        """
        users = self.load_users()
        users = [user for user in users if user.get("email") != email]
        self.save_users(users)

    def add_request(self, name: str, email: str, reason: str) -> str:
        """
        Add a new permission request. Returns the request ID.
        """
        requests = self.load_requests()
        request_id = str(uuid.uuid4())
        
        new_request = {
            "id": request_id,
            "name": name,
            "email": email,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "pending",
            "reviewed_at": None,
            "rejection_reason": None
        }
        
        requests.append(new_request)
        self.save_requests(requests)
        return request_id

    def get_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a request by ID.
        """
        requests = self.load_requests()
        return next((req for req in requests if req.get("id") == request_id), None)

    def update_request_status(self, request_id: str, status: str, rejection_reason: Optional[str] = None) -> None:
        """
        Update the status of a request.
        """
        requests = self.load_requests()
        for req in requests:
            if req.get("id") == request_id:
                req["status"] = status
                req["reviewed_at"] = datetime.utcnow().isoformat()
                if rejection_reason:
                    req["rejection_reason"] = rejection_reason
                break
        self.save_requests(requests)

    def delete_request(self, request_id: str) -> None:
        """
        Delete a request by ID.
        """
        requests = self.load_requests()
        requests = [req for req in requests if req.get("id") != request_id]
        self.save_requests(requests)
