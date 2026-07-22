from django.core.mail import send_mail, EmailMessage
from django.template.loader import render_to_string
from django.conf import settings
from datetime import datetime
from django.template import RequestContext
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
import requests
from io import BytesIO
from PIL import Image

def send_otp_email(email: str, otp: str, is_verification: bool = True):
    subject = 'Verify your email' if is_verification else 'Login OTP'
    context = {
        'otp': otp,
        'is_verification': is_verification
    }
    # Create a request with anonymous user to avoid context processor conflicts
    request_factory = RequestFactory()
    request = request_factory.get('/')
    request.user = AnonymousUser()
    
    html_message = render_to_string('users/email/otp_email.html', context, request=request)
    plain_message = f'Your OTP is: {otp}'
    
    send_mail(
        subject=subject,
        message=plain_message,
        html_message=html_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

def send_password_reset_email(email: str, reset_url: str):
    subject = 'Reset your password'
    context = {
        'reset_url': reset_url
    }
    # Create a request with anonymous user to avoid context processor conflicts
    request_factory = RequestFactory()
    request = request_factory.get('/')
    request.user = AnonymousUser()
    
    html_message = render_to_string('users/email/password_reset.html', context, request=request)
    plain_message = f'Reset your password using this link: {reset_url}'
    
    send_mail(
        subject=subject,
        message=plain_message,
        html_message=html_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    ) 

def send_purchase_receipt_email(payment, purchases):
    """Send purchase receipt email to buyer"""
    try:
        # Format the order date
        order_date = payment.created_at.strftime('%B %d, %Y at %I:%M %p')
        
        # Prepare context for the email template
        context = {
            'customer_name': payment.user.full_name or payment.user.email,
            'payment_reference': payment.reference,
            'order_date': order_date,
            'payment_status': payment.status,
            'purchases': purchases,
            'total_amount': payment.amount,
            'customer': payment.user,  # Add explicit customer variable
            'buyer': payment.user,  # Add explicit buyer variable
            'library_url': f"{settings.FRONTEND_URL}/dashboard/buyer/library",
        }
        

        

        
        # Create a request with anonymous user to avoid context processor conflicts
        request_factory = RequestFactory()
        request = request_factory.get('/')
        request.user = AnonymousUser()
        

        
        # Render the HTML email with RequestContext
        html_message = render_to_string('users/email/purchase_receipt.html', context, request=request)
        
        # Create plain text version
        customer_name = context['customer_name']
        plain_message = (
            f"Hi {customer_name},\n\n"
            "Your payment went through. Here's your receipt.\n\n"
            f"Reference: {payment.reference}\n"
            f"Date: {order_date}\n\n"
        )

        for purchase in purchases:
            plain_message += (
                f"{purchase.product.title} x {purchase.quantity} — "
                f"NGN {purchase.total_price}\n"
            )

        plain_message += (
            f"\nTotal: NGN {payment.amount}\n\n"
            "Your purchase is in your library, ready to download:\n"
            f"{context['library_url']}\n\n"
            "Questions? Just reply to this email.\n"
        )
        
        # Send the email
        send_mail(
            subject=f'Your receipt - {payment.reference}',
            message=plain_message,
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[payment.user.email],
            fail_silently=False,
        )
        
        print(f"Purchase receipt email sent to {payment.user.email}")
        return True
        
    except Exception as e:
        print(f"Error sending purchase receipt email: {str(e)}")
        return False

def send_event_ticket_email(user, product, tickets):
    """Send event ticket email to buyer"""
    try:
        # Create a request with anonymous user to avoid context processor conflicts
        request_factory = RequestFactory()
        request = request_factory.get('/')
        request.user = AnonymousUser()
        
        # Prepare context for the email template
        context = {
            'customer_name': user.full_name or user.email,
            'event_title': product.title,
            'event_date': product.event_date.strftime('%B %d, %Y at %I:%M %p') if product.event_date else 'TBD',
            'tickets': tickets,
            'ticket_count': len(tickets),
            'event_location': getattr(product, 'location', 'TBD'),
            'event_description': product.description,
            'quantity': len(tickets),
            'total_amount': sum(ticket.purchase.unit_price for ticket in tickets),
            'payment_reference': tickets[0].purchase.payment.reference if tickets else 'N/A',
            'ticket_ids': [str(ticket.ticket_id) for ticket in tickets],
        }
        
        # Render the HTML email with RequestContext
        html_message = render_to_string('users/email/event_ticket.html', context, request=request)
        
        # Create plain text version
        plain_message = f"""
        Your Event Tickets - {product.title}
        
        Hello {user.full_name or user.email},
        
        Thank you for purchasing tickets to {product.title}!
        
        Event Details:
        - Date: {context['event_date']}
        - Location: {context['event_location']}
        - Tickets: {len(tickets)} ticket(s)
        
        Your tickets are attached to this email. Please present them at the event entrance.
        
        If you have any questions, please contact our support team.
        
        Thank you for choosing Darra!
        """
        
        # Create email with attachments
        email = EmailMessage(
            subject=f'Event Tickets - {product.title}',
            body=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        email.content_subtype = "html"  # Main content is now text/html
        
        # Attach QR codes for each ticket
        for i, ticket in enumerate(tickets):
            try:
                # Check if this is a fast ticket or old ticket
                if hasattr(ticket, 'ticket_png') and ticket.ticket_png:
                    # Fast ticket - use PNG file
                    qr_content = ticket.ticket_png.read()
                    qr_filename = f"ticket_{ticket.ticket_id}.png"
                    email.attach(qr_filename, qr_content, 'image/png')
                    print(f"✅ Attached fast ticket PNG: {qr_filename}")
                elif hasattr(ticket, 'generate_qr_code'):
                    # Old ticket - generate QR code
                    qr_code_file = ticket.generate_qr_code()
                    if qr_code_file:
                        # Read the QR code file from local storage
                        if hasattr(qr_code_file, 'read'):
                            # If it's a file object, read it
                            qr_code_file.seek(0)
                            qr_content = qr_code_file.read()
                        else:
                            # If it's a file path, read from filesystem
                            with open(qr_code_file.path, 'rb') as f:
                                qr_content = f.read()
                        
                        # Create attachment
                        qr_filename = f"ticket_{ticket.ticket_id}.png"
                        email.attach(qr_filename, qr_content, 'image/png')
                        print(f"✅ Attached QR code: {qr_filename}")
                    else:
                        print(f"❌ No QR code file for ticket {ticket.ticket_id}")
                else:
                    print(f"❌ No QR code file for ticket {ticket.ticket_id}")
            except Exception as e:
                print(f"❌ Error attaching QR code for ticket {ticket.ticket_id}: {str(e)}")
        
        # Send the email
        email.send(fail_silently=False)
        
        print(f"Event ticket email sent to {user.email}")
        return True
        
    except Exception as e:
        print(f"Error sending event ticket email: {str(e)}")
        return False

def send_seller_notification_email(payment, purchases):
    """Send sale notification email to seller(s)"""
    try:
        # Group purchases by seller
        seller_purchases = {}
        for purchase in purchases:
            seller = purchase.product.owner
            if seller not in seller_purchases:
                seller_purchases[seller] = []
            seller_purchases[seller].append(purchase)
        
        # Send email to each seller
        for seller, seller_purchases_list in seller_purchases.items():
            # Calculate total earnings for this seller
            total_earnings = sum(p.total_price for p in seller_purchases_list)
            
            # Format the sale date
            sale_date = payment.created_at.strftime('%B %d, %Y at %I:%M %p')
            
            # Prepare context for the email template
            context = {
                'seller_name': seller.full_name or seller.email,
                'payment_reference': payment.reference,
                'sale_date': sale_date,
                'payment_status': payment.status,
                'customer_name': payment.user.full_name or payment.user.email,
                'customer_email': payment.user.email,
                'purchases': seller_purchases_list,
                'total_earnings': total_earnings,
                'dashboard_url': f"{settings.FRONTEND_URL}/dashboard/seller",
            }
            

            
            # Create a request with anonymous user to avoid context processor conflicts
            request_factory = RequestFactory()
            request = request_factory.get('/')
            request.user = AnonymousUser()
            
            # Render the HTML email with RequestContext
            html_message = render_to_string('users/email/seller_notification.html', context, request=request)
            
            # Create plain text version
            plain_message = (
                f"Hi {context['seller_name']},\n\n"
                "You made a sale.\n\n"
                f"Your earnings from this sale: NGN {total_earnings}\n\n"
            )

            for purchase in seller_purchases_list:
                plain_message += (
                    f"{purchase.product.title} x {purchase.quantity} — "
                    f"NGN {purchase.total_price}\n"
                )

            plain_message += (
                f"\nBuyer: {payment.user.full_name or payment.user.email}\n"
                f"Email: {payment.user.email}\n"
                f"Reference: {payment.reference}\n"
                f"Date: {sale_date}\n\n"
                f"View your dashboard: {context['dashboard_url']}\n"
            )

            # Send the email
            send_mail(
                subject=f'You made a sale - {payment.reference}',
                message=plain_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[seller.email],
                fail_silently=False,
            )
            
            print(f"Seller notification email sent to {seller.email}")
        
        return True
        
    except Exception as e:
        print(f"Error sending seller notification email: {str(e)}")
        return False

# The four payout emails differ only in wording and colour, so they share one
# template and one sender rather than four near-identical copies.
PAYOUT_EMAIL_STATES = {
    'requested': {
        'subject': 'Payout request received',
        'message': 'We have received your payout request and it is queued for processing.',
        'status_label': 'Requested',
        'status_bg': '#F2F4FF',
        'status_color': '#4B6BFB',
        'amount_bg': '#f4f4f5',
        'amount_color': '#1b1b1f',
        'note': 'Payouts are normally sent within 12-14 hours.',
        'note_bg': '#f4f4f5',
    },
    'processing': {
        'subject': 'Payout processing',
        'message': 'Your payout is being processed and is on its way to your bank.',
        'status_label': 'Processing',
        'status_bg': '#FFF9E5',
        'status_color': '#B08600',
        'amount_bg': '#f4f4f5',
        'amount_color': '#1b1b1f',
        'note': 'You will get another email once the transfer has been sent.',
        'note_bg': '#f4f4f5',
    },
    'completed': {
        'subject': 'Payout sent',
        'message': 'Your payout has been sent to your bank account.',
        'status_label': 'Sent',
        'status_bg': '#EBFBF0',
        'status_color': '#00B42A',
        'amount_bg': '#EBFBF0',
        'amount_color': '#00B42A',
        'note': 'Funds usually reflect within a few minutes, though some banks take longer.',
        'note_bg': '#f4f4f5',
    },
    'failed': {
        'subject': 'Payout failed',
        'message': 'Your payout could not be completed, so it was not sent.',
        'status_label': 'Failed',
        'status_bg': '#FEECEC',
        'status_color': '#b3261e',
        'amount_bg': '#f4f4f5',
        'amount_color': '#1b1b1f',
        'note': 'Your balance has not been deducted — the funds are still in your Darra '
                'account. Check your bank details are correct and try again, or reply to '
                'this email and we will sort it out.',
        'note_bg': '#FEECEC',
    },
}


def _send_payout_email(payout_request, state):
    """Send one of the payout status emails. `state` keys PAYOUT_EMAIL_STATES."""
    try:
        cfg = PAYOUT_EMAIL_STATES[state]
        seller = payout_request.seller
        bank = payout_request.bank_details
        seller_name = seller.full_name or seller.email
        amount = f"{payout_request.amount:,.2f}"

        context = {
            'seller_name': seller_name,
            'amount': amount,
            'bank_name': bank.bank_name,
            'account_number': bank.account_number,
            'account_name': bank.account_name,
            'reference': payout_request.transfer_reference,
            'payouts_url': f"{settings.FRONTEND_URL}/dashboard/seller/earnings/payout-history",
            'headline': cfg['subject'],
            'message': cfg['message'],
            'status_label': cfg['status_label'],
            'status_bg': cfg['status_bg'],
            'status_color': cfg['status_color'],
            'amount_bg': cfg['amount_bg'],
            'amount_color': cfg['amount_color'],
            'note': cfg['note'],
            'note_bg': cfg['note_bg'],
        }

        request_factory = RequestFactory()
        request = request_factory.get('/')
        request.user = AnonymousUser()
        html_message = render_to_string(
            'users/email/payout_status.html', context, request=request
        )

        plain_message = (
            f"Hi {seller_name},\n\n"
            f"{cfg['message']}\n\n"
            f"Amount: NGN {amount}\n"
            f"Status: {cfg['status_label']}\n"
            f"Bank: {bank.bank_name}\n"
            f"Account: {bank.account_number}\n"
            f"Account name: {bank.account_name}\n"
            f"Reference: {payout_request.transfer_reference}\n\n"
            f"{cfg['note']}\n\n"
            f"Payout history: {context['payouts_url']}\n"
        )

        send_mail(
            subject=f"{cfg['subject']} - NGN {amount}",
            message=plain_message,
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[seller.email],
            fail_silently=False,
        )
        print(f"Payout {state} email sent to {seller.email}")
        return True
    except Exception as e:
        print(f"Error sending payout {state} email: {str(e)}")
        return False


def send_payout_requested_email(payout_request):
    """Notify seller their payout request was received"""
    return _send_payout_email(payout_request, 'requested')


def send_payout_processing_email(payout_request):
    """Notify seller their payout is being processed"""
    return _send_payout_email(payout_request, 'processing')


def send_payout_failed_email(payout_request):
    """Notify seller their payout failed"""
    return _send_payout_email(payout_request, 'failed')


def send_payout_completed_email(payout_request):
    """Notify seller their payout has been processed"""
    return _send_payout_email(payout_request, 'completed')


def send_digital_product_email(user, product, file_url):
    """Send digital product file via email to user"""
    try:
        # Create a request with anonymous user to avoid context processor conflicts
        request_factory = RequestFactory()
        request = request_factory.get('/')
        request.user = AnonymousUser()
        
        # Prepare context for the email template
        context = {
            'customer_name': user.full_name or user.email,
            'product_title': product.title,
            'product_description': product.description,
            'product_type': product.product_type,
            'purchase_date': product.created_at.strftime('%B %d, %Y') if hasattr(product, 'created_at') else 'Recently',
        }
        
        # Render the HTML email with RequestContext
        html_message = render_to_string('users/email/digital_product.html', context, request=request)
        
        # Create plain text version
        plain_message = f"""
        Your Digital Product - {product.title}
        
        Hello {user.full_name or user.email},
        
        Thank you for your purchase! Your digital product is ready for download.
        
        Product Details:
        - Title: {product.title}
        - Type: {product.product_type}
        - Description: {product.description}
        
        Your product file is attached to this email.
        
        If you have any questions, please contact our support team.
        
        Thank you for choosing Darra!
        """
        
        # Create email with attachment
        email = EmailMessage(
            subject=f'Your Digital Product - {product.title}',
            body=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        email.content_subtype = "html"  # Main content is now text/html
        
        # Add headers to avoid spam/virus detection (same as event tickets)
        email.extra_headers = {
            'X-Mailer': 'Darra App',
            'X-Priority': '3',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
        }
        
        # Download and attach the product file
        try:
            print(f"DEBUG: Attempting to download file from: {file_url}")
            
            # Check if this is a local file path or URL
            if file_url.startswith('http'):
                # This is a URL from the old Cloudinary system
                print(f"DEBUG: Detected URL from old system: {file_url}")
                print(f"DEBUG: This product needs to be re-uploaded to work with the new system")
                return False
            
            # This is a local file path - read it directly
            if not product.file:
                print(f"DEBUG: No file field found for product")
                return False
                
            # Read the file from local storage. resolve_file_path() handles the
            # private location plus the legacy MEDIA_ROOT fallback for files
            # that have not been moved yet.
            resolved_path = product.resolve_file_path()
            if not resolved_path:
                print(f"DEBUG: Product file missing on disk: {product.file.name}")
                return False

            with open(resolved_path, 'rb') as f:
                file_content = f.read()
            
            # Get file extension from the file name
            file_extension = product.file.name.split('.')[-1].lower() if '.' in product.file.name else 'file'
            
            # Create clean filename
            clean_title = "".join(c for c in product.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
            filename = f"{clean_title.replace(' ', '_')}.{file_extension}"
            
            # Determine content type based on file extension
            content_type = 'application/octet-stream'  # Default
            if file_extension in ['pdf']:
                content_type = 'application/pdf'
            elif file_extension in ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp']:
                content_type = f'image/{file_extension}'
            elif file_extension in ['zip', 'rar']:
                content_type = f'application/{file_extension}'
            elif file_extension in ['doc', 'docx']:
                content_type = 'application/msword'
            elif file_extension in ['xls', 'xlsx']:
                content_type = 'application/vnd.ms-excel'
            elif file_extension in ['txt']:
                content_type = 'text/plain'
            elif file_extension in ['mp4', 'avi', 'mov']:
                content_type = f'video/{file_extension}'
            elif file_extension in ['mp3', 'wav', 'flac']:
                content_type = f'audio/{file_extension}'
            
            # Attach the file
            email.attach(filename, file_content, content_type)
            print(f"✅ Attached digital product from local storage: {filename} ({content_type})")
        except Exception as e:
            print(f"❌ Error downloading product file: {str(e)}")
            return False
        
        # Send the email
        email.send(fail_silently=False)
        
        print(f"Digital product email sent to {user.email}")
        return True
        
    except Exception as e:
        print(f"Error sending digital product email: {str(e)}")
        return False