@echo off
echo Starting Darra App with Celery...
echo.

REM Start Celery worker in background
echo Starting Celery worker...
start "Celery Worker" cmd /k "cd /d %~dp0 && python start_celery.py worker"

REM Wait a moment for Celery to start
timeout /t 3 /nobreak > nul

REM Start Django server
echo Starting Django server...
python manage.py runserver

pause
