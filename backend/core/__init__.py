import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import Celery app to ensure it's loaded when Django starts
# Commented out for PythonAnywhere deployment - Celery not needed for basic functionality
# from .celery import app as celery_app

# __all__ = ('celery_app',)
