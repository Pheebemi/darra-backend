# Quick PythonAnywhere Deployment Steps

## 1. Push to GitHub
```bash
git add .
git commit -m "Prepare for PythonAnywhere deployment"
git push origin main
```

## 2. On PythonAnywhere

### Clone your repository:
```bash
cd /home/pheedev/
git clone https://github.com/Pheebemi/darra-backend.git
```

### Run the deployment script:
```bash
cd darra-backend/backend
chmod +x deploy_to_pythonanywhere.sh
./deploy_to_pythonanywhere.sh
```

### Configure Web App:
1. Go to **Web** tab in PythonAnywhere dashboard
2. Click **"Add a new web app"**
3. Choose **"Manual configuration"**
4. Select **Python 3.10** or **3.11**
5. In the WSGI configuration file, replace content with:
   ```python
   import os
   import sys
   
   path = '/home/pheedev/darra-backend/backend'
   if path not in sys.path:
       sys.path.append(path)
   
   os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
   
   from django.core.wsgi import get_wsgi_application
   application = get_wsgi_application()
   ```

### Configure Static Files:
- **URL:** `/static/`
- **Directory:** `/home/pheedev/darra-backend/backend/staticfiles`

- **URL:** `/media/`
- **Directory:** `/home/pheedev/darra-backend/backend/media`

## 3. Update Mobile App
In `mobile/lib/api/client.ts`, change:
```typescript
const BASE_URL = 'https://pheedev.pythonanywhere.com/api';
```

## 4. Test
- Visit: `https://pheedev.pythonanywhere.com`
- API: `https://pheedev.pythonanywhere.com/api/`
- Admin: `https://pheedev.pythonanywhere.com/admin/`
