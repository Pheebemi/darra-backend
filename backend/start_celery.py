#!/usr/bin/env python3
"""
Start Celery worker and beat scheduler for Darra app
"""
import os
import sys
import subprocess

def start_celery_worker():
    """Start Celery worker"""
    print("🚀 Starting Celery worker...")
    cmd = [
        'celery', '-A', 'core', 'worker',
        '--loglevel=info',
        '--concurrency=4',
        '--queues=ticket_generation,payment_processing,notifications'
    ]
    subprocess.run(cmd)

def start_celery_beat():
    """Start Celery beat scheduler"""
    print("⏰ Starting Celery beat scheduler...")
    cmd = [
        'celery', '-A', 'core', 'beat',
        '--loglevel=info',
        '--scheduler=django_celery_beat.schedulers:DatabaseScheduler'
    ]
    subprocess.run(cmd)

def start_celery_flower():
    """Start Celery Flower monitoring"""
    print("🌸 Starting Celery Flower monitoring...")
    cmd = ['celery', '-A', 'core', 'flower', '--port=5555']
    subprocess.run(cmd)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'worker':
            start_celery_worker()
        elif command == 'beat':
            start_celery_beat()
        elif command == 'flower':
            start_celery_flower()
        else:
            print("Usage: python start_celery.py [worker|beat|flower]")
    else:
        print("🚀 Starting Celery worker and beat...")
        print("Use 'python start_celery.py worker' for worker only")
        print("Use 'python start_celery.py beat' for beat only")
        print("Use 'python start_celery.py flower' for monitoring")
