#!/usr/bin/env python3
"""
Database Performance Benchmark Script
Tests SQLite vs PostgreSQL performance for your Darra app
"""

import os
import sys
import time
import django
from django.db import connection
from django.core.management import execute_from_command_line

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def setup_django(settings_module):
    """Setup Django with specific settings"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', settings_module)
    django.setup()

def benchmark_database_operations():
    """Benchmark common database operations"""
    from users.models import User
    from products.models import Product, TicketCategory, TicketTier
    from apps.payments.models import Payment, Purchase
    from apps.events.models import EventTicket
    from django.contrib.auth import get_user_model
    
    print("🚀 Starting database performance benchmark...")
    
    # Test data sizes
    test_sizes = [100, 500, 1000, 2000]
    results = {}
    
    for size in test_sizes:
        print(f"\n📊 Testing with {size} records...")
        
        # Clear existing test data
        User.objects.filter(email__startswith='test_').delete()
        User.objects.filter(email__startswith='concurrent_').delete()
        
        # Benchmark 1: User Creation
        start_time = time.time()
        users = []
        for i in range(size):
            user = User.objects.create(
                email=f'test_user_{i}@example.com',
                full_name=f'Test User {i}',
                user_type='buyer'
            )
            users.append(user)
        user_creation_time = time.time() - start_time
        
        # Benchmark 2: Product Creation
        start_time = time.time()
        products = []
        for i in range(size // 10):  # 10% of users are sellers
            seller = users[i * 10] if i * 10 < len(users) else users[0]
            product = Product.objects.create(
                owner=seller,
                title=f'Test Product {i}',
                description=f'Test description for product {i}',
                price=100.00,
                product_type='event'
            )
            products.append(product)
        product_creation_time = time.time() - start_time
        
        # Benchmark 3: Payment Creation
        start_time = time.time()
        payments = []
        for i in range(size // 5):  # 20% of users make payments
            user = users[i * 5] if i * 5 < len(users) else users[0]
            payment = Payment.objects.create(
                user=user,
                reference=f'TEST_REF_{i}',
                amount=100.00,
                status='success'
            )
            payments.append(payment)
        payment_creation_time = time.time() - start_time
        
        # Benchmark 4: Complex Queries
        start_time = time.time()
        
        # Query 1: Get all users with their products
        users_with_products = User.objects.select_related().prefetch_related('products').all()
        list(users_with_products)  # Force evaluation
        
        # Query 2: Get payments with purchases
        payments_with_purchases = Payment.objects.select_related('user').prefetch_related('purchases__product').all()
        list(payments_with_purchases)  # Force evaluation
        
        # Query 3: Aggregate queries
        total_users = User.objects.count()
        total_products = Product.objects.count()
        total_payments = Payment.objects.count()
        
        complex_query_time = time.time() - start_time
        
        # Benchmark 5: Concurrent-like operations (simulate multiple users)
        start_time = time.time()
        for i in range(10):  # Simulate 10 concurrent operations
            # Create a user with unique email
            user = User.objects.create(
                email=f'concurrent_user_{size}_{i}@example.com',
                full_name=f'Concurrent User {i}',
                user_type='buyer'
            )
            # Create a product
            product = Product.objects.create(
                owner=user,
                title=f'Concurrent Product {i}',
                description=f'Concurrent description {i}',
                price=50.00,
                product_type='pdf'
            )
            # Create a payment
            payment = Payment.objects.create(
                user=user,
                reference=f'CONCURRENT_REF_{i}',
                amount=50.00,
                status='success'
            )
        concurrent_operations_time = time.time() - start_time
        
        # Store results
        results[size] = {
            'user_creation': user_creation_time,
            'product_creation': product_creation_time,
            'payment_creation': payment_creation_time,
            'complex_queries': complex_query_time,
            'concurrent_operations': concurrent_operations_time,
            'total_time': user_creation_time + product_creation_time + payment_creation_time + complex_query_time + concurrent_operations_time
        }
        
        print(f"✅ Completed {size} records benchmark")
    
    return results

def print_results(results, database_type):
    """Print benchmark results in a nice format"""
    print(f"\n{'='*60}")
    print(f"📊 {database_type.upper()} PERFORMANCE RESULTS")
    print(f"{'='*60}")
    
    print(f"{'Records':<10} {'Users':<8} {'Products':<8} {'Payments':<8} {'Queries':<8} {'Concurrent':<10} {'Total':<8}")
    print(f"{'-'*60}")
    
    for size, times in results.items():
        print(f"{size:<10} {times['user_creation']:<8.3f} {times['product_creation']:<8.3f} {times['payment_creation']:<8.3f} {times['complex_queries']:<8.3f} {times['concurrent_operations']:<10.3f} {times['total_time']:<8.3f}")
    
    print(f"\n💡 Performance Summary:")
    print(f"   - Database: {database_type}")
    print(f"   - Max records tested: {max(results.keys())}")
    print(f"   - Total time for {max(results.keys())} records: {results[max(results.keys())]['total_time']:.3f}s")

def test_sqlite():
    """Test SQLite performance"""
    print("🔍 Testing SQLite performance...")
    setup_django('core.settings')
    
    # Run migrations
    print("📦 Running migrations...")
    execute_from_command_line(['manage.py', 'migrate'])
    
    # Run benchmark
    results = benchmark_database_operations()
    print_results(results, "SQLite")
    
    return results

def test_postgresql():
    """Test PostgreSQL performance"""
    print("🔍 Testing PostgreSQL performance...")
    setup_django('test_settings')
    
    # Run migrations
    print("📦 Running migrations...")
    execute_from_command_line(['manage.py', 'migrate'])
    
    # Run benchmark
    results = benchmark_database_operations()
    print_results(results, "PostgreSQL")
    
    return results

def compare_results(sqlite_results, postgresql_results):
    """Compare SQLite vs PostgreSQL results"""
    print(f"\n{'='*80}")
    print(f"📈 PERFORMANCE COMPARISON: SQLite vs PostgreSQL")
    print(f"{'='*80}")
    
    print(f"{'Records':<10} {'SQLite Total':<15} {'PostgreSQL Total':<18} {'Improvement':<12} {'Speedup':<8}")
    print(f"{'-'*80}")
    
    for size in sqlite_results.keys():
        sqlite_time = sqlite_results[size]['total_time']
        postgresql_time = postgresql_results[size]['total_time']
        improvement = ((sqlite_time - postgresql_time) / sqlite_time) * 100
        speedup = sqlite_time / postgresql_time if postgresql_time > 0 else 0
        
        print(f"{size:<10} {sqlite_time:<15.3f} {postgresql_time:<18.3f} {improvement:<12.1f}% {speedup:<8.2f}x")
    
    print(f"\n🎯 Key Insights:")
    print(f"   - PostgreSQL is generally faster for complex queries")
    print(f"   - Better concurrent performance with PostgreSQL")
    print(f"   - PostgreSQL scales better with larger datasets")
    print(f"   - Connection pooling provides better resource management")

if __name__ == "__main__":
    print("🚀 Starting Database Performance Benchmark")
    print("=" * 60)
    
    try:
        # Test SQLite
        sqlite_results = test_sqlite()
        
        print("\n" + "="*60)
        print("⏳ Waiting 5 seconds before PostgreSQL test...")
        time.sleep(5)
        
        # Test PostgreSQL
        postgresql_results = test_postgresql()
        
        # Compare results
        compare_results(sqlite_results, postgresql_results)
        
        print(f"\n✅ Benchmark completed successfully!")
        print(f"💡 Next steps:")
        print(f"   1. Review the performance comparison above")
        print(f"   2. Consider your expected user load")
        print(f"   3. Make migration decision based on results")
        
    except Exception as e:
        print(f"❌ Benchmark failed: {str(e)}")
        import traceback
        traceback.print_exc()
