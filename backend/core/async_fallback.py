"""
Async fallback for when Celery is not available
Uses threading to simulate async behavior
"""
import threading
import time
import logging
from django.conf import settings

logger = logging.getLogger('performance')

class AsyncFallback:
    """Fallback async implementation using threading"""
    
    @staticmethod
    def delay(func, *args, **kwargs):
        """Simulate Celery's delay method using threading"""
        def run_task():
            try:
                result = func(*args, **kwargs)
                logger.info(f"Async task completed: {func.__name__}")
                return result
            except Exception as e:
                logger.error(f"Async task failed: {func.__name__} - {str(e)}")
                return {'status': 'error', 'error': str(e)}
        
        # Start task in background thread
        thread = threading.Thread(target=run_task, daemon=True)
        thread.start()
        
        # Return a mock task object
        return MockTask(thread)

class MockTask:
    """Mock task object to simulate Celery task"""
    
    def __init__(self, thread):
        self.thread = thread
        self.id = f"mock_{int(time.time())}"
    
    def get(self, timeout=None):
        """Wait for task completion"""
        self.thread.join(timeout=timeout)
        return {'status': 'completed', 'task_id': self.id}

# Check if Celery is available
try:
    from celery import shared_task
    CELERY_AVAILABLE = True
    logger.info("Celery available - using real async tasks")
except ImportError:
    CELERY_AVAILABLE = False
    logger.warning("Celery not available - using threading fallback")

# Create fallback functions
if not CELERY_AVAILABLE:
    def generate_ticket_qr_code(ticket_id):
        """Fallback QR code generation"""
        from apps.events.models import EventTicket
        try:
            ticket = EventTicket.objects.get(id=ticket_id)
            ticket.generate_qr_code()
            return {'status': 'success', 'ticket_id': ticket_id}
        except Exception as e:
            return {'status': 'error', 'ticket_id': ticket_id, 'error': str(e)}
    
    def generate_ticket_pdf(ticket_id):
        """Fallback PDF generation"""
        from apps.events.models import EventTicket
        try:
            ticket = EventTicket.objects.get(id=ticket_id)
            ticket.generate_pdf_ticket()
            return {'status': 'success', 'ticket_id': ticket_id}
        except Exception as e:
            return {'status': 'error', 'ticket_id': ticket_id, 'error': str(e)}
    
    def generate_ticket_assets(ticket_id):
        """Fallback asset generation"""
        from apps.events.models import EventTicket
        try:
            ticket = EventTicket.objects.get(id=ticket_id)
            qr_result = generate_ticket_qr_code(ticket_id)
            pdf_result = generate_ticket_pdf(ticket_id)
            return {
                'status': 'completed',
                'ticket_id': ticket_id,
                'qr_code': qr_result,
                'pdf': pdf_result
            }
        except Exception as e:
            return {'status': 'error', 'ticket_id': ticket_id, 'error': str(e)}
    
    def generate_multiple_ticket_assets(ticket_ids):
        """Fallback multiple asset generation"""
        results = []
        for ticket_id in ticket_ids:
            result = generate_ticket_assets(ticket_id)
            results.append({
                'ticket_id': ticket_id,
                'result': result
            })
        return {
            'status': 'completed',
            'ticket_count': len(ticket_ids),
            'results': results
        }
    
    # Make functions async using threading
    generate_ticket_qr_code = AsyncFallback.delay(generate_ticket_qr_code)
    generate_ticket_pdf = AsyncFallback.delay(generate_ticket_pdf)
    generate_ticket_assets = AsyncFallback.delay(generate_ticket_assets)
    generate_multiple_ticket_assets = AsyncFallback.delay(generate_multiple_ticket_assets)
