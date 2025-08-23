from django.core.management.base import BaseCommand
from django.db import transaction
from apps.payments.models import Purchase, UserLibrary, Payment
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Fix missing UserLibrary entries for existing purchases'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        # Get all successful payments
        successful_payments = Payment.objects.filter(status='success')
        self.stdout.write(f'Found {successful_payments.count()} successful payments')
        
        total_purchases = 0
        total_library_entries = 0
        created_entries = 0
        
        for payment in successful_payments:
            purchases = payment.purchases.all()
            total_purchases += purchases.count()
            
            for purchase in purchases:
                # Check if UserLibrary entry already exists
                existing_entries = UserLibrary.objects.filter(
                    user=payment.user,
                    product=purchase.product,
                    purchase=purchase
                )
                
                if existing_entries.exists():
                    total_library_entries += existing_entries.count()
                    self.stdout.write(f'✓ Purchase {purchase.id} already has {existing_entries.count()} library entries')
                else:
                    if not dry_run:
                        try:
                            if purchase.product.product_type == 'event':
                                # For event tickets, create separate library entries for each ticket
                                for ticket_number in range(purchase.quantity):
                                    UserLibrary.objects.create(
                                        user=payment.user,
                                        product=purchase.product,
                                        purchase=purchase,
                                        quantity=1  # Each library entry represents 1 ticket
                                    )
                                created_entries += purchase.quantity
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f'✓ Created {purchase.quantity} library entries for event: {purchase.product.title}'
                                    )
                                )
                            else:
                                # For digital products, create one library entry with the full quantity
                                UserLibrary.objects.create(
                                    user=payment.user,
                                    product=purchase.product,
                                    purchase=purchase,
                                    quantity=purchase.quantity
                                )
                                created_entries += 1
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f'✓ Created library entry for digital product: {purchase.product.title} x{purchase.quantity}'
                                    )
                                )
                        except Exception as e:
                            self.stdout.write(
                                self.style.ERROR(
                                    f'✗ Error creating library entry for purchase {purchase.id}: {str(e)}'
                                )
                            )
                    else:
                        # Dry run - just show what would be created
                        if purchase.product.product_type == 'event':
                            self.stdout.write(
                                f'Would create {purchase.quantity} library entries for event: {purchase.product.title}'
                            )
                        else:
                            self.stdout.write(
                                f'Would create library entry for digital product: {purchase.product.title} x{purchase.quantity}'
                            )
        
        # Summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write('SUMMARY:')
        self.stdout.write(f'Total successful payments: {successful_payments.count()}')
        self.stdout.write(f'Total purchases: {total_purchases}')
        self.stdout.write(f'Existing library entries: {total_library_entries}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No entries were created'))
        else:
            self.stdout.write(f'New library entries created: {created_entries}')
            self.stdout.write(
                self.style.SUCCESS(
                    f'Total library entries after fix: {total_library_entries + created_entries}'
                )
            )
        
        self.stdout.write('='*50)
