"""
Fast PNG-only ticket service
Optimized for speed - generates only QR code PNGs, no PDFs
"""

import qrcode
from io import BytesIO
from django.core.files import File
from PIL import Image, ImageDraw, ImageFont
import os
from django.conf import settings

class FastTicketService:
    """Fast ticket generation service - PNG only"""
    
    def __init__(self):
        self.qr_size = 300  # QR code size
        self.ticket_width = 400
        self.ticket_height = 500
        
    def generate_ticket_png(self, ticket_data):
        """
        Generate a complete ticket as PNG (QR code + event info)
        Much faster than PDF generation
        """
        try:
            # Create ticket canvas
            ticket_img = Image.new('RGB', (self.ticket_width, self.ticket_height), 'white')
            draw = ImageDraw.Draw(ticket_img)
            
            # Try to use a nice font, fallback to default
            try:
                # Try to load a better font
                font_large = ImageFont.truetype("arial.ttf", 24)
                font_medium = ImageFont.truetype("arial.ttf", 18)
                font_small = ImageFont.truetype("arial.ttf", 14)
            except:
                # Fallback to default font
                font_large = ImageFont.load_default()
                font_medium = ImageFont.load_default()
                font_small = ImageFont.load_default()
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=8,
                border=2,
            )
            qr.add_data(ticket_data['ticket_id'])
            qr.make(fit=True)
            
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # Resize QR code to fit ticket
            qr_img = qr_img.resize((200, 200))
            
            # Paste QR code on ticket
            ticket_img.paste(qr_img, (100, 50))
            
            # Add event information
            y_position = 280
            
            # Event title
            draw.text((20, y_position), "EVENT TICKET", fill='black', font=font_large)
            y_position += 40
            
            # Event name
            event_title = ticket_data.get('event_title', 'Event')[:30]  # Truncate if too long
            draw.text((20, y_position), f"Event: {event_title}", fill='black', font=font_medium)
            y_position += 30
            
            # Event date
            event_date = ticket_data.get('event_date', 'TBD')
            if hasattr(event_date, 'strftime'):
                event_date = event_date.strftime('%Y-%m-%d %H:%M')
            draw.text((20, y_position), f"Date: {event_date}", fill='black', font=font_medium)
            y_position += 30
            
            # Buyer name
            buyer_name = ticket_data.get('buyer_name', 'Guest')
            draw.text((20, y_position), f"Guest: {buyer_name}", fill='black', font=font_medium)
            y_position += 30
            
            # Ticket ID
            ticket_id = ticket_data.get('ticket_id', 'N/A')
            draw.text((20, y_position), f"Ticket ID: {ticket_id}", fill='black', font=font_small)
            y_position += 25
            
            # Quantity
            quantity = ticket_data.get('quantity', 1)
            draw.text((20, y_position), f"Quantity: {quantity}", fill='black', font=font_small)
            y_position += 25
            
            # Add some styling
            draw.rectangle([10, 10, self.ticket_width-10, self.ticket_height-10], outline='black', width=2)
            draw.rectangle([10, 260, self.ticket_width-10, 270], fill='black')
            
            # Convert to bytes
            buffer = BytesIO()
            ticket_img.save(buffer, format='PNG', optimize=True)
            buffer.seek(0)
            
            return buffer
            
        except Exception as e:
            print(f"Error generating fast ticket PNG: {str(e)}")
            return None
    
    def generate_qr_code_only(self, ticket_id, event_title):
        """
        Generate just the QR code (fastest option)
        """
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(ticket_id)
            qr.make(fit=True)
            
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to bytes
            buffer = BytesIO()
            qr_img.save(buffer, format='PNG', optimize=True)
            buffer.seek(0)
            
            return buffer
            
        except Exception as e:
            print(f"Error generating QR code: {str(e)}")
            return None
    
    def save_ticket_locally(self, ticket_buffer, ticket_id, event_id):
        """
        Save ticket to local storage (faster than cloud upload)
        """
        try:
            # Create directory if it doesn't exist
            ticket_dir = os.path.join(settings.MEDIA_ROOT, 'tickets', 'png')
            os.makedirs(ticket_dir, exist_ok=True)
            
            # Save file
            filename = f"ticket_{ticket_id}.png"
            file_path = os.path.join(ticket_dir, filename)
            
            with open(file_path, 'wb') as f:
                f.write(ticket_buffer.getvalue())
            
            return {
                'success': True,
                'file_path': file_path,
                'filename': filename,
                'url': f"{settings.MEDIA_URL}tickets/png/{filename}"
            }
            
        except Exception as e:
            print(f"Error saving ticket locally: {str(e)}")
            return {'success': False, 'error': str(e)}

# Global instance
fast_ticket_service = FastTicketService()
