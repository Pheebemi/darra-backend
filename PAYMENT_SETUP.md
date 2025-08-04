# Paystack Payment Integration Setup Guide

This guide will help you set up the Paystack payment integration for your Darra app.

## Prerequisites

1. A Paystack account (sign up at https://paystack.com)
2. Your Django backend running
3. Your React Native mobile app

## Step 1: Get Paystack API Keys

1. Log in to your Paystack dashboard
2. Go to Settings > API Keys & Webhooks
3. Copy your **Test Secret Key** and **Test Public Key**
4. For production, use the **Live Secret Key** and **Live Public Key**

## Step 2: Configure Backend Environment

1. Create a `.env` file in the `backend/` directory
2. Add the following configuration:

```env
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True

# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_test_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_test_public_key_here
BASE_URL=http://localhost:8000

# Currency Settings
CURRENCY=NGN
CURRENCY_SYMBOL=₦

# Email Settings (optional)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com
```

## Step 3: Run Database Migrations

```bash
cd backend
python manage.py makemigrations payments
python manage.py migrate
```

## Step 4: Test the Integration

### Backend Testing

1. Start your Django server:
```bash
cd backend
python manage.py runserver
```

2. Test the payment endpoints:
   - `POST /api/payments/checkout/` - Initialize payment
   - `GET /api/payments/verify/{reference}/` - Verify payment
   - `GET /api/payments/library/` - Get user library
   - `GET /api/payments/history/` - Get payment history

### Mobile App Testing

1. Start your React Native app
2. Add products to cart
3. Go to checkout
4. Complete payment using Paystack test cards

## Step 5: Paystack Test Cards

Use these test cards for testing:

- **Visa**: 4084 0840 8408 4081
- **Mastercard**: 5105 1051 0510 5100
- **Verve**: 5061 4603 6000 0000

**CVV**: Any 3 digits (e.g., 123)
**Expiry**: Any future date (e.g., 12/25)

## Step 6: Payment Flow

1. **User adds products to cart** in mobile app
2. **User proceeds to checkout** and enters email
3. **Backend creates payment record** and initializes Paystack payment
4. **User is redirected to Paystack** to complete payment
5. **Paystack redirects back** to your app with payment status
6. **Backend verifies payment** and adds products to user library
7. **User can access purchased products** in their library

## Step 7: Production Setup

1. **Update environment variables** with live Paystack keys
2. **Set DEBUG=False** in Django settings
3. **Update BASE_URL** to your production domain
4. **Configure webhooks** in Paystack dashboard
5. **Test thoroughly** with small amounts first

## API Endpoints

### Checkout
```http
POST /api/payments/checkout/
Content-Type: application/json
Authorization: Bearer <token>

{
  "items": [
    {
      "product_id": 1,
      "quantity": 1
    }
  ],
  "email": "user@example.com"
}
```

### Verify Payment
```http
GET /api/payments/verify/{reference}/
Authorization: Bearer <token>
```

### Get User Library
```http
GET /api/payments/library/
Authorization: Bearer <token>
```

### Get Payment History
```http
GET /api/payments/history/
Authorization: Bearer <token>
```

## Troubleshooting

### Common Issues

1. **Payment initialization fails**
   - Check Paystack API keys
   - Verify BASE_URL is correct
   - Check network connectivity

2. **Payment verification fails**
   - Ensure reference is correct
   - Check Paystack webhook configuration
   - Verify payment status in Paystack dashboard

3. **Products not added to library**
   - Check payment status
   - Verify UserLibrary model creation
   - Check database migrations

### Debug Mode

Enable debug mode to see detailed error messages:

```python
# In settings.py
DEBUG = True
```

## Security Considerations

1. **Never expose secret keys** in client-side code
2. **Always verify payments** on the backend
3. **Use HTTPS** in production
4. **Validate all input data**
5. **Implement rate limiting** for payment endpoints

## Support

- Paystack Documentation: https://paystack.com/docs
- Paystack Support: support@paystack.com
- Django Documentation: https://docs.djangoproject.com 