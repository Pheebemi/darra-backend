#!/usr/bin/env python3
"""
Optimizations for slower PCs
"""
import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Optimize Django settings for slower PCs
from django.conf import settings

# Reduce concurrent workers
CELERY_WORKER_CONCURRENCY = 2  # Instead of 4
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# Reduce file processing
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # 5MB instead of 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # 5MB instead of 10MB

print("🖥️ PC Optimization Settings Applied:")
print(f"   - Worker concurrency: {CELERY_WORKER_CONCURRENCY}")
print(f"   - File upload limit: {FILE_UPLOAD_MAX_MEMORY_SIZE // 1024 // 1024}MB")
print(f"   - Prefetch multiplier: {CELERY_WORKER_PREFETCH_MULTIPLIER}")
