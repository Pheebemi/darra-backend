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
        
    # Palette (Darra indigo brand)
    INDIGO = (56, 0, 255)
    CONTAINER = (243, 241, 255)
    BADGE_BG = (232, 222, 255)
    BORDER = (226, 224, 240)
    TEXT = (24, 24, 27)
    MUTED = (120, 118, 132)
    WHITE = (255, 255, 255)

    # Pre-rendered logo (the SVG is rasterised offline so the server needs no
    # SVG library). If the file is missing the header falls back to the
    # wordmark alone — a ticket never fails to generate over a logo.
    _LOGO_PATH = os.path.join(os.path.dirname(__file__), 'assets', 'logo.png')

    @staticmethod
    def _font(size):
        # Pillow's scalable built-in font: renders identically on the server,
        # no dependency on a system font like Arial (which the old code needed
        # and which Linux does not have — that made server tickets tiny).
        try:
            return ImageFont.load_default(size=size)
        except TypeError:  # very old Pillow
            return ImageFont.load_default()

    def generate_ticket_png(self, ticket_data):
        """
        Generate a branded Darra event ticket as a PNG: indigo header, event
        title, category badge, QR code, a perforated stub, and a details grid
        (date, guest, email, ticket id). The QR payload is unchanged so ticket
        verification keeps working.
        """
        try:
            import json

            f = self._font
            W = 440

            def bold(draw, xy, text, font, fill):
                x, y = xy
                draw.text((x, y), text, font=font, fill=fill)
                draw.text((x + 1, y), text, font=font, fill=fill)

            def wrap(draw, text, font, maxw, max_lines=2):
                words = str(text).split()
                lines, cur = [], ""
                for w in words:
                    t = (cur + " " + w).strip()
                    if draw.textlength(t, font=font) <= maxw:
                        cur = t
                    else:
                        if cur:
                            lines.append(cur)
                        cur = w
                if cur:
                    lines.append(cur)
                return lines[:max_lines] or [""]

            def fit(draw, text, font, maxw):
                text = str(text)
                if draw.textlength(text, font=font) <= maxw:
                    return text
                while text and draw.textlength(text + "…", font=font) > maxw:
                    text = text[:-1]
                return text + "…"

            measure = ImageDraw.Draw(Image.new('RGB', (1, 1)))
            title_font = f(23)
            title_lines = wrap(measure, ticket_data.get('event_title', 'Event'), title_font, W - 56)
            H = 690 + (len(title_lines) - 1) * 30

            img = Image.new('RGB', (W, H), self.WHITE)
            draw = ImageDraw.Draw(img)

            # Header band (rounded top, square bottom)
            draw.rounded_rectangle([0, 0, W, 132], 24, fill=self.INDIGO)
            draw.rectangle([0, 108, W, 132], fill=self.INDIGO)

            # Brand: the logo in a white tile + wordmark. Falls back to the
            # wordmark alone if the logo asset can't be loaded.
            wordmark_x, wordmark_y, wordmark_size = 28, 40, 30
            try:
                logo = Image.open(self._LOGO_PATH).convert('RGBA')
                tile, tx, ty = 58, 26, 30
                draw.rounded_rectangle([tx, ty, tx + tile, ty + tile], 15, fill=self.WHITE)
                logo_h = 42
                logo_w = max(1, int(logo.width / logo.height * logo_h))
                logo = logo.resize((logo_w, logo_h))
                img.paste(logo, (tx + (tile - logo_w) // 2, ty + (tile - logo_h) // 2), logo)
                wordmark_x, wordmark_y, wordmark_size = tx + tile + 14, 46, 28
            except Exception as e:
                print(f"Ticket logo not loaded, using wordmark only: {e}")

            bold(draw, (wordmark_x, wordmark_y), "DARRA", f(wordmark_size), self.WHITE)
            draw.text((W - 26, 50), "E-TICKET", font=f(13), fill=(206, 196, 255), anchor="ra")

            # Event title
            y = 152
            for ln in title_lines:
                bold(draw, (28, y), ln, title_font, self.TEXT)
                y += 30

            # Category badge
            category = str(ticket_data.get('ticket_category') or 'General').upper()
            bf = f(12)
            bw = measure.textlength(category, font=bf) + 26
            draw.rounded_rectangle([28, y + 2, 28 + bw, y + 28], 13, fill=self.BADGE_BG)
            draw.text((28 + 13, y + 8), category, font=bf, fill=self.INDIGO)
            y += 44

            # QR code — payload identical to before so verification still works
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=8,
                border=1,
            )
            qr.add_data(json.dumps({
                'ticket_id': ticket_data['ticket_id'],
                'event_id': ticket_data.get('event_id', ''),
                'timestamp': ticket_data.get('timestamp', ''),
                'type': 'fast_ticket',
            }))
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color=(24, 24, 27), back_color=self.WHITE).convert('RGB').resize((208, 208))

            ct = y + 2
            cs = 236
            cx = (W - cs) // 2
            draw.rounded_rectangle([cx, ct, cx + cs, ct + cs], 18, fill=self.CONTAINER)
            img.paste(qr_img, (cx + 14, ct + 14))

            # Perforated stub line with side notches
            yp = ct + cs + 22
            for x in range(24, W - 24, 14):
                draw.line([x, yp, x + 7, yp], fill=(205, 203, 216), width=2)
            draw.ellipse([-12, yp - 12, 12, yp + 12], fill=self.WHITE, outline=self.BORDER, width=2)
            draw.ellipse([W - 12, yp - 12, W + 12, yp + 12], fill=self.WHITE, outline=self.BORDER, width=2)

            # Details grid
            event_date = ticket_data.get('event_date', 'TBD')
            if hasattr(event_date, 'strftime'):
                event_date = event_date.strftime('%b %d, %Y · %I:%M %p')

            def cell(x, cy, label, value, maxw):
                draw.text((x, cy), str(label).upper(), font=f(11), fill=self.MUTED)
                draw.text((x, cy + 16), fit(draw, value, f(15), maxw), font=f(15), fill=self.TEXT)

            gy = yp + 24
            cell(28, gy, "Date", event_date, 170)
            cell(W // 2, gy, "Guest", ticket_data.get('buyer_name', 'Guest'), 170)
            cell(28, gy + 52, "Email", ticket_data.get('buyer_email', ''), W - 56)
            cell(28, gy + 104, "Ticket ID", ticket_data.get('ticket_id', 'N/A'), W - 56)

            draw.text((W // 2, H - 30), "Present this code at entry  •  darra.com.ng",
                      font=f(11), fill=self.MUTED, anchor="ma")

            # Outer border last so it frames everything cleanly
            draw.rounded_rectangle([0, 0, W - 1, H - 1], 24, outline=self.BORDER, width=2)

            buffer = BytesIO()
            img.save(buffer, format='PNG', optimize=True)
            buffer.seek(0)
            return buffer

        except Exception as e:
            print(f"Error generating fast ticket PNG: {str(e)}")
            return None
    
    def generate_qr_code_only(self, ticket_id, event_title, event_id=None):
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
            
            # Create unique QR data
            import json
            from datetime import datetime
            
            qr_data = {
                'ticket_id': ticket_id,
                'event_id': event_id or '',
                'timestamp': datetime.now().isoformat(),
                'type': 'fast_ticket'
            }
            
            qr_data_string = json.dumps(qr_data)
            qr.add_data(qr_data_string)
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
