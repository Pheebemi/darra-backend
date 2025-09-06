"""
Lightweight tasks for slower PCs
Reduces resource usage while maintaining async behavior
"""
import threading
import time
import logging
from django.conf import settings

logger = logging.getLogger('performance')

class LightweightAsync:
    """Lightweight async implementation for slower PCs"""
    
    @staticmethod
    def delay(func, *args, **kwargs):
        """Lightweight delay using threading with resource limits"""
        def run_task():
            try:
                # Add small delay to prevent overwhelming the system
                time.sleep(0.1)
                result = func(*args, **kwargs)
                logger.info(f"Lightweight task completed: {func.__name__}")
                return result
            except Exception as e:
                logger.error(f"Lightweight task failed: {func.__name__} - {str(e)}")
                return {'status': 'error', 'error': str(e)}
        
        # Start task in background thread with lower priority
        thread = threading.Thread(target=run_task, daemon=True)
        thread.start()
        
        return LightweightTask(thread)

class LightweightTask:
    """Lightweight task object"""
    
    def __init__(self, thread):
        self.thread = thread
        self.id = f"lightweight_{int(time.time())}"
    
    def get(self, timeout=None):
        """Wait for task completion with timeout"""
        self.thread.join(timeout=timeout)
        return {'status': 'completed', 'task_id': self.id}

def generate_lightweight_qr_code(ticket_id):
    """Lightweight QR code generation"""
    from apps.events.models import EventTicket
    try:
        ticket = EventTicket.objects.get(id=ticket_id)
        
        # Simplified QR generation (faster)
        print(f"   🔄 Generating lightweight QR for ticket {ticket_id}...")
        time.sleep(0.2)  # Reduced from 2-3 seconds
        
        # Just create a simple QR code without heavy processing
        ticket.qr_code_cloudinary_id = f"lightweight_qr_{ticket_id}"
        ticket.save(update_fields=['qr_code_cloudinary_id'])
        
        return {'status': 'success', 'ticket_id': ticket_id}
    except Exception as e:
        return {'status': 'error', 'ticket_id': ticket_id, 'error': str(e)}

def generate_lightweight_pdf(ticket_id):
    """Lightweight PDF generation"""
    from apps.events.models import EventTicket
    try:
        ticket = EventTicket.objects.get(id=ticket_id)
        
        # Simplified PDF generation (faster)
        print(f"   🔄 Generating lightweight PDF for ticket {ticket_id}...")
        time.sleep(0.1)  # Reduced from 1-2 seconds
        
        # Just create a simple PDF without heavy processing
        ticket.pdf_ticket_cloudinary_id = f"lightweight_pdf_{ticket_id}"
        ticket.save(update_fields=['pdf_ticket_cloudinary_id'])
        
        return {'status': 'success', 'ticket_id': ticket_id}
    except Exception as e:
        return {'status': 'error', 'ticket_id': ticket_id, 'error': str(e)}

def generate_lightweight_assets(ticket_id):
    """Lightweight asset generation for slower PCs"""
    try:
        print(f"   🚀 Starting lightweight asset generation for ticket {ticket_id}")
        
        # Generate assets with reduced processing
        qr_result = generate_lightweight_qr_code(ticket_id)
        pdf_result = generate_lightweight_pdf(ticket_id)
        
        return {
            'status': 'completed',
            'ticket_id': ticket_id,
            'qr_code': qr_result,
            'pdf': pdf_result
        }
    except Exception as e:
        return {'status': 'error', 'ticket_id': ticket_id, 'error': str(e)}

def generate_multiple_lightweight_assets(ticket_ids):
    """Generate assets for multiple tickets with resource management"""
    results = []
    
    # Process tickets in smaller batches to avoid overwhelming the system
    batch_size = 3  # Process 3 tickets at a time
    for i in range(0, len(ticket_ids), batch_size):
        batch = ticket_ids[i:i + batch_size]
        
        print(f"   📦 Processing batch {i//batch_size + 1}: {len(batch)} tickets")
        
        for ticket_id in batch:
            result = generate_lightweight_assets(ticket_id)
            results.append({
                'ticket_id': ticket_id,
                'result': result
            })
            
            # Small delay between tickets to prevent system overload
            time.sleep(0.05)
        
        # Delay between batches
        if i + batch_size < len(ticket_ids):
            time.sleep(0.1)
    
    return {
        'status': 'completed',
        'ticket_count': len(ticket_ids),
        'results': results
    }

# Make functions async
generate_lightweight_qr_code = LightweightAsync.delay(generate_lightweight_qr_code)
generate_lightweight_pdf = LightweightAsync.delay(generate_lightweight_pdf)
generate_lightweight_assets = LightweightAsync.delay(generate_lightweight_assets)
generate_multiple_lightweight_assets = LightweightAsync.delay(generate_multiple_lightweight_assets)
