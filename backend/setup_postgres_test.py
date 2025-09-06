#!/usr/bin/env python3
"""
Quick setup script for PostgreSQL testing
Run this to set up your test environment
"""

import os
import sys

def check_postgresql_connection():
    """Check if PostgreSQL is running and accessible"""
    try:
        import psycopg2
        conn = psycopg2.connect(
            host="localhost",
            port="5432",
            database="postgres",  # Connect to default database first
            user="postgres",
            password=input("Enter your PostgreSQL password: ")
        )
        conn.close()
        print("✅ PostgreSQL connection successful!")
        return True
    except ImportError:
        print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
        return False
    except Exception as e:
        print(f"❌ PostgreSQL connection failed: {str(e)}")
        print("💡 Make sure PostgreSQL is running and accessible")
        return False

def create_test_database():
    """Create test database"""
    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
        
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host="localhost",
            port="5432",
            database="postgres",
            user="postgres",
            password=input("Enter your PostgreSQL password: ")
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create test database
        cursor.execute("DROP DATABASE IF EXISTS darra_test;")
        cursor.execute("CREATE DATABASE darra_test;")
        
        print("✅ Test database 'darra_test' created successfully!")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Failed to create test database: {str(e)}")
        return False

def update_test_settings():
    """Update test_settings.py with your password"""
    password = input("Enter your PostgreSQL password for test_settings.py: ")
    
    try:
        with open('test_settings.py', 'r') as f:
            content = f.read()
        
        # Replace placeholder password
        content = content.replace('your_password_here', password)
        
        with open('test_settings.py', 'w') as f:
            f.write(content)
        
        print("✅ test_settings.py updated with your password!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to update test_settings.py: {str(e)}")
        return False

def main():
    print("🐘 PostgreSQL Test Environment Setup")
    print("=" * 50)
    
    print("\n1. Checking PostgreSQL connection...")
    if not check_postgresql_connection():
        return
    
    print("\n2. Creating test database...")
    if not create_test_database():
        return
    
    print("\n3. Updating test settings...")
    if not update_test_settings():
        return
    
    print("\n✅ Setup completed successfully!")
    print("\n🚀 Next steps:")
    print("   1. Open PgAdmin4 and verify the 'darra_test' database exists")
    print("   2. Run: python benchmark_database.py")
    print("   3. Compare SQLite vs PostgreSQL performance")
    
    print("\n💡 PgAdmin4 Tips:")
    print("   - Connect to localhost:5432")
    print("   - Username: postgres")
    print("   - Look for 'darra_test' database in the left panel")
    print("   - You can monitor queries in real-time during the benchmark")

if __name__ == "__main__":
    main()
