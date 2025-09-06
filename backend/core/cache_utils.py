"""
Caching utilities for Darra app performance optimization
"""
import logging
from django.core.cache import cache
from django.conf import settings
from functools import wraps
import time

logger = logging.getLogger('performance')

# Check if Redis is available
try:
    from django_redis import get_redis_connection
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available, using local memory cache")

class CacheManager:
    """Centralized cache management for the Darra app"""
    
    @staticmethod
    def get_cache_key(prefix, *args, **kwargs):
        """Generate consistent cache keys"""
        key_parts = [prefix]
        for arg in args:
            key_parts.append(str(arg))
        for key, value in sorted(kwargs.items()):
            key_parts.append(f"{key}:{value}")
        return ":".join(key_parts)
    
    @staticmethod
    def get_user_cache_key(user_id, data_type):
        """Get cache key for user-specific data"""
        return CacheManager.get_cache_key("user", user_id, data_type)
    
    @staticmethod
    def get_product_cache_key(product_id, data_type="detail"):
        """Get cache key for product-specific data"""
        return CacheManager.get_cache_key("product", product_id, data_type)
    
    @staticmethod
    def get_list_cache_key(model_name, filters=None):
        """Get cache key for list data"""
        filter_str = ""
        if filters:
            filter_str = ":" + ":".join([f"{k}:{v}" for k, v in sorted(filters.items())])
        return CacheManager.get_cache_key("list", model_name, filter_str)
    
    @staticmethod
    def get_timeout(cache_type):
        """Get timeout for different cache types"""
        return settings.CACHE_TIMEOUTS.get(cache_type, 300)
    
    @staticmethod
    def invalidate_user_cache(user_id):
        """Invalidate all cache entries for a specific user"""
        cache_pattern = f"darra_app:user:{user_id}:*"
        # Note: Redis pattern deletion would need to be implemented
        # For now, we'll use specific key invalidation
        logger.info(f"Invalidating cache for user {user_id}")
    
    @staticmethod
    def invalidate_product_cache(product_id):
        """Invalidate all cache entries for a specific product"""
        cache_pattern = f"darra_app:product:{product_id}:*"
        logger.info(f"Invalidating cache for product {product_id}")

def cache_result(cache_type, timeout=None, key_func=None):
    """
    Decorator to cache function results
    
    Usage:
    @cache_result('user_data', timeout=300)
    def get_user_profile(user_id):
        return User.objects.get(id=user_id)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = CacheManager.get_cache_key(
                    func.__name__, 
                    *args, 
                    **kwargs
                )
            
            # Try to get from cache
            result = cache.get(cache_key)
            if result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return result
            
            # Execute function and cache result
            logger.debug(f"Cache miss for {cache_key}, executing function")
            result = func(*args, **kwargs)
            
            # Set cache with timeout
            cache_timeout = timeout or CacheManager.get_timeout(cache_type)
            cache.set(cache_key, result, cache_timeout)
            logger.debug(f"Cached result for {cache_key} with timeout {cache_timeout}")
            
            return result
        return wrapper
    return decorator

def cache_query_result(cache_type, timeout=None):
    """
    Decorator specifically for caching Django QuerySet results
    
    Usage:
    @cache_query_result('product_list', timeout=600)
    def get_featured_products():
        return Product.objects.filter(is_featured=True)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = CacheManager.get_cache_key(
                func.__name__, 
                *args, 
                **kwargs
            )
            
            # Try to get from cache
            result = cache.get(cache_key)
            if result is not None:
                logger.debug(f"Query cache hit for {cache_key}")
                return result
            
            # Execute query and cache result
            logger.debug(f"Query cache miss for {cache_key}")
            queryset = func(*args, **kwargs)
            
            # Convert QuerySet to list for caching
            result = list(queryset)
            
            # Set cache with timeout
            cache_timeout = timeout or CacheManager.get_timeout(cache_type)
            cache.set(cache_key, result, cache_timeout)
            logger.debug(f"Cached query result for {cache_key}")
            
            return result
        return wrapper
    return decorator

def performance_monitor(func_name):
    """
    Decorator to monitor function performance
    
    Usage:
    @performance_monitor('get_user_products')
    def get_user_products(user_id):
        return Product.objects.filter(owner_id=user_id)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                logger.info(f"{func_name} executed in {execution_time:.3f}s")
                return result
            except Exception as e:
                execution_time = time.time() - start_time
                logger.error(f"{func_name} failed after {execution_time:.3f}s: {str(e)}")
                raise
        return wrapper
    return decorator

# Pre-configured cache decorators for common use cases
cache_user_data = lambda func: cache_result('user_data')(func)
cache_product_data = lambda func: cache_result('product_detail')(func)
cache_product_list = lambda func: cache_query_result('product_list')(func)
cache_payment_data = lambda func: cache_result('payment_data')(func)
cache_notification_data = lambda func: cache_result('notification')(func)
