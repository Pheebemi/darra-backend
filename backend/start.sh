#!/bin/bash
# Start script for Railway deployment

# Collect static files
python manage.py collectstatic --noinput

# Run database migrations
python manage.py migrate

# Start the application
exec gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
