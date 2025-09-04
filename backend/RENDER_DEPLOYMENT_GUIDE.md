# 🚀 Django Backend Deployment to Render - Step by Step Guide

## Prerequisites
- GitHub account with your code repository
- Render account (free tier available)
- Cloudinary account (for file storage)
- Paystack/Flutterwave account (for payments)

## Step 1: Prepare Your Repository

### 1.1 Push Your Code to GitHub
```bash
# If you haven't already, initialize git and push to GitHub
cd backend
git init
git add .
git commit -m "Initial commit for Render deployment"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

### 1.2 Verify Required Files
Make sure these files are in your `backend/` directory:
- ✅ `Procfile` - Tells Render how to run your app
- ✅ `requirements.txt` - Lists Python dependencies
- ✅ `runtime.txt` - Specifies Python version
- ✅ `build.sh` - Build script for deployment
- ✅ `manage.py` - Django management script

## Step 2: Set Up Cloudinary (File Storage)

### 2.1 Create Cloudinary Account
1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Go to your dashboard and note down:
   - Cloud Name
   - API Key
   - API Secret

### 2.2 Test Cloudinary Integration
Your app is already configured to use Cloudinary. The settings are in `core/settings.py`.

## Step 3: Set Up Payment Provider

### 3.1 Paystack Setup (Recommended)
1. Go to [paystack.com](https://paystack.com)
2. Create an account and get your API keys
3. Note down:
   - Secret Key (starts with `sk_`)
   - Public Key (starts with `pk_`)

### 3.2 Flutterwave Setup (Alternative)
1. Go to [flutterwave.com](https://flutterwave.com)
2. Create an account and get your API keys
3. Note down:
   - Secret Key (starts with `FLWSECK_`)
   - Public Key (starts with `FLWPUBK_`)
   - Encryption Key (starts with `FLWSECK_`)

## Step 4: Deploy to Render

### 4.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Connect your GitHub repository

### 4.2 Create a New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Choose your repository and branch (usually `main`)

### 4.3 Configure the Web Service
Fill in these settings:

**Basic Settings:**
- **Name**: `darra-backend` (or your preferred name)
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `backend` (important!)
- **Runtime**: `Python 3.11.7`

**Build & Deploy:**
- **Build Command**: `./build.sh`
- **Start Command**: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`

### 4.4 Add Environment Variables
Click "Environment" tab and add these variables:

**Required Variables:**
```
DJANGO_SECRET_KEY=your-super-secret-key-here-make-it-long-and-random
DEBUG=False
```

**Database (Auto-configured by Render):**
```
DATABASE_URL=postgresql://... (automatically set by Render)
```

**Cloudinary:**
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Paystack:**
```
PAYSTACK_SECRET_KEY=sk_live_your_live_secret_key
PAYSTACK_PUBLIC_KEY=pk_live_your_live_public_key
PAYMENT_PROVIDER=paystack
```

**Flutterwave (if using):**
```
FLUTTERWAVE_SECRET_KEY=FLWSECK_live_your_live_secret_key
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_live_your_live_public_key
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_live_your_live_encryption_key
PAYMENT_PROVIDER=flutterwave
```

**Email (Optional):**
```
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com
```

**Base URL:**
```
BASE_URL=https://your-app-name.onrender.com
```

### 4.5 Deploy
1. Click "Create Web Service"
2. Render will automatically:
   - Install dependencies
   - Run migrations
   - Collect static files
   - Start your application

## Step 5: Set Up Database (PostgreSQL)

### 5.1 Create PostgreSQL Database
1. In Render dashboard, click "New +" → "PostgreSQL"
2. Choose:
   - **Name**: `darra-database`
   - **Database**: `darra_app`
   - **User**: `darra_user`
   - **Region**: Same as your web service
3. Click "Create Database"

### 5.2 Connect Database to Web Service
1. Go to your web service settings
2. In "Environment" tab, you'll see `DATABASE_URL` is automatically set
3. If not, copy the `DATABASE_URL` from your PostgreSQL service

