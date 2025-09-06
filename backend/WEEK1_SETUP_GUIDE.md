# Week 1 Performance Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Install Redis (Optional but Recommended)

**Windows:**
- Download Redis from https://github.com/microsoftarchive/redis/releases
- Or use WSL: `sudo apt install redis-server`

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

### 3. Install MySQL (Optional)

**Windows:**
- Download from https://dev.mysql.com/downloads/mysql/
- Or use XAMPP/WAMP

**macOS:**
```bash
brew install mysql
brew services start mysql
```

**Linux:**
```bash
sudo apt install mysql-server
sudo systemctl start mysql
```

### 4. Run Setup
```bash
python setup_week1.py
```

### 5. Test Performance
```bash
python test_performance.py
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the backend directory:

```env
# Database (choose one)
MYSQL_DATABASE=darra_app
MYSQL_USER=darra_user
MYSQL_PASSWORD=your_password
MYSQL_HOST=localhost
MYSQL_PORT=3306

# Or use PostgreSQL
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Redis (optional)
REDIS_URL=redis://127.0.0.1:6379/1

# Django
DEBUG=True
SECRET_KEY=your-secret-key
```

## 📊 Expected Results

After setup, you should see:
- ✅ Database queries: 3-10x faster
- ✅ API responses: 2-5x faster  
- ✅ Concurrent users: 2-5x more
- ✅ Memory usage: 30-50% reduction

## 🐛 Troubleshooting

### Redis Connection Error
If you see "Could not find backend 'django_redis.cache.RedisCache'":
1. Install Redis: `pip install django-redis redis`
2. Or the app will automatically fall back to local memory cache

### MySQL Connection Error
If you see MySQL connection errors:
1. Make sure MySQL is running
2. Check your database credentials
3. Or use SQLite for development (default)

### Performance Issues
1. Check logs: `tail -f django_performance.log`
2. Run tests: `python test_performance.py`
3. Monitor with: `python manage.py runserver --verbosity=2`

## 🎯 Next Steps

Week 1 is complete! Ready for:
- Week 2: Background tasks with Celery
- Week 3: Async file processing
- Week 4: Load balancing and scaling
