# 🚀 Django Backend Deployment to Railway - FREE (No Credit Card Required!)

## Why Railway?
- ✅ **100% FREE** - No credit card required
- ✅ **Easy deployment** - Just connect GitHub
- ✅ **PostgreSQL included** - Free database
- ✅ **Custom domains** - Free subdomain
- ✅ **Great for Django** - Excellent Python support

## Step 1: Prepare Your Repository

### 1.1 Push Your Code to GitHub
```bash
cd backend
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

## Step 2: Deploy to Railway

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your repositories

### 2.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Select the `backend` folder as root directory

### 2.3 Configure Environment Variables
Click on your service → "Variables" tab and add:

**Required Variables:**
```
DJANGO_SECRET_KEY=your-secure-secret-key-here
DEBUG=False
```

**Cloudinary (for file storage):**
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

**Base URL:**
```
BASE_URL=https://your-app-name.railway.app
```

### 2.4 Add PostgreSQL Database
1. Click "New" → "Database" → "PostgreSQL"
2. Railway will automatically set `DATABASE_URL`
3. Your app will automatically connect to it

## Step 3: Update for Railway

### 3.1 Create Railway-specific files

**Create `railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "gunicorn core.wsgi:application --bind 0.0.0.0:$PORT",
    "healthcheckPath": "/api/",
    "healthcheckTimeout": 100
  }
}
```

**Update `requirements.txt` (already done):**
```
gunicorn>=21.2.0
whitenoise>=6.6.0
dj-database-url>=2.1.0
```

## Step 4: Deploy!

1. Railway will automatically:
   - Install dependencies
   - Run migrations
   - Start your app
2. Your app will be available at: `https://your-app-name.railway.app`

## Step 5: Test Your Deployment

### 5.1 Check Health
Visit: `https://your-app-name.railway.app/api/`

### 5.2 Test Endpoints
- Authentication: `POST /api/auth/login/`
- Products: `GET /api/products/`
- User registration: `POST /api/auth/register/`

## Step 6: Update Mobile App

Update your mobile app's API configuration:
```typescript
const API_BASE_URL = 'https://your-app-name.railway.app/api';
```

## Railway vs Render Comparison

| Feature | Railway | Render |
|---------|---------|---------|
| Free Tier | ✅ No credit card | ❌ Requires card |
| PostgreSQL | ✅ Free | ✅ Free |
| Custom Domain | ✅ Free | ✅ Free |
| Deployment | ✅ Easy | ✅ Easy |
| Performance | ✅ Great | ✅ Great |

## Troubleshooting

### Issue 1: Build Fails
**Solution**: Check Railway logs in dashboard

### Issue 2: Database Connection
**Solution**: Verify `DATABASE_URL` is set automatically

### Issue 3: Static Files
**Solution**: WhiteNoise is already configured

## Cost: $0/month! 🎉

Railway's free tier includes:
- Unlimited deployments
- 500 hours of usage
- 1GB RAM
- Free PostgreSQL database
- Free custom domain

---

🎉 **Congratulations!** Your Django backend is now deployed for FREE on Railway!


