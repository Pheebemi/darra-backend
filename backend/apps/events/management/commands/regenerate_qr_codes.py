from django.core.management.base import BaseCommand
from apps.events.models import EventTicket


class Command(BaseCommand):
    help = 'Regenerate QR codes for tickets that don\'t have them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--ticket-id',
            type=str,
            help='Specific ticket ID to regenerate QR code for',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Regenerate QR codes for all tickets without QR codes',
        )

    def handle(self, *args, **options):
        if options['ticket_id']:
            # Regenerate QR code for specific ticket
            try:
                ticket = EventTicket.objects.get(ticket_id=options['ticket_id'])
                self.stdout.write(f'Regenerating QR code for ticket {ticket.ticket_id}...')
                
                # Clear existing QR code
                ticket.qr_code = None
                ticket.qr_code_cloudinary_id = None
                ticket.save()
                
                # Generate new QR code
                qr_result = ticket.generate_qr_code()
                if qr_result:
                    self.stdout.write(
                        self.style.SUCCESS(f'✅ QR code regenerated for ticket {ticket.ticket_id}')
                    )
                else:
                    self.stdout.write(
                        self.style.ERROR(f'❌ Failed to regenerate QR code for ticket {ticket.ticket_id}')
                    )
                    
            except EventTicket.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'❌ Ticket with ID {options["ticket_id"]} not found')
                )
                
        elif options['all']:
            # Regenerate QR codes for all tickets without QR codes
            tickets_without_qr = EventTicket.objects.filter(qr_code__isnull=True)
            count = tickets_without_qr.count()
            
            if count == 0:
                self.stdout.write('No tickets found without QR codes')
                return
            
            self.stdout.write(f'Found {count} tickets without QR codes. Regenerating...')
            
            success_count = 0
            for ticket in tickets_without_qr:
                try:
                    self.stdout.write(f'Regenerating QR code for ticket {ticket.ticket_id}...')
                    qr_result = ticket.generate_qr_code()
                    if qr_result:
                        success_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'✅ QR code generated for ticket {ticket.ticket_id}')
                        )
                    else:
                        self.stdout.write(
                            self.style.ERROR(f'❌ Failed to generate QR code for ticket {ticket.ticket_id}')
                        )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'❌ Error generating QR code for ticket {ticket.ticket_id}: {str(e)}')
                    )
            
            self.stdout.write(
                self.style.SUCCESS(f'✅ Successfully regenerated {success_count}/{count} QR codes')
            )
            
        else:
            self.stdout.write('Please specify --ticket-id or --all option')


