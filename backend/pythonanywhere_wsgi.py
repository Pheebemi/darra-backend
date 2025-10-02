# This file contains the WSGI configuration required to serve up your
# web application at http://<your-username>.pythonanywhere.com/
# It works by setting the variable 'application' to a WSGI handler of some
# description.
#
# The below has been auto-generated for your Django project

import os
import sys

# add your project directory to the sys.path
path = '/home/pheedev/darra-backend/backend'
if path not in sys.path:
    sys.path.append(path)

# add the Django project directory to the sys.path
django_project_path = '/home/pheedev/darra-backend/backend'
if django_project_path not in sys.path:
    sys.path.append(django_project_path)

# tell Django where to find the settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# import the Django WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
