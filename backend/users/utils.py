from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from datetime import datetime

def send_otp_email(email: str, otp: str, is_verification: bool = True):
    subject = 'Verify your email' if is_verification else 'Login OTP'
    context = {
        'otp': otp,
        'is_verification': is_verification
    }
    html_message = render_to_string('users/email/otp_email.html', context)
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
    html_message = render_to_string('users/email/password_reset.html', context)
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
        }
        
        # Render the HTML email
        html_message = render_to_string('users/email/purchase_receipt.html', context)
        
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
            
            # Render the HTML email
            html_message = render_to_string('users/email/seller_notification.html', context)
            
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

def send_event_ticket_email(purchase, tickets):
    """Send event ticket email with QR codes to buyer"""
    try:
        event = purchase.product
        buyer = purchase.payment.user
        
        # Format the event date
        event_date = event.event_date.strftime('%B %d, %Y at %I:%M %p') if event.event_date else 'TBD'
        
        # Prepare context for the email template
        context = {
            'customer_name': buyer.full_name or buyer.email,
            'event_title': event.title,
            'event_date': event_date,
            'event_location': getattr(event, 'event_location', 'TBD'),
            'tickets': tickets,
            'payment_reference': purchase.payment.reference,
            'total_amount': purchase.total_price,
            'quantity': purchase.quantity,
        }
        
        # Render the HTML email
        html_message = render_to_string('users/email/event_ticket.html', context)
        
        # Create plain text version
        plain_message = f"""
        Thank you for purchasing event tickets on Darra!
        
        Event: {event.title}
        Date: {event_date}
        Location: {getattr(event, 'event_location', 'TBD')}
        Number of Tickets: {purchase.quantity}
        Total Amount: ₦{purchase.total_price}
        Payment Reference: {purchase.payment.reference}
        
        Your QR codes are attached to this email. Please present them at the event entrance.
        
        Important:
        - Each ticket can only be used once
        - Keep your tickets safe and don't share them
        - Present the QR code at the event entrance
        
        If you have any questions, please contact the event organizer.
        
        Thank you for choosing Darra!
        """
        
        # Create email with attachments
        email = EmailMultiAlternatives(
            subject=f'Your Event Tickets - {event.title}',
            body=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[buyer.email]
        )
        email.attach_alternative(html_message, "text/html")
        
        # Attach QR codes
        for i, ticket in enumerate(tickets):
            ticket.generate_qr_code()  # Ensure QR code is generated
            if ticket.qr_code and ticket.qr_code.name:
                try:
                    with ticket.qr_code.open('rb') as qr_file:
                        email.attach(f'ticket_{i+1}_{ticket.ticket_id}.png', qr_file.read(), 'image/png')
                except Exception as e:
                    print(f"Error attaching QR code for ticket {ticket.ticket_id}: {str(e)}")
                    # Continue with other tickets even if one fails
        
        email.send()
        
        print(f"Event ticket email sent to {buyer.email}")
        return True
        
    except Exception as e:
        print(f"Error sending event ticket email: {str(e)}")
        return False 