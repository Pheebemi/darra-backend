# 🔄 Payment Provider Switching Guide

This guide explains how to switch between **Paystack** and **Flutterwave** payment providers in your Darra app.

## 🎯 **Current Status**

✅ **Paystack**: Fully integrated and working  
🔄 **Flutterwave**: Integrated alongside Paystack, ready for testing  
⚙️ **Switching**: Dynamic provider selection based on environment variables

## 🚀 **How to Switch Payment Providers**

### **Option 1: Environment Variable (Recommended)**

Set the `PAYMENT_PROVIDER` environment variable in your `.env` file:

```bash
# For Paystack (current)
PAYMENT_PROVIDER=paystack

# For Flutterwave
PAYMENT_PROVIDER=flutterwave
```

### **Option 2: Code-Level Switching**

You can also switch providers programmatically in your code:

```python
# In Python (Django)
from apps.payments.services import PaymentProviderFactory

# Get specific provider
paystack_service = PaymentProviderFactory.get_payment_service_by_provider('paystack')
flutterwave_service = PaymentProviderFactory.get_payment_service_by_provider('flutterwave')

# Get default provider (based on settings)
default_service = PaymentProviderFactory.get_payment_service()
```

## 🔧 **Configuration Files**

### **Backend Settings** (`backend/core/settings.py`)

```python
# Payment provider selection
PAYMENT_PROVIDER = os.getenv('PAYMENT_PROVIDER', 'paystack')

# Paystack settings
PAYSTACK_SECRET_KEY = os.getenv('PAYSTACK_SECRET_KEY')
PAYSTACK_PUBLIC_KEY = os.getenv('PAYSTACK_PUBLIC_KEY')

# Flutterwave settings
FLUTTERWAVE_SECRET_KEY = os.getenv('FLUTTERWAVE_SECRET_KEY')
FLUTTERWAVE_PUBLIC_KEY = os.getenv('FLUTTERWAVE_PUBLIC_KEY')
FLUTTERWAVE_ENCRYPTION_KEY = os.getenv('FLUTTERWAVE_ENCRYPTION_KEY')
```

### **Environment Variables** (`.env`)

```bash
# Choose your payment provider
PAYMENT_PROVIDER=paystack  # or 'flutterwave'

# Paystack credentials
PAYSTACK_SECRET_KEY=sk_test_your_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_key_here

# Flutterwave credentials
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST_your_key_here
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST_your_key_here
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_TEST_your_key_here
```

## 📱 **Mobile App Integration**

The mobile app automatically detects the payment provider and shows the appropriate WebView:

- **Paystack**: Uses `PaystackWebView` component
- **Flutterwave**: Uses `FlutterwaveWebView` component

### **Component Selection Logic**

```typescript
// In checkout.tsx
if (paymentProvider === 'flutterwave') {
  return <FlutterwaveWebView paymentData={...} />;
} else {
  return <PaystackWebView authorizationUrl={...} />;
}
```

## 🔄 **Switching Process**

### **Step 1: Update Environment Variables**

```bash
# In your .env file
PAYMENT_PROVIDER=flutterwave
```

### **Step 2: Restart Your Application**

```bash
# Backend
cd backend
python manage.py runserver

# Mobile (if using Expo)
cd mobile
expo start
```

### **Step 3: Test the Integration**

1. Create a test payment
2. Verify the correct WebView loads
3. Test payment flow end-to-end
4. Check webhook processing

## 🧪 **Testing Both Providers**

### **Development Testing**

You can test both providers simultaneously by:

1. **Setting up both sets of credentials**
2. **Switching between them** using environment variables
3. **Testing payment flows** for each provider

### **A/B Testing**

For production, you can implement A/B testing:

```python
# Random provider selection (example)
import random

def get_random_payment_provider():
    providers = ['paystack', 'flutterwave']
    return random.choice(providers)

# Or user preference-based selection
def get_user_preferred_provider(user):
    return user.payment_preference or 'paystack'
```

## 🔒 **Security Considerations**

### **API Key Management**

- ✅ **Never commit API keys** to version control
- ✅ **Use environment variables** for all sensitive data
- ✅ **Rotate keys regularly** for production
- ✅ **Use test keys** for development

### **Webhook Security**

Both providers require webhook signature verification:

```python
# Paystack webhook verification
def verify_paystack_signature(signature, body):
    # Implement signature verification
    pass

# Flutterwave webhook verification
def verify_flutterwave_signature(signature, body, encryption_key):
    # Implement signature verification with encryption key
    pass
```

## 📊 **Provider Comparison**

| Feature | Paystack | Flutterwave |
|---------|----------|-------------|
| **Setup** | ✅ Simple | ✅ Simple |
| **Documentation** | ✅ Excellent | ✅ Good |
| **Webhook Support** | ✅ Yes | ✅ Yes |
| **Mobile SDK** | ✅ Yes | ✅ Yes |
| **Fees** | 1.5% + ₦100 | 1.4% + ₦50 |
| **Currencies** | NGN, USD, EUR | NGN, USD, EUR, GBP |
| **Support** | ✅ Excellent | ✅ Good |

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Provider Not Switching**
   - Check environment variable spelling
   - Restart application after changes
   - Verify `.env` file is loaded

2. **Payment Initialization Fails**
   - Verify API keys are correct
   - Check network connectivity
   - Review API response logs

3. **Webhook Not Working**
   - Verify webhook URL in provider dashboard
   - Check webhook signature verification
   - Review webhook logs

### **Debug Mode**

Enable debug logging to troubleshoot:

```python
# In settings.py
DEBUG = True

# Check console output for:
# - Payment provider selection
# - API calls and responses
# - Webhook processing
```

## 🎯 **Next Steps**

### **Immediate Actions**

1. ✅ **Test Flutterwave integration** in development
2. ✅ **Verify webhook processing** for both providers
3. ✅ **Test mobile app** with both providers
4. ✅ **Document any issues** or differences

### **Production Deployment**

1. **Choose primary provider** based on testing
2. **Set up production credentials**
3. **Configure webhook URLs**
4. **Test end-to-end flows**
5. **Monitor payment success rates**

### **Future Enhancements**

1. **User preference selection** in mobile app
2. **Provider performance analytics**
3. **Automatic failover** between providers
4. **Multi-currency support**

## 📞 **Support**

- **Paystack**: [docs.paystack.co](https://docs.paystack.co)
- **Flutterwave**: [docs.flutterwave.com](https://docs.flutterwave.com)
- **Darra App**: Check code comments and this guide

---

**Remember**: Always test thoroughly in development before switching providers in production! 🚀
