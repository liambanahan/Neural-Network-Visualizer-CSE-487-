---
title: Neural Style Transfer API
emoji: 🎨
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Neural Style Transfer API

FastAPI backend for neural style transfer using PyTorch and VGG19.

## Features

- Style transfer processing with customizable parameters
- Gallery management for generated images
- User authentication and permission requests
- Image storage via Hugging Face datasets

## Environment Variables

Set these in the Hugging Face Space secrets:

- `HF_DATASET_REPO`: Your Hugging Face dataset repository (e.g., `username/style-transfer-data`)
- `HF_TOKEN`: Hugging Face access token with write permissions
- `MASTER_PASSWORD`: Master password for admin access
- `ADMIN_EMAIL`: Admin email for receiving permission request notifications
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `SMTP_HOST`: SMTP server host (optional, for email notifications)
- `SMTP_PORT`: SMTP server port (optional)
- `SMTP_USER`: SMTP username (optional)
- `SMTP_PASSWORD`: SMTP password (optional)
- `SMTP_FROM_EMAIL`: Email address to send from (optional)

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/transfer` - Create style transfer job (requires auth)
- `GET /api/transfer/{job_id}` - Get job status
- `GET /api/gallery` - List gallery items
- `GET /api/gallery/{item_id}` - Get gallery item
- `DELETE /api/gallery/{item_id}` - Delete gallery item (requires auth)
- `POST /api/auth/login` - Login
- `POST /api/auth/requests` - Submit permission request
- `GET /api/auth/requests` - List requests (admin only)
- `POST /api/auth/requests/{id}/approve` - Approve request (admin only)
- `POST /api/auth/requests/{id}/reject` - Reject request (admin only)