## Step 6: Configure CORS for Mobile App

### 6.1 Update CORS Settings
In your deployed app, the CORS settings will automatically use production mode. Update your mobile app to use the new backend URL:

```typescript
// In your mobile app's API configuration
const API_BASE_URL = 'https://your-app-name.onrender.com/api';
```

### 6.2 Update Mobile App API Endpoints
Make sure your mobile app points to the new Render URL instead of localhost.

## Step 7: Test Your Deployment

### 7.1 Check Health Endpoint
Visit: `https://your-app-name.onrender.com/api/`

### 7.2 Test API Endpoints
- Authentication: `POST /api/auth/login/`
- Products: `GET /api/products/`
- User registration: `POST /api/auth/register/`

### 7.3 Test File Uploads
Try uploading a product with an image to ensure Cloudinary integration works.

## Step 8: Set Up Custom Domain (Optional)

### 8.1 Add Custom Domain
1. In Render dashboard, go to your web service
2. Click "Settings" → "Custom Domains"
3. Add your domain (e.g., `api.yourdomain.com`)
4. Follow DNS configuration instructions

### 8.2 Update Environment Variables
```
BASE_URL=https://api.yourdomain.com
```

## Step 9: Monitor and Maintain

### 9.1 Monitor Logs
- Go to your web service in Render dashboard
- Click "Logs" tab to see real-time logs
- Monitor for errors and performance issues

### 9.2 Set Up Alerts
- Configure email alerts for deployment failures
- Monitor uptime and performance

### 9.3 Regular Updates
- Keep dependencies updated
- Monitor security updates
- Regular database backups

## Troubleshooting Common Issues

### Issue 1: Build Fails
**Solution**: Check build logs in Render dashboard. Common causes:
- Missing dependencies in `requirements.txt`
- Incorrect Python version in `runtime.txt`
- Build script errors

### Issue 2: Database Connection Errors
**Solution**: 
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running
- Ensure migrations ran successfully

### Issue 3: Static Files Not Loading
**Solution**:
- Verify `STATIC_ROOT` is set correctly
- Check `collectstatic` ran during build
- Ensure WhiteNoise is configured

### Issue 4: CORS Errors
**Solution**:
- Update `CORS_ALLOWED_ORIGINS` in settings
- Check mobile app is using correct API URL
- Verify CORS middleware is enabled

### Issue 5: File Upload Issues
**Solution**:
- Verify Cloudinary credentials are correct
- Check file size limits
- Ensure proper file type validation

## Security Checklist

- ✅ `DEBUG=False` in production
- ✅ Strong `DJANGO_SECRET_KEY`
- ✅ HTTPS enabled (automatic on Render)
- ✅ CORS properly configured
- ✅ Database credentials secure
- ✅ API keys stored as environment variables
- ✅ Security headers enabled

## Cost Optimization

### Free Tier Limits
- **Web Service**: 750 hours/month (free)
- **PostgreSQL**: 1GB storage (free)
- **Bandwidth**: 100GB/month (free)

### Upgrade When Needed
- Monitor usage in Render dashboard
- Upgrade to paid plans when you exceed limits
- Consider caching strategies for better performance

## Next Steps

1. **Set up monitoring**: Use services like Sentry for error tracking
2. **Implement caching**: Use Redis for better performance
3. **Set up CI/CD**: Automate deployments from GitHub
4. **Add SSL certificate**: For custom domains
5. **Implement backup strategy**: Regular database backups

## Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Django Deployment**: [docs.djangoproject.com/en/stable/howto/deployment/](https://docs.djangoproject.com/en/stable/howto/deployment/)
- **Cloudinary Documentation**: [cloudinary.com/documentation](https://cloudinary.com/documentation)

---

🎉 **Congratulations!** Your Django backend should now be successfully deployed to Render and accessible via HTTPS!
