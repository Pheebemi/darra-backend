from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from io import BytesIO
import qrcode
from PIL import Image
import uuid
from typing import Dict, Any, Optional
import json

class TicketService:
    """Service for handling ticket generation and local storage"""
    
    def __init__(self):
        # No configuration needed for local storage
        pass
    
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
    
    def upload_qr_code_to_local_storage(self, qr_code_buffer: BytesIO, ticket_id: str, event_id: int) -> Dict[str, Any]:
        """
        Upload QR code to local storage
        
        Args:
            qr_code_buffer: BytesIO buffer containing QR code image
            ticket_id: Unique ticket identifier
            event_id: ID of the event
            
        Returns:
            Dict containing local storage upload response
        """
        try:
            # Create file path
            file_path = f'qr_codes/events/{event_id}/qr_{ticket_id}.png'
            
            # Reset buffer position
            qr_code_buffer.seek(0)
            
            # Save to local storage
            saved_path = default_storage.save(file_path, ContentFile(qr_code_buffer.read()))
            
            # Get the full URL
            file_url = default_storage.url(saved_path)
            
            result = {
                'public_id': saved_path,
                'secure_url': file_url,
                'url': file_url,
                'format': 'png',
                'resource_type': 'image'
            }
            
            print(f"✅ QR code saved to local storage: {saved_path}")
            return result
            
        except Exception as e:
            print(f"❌ Error saving QR code to local storage: {str(e)}")
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
    
    def upload_pdf_ticket_to_local_storage(self, pdf_buffer: BytesIO, ticket_id: str, event_id: int) -> Dict[str, Any]:
        """
        Upload PDF ticket to local storage
        
        Args:
            pdf_buffer: BytesIO buffer containing PDF ticket
            ticket_id: Unique ticket identifier
            event_id: ID of the event
            
        Returns:
            Dict containing local storage upload response
        """
        try:
            # Create file path
            file_path = f'tickets/pdf/{event_id}/ticket_{ticket_id}.pdf'
            
            # Reset buffer position
            pdf_buffer.seek(0)
            
            # Save to local storage
            saved_path = default_storage.save(file_path, ContentFile(pdf_buffer.read()))
            
            # Get the full URL
            file_url = default_storage.url(saved_path)
            
            result = {
                'public_id': saved_path,
                'secure_url': file_url,
                'url': file_url,
                'format': 'pdf',
                'resource_type': 'raw'
            }
            
            print(f"✅ PDF ticket saved to local storage: {saved_path}")
            return result
            
        except Exception as e:
            print(f"❌ Error saving PDF ticket to local storage: {str(e)}")
            return None
    
    def delete_ticket_from_local_storage(self, file_path: str) -> bool:
        """
        Delete a ticket file from local storage
        
        Args:
            file_path: Path of the file to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            if default_storage.exists(file_path):
                default_storage.delete(file_path)
                print(f"✅ Ticket deleted from local storage: {file_path}")
                return True
            else:
                print(f"⚠️ File not found: {file_path}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting ticket from local storage: {str(e)}")
            return False
    
    def get_ticket_url(self, file_path: str, transformation: Optional[str] = None) -> str:
        """
        Get the URL for a ticket stored in local storage
        
        Args:
            file_path: Path of the ticket file
            transformation: Optional transformation string (ignored for local storage)
            
        Returns:
            URL of the ticket
        """
        return default_storage.url(file_path)

# Create a global instance
ticket_service = TicketService()
