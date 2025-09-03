from django.core.management.base import BaseCommand
from django.db import transaction
from apps.events.models import EventTicket
from apps.events.ticket_service import ticket_service
import os

class Command(BaseCommand):
    help = 'Migrate existing tickets to Cloudinary storage'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually doing it',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force migration even if tickets already exist on Cloudinary',
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        
        self.stdout.write(
            self.style.SUCCESS('🚀 Starting ticket migration to Cloudinary...')
        )
        
        # Get all tickets
        tickets = EventTicket.objects.all()
        total_tickets = tickets.count()
        
        if total_tickets == 0:
            self.stdout.write(
                self.style.WARNING('⚠️ No tickets found to migrate')
            )
            return
        
        self.stdout.write(f'📊 Found {total_tickets} tickets to process')
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for ticket in tickets:
            try:
                self.stdout.write(f'🔄 Processing ticket {ticket.ticket_id}...')
                
                # Check if already migrated
                if not force and ticket.qr_code_cloudinary_id:
                    self.stdout.write(f'⏭️ Ticket {ticket.ticket_id} already on Cloudinary, skipping...')
                    skipped_count += 1
                    continue
                
                if dry_run:
                    self.stdout.write(f'🔍 Would migrate ticket {ticket.ticket_id}')
                    migrated_count += 1
                    continue
                
                # Migrate QR code
                if ticket.qr_code and not ticket.qr_code_cloudinary_id:
                    self.stdout.write(f'📤 Uploading QR code for ticket {ticket.ticket_id}...')
                    
                    # Read the existing QR code file
                    if os.path.exists(ticket.qr_code.path):
                        with open(ticket.qr_code.path, 'rb') as f:
                            from io import BytesIO
                            qr_buffer = BytesIO(f.read())
                            qr_buffer.seek(0)
                            
                            # Upload to Cloudinary
                            cloudinary_result = ticket_service.upload_qr_code_to_cloudinary(
                                qr_buffer, 
                                str(ticket.ticket_id), 
                                ticket.event.id
                            )
                            
                            # Update the model
                            ticket.qr_code_cloudinary_id = cloudinary_result['public_id']
                            ticket.save(update_fields=['qr_code_cloudinary_id'])
                            
                            self.stdout.write(
                                self.style.SUCCESS(f'✅ QR code migrated for ticket {ticket.ticket_id}')
                            )
                    else:
                        self.stdout.write(
                            self.style.WARNING(f'⚠️ QR code file not found for ticket {ticket.ticket_id}')
                        )
                
                # Generate PDF ticket if it doesn't exist
                if not ticket.pdf_ticket and not ticket.pdf_ticket_cloudinary_id:
                    self.stdout.write(f'📄 Generating PDF ticket for ticket {ticket.ticket_id}...')
                    
                    try:
                        ticket.generate_pdf_ticket()
                        self.stdout.write(
                            self.style.SUCCESS(f'✅ PDF ticket generated for ticket {ticket.ticket_id}')
                        )
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f'❌ Failed to generate PDF ticket: {str(e)}')
                        )
                
                migrated_count += 1
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Error processing ticket {ticket.ticket_id}: {str(e)}')
                )
                error_count += 1
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS('🎉 Migration completed!'))
        self.stdout.write(f'📊 Total tickets: {total_tickets}')
        self.stdout.write(f'✅ Migrated: {migrated_count}')
        self.stdout.write(f'⏭️ Skipped: {skipped_count}')
        self.stdout.write(f'❌ Errors: {error_count}')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('⚠️ This was a dry run. No actual changes were made.')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('🚀 Tickets have been successfully migrated to Cloudinary!')
            )


