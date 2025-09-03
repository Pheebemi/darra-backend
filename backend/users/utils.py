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
import img2pdf

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
        }
        

        

        
        # Create a request with anonymous user to avoid context processor conflicts
        request_factory = RequestFactory()
        request = request_factory.get('/')
        request.user = AnonymousUser()
        

        
        # Render the HTML email with RequestContext
        html_message = render_to_string('users/email/purchase_receipt.html', context, request=request)
        
        # Create plain text version
        plain_message = f"""
        Thank you for your purchase on Darra!
        
        Order Reference: {payment.reference}
        Order Date: {order_date}
        Total Amount: ₦{payment.amount}
        
        Products Purchased:
        """
        
        for purchase in purchases:
            plain_message += f"""
        - {purchase.product.title} ({purchase.product.product_type})
          Quantity: {purchase.quantity}
          Price: ₦{purchase.unit_price}
          Total: ₦{purchase.total_price}
        """
        
        plain_message += """
        
        Your products are now available in your library.
        If you have any questions, please contact our support team.
        
        Thank you for choosing Darra!
        """
        
        # Send the email
        send_mail(
            subject=f'Purchase Receipt - {payment.reference}',
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
                # Get QR code URL from Cloudinary
                qr_url = ticket.get_qr_code_url()
                if qr_url:
                    # Download QR code image
                    response = requests.get(qr_url)
                    if response.status_code == 200:
                        # Create attachment
                        qr_filename = f"ticket_{ticket.ticket_id}.png"
                        email.attach(qr_filename, response.content, 'image/png')
                        print(f"✅ Attached QR code: {qr_filename}")
                    else:
                        print(f"❌ Failed to download QR code for ticket {ticket.ticket_id}")
                else:
                    print(f"❌ No QR code URL for ticket {ticket.ticket_id}")
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
            }
            

            
            # Create a request with anonymous user to avoid context processor conflicts
            request_factory = RequestFactory()
            request = request_factory.get('/')
            request.user = AnonymousUser()
            
            # Render the HTML email with RequestContext
            html_message = render_to_string('users/email/seller_notification.html', context, request=request)
            
            # Create plain text version
            plain_message = f"""
            Congratulations! You have a new sale on Darra!
            
            Sale Details:
            Order Reference: {payment.reference}
            Sale Date: {sale_date}
            Total Earnings: ₦{total_earnings}
            
            Customer Information:
            Name: {payment.user.full_name or payment.user.email}
            Email: {payment.user.email}
            
            Products Sold:
            """
            
            for purchase in seller_purchases_list:
                plain_message += f"""
            - {purchase.product.title} ({purchase.product.product_type})
              Quantity: {purchase.quantity}
              Unit Price: ₦{purchase.unit_price}
              Total: ₦{purchase.total_price}
            """
            
            plain_message += """
            
            Keep creating amazing content! Your customers love your products.
            You can view your sales analytics in your seller dashboard.
            
            Thank you for being part of Darra!
            """
            
            # Send the email
            send_mail(
                subject=f'New Sale Notification - {payment.reference}',
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
        
        # Add headers to avoid spam/virus detection
        email.extra_headers = {
            'X-Mailer': 'Darra App',
            'X-Priority': '3',
            'X-MSMail-Priority': 'Normal',
            'Importance': 'Normal',
        }
        
        # Download and attach the product file
        try:
            print(f"DEBUG: Attempting to download file from: {file_url}")
            
            # Try the original URL first
            response = requests.get(file_url, timeout=30)
            print(f"DEBUG: Response status code: {response.status_code}")
            print(f"DEBUG: Response headers: {dict(response.headers)}")
            
            # If the original URL fails, try different Cloudinary URL formats
            if response.status_code != 200 and 'cloudinary.com' in file_url:
                print(f"DEBUG: Original URL failed, trying alternative formats...")
                
                # Try adding .pdf extension
                if not file_url.endswith('.pdf'):
                    pdf_url = f"{file_url}.pdf"
                    print(f"DEBUG: Trying with .pdf extension: {pdf_url}")
                    response = requests.get(pdf_url, timeout=30)
                    print(f"DEBUG: PDF URL response status: {response.status_code}")
                    if response.status_code == 200:
                        file_url = pdf_url
                
                # If still failing, try adding format parameter
                if response.status_code != 200 and 'f_' not in file_url:
                    format_url = f"{file_url}/f_pdf"
                    print(f"DEBUG: Trying with format parameter: {format_url}")
                    response = requests.get(format_url, timeout=30)
                    print(f"DEBUG: Format URL response status: {response.status_code}")
                    if response.status_code == 200:
                        file_url = format_url
            
            if response.status_code == 200:
                # Get file extension from URL or content type
                file_extension = file_url.split('.')[-1].lower() if '.' in file_url else 'file'
                if '?' in file_extension:
                    file_extension = file_extension.split('?')[0]
                
                # Check content type from response headers
                content_type_header = response.headers.get('content-type', '').lower()
                print(f"DEBUG: Content-Type header: {content_type_header}")
                
                # If content type indicates PDF, override file extension
                if 'application/pdf' in content_type_header:
                    file_extension = 'pdf'
                    print(f"DEBUG: Detected PDF from content-type header")
                
                # Check if it's an image file that should be converted to PDF
                if file_extension in ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp']:
                    try:
                        # Convert image to PDF
                        image = Image.open(BytesIO(response.content))
                        pdf_buffer = BytesIO()
                        
                        # Convert image to RGB if necessary (for PNG with transparency)
                        if image.mode in ('RGBA', 'LA', 'P'):
                            # Create a white background
                            background = Image.new('RGB', image.size, (255, 255, 255))
                            if image.mode == 'P':
                                image = image.convert('RGBA')
                            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                            image = background
                        elif image.mode != 'RGB':
                            image = image.convert('RGB')
                        
                        # Save as PDF with specific options to avoid virus detection
                        image.save(pdf_buffer, format='PDF', quality=95, optimize=True)
                        pdf_buffer.seek(0)
                        
                        # Create clean PDF filename
                        clean_title = "".join(c for c in product.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
                        filename = f"{clean_title.replace(' ', '_')}.pdf"
                        content_type = 'application/pdf'
                        
                        # Attach the PDF
                        email.attach(filename, pdf_buffer.getvalue(), content_type)
                        print(f"✅ Converted image to PDF and attached: {filename}")
                        
                    except Exception as e:
                        print(f"❌ Error converting image to PDF: {str(e)}")
                        # Fallback: attach original image
                        clean_title = "".join(c for c in product.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
                        filename = f"{clean_title.replace(' ', '_')}.{file_extension}"
                        content_type = f'image/{file_extension}'
                        email.attach(filename, response.content, content_type)
                        print(f"✅ Attached original image as fallback: {filename}")
                        
                        # Also try to send a simple PDF version using img2pdf as backup
                        try:
                            import img2pdf
                            pdf_data = img2pdf.convert(response.content)
                            pdf_filename = f"{clean_title.replace(' ', '_')}_simple.pdf"
                            email.attach(pdf_filename, pdf_data, 'application/pdf')
                            print(f"✅ Also attached simple PDF version: {pdf_filename}")
                        except Exception as pdf_error:
                            print(f"❌ Could not create simple PDF: {str(pdf_error)}")
                else:
                    # For non-image files, attach as-is
                    clean_title = "".join(c for c in product.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
                    filename = f"{clean_title.replace(' ', '_')}.{file_extension}"
                    
                    # Determine content type
                    content_type = 'application/octet-stream'  # Default
                    if file_extension in ['pdf']:
                        content_type = 'application/pdf'
                    elif file_extension in ['zip', 'rar']:
                        content_type = f'application/{file_extension}'
                    elif file_extension in ['doc', 'docx']:
                        content_type = 'application/msword'
                    elif file_extension in ['xls', 'xlsx']:
                        content_type = 'application/vnd.ms-excel'
                    
                    # Attach the file
                    email.attach(filename, response.content, content_type)
                    print(f"✅ Attached digital product: {filename}")
            else:
                print(f"❌ Failed to download product file: {file_url}")
                print(f"❌ Status code: {response.status_code}")
                print(f"❌ Response text: {response.text[:500]}")  # First 500 chars
                return False
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