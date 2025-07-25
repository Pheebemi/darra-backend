from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

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