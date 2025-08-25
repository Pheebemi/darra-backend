"""
OTP Security Utilities
Provides secure OTP generation and validation functions
"""

import secrets
import hashlib
import time
from django.utils import timezone
from datetime import timedelta


def generate_secure_otp():
    """
    Generate cryptographically secure 6-digit OTP
    Uses secrets.token_hex() for true randomness
    """
    # Generate 3 bytes (6 hex characters) and convert to 6 digits
    hex_string = secrets.token_hex(3)  # 6 characters like 'a1b2c3'
    # Convert hex to decimal and ensure it's 6 digits
    decimal_num = int(hex_string, 16)
    # Ensure it's exactly 6 digits by taking modulo
    otp = str(decimal_num % 1000000).zfill(6)
    return otp


def generate_otp_hash(otp, timestamp):
    """
    Generate a hash of OTP with timestamp for additional security
    """
    data = f"{otp}:{timestamp}"
    return hashlib.sha256(data.encode()).hexdigest()


def validate_otp_timing(otp_created_at, max_age_minutes=10):
    """
    Validate OTP timing to prevent replay attacks
    """
    if not otp_created_at:
        return False, "No OTP timestamp found"
    
    now = timezone.now()
    age = now - otp_created_at
    
    if age > timedelta(minutes=max_age_minutes):
        return False, f"OTP expired ({age.total_seconds() / 60:.1f} minutes old)"
    
    if age < timedelta(seconds=1):
        return False, "OTP too recent (potential replay attack)"
    
    return True, "OTP timing valid"


def check_otp_cooldown(otp_created_at, cooldown_minutes=2):
    """
    Check if enough time has passed since last OTP request
    """
    if not otp_created_at:
        return True, 0
    
    now = timezone.now()
    time_since_last = now - otp_created_at
    
    if time_since_last < timedelta(minutes=cooldown_minutes):
        remaining = timedelta(minutes=cooldown_minutes) - time_since_last
        return False, int(remaining.total_seconds())
    
    return True, 0


def sanitize_otp_input(otp_input):
    """
    Sanitize OTP input to prevent injection attacks
    """
    if not otp_input:
        return None
    
    # Remove any non-digit characters
    sanitized = ''.join(filter(str.isdigit, str(otp_input)))
    
    # Ensure it's exactly 6 digits
    if len(sanitized) != 6:
        return None
    
    return sanitized


def log_otp_attempt(email, success, ip_address=None):
    """
    Log OTP attempts for security monitoring
    """
    timestamp = timezone.now().isoformat()
    status = "SUCCESS" if success else "FAILURE"
    
    log_entry = f"[{timestamp}] OTP {status} for {email}"
    if ip_address:
        log_entry += f" from IP: {ip_address}"
    
    print(f"SECURITY_LOG: {log_entry}")
    
    # In production, you might want to log to a proper logging system
    # logger.info(log_entry)
