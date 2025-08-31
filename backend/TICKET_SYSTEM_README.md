# 🎫 Ticket System with Cloudinary Storage

This document explains how to use the new ticket system that stores generated tickets (QR codes and PDFs) on Cloudinary instead of locally.

## 🚀 What's New

### Before (Local Storage)
- QR codes stored locally in `qr_codes/` folder
- No PDF tickets
- Files not accessible from mobile apps easily
- No backup/redundancy

### After (Cloudinary Storage)
- QR codes stored on Cloudinary with optimized transformations
- PDF tickets generated and stored on Cloudinary
- Accessible from anywhere via URLs
- Automatic backup and CDN distribution
- Optimized image delivery

## 📋 Prerequisites

### 1. Install Required Dependencies
```bash
cd backend
pip install -r requirements.txt
```

This will install:
- `qrcode>=7.4.2` - For QR code generation
- `reportlab>=4.0.0` - For PDF ticket generation
- `cloudinary>=1.40.0` - For Cloudinary integration
- `django-cloudinary-storage>=0.3.0` - For Django Cloudinary storage

### 2. Environment Variables
Make sure your `.env` file has these Cloudinary credentials:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_SECURE=True
```

## 🏗️ Database Changes

The migration `events.0003_eventticket_pdf_ticket_and_more` adds these new fields:

- `qr_code_cloudinary_id` - Stores Cloudinary public ID for QR codes
- `pdf_ticket` - FileField for PDF tickets
- `pdf_ticket_cloudinary_id` - Stores Cloudinary public ID for PDF tickets

## 🔧 How It Works

### 1. Automatic Ticket Generation
When a new `EventTicket` is created:
- QR code is automatically generated and uploaded to Cloudinary
- PDF ticket is generated with event details and uploaded to Cloudinary
- Cloudinary public IDs are stored in the database

### 2. Cloudinary Organization
Files are organized in Cloudinary as:
```
tickets/
├── qr_codes/
│   └── {event_id}/
│       └── ticket_{ticket_id}.png
└── pdf/
    └── {event_id}/
        └── ticket_{ticket_id}.pdf
```

### 3. Optimized Delivery
- QR codes are automatically resized to 300x300px
- Quality is optimized automatically
- CDN distribution for fast global access

## 📱 API Endpoints

### Get Ticket Details
```http
GET /api/events/ticket/{ticket_id}/
```
Returns ticket with Cloudinary URLs:
```json
{
  "ticket_id": "uuid",
  "qr_code_url": "https://res.cloudinary.com/.../tickets/qr_codes/1/ticket_uuid.png",
  "pdf_ticket_url": "https://res.cloudinary.com/.../tickets/pdf/1/ticket_uuid.pdf",
  ...
}
```

### Regenerate Ticket
```http
POST /api/events/regenerate/{ticket_id}/
```
Regenerates and re-uploads ticket files to Cloudinary.

## 🛠️ Management Commands

### Migrate Existing Tickets
To migrate existing tickets from local storage to Cloudinary:

```bash
# Dry run (see what would be migrated)
python manage.py migrate_tickets_to_cloudinary --dry-run

# Actually migrate
python manage.py migrate_tickets_to_cloudinary

# Force migration (even if already on Cloudinary)
python manage.py migrate_tickets_to_cloudinary --force
```

### Test the Service
```bash
python test_ticket_service.py
```

## 💻 Usage Examples

### 1. Generate QR Code Manually
```python
from apps.events.ticket_service import ticket_service

# Generate QR code
qr_buffer = ticket_service.generate_qr_code("ticket-123", "Event Name")

# Upload to Cloudinary
result = ticket_service.upload_qr_code_to_cloudinary(qr_buffer, "ticket-123", 1)
print(f"QR code uploaded: {result['url']}")
```

### 2. Generate PDF Ticket
```python
ticket_data = {
    'ticket_id': 'ticket-123',
    'event_title': 'Concert Night',
    'event_date': '2024-01-15 19:00',
    'buyer_name': 'John Doe',
    'quantity': 2
}

pdf_buffer = ticket_service.generate_pdf_ticket(ticket_data)
result = ticket_service.upload_pdf_ticket_to_cloudinary(pdf_buffer, "ticket-123", 1)
```

### 3. Get Optimized URLs
```python
# Get QR code with custom transformation
qr_url = ticket_service.get_ticket_url("public_id", "w_200,h_200,c_fill")

# Get PDF ticket URL
pdf_url = ticket_service.get_ticket_url("public_id")
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Cloudinary Configuration Error
```
❌ Error uploading QR code to Cloudinary: Invalid cloud_name
```
**Solution**: Check your `.env` file has correct Cloudinary credentials.

#### 2. ReportLab Import Error
```
⚠️ ReportLab not installed. Install with: pip install reportlab
```
**Solution**: Install ReportLab: `pip install reportlab`

#### 3. File Not Found Error
```
⚠️ QR code file not found for ticket
```
**Solution**: The local file was deleted. Use the regenerate endpoint to recreate it.

### Debug Mode
Enable debug logging in your Django settings:
```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'apps.events': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

## 📊 Performance Benefits

### Before (Local Storage)
- Files served from your server
- No image optimization
- Limited bandwidth
- No CDN

### After (Cloudinary)
- Global CDN distribution
- Automatic image optimization
- Unlimited bandwidth
- Fast loading times worldwide

## 🔐 Security Features

- Files are stored in organized folders
- Public IDs are unique and non-guessable
- Access control through Django permissions
- Automatic cleanup when tickets are deleted

## 🚀 Next Steps

1. **Test the system**: Run `python test_ticket_service.py`
2. **Migrate existing tickets**: Use the management command
3. **Update your mobile app**: Use the new Cloudinary URLs
4. **Monitor performance**: Check Cloudinary analytics

## 📞 Support

If you encounter issues:
1. Check the Cloudinary dashboard for upload status
2. Verify your environment variables
3. Check Django logs for detailed error messages
4. Test with the provided test script

---

**🎉 Your tickets are now stored on Cloudinary with professional-grade delivery!**
