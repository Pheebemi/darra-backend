#!/bin/bash

# PythonAnywhere Deployment Script
# Run this script on PythonAnywhere after uploading your code

echo "🚀 Starting PythonAnywhere deployment..."

# Navigate to project directory
cd /home/pheedev/darra-backend/backend

# Pull latest changes from GitHub (optional)
echo "📥 Pulling latest changes from GitHub..."
git pull origin master

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3.10 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Run migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser (optional)
echo "👤 Creating superuser (optional)..."
echo "You can skip this by pressing Ctrl+C"
python manage.py createsuperuser

echo "✅ Deployment complete!"
echo "🌐 Your app should now be available at: https://pheedev.pythonanywhere.com"
echo "📊 Admin panel: https://pheedev.pythonanywhere.com/admin"
echo "🔗 API endpoints: https://pheedev.pythonanywhere.com/api"
