import cloudinary
import cloudinary.uploader
import cloudinary.api
from django.conf import settings
from django.core.files.base import ContentFile
from io import BytesIO
import qrcode
from PIL import Image
import uuid
from typing import Dict, Any, Optional
import json

class TicketService:
    """Service for handling ticket generation and Cloudinary storage"""
    
    def __init__(self):
        # Configure Cloudinary
        cloudinary.config(
            cloud_name=settings.CLOUDINARY['cloud_name'],
            api_key=settings.CLOUDINARY['api_key'],
            api_secret=settings.CLOUDINARY['api_secret'],
            secure=settings.CLOUDINARY['secure']
        )
    
    def generate_qr_code(self, ticket_id: str, event_title: str) -> BytesIO:
        """
        Generate QR code for a ticket
        
        Args:
            ticket_id: Unique ticket identifier
            event_title: Title of the event
            
        Returns:
            BytesIO object containing the QR code image
        """
        # Create QR code with ticket data
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        
        # Add ticket data to QR code
        ticket_data = {
            'ticket_id': str(ticket_id),
            'event': event_title,
            'timestamp': str(uuid.uuid4())  # Additional uniqueness
        }
        
        qr.add_data(json.dumps(ticket_data))
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to BytesIO
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return buffer
    
    def upload_qr_code_to_cloudinary(self, qr_code_buffer: BytesIO, ticket_id: str, event_id: int) -> Dict[str, Any]:
        """
        Upload QR code to Cloudinary
        
        Args:
            qr_code_buffer: BytesIO buffer containing QR code image
            ticket_id: Unique ticket identifier
            event_id: ID of the event
            
        Returns:
            Dict containing Cloudinary upload response
        """
        try:
            # Prepare upload options
            upload_options = {
                'folder': f'tickets/qr_codes/{event_id}',
                'public_id': f'ticket_{ticket_id}',
                'resource_type': 'image',
                'format': 'png',
                'transformation': [
                    {'width': 300, 'height': 300, 'crop': 'fill'},
                    {'quality': 'auto'}
                ]
            }
            
            # Upload to Cloudinary
            result = cloudinary.uploader.upload(
                qr_code_buffer,
                **upload_options
            )
            
            print(f"✅ QR code uploaded to Cloudinary: {result['public_id']}")
            return result
            
        except Exception as e:
            print(f"❌ Error uploading QR code to Cloudinary: {str(e)}")
            # Don't re-raise the exception - let the calling code handle it
            # This prevents the error from bubbling up and breaking ticket creation
            return None
    
    def generate_pdf_ticket(self, ticket_data: Dict[str, Any]) -> BytesIO:
        """
        Generate PDF ticket with event details
        
        Args:
            ticket_data: Dictionary containing ticket information
            
        Returns:
            BytesIO object containing the PDF ticket
        """
        try:
            # This is a placeholder - you'll need to implement actual PDF generation
            # You can use libraries like reportlab, weasyprint, or pdfkit
            
            # For now, we'll create a simple text representation
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            
            buffer = BytesIO()
            p = canvas.Canvas(buffer, pagesize=letter)
            
            # Add ticket content
            p.drawString(100, 750, f"EVENT TICKET")
            p.drawString(100, 700, f"Event: {ticket_data.get('event_title', 'N/A')}")
            p.drawString(100, 650, f"Ticket ID: {ticket_data.get('ticket_id', 'N/A')}")
            p.drawString(100, 600, f"Date: {ticket_data.get('event_date', 'N/A')}")
            p.drawString(100, 550, f"Buyer: {ticket_data.get('buyer_name', 'N/A')}")
            p.drawString(100, 500, f"Quantity: {ticket_data.get('quantity', 'N/A')}")
            
            p.save()
            buffer.seek(0)
            
            return buffer
            
        except ImportError:
            print("⚠️ ReportLab not installed. Install with: pip install reportlab")
            # Fallback to simple text
            buffer = BytesIO()
            ticket_text = f"""
            EVENT TICKET
            Event: {ticket_data.get('event_title', 'N/A')}
            Ticket ID: {ticket_data.get('ticket_id', 'N/A')}
            Date: {ticket_data.get('event_date', 'N/A')}
            Buyer: {ticket_data.get('buyer_name', 'N/A')}
            Quantity: {ticket_data.get('quantity', 'N/A')}
            """
            buffer.write(ticket_text.encode())
            buffer.seek(0)
            return buffer
    
    def upload_pdf_ticket_to_cloudinary(self, pdf_buffer: BytesIO, ticket_id: str, event_id: int) -> Dict[str, Any]:
        """
        Upload PDF ticket to Cloudinary
        
        Args:
            pdf_buffer: BytesIO buffer containing PDF ticket
            ticket_id: Unique ticket identifier
            event_id: ID of the event
            
        Returns:
            Dict containing Cloudinary upload response
        """
        try:
            # Prepare upload options
            upload_options = {
                'folder': f'tickets/pdf/{event_id}',
                'public_id': f'ticket_{ticket_id}',
                'resource_type': 'raw',
                'format': 'pdf'
            }
            
            # Upload to Cloudinary
            result = cloudinary.uploader.upload(
                pdf_buffer,
                **upload_options
            )
            
            print(f"✅ PDF ticket uploaded to Cloudinary: {result['public_id']}")
            return result
            
        except Exception as e:
            print(f"❌ Error uploading PDF ticket to Cloudinary: {str(e)}")
            # Don't re-raise the exception - let the calling code handle it
            return None
    
    def delete_ticket_from_cloudinary(self, public_id: str) -> bool:
        """
        Delete a ticket file from Cloudinary
        
        Args:
            public_id: Public ID of the file to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            result = cloudinary.uploader.destroy(public_id)
            if result.get('result') == 'ok':
                print(f"✅ Ticket deleted from Cloudinary: {public_id}")
                return True
            else:
                print(f"⚠️ Ticket deletion failed: {result}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting ticket from Cloudinary: {str(e)}")
            return False
    
    def get_ticket_url(self, public_id: str, transformation: Optional[str] = None) -> str:
        """
        Get the URL for a ticket stored in Cloudinary
        
        Args:
            public_id: Public ID of the ticket
            transformation: Optional transformation string
            
        Returns:
            URL of the ticket
        """
        if transformation:
            return cloudinary.CloudinaryImage(public_id).build_url(transformation=transformation)
        else:
            return cloudinary.CloudinaryImage(public_id).build_url()

# Create a global instance
ticket_service = TicketService()
