"""
Background tasks for event ticket generation
"""
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
import logging

logger = logging.getLogger('performance')

@shared_task(bind=True, name='generate_ticket_qr_code')
def generate_ticket_qr_code(self, ticket_id):
    """
    Generate QR code for a ticket in the background
    """
    try:
        from .models import EventTicket
        
        ticket = EventTicket.objects.get(id=ticket_id)
        logger.info(f"Starting QR code generation for ticket {ticket_id}")
        
        # Generate QR code
        qr_code = ticket.generate_qr_code()
        
        if qr_code:
            # Save the model to database after generating QR code
            ticket.save(update_fields=['qr_code', 'qr_code_file_path'])
            logger.info(f"QR code generated successfully for ticket {ticket_id}")
            return {
                'status': 'success',
                'ticket_id': ticket_id,
                'qr_code_url': ticket.get_qr_code_url() if hasattr(ticket, 'get_qr_code_url') else None
            }
        else:
            logger.error(f"QR code generation failed for ticket {ticket_id}")
            return {
                'status': 'failed',
                'ticket_id': ticket_id,
                'error': 'QR code generation failed'
            }
            
    except Exception as e:
        logger.error(f"Error generating QR code for ticket {ticket_id}: {str(e)}")
        return {
            'status': 'error',
            'ticket_id': ticket_id,
            'error': str(e)
        }

@shared_task(bind=True, name='generate_ticket_pdf')
def generate_ticket_pdf(self, ticket_id):
    """
    Generate PDF for a ticket in the background
    """
    try:
        from .models import EventTicket
        
        ticket = EventTicket.objects.get(id=ticket_id)
        logger.info(f"Starting PDF generation for ticket {ticket_id}")
        
        # Generate PDF
        pdf_ticket = ticket.generate_pdf_ticket()
        
        if pdf_ticket:
            # Save the model to database after generating PDF
            ticket.save(update_fields=['pdf_ticket', 'pdf_ticket_file_path'])
            logger.info(f"PDF generated successfully for ticket {ticket_id}")
            return {
                'status': 'success',
                'ticket_id': ticket_id,
                'pdf_url': ticket.get_pdf_ticket_url() if hasattr(ticket, 'get_pdf_ticket_url') else None
            }
        else:
            logger.error(f"PDF generation failed for ticket {ticket_id}")
            return {
                'status': 'failed',
                'ticket_id': ticket_id,
                'error': 'PDF generation failed'
            }
            
    except Exception as e:
        logger.error(f"Error generating PDF for ticket {ticket_id}: {str(e)}")
        return {
            'status': 'error',
            'ticket_id': ticket_id,
            'error': str(e)
        }

@shared_task(bind=True, name='generate_ticket_assets')
def generate_ticket_assets(self, ticket_id):
    """
    Generate both QR code and PDF for a ticket in the background
    """
    try:
        from .models import EventTicket
        
        ticket = EventTicket.objects.get(id=ticket_id)
        logger.info(f"Starting asset generation for ticket {ticket_id}")
        
        results = {
            'ticket_id': ticket_id,
            'qr_code': None,
            'pdf': None,
            'status': 'processing'
        }
        
        # Generate QR code
        try:
            qr_result = generate_ticket_qr_code.delay(ticket_id).get(timeout=60)
            results['qr_code'] = qr_result
        except Exception as e:
            logger.error(f"QR code generation failed for ticket {ticket_id}: {str(e)}")
            results['qr_code'] = {'status': 'error', 'error': str(e)}
        
        # Generate PDF
        try:
            pdf_result = generate_ticket_pdf.delay(ticket_id).get(timeout=60)
            results['pdf'] = pdf_result
        except Exception as e:
            logger.error(f"PDF generation failed for ticket {ticket_id}: {str(e)}")
            results['pdf'] = {'status': 'error', 'error': str(e)}
        
        # Update status
        if results['qr_code'] and results['qr_code'].get('status') == 'success' and \
           results['pdf'] and results['pdf'].get('status') == 'success':
            results['status'] = 'completed'
        else:
            results['status'] = 'partial'
        
        logger.info(f"Asset generation completed for ticket {ticket_id}: {results['status']}")
        return results
        
    except Exception as e:
        logger.error(f"Error generating assets for ticket {ticket_id}: {str(e)}")
        return {
            'status': 'error',
            'ticket_id': ticket_id,
            'error': str(e)
        }

@shared_task(bind=True, name='generate_multiple_ticket_assets')
def generate_multiple_ticket_assets(self, ticket_ids):
    """
    Generate assets for multiple tickets in parallel
    """
    try:
        logger.info(f"Starting asset generation for {len(ticket_ids)} tickets")
        
        # Create tasks for each ticket
        tasks = []
        for ticket_id in ticket_ids:
            task = generate_ticket_assets.delay(ticket_id)
            tasks.append((ticket_id, task))
        
        # Wait for all tasks to complete
        results = []
        for ticket_id, task in tasks:
            try:
                result = task.get(timeout=300)  # 5 minutes timeout
                results.append({
                    'ticket_id': ticket_id,
                    'result': result
                })
            except Exception as e:
                logger.error(f"Task failed for ticket {ticket_id}: {str(e)}")
                results.append({
                    'ticket_id': ticket_id,
                    'result': {'status': 'error', 'error': str(e)}
                })
        
        logger.info(f"Asset generation completed for {len(ticket_ids)} tickets")
        return {
            'status': 'completed',
            'ticket_count': len(ticket_ids),
            'results': results
        }
        
    except Exception as e:
        logger.error(f"Error generating assets for multiple tickets: {str(e)}")
        return {
            'status': 'error',
            'error': str(e)
        }

@shared_task(bind=True, name='send_ticket_email')
def send_ticket_email(self, ticket_id, user_email):
    """
    Send ticket email to user after assets are generated
    """
    try:
        from .models import EventTicket
        
        ticket = EventTicket.objects.get(id=ticket_id)
        
        # Prepare email content
        subject = f"Your ticket for {ticket.event.title}"
        message = f"""
        Hello,
        
        Your ticket for {ticket.event.title} has been generated successfully!
        
        Ticket ID: {ticket.ticket_id}
        Event: {ticket.event.title}
        Date: {ticket.event.event_date.strftime('%Y-%m-%d %H:%M') if ticket.event.event_date else 'TBD'}
        
        You can download your ticket PDF and view the QR code from your account.
        
        Thank you for your purchase!
        """
        
        # Send email
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user_email],
            fail_silently=False,
        )
        
        logger.info(f"Ticket email sent to {user_email} for ticket {ticket_id}")
        return {
            'status': 'success',
            'ticket_id': ticket_id,
            'email': user_email
        }
        
    except Exception as e:
        logger.error(f"Error sending ticket email for ticket {ticket_id}: {str(e)}")
        return {
            'status': 'error',
            'ticket_id': ticket_id,
            'error': str(e)
        }
