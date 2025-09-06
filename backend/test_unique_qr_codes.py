#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.events.fast_ticket_service import fast_ticket_service
import json

def test_unique_qr_codes():
    print("🔍 Testing QR code uniqueness...")
    
    # Test data for multiple tickets
    test_tickets = [
        {
            'ticket_id': 'test-ticket-1',
            'event_id': 'event-123',
            'event_title': 'Test Event 1',
            'event_date': '2024-12-31 20:00:00',
            'buyer_name': 'John Doe',
            'quantity': 1,
            'timestamp': '2024-01-01T10:00:00'
        },
        {
            'ticket_id': 'test-ticket-2',
            'event_id': 'event-123',
            'event_title': 'Test Event 1',
            'event_date': '2024-12-31 20:00:00',
            'buyer_name': 'Jane Smith',
            'quantity': 1,
            'timestamp': '2024-01-01T10:01:00'
        },
        {
            'ticket_id': 'test-ticket-3',
            'event_id': 'event-456',
            'event_title': 'Test Event 2',
            'event_date': '2024-12-31 20:00:00',
            'buyer_name': 'Bob Johnson',
            'quantity': 2,
            'timestamp': '2024-01-01T10:02:00'
        }
    ]
    
    qr_data_list = []
    
    for i, ticket_data in enumerate(test_tickets):
        print(f"\n📱 Generating QR code for ticket {i+1}...")
        
        # Generate QR code
        qr_buffer = fast_ticket_service.generate_qr_code_only(
            ticket_data['ticket_id'],
            ticket_data['event_title'],
            ticket_data['event_id']
        )
        
        if qr_buffer:
            # Read the QR code data (simulate scanning)
            qr_data_string = qr_buffer.getvalue().decode('utf-8', errors='ignore')
            
            # Try to parse as JSON
            try:
                qr_data = json.loads(qr_data_string)
                qr_data_list.append(qr_data)
                print(f"   ✅ QR data: {qr_data}")
            except:
                print(f"   ❌ Failed to parse QR data as JSON")
        else:
            print(f"   ❌ Failed to generate QR code")
    
    # Check uniqueness
    print(f"\n🔍 Checking uniqueness...")
    print(f"   Total QR codes generated: {len(qr_data_list)}")
    
    # Check if all ticket_ids are unique
    ticket_ids = [data['ticket_id'] for data in qr_data_list]
    unique_ticket_ids = set(ticket_ids)
    print(f"   Unique ticket IDs: {len(unique_ticket_ids)}")
    
    if len(ticket_ids) == len(unique_ticket_ids):
        print("   ✅ All ticket IDs are unique!")
    else:
        print("   ❌ Duplicate ticket IDs found!")
    
    # Check if QR data strings are unique
    qr_strings = [json.dumps(data, sort_keys=True) for data in qr_data_list]
    unique_qr_strings = set(qr_strings)
    print(f"   Unique QR data strings: {len(unique_qr_strings)}")
    
    if len(qr_strings) == len(unique_qr_strings):
        print("   ✅ All QR codes are unique!")
    else:
        print("   ❌ Duplicate QR codes found!")
    
    # Show the differences
    print(f"\n📊 QR Code Comparison:")
    for i, data in enumerate(qr_data_list):
        print(f"   Ticket {i+1}: {data['ticket_id']} | {data['event_id']} | {data['timestamp']}")
    
    print("\n✅ QR code uniqueness test completed!")

if __name__ == '__main__':
    test_unique_qr_codes()
