"""
Entry point for Hugging Face Spaces deployment.
This file simply imports and exposes the FastAPI app from main.py.
"""
from main import app

# The app is already configured in main.py
# Hugging Face Spaces will automatically detect and serve this FastAPI app
#filler