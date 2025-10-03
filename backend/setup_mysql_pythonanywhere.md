# MySQL Setup for PythonAnywhere

## Step 1: Create MySQL Database on PythonAnywhere

1. **Go to the "Databases" tab** in your PythonAnywhere dashboard
2. **Click "Create a new database"**
3. **Choose a database name** (e.g., `pheedev_darra_db`)
4. **Note down the credentials:**
   - Database name: `pheedev_darra_db`
   - Username: `pheedev`
   - Password: (generated password)
   - Host: `pheedev.mysql.pythonanywhere-services.com`

## Step 2: Update Environment Variables

Create a `.env` file in your backend directory:

```env
DEBUG=False
DJANGO_SECRET_KEY=your-super-secret-key-here
MYSQL_DATABASE=pheedev_darra_db
MYSQL_USER=pheedev
MYSQL_PASSWORD=your-generated-password
MYSQL_HOST=pheedev.mysql.pythonanywhere-services.com
MYSQL_PORT=3306
```

## Step 3: Update Django Settings

Your current `settings.py` already supports MySQL! It will automatically use MySQL when these environment variables are set.

## Step 4: Run Migrations

```bash
cd /home/pheedev/darra-backend/backend
source venv/bin/activate
python manage.py migrate
```

## Step 5: Create Superuser

```bash
python manage.py createsuperuser
```

## Step 6: Test Database Connection

```bash
python manage.py dbshell
```

If you can connect, you're all set!
