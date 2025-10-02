# PythonAnywhere Deployment Guide

This guide will help you deploy your Django backend to PythonAnywhere.

## Prerequisites

1. A PythonAnywhere account (free tier available)
2. Your Django project ready for deployment

## Step 1: Upload Your Code via GitHub

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for PythonAnywhere deployment"
   git push origin main
   ```

2. **Clone your repository on PythonAnywhere:**
   - Open a Bash console in PythonAnywhere
   - Navigate to your home directory: `cd /home/yourusername/`
   - Clone your repository: `git clone https://github.com/yourusername/darra-app.git`

## Step 2: Set Up Virtual Environment

1. **Open a Bash console** in PythonAnywhere
2. **Navigate to your project:**
   ```bash
   cd /home/yourusername/darra-app/backend
   ```

3. **Create a virtual environment:**
   ```bash
   python3.10 -m venv venv
   # or
   python3.11 -m venv venv
   ```

4. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate
   ```

5. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Step 3: Set Up Database

### Option A: Use SQLite (Easiest for free tier)
Your current settings already support SQLite, so no changes needed.

### Option B: Use MySQL (Recommended for production)
1. **Create a MySQL database:**
   - Go to the Databases tab
   - Create a new MySQL database
   - Note down the database name, username, and password

2. **Set environment variables:**
   ```bash
   # In your Bash console
   export MYSQL_DATABASE="your_database_name"
   export MYSQL_USER="your_username"
   export MYSQL_PASSWORD="your_password"
   export MYSQL_HOST="yourusername.mysql.pythonanywhere-services.com"
   export MYSQL_PORT="3306"
   ```

## Step 4: Configure Environment Variables

1. **Create a .env file in your backend directory:**
   ```bash
   cd /home/yourusername/darra-app/backend
   nano .env
   ```

2. **Add the following content:**
   ```env
   DEBUG=False
   DJANGO_SECRET_KEY=your-super-secret-key-here
   MYSQL_DATABASE=your_database_name
   MYSQL_USER=your_username
   MYSQL_PASSWORD=your_password
   MYSQL_HOST=yourusername.mysql.pythonanywhere-services.com
   MYSQL_PORT=3306
   ```

## Step 5: Run Migrations

1. **Activate your virtual environment:**
   ```bash
   source venv/bin/activate
   ```

2. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

3. **Create a superuser:**
   ```bash
   python manage.py createsuperuser
   ```

4. **Collect static files:**
   ```bash
   python manage.py collectstatic --noinput
   ```

## Step 6: Configure Web App

1. **Go to the Web tab** in your PythonAnywhere dashboard
2. **Click "Add a new web app"**
3. **Choose "Manual configuration"**
4. **Select Python version** (3.10 or 3.11)
5. **In the WSGI configuration file:**
   - Replace the default content with the content from `pythonanywhere_wsgi.py`
   - Update the username in the paths to match your PythonAnywhere username

## Step 7: Configure Static Files

1. **In the Web tab, go to Static files section:**
   - URL: `/static/`
   - Directory: `/home/yourusername/darra-app/backend/staticfiles`

2. **For media files:**
   - URL: `/media/`
   - Directory: `/home/yourusername/darra-app/backend/media`

## Step 8: Update Mobile App API URL

1. **Update your mobile app's API client:**
   - Open `mobile/lib/api/client.ts`
   - Change the BASE_URL to: `https://yourusername.pythonanywhere.com/api`

## Step 9: Test Your Deployment

1. **Visit your web app URL:** `https://yourusername.pythonanywhere.com`
2. **Test the API endpoints:**
   - `https://yourusername.pythonanywhere.com/api/`
   - `https://yourusername.pythonanywhere.com/admin/`

## Troubleshooting

### Common Issues:

1. **Import errors:** Make sure your virtual environment is activated and dependencies are installed
2. **Database errors:** Check your database configuration and ensure migrations are run
3. **Static files not loading:** Verify static files configuration in the Web tab
4. **CORS errors:** Make sure your mobile app URL is in ALLOWED_HOSTS

### Logs:
- Check the error log in the Web tab for detailed error messages
- Use the Bash console to run Django commands and see output

## Free Tier Limitations

- **CPU seconds:** 100,000 per month
- **Disk space:** 1GB
- **Always-on tasks:** Not available (your app will sleep after inactivity)
- **Custom domains:** Not available

## Upgrading to Paid Plan

For production use, consider upgrading to a paid plan for:
- Always-on tasks (Celery workers)
- More CPU seconds
- Custom domains
- More disk space

## Security Notes

1. **Never commit your .env file** to version control
2. **Use strong secret keys** in production
3. **Set DEBUG=False** in production
4. **Use HTTPS** for all API calls
5. **Regularly update dependencies** for security patches
