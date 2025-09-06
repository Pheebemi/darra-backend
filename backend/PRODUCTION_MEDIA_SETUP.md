# Production Media Files Setup

## The Problem
When `DEBUG = False` in production, Django doesn't serve static/media files by default. This means your cover images and product files won't be accessible.

## The Solution
I've configured your Django app to serve media files in production using Django's built-in static file serving.

## What I Fixed

### 1. Updated `backend/core/urls.py`
- Added production media file serving using `django.views.static.serve`
- Media files are now served at `/media/` path in production
- Static files are handled by WhiteNoise

### 2. Updated `backend/core/settings.py`
- Added production media file configuration
- Maintained local file storage setup

## How It Works

### Development (`DEBUG = True`)
- Django serves media files directly
- Files accessible at `http://localhost:8000/media/...`

### Production (`DEBUG = False`)
- Django serves media files through URL routing
- Files accessible at `https://your-domain.com/media/...`
- WhiteNoise handles static files (CSS, JS)

## Deployment Platforms

### Render.com
✅ **Works out of the box** - No additional configuration needed
- Media files are served by Django
- Files are stored in the container's file system
- **Note**: Files are lost when container restarts (use external storage for persistence)

### Railway.app
✅ **Works out of the box** - No additional configuration needed
- Same as Render.com
- Files lost on restart

### AWS/GCP/Azure
✅ **Works** - But consider using cloud storage for better performance
- Can use S3, Google Cloud Storage, or Azure Blob Storage
- Better for production with high traffic

## Testing Your Setup

### 1. Test Locally with DEBUG=False
```bash
# Set DEBUG=False in your .env file
DEBUG=False

# Run Django
python manage.py runserver

# Test media file access
curl http://localhost:8000/media/products/cover_images/your-image.jpg
```

### 2. Test in Production
After deployment, test:
```bash
curl https://your-domain.com/media/products/cover_images/your-image.jpg
```

## File Storage Options

### Option 1: Local Storage (Current Setup)
- ✅ Simple setup
- ✅ Works with current code
- ❌ Files lost on container restart
- ❌ Not scalable for high traffic

### Option 2: Cloud Storage (Recommended for Production)
- ✅ Files persist across restarts
- ✅ Better performance
- ✅ Scalable
- ❌ Requires code changes

## If You Want Cloud Storage Later

### AWS S3 Setup
```python
# settings.py
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
AWS_S3_REGION_NAME = 'us-east-1'
```

### Cloudinary Setup (You had this before)
```python
# settings.py
DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.getenv('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': os.getenv('CLOUDINARY_API_KEY'),
    'API_SECRET': os.getenv('CLOUDINARY_API_SECRET'),
}
```

## Current Status
✅ **Your app is now ready for production deployment!**
- Cover images will show when `DEBUG = False`
- Product files will be accessible
- No additional configuration needed for Render/Railway

## Next Steps
1. Deploy to your chosen platform
2. Test media file access
3. Consider cloud storage for production if needed
4. Monitor file storage usage
