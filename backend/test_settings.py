"""
Test settings for PostgreSQL performance testing
Copy this to test_settings.py and run: python manage.py migrate --settings=test_settings
"""

import os
from .settings import *

# Override database settings for PostgreSQL testing
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'darra_test',
        'USER': 'postgres',  # or 'darra_test' if you created a user
        'PASSWORD': '12345678',  # Your PostgreSQL password
        'HOST': 'localhost',
        'PORT': '5432',
        'CONN_MAX_AGE': 60,  # Connection pooling
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}

# Disable Redis for testing (use local memory cache)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
            'CULL_FREQUENCY': 3,
        },
        'TIMEOUT': 300,
    }
}

# Disable Celery for testing
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Performance testing settings
DEBUG = False  # Disable debug for accurate performance testing
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}

print("🔧 Using PostgreSQL test database: darra_test")
