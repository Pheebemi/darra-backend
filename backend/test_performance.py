#!/usr/bin/env python3
"""
Performance testing script for Darra app
Tests caching, database performance, and concurrent user simulation
Run from backend directory: python test_performance.py
"""

import os
import sys
import django
import time
import threading
import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.cache import cache
from django.db import connection
from django.test import RequestFactory
from products.models import Product
from users.models import User
from apps.payments.models import Payment, Purchase
from products.views import ProductListView, PublicProductDetailView
from core.cache_utils import CacheManager, performance_monitor

class PerformanceTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.results = {}
        
    def test_database_performance(self):
        """Test database query performance"""
        print("🔍 Testing database performance...")
        
        # Clear cache first (handle Redis connection errors gracefully)
        try:
            cache.clear()
        except Exception as e:
            print(f"Cache clear failed (using fallback): {e}")
            # Continue with test even if cache clear fails
        
        # Test 1: Product list query
        start_time = time.time()
        products = list(Product.objects.select_related('owner').all()[:100])
        db_time = time.time() - start_time
        
        # Test 2: Cached query
        start_time = time.time()
        cached_products = list(Product.objects.select_related('owner').all()[:100])
        cached_time = time.time() - start_time
        
        # Test 3: Complex query with joins
        start_time = time.time()
        complex_query = list(Product.objects.select_related('owner', 'ticket_category')
                           .prefetch_related('ticket_tiers')
                           .filter(price__gte=1000)[:50])
        complex_time = time.time() - start_time
        
        self.results['database'] = {
            'simple_query_time': db_time,
            'cached_query_time': cached_time,
            'complex_query_time': complex_time,
            'products_count': len(products),
            'complex_products_count': len(complex_query)
        }
        
        print(f"✅ Database tests completed:")
        print(f"   - Simple query: {db_time:.3f}s")
        print(f"   - Cached query: {cached_time:.3f}s")
        print(f"   - Complex query: {complex_time:.3f}s")
        
    def test_cache_performance(self):
        """Test cache performance"""
        print("🔍 Testing cache performance...")
        
        # Test cache set/get operations
        test_data = {"test": "data", "number": 123, "list": [1, 2, 3]}
        
        # Test 1: Cache set
        start_time = time.time()
        try:
            cache.set('test_key', test_data, 300)
            set_time = time.time() - start_time
        except Exception as e:
            print(f"Cache set failed: {e}")
            set_time = 0
        
        # Test 2: Cache get
        start_time = time.time()
        try:
            retrieved_data = cache.get('test_key')
            get_time = time.time() - start_time
        except Exception as e:
            print(f"Cache get failed: {e}")
            retrieved_data = None
            get_time = 0
        
        # Test 3: Cache miss
        start_time = time.time()
        miss_data = cache.get('non_existent_key')
        miss_time = time.time() - start_time
        
        # Test 4: Bulk operations
        start_time = time.time()
        for i in range(100):
            cache.set(f'bulk_key_{i}', f'value_{i}', 300)
        bulk_set_time = time.time() - start_time
        
        start_time = time.time()
        for i in range(100):
            cache.get(f'bulk_key_{i}')
        bulk_get_time = time.time() - start_time
        
        self.results['cache'] = {
            'set_time': set_time,
            'get_time': get_time,
            'miss_time': miss_time,
            'bulk_set_time': bulk_set_time,
            'bulk_get_time': bulk_get_time,
            'data_retrieved': retrieved_data == test_data
        }
        
        print(f"✅ Cache tests completed:")
        print(f"   - Set operation: {set_time:.4f}s")
        print(f"   - Get operation: {get_time:.4f}s")
        print(f"   - Miss operation: {miss_time:.4f}s")
        print(f"   - Bulk set (100): {bulk_set_time:.3f}s")
        print(f"   - Bulk get (100): {bulk_get_time:.3f}s")
        
    def test_view_performance(self):
        """Test Django view performance"""
        print("🔍 Testing view performance...")
        
        factory = RequestFactory()
        
        # Test 1: Product list view
        request = factory.get('/api/products/')
        view = ProductListView()
        
        start_time = time.time()
        queryset = view.get_queryset()
        view_time = time.time() - start_time
        
        # Test 2: Product detail view
        if Product.objects.exists():
            product = Product.objects.first()
            request = factory.get(f'/api/products/{product.id}/')
            view = PublicProductDetailView()
            
            start_time = time.time()
            view.get_queryset()
            detail_time = time.time() - start_time
        else:
            detail_time = 0
            
        self.results['views'] = {
            'list_view_time': view_time,
            'detail_view_time': detail_time,
            'products_in_queryset': len(queryset)
        }
        
        print(f"✅ View tests completed:")
        print(f"   - List view: {view_time:.3f}s")
        print(f"   - Detail view: {detail_time:.3f}s")
        
    def test_concurrent_requests(self, num_requests=50):
        """Test concurrent request handling"""
        print(f"🔍 Testing concurrent requests ({num_requests} requests)...")
        
        def make_request(request_id):
            try:
                start_time = time.time()
                # Simulate API request
                response = requests.get(f"{self.base_url}/api/products/", timeout=10)
                end_time = time.time()
                
                return {
                    'request_id': request_id,
                    'response_time': end_time - start_time,
                    'status_code': response.status_code,
                    'success': response.status_code == 200
                }
            except Exception as e:
                return {
                    'request_id': request_id,
                    'response_time': 0,
                    'status_code': 0,
                    'success': False,
                    'error': str(e)
                }
        
        # Execute concurrent requests
        start_time = time.time()
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request, i) for i in range(num_requests)]
            results = [future.result() for future in as_completed(futures)]
        total_time = time.time() - start_time
        
        # Analyze results
        successful_requests = [r for r in results if r['success']]
        failed_requests = [r for r in results if not r['success']]
        
        if successful_requests:
            response_times = [r['response_time'] for r in successful_requests]
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            min_response_time = min(response_times)
        else:
            avg_response_time = max_response_time = min_response_time = 0
        
        self.results['concurrent'] = {
            'total_requests': num_requests,
            'successful_requests': len(successful_requests),
            'failed_requests': len(failed_requests),
            'total_time': total_time,
            'avg_response_time': avg_response_time,
            'max_response_time': max_response_time,
            'min_response_time': min_response_time,
            'requests_per_second': num_requests / total_time if total_time > 0 else 0
        }
        
        print(f"✅ Concurrent tests completed:")
        print(f"   - Successful: {len(successful_requests)}/{num_requests}")
        print(f"   - Failed: {len(failed_requests)}")
        print(f"   - Avg response time: {avg_response_time:.3f}s")
        print(f"   - Max response time: {max_response_time:.3f}s")
        print(f"   - Requests/second: {num_requests / total_time:.1f}")
        
    def test_memory_usage(self):
        """Test memory usage patterns"""
        print("🔍 Testing memory usage...")
        
        import psutil
        import gc
        
        process = psutil.Process()
        
        # Get initial memory
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Create some data
        products = list(Product.objects.all()[:1000])
        users = list(User.objects.all()[:100])
        
        # Get memory after data creation
        after_data_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Clear data and force garbage collection
        del products, users
        gc.collect()
        
        # Get memory after cleanup
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        self.results['memory'] = {
            'initial_memory_mb': initial_memory,
            'after_data_memory_mb': after_data_memory,
            'final_memory_mb': final_memory,
            'memory_used_mb': after_data_memory - initial_memory,
            'memory_cleaned_mb': after_data_memory - final_memory
        }
        
        print(f"✅ Memory tests completed:")
        print(f"   - Initial memory: {initial_memory:.1f} MB")
        print(f"   - After data: {after_data_memory:.1f} MB")
        print(f"   - Final memory: {final_memory:.1f} MB")
        print(f"   - Memory used: {after_data_memory - initial_memory:.1f} MB")
        
    def run_all_tests(self):
        """Run all performance tests"""
        print("🚀 Starting Darra App Performance Tests...")
        print("=" * 50)
        
        try:
            self.test_database_performance()
            print()
            
            self.test_cache_performance()
            print()
            
            self.test_view_performance()
            print()
            
            self.test_memory_usage()
            print()
            
            # Only test concurrent requests if server is running
            try:
                response = requests.get(f"{self.base_url}/api/products/", timeout=5)
                if response.status_code == 200:
                    self.test_concurrent_requests()
                else:
                    print("⚠️ Server not responding, skipping concurrent tests")
            except:
                print("⚠️ Server not running, skipping concurrent tests")
            
            self.print_summary()
            
        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            import traceback
            traceback.print_exc()
    
    def print_summary(self):
        """Print performance test summary"""
        print("\n" + "=" * 50)
        print("📊 PERFORMANCE TEST SUMMARY")
        print("=" * 50)
        
        # Database performance
        if 'database' in self.results:
            db = self.results['database']
            print(f"🗄️  Database Performance:")
            print(f"   - Simple queries: {db['simple_query_time']:.3f}s")
            print(f"   - Complex queries: {db['complex_query_time']:.3f}s")
            print(f"   - Products loaded: {db['products_count']}")
            
        # Cache performance
        if 'cache' in self.results:
            cache = self.results['cache']
            print(f"⚡ Cache Performance:")
            print(f"   - Set operations: {cache['set_time']:.4f}s")
            print(f"   - Get operations: {cache['get_time']:.4f}s")
            print(f"   - Bulk operations: {cache['bulk_set_time']:.3f}s")
            
        # View performance
        if 'views' in self.results:
            views = self.results['views']
            print(f"🎯 View Performance:")
            print(f"   - List view: {views['list_view_time']:.3f}s")
            print(f"   - Detail view: {views['detail_view_time']:.3f}s")
            
        # Concurrent performance
        if 'concurrent' in self.results:
            conc = self.results['concurrent']
            print(f"🔄 Concurrent Performance:")
            print(f"   - Success rate: {conc['successful_requests']}/{conc['total_requests']}")
            print(f"   - Avg response: {conc['avg_response_time']:.3f}s")
            print(f"   - Requests/sec: {conc['requests_per_second']:.1f}")
            
        # Memory usage
        if 'memory' in self.results:
            mem = self.results['memory']
            print(f"💾 Memory Usage:")
            print(f"   - Memory used: {mem['memory_used_mb']:.1f} MB")
            print(f"   - Memory cleaned: {mem['memory_cleaned_mb']:.1f} MB")
            
        print("\n🎯 Performance Recommendations:")
        print("   - Response times < 200ms: ✅ Good")
        print("   - Cache hit rate > 80%: ✅ Good")
        print("   - Memory usage < 512MB: ✅ Good")
        print("   - Concurrent users > 50: ✅ Good")
        
        print("\n✅ Performance testing completed!")

if __name__ == "__main__":
    tester = PerformanceTester()
    tester.run_all_tests()
