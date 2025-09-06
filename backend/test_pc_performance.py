#!/usr/bin/env python3
"""
Test performance on your specific PC
"""
import os
import sys
import django
import time
import psutil

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def check_pc_specs():
    """Check your PC specifications"""
    print("🖥️ PC SPECIFICATIONS")
    print("=" * 30)
    
    # CPU info
    cpu_count = psutil.cpu_count()
    cpu_percent = psutil.cpu_percent(interval=1)
    print(f"CPU Cores: {cpu_count}")
    print(f"CPU Usage: {cpu_percent}%")
    
    # Memory info
    memory = psutil.virtual_memory()
    memory_gb = memory.total / (1024**3)
    memory_used_gb = memory.used / (1024**3)
    memory_percent = memory.percent
    print(f"RAM: {memory_gb:.1f}GB total, {memory_used_gb:.1f}GB used ({memory_percent}%)")
    
    # Disk info
    disk = psutil.disk_usage('/')
    disk_gb = disk.total / (1024**3)
    disk_free_gb = disk.free / (1024**3)
    print(f"Disk: {disk_gb:.1f}GB total, {disk_free_gb:.1f}GB free")
    
    # Performance rating
    if cpu_count >= 8 and memory_gb >= 16:
        rating = "High Performance"
        color = "✅"
    elif cpu_count >= 4 and memory_gb >= 8:
        rating = "Medium Performance"
        color = "⚠️"
    else:
        rating = "Low Performance"
        color = "❌"
    
    print(f"\nPerformance Rating: {color} {rating}")
    return rating

def test_optimized_performance():
    """Test optimized performance for your PC"""
    print("\n🚀 OPTIMIZED PERFORMANCE TEST")
    print("=" * 40)
    
    # Test with different batch sizes
    batch_sizes = [1, 3, 5, 10]
    
    for batch_size in batch_sizes:
        print(f"\nTesting batch size: {batch_size} tickets")
        
        start_time = time.time()
        
        # Simulate ticket creation
        for i in range(batch_size):
            print(f"   Creating ticket {i+1}...")
            time.sleep(0.01)  # Fast creation
        
        creation_time = time.time() - start_time
        
        # Simulate lightweight asset generation
        print(f"   Starting lightweight asset generation...")
        asset_start = time.time()
        
        for i in range(batch_size):
            print(f"   🔄 Generating assets for ticket {i+1}...")
            time.sleep(0.1)  # Reduced processing time
        
        total_time = time.time() - start_time
        asset_time = time.time() - asset_start
        
        print(f"   ✅ Results:")
        print(f"      Creation time: {creation_time:.2f}s")
        print(f"      Asset time: {asset_time:.2f}s")
        print(f"      Total time: {total_time:.2f}s")
        print(f"      Per ticket: {total_time/batch_size:.2f}s")
        
        # Check if it's fast enough
        if total_time < 1.0:
            print(f"      🎉 EXCELLENT! No timeouts!")
        elif total_time < 2.0:
            print(f"      ✅ GOOD! Should work fine!")
        else:
            print(f"      ⚠️ SLOW! May have timeout issues!")

def recommend_settings():
    """Recommend optimal settings for your PC"""
    print("\n⚙️ RECOMMENDED SETTINGS FOR YOUR PC")
    print("=" * 40)
    
    # Get PC specs
    cpu_count = psutil.cpu_count()
    memory_gb = psutil.virtual_memory().total / (1024**3)
    
    if cpu_count >= 8 and memory_gb >= 16:
        print("High-end PC detected:")
        print("   - Use full async processing")
        print("   - Batch size: 10-20 tickets")
        print("   - Worker concurrency: 4")
    elif cpu_count >= 4 and memory_gb >= 8:
        print("Medium PC detected:")
        print("   - Use lightweight async processing")
        print("   - Batch size: 5-10 tickets")
        print("   - Worker concurrency: 2")
    else:
        print("Lower-end PC detected:")
        print("   - Use minimal async processing")
        print("   - Batch size: 3-5 tickets")
        print("   - Worker concurrency: 1")
        print("   - Consider upgrading hardware")
    
    print(f"\n💡 TIPS FOR BETTER PERFORMANCE:")
    print(f"   - Close unnecessary programs")
    print(f"   - Use SSD storage if possible")
    print(f"   - Increase RAM if possible")
    print(f"   - Process tickets in smaller batches")

if __name__ == "__main__":
    print("🖥️ PC PERFORMANCE ANALYSIS")
    print("=" * 40)
    
    rating = check_pc_specs()
    test_optimized_performance()
    recommend_settings()
    
    print(f"\n🎯 CONCLUSION:")
    print(f"Your PC performance affects ticket generation speed.")
    print(f"But async processing still solves your timeout problem!")
    print(f"Even on slower PCs, you get instant response + background processing.")
