from django.core.management.base import BaseCommand
from django.db import transaction
from apps.payments.models import Payment, Purchase, SellerCommission, SellerEarnings
from apps.payments.services import PaystackService
from decimal import Decimal

class Command(BaseCommand):
    help = 'Backfill old payments into seller commission and earnings system'

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
        
        # Get all successful payments that don't have commission records
        payments_without_commissions = Payment.objects.filter(
            status='success'
        ).exclude(
            purchases__commissions__isnull=False
        ).distinct()
        
        self.stdout.write(f"Found {payments_without_commissions.count()} payments without commission records")
        
        if dry_run:
            self.stdout.write("Would process the following payments:")
            for payment in payments_without_commissions[:10]:  # Show first 10
                self.stdout.write(f"  - {payment.reference}: ₦{payment.amount} by {payment.user.email}")
            if payments_without_commissions.count() > 10:
                self.stdout.write(f"  ... and {payments_without_commissions.count() - 10} more")
        else:
            paystack_service = PaystackService()
            total_commissions_created = 0
            total_earnings_updated = 0
            
            with transaction.atomic():
                for payment in payments_without_commissions:
                    try:
                        # Get all purchases for this payment
                        purchases = payment.purchases.all()
                        
                        for purchase in purchases:
                            # Check if commission already exists
                            if not SellerCommission.objects.filter(
                                seller=purchase.product.owner,
                                purchase=purchase
                            ).exists():
                                
                                # Create commission record
                                commission = paystack_service.create_seller_commission(purchase)
                                if commission:
                                    total_commissions_created += 1
                                    self.stdout.write(
                                        f"✓ Created commission for {purchase.product.owner.email}: "
                                        f"₦{commission.commission_amount} from {purchase.product.title}"
                                    )
                                
                                # Update seller earnings
                                earnings_updated = paystack_service.update_seller_earnings(purchase.product.owner)
                                if earnings_updated:
                                    total_earnings_updated += 1
                        
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(
                                f"Error processing payment {payment.reference}: {str(e)}"
                            )
                        )
                        continue
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully created {total_commissions_created} commission records "
                    f"and updated {total_earnings_updated} earnings records"
                )
            )
        
        # Show summary of what would be fixed
        if not dry_run:
            self.stdout.write("\n" + "="*50)
            self.stdout.write("SUMMARY OF FIXES:")
            
            # Count total revenue that will be tracked
            total_revenue = sum(payment.amount for payment in payments_without_commissions)
            total_commission = total_revenue * Decimal('0.04')
            total_seller_payout = total_revenue - total_commission
            
            self.stdout.write(f"Total Revenue to be tracked: ₦{total_revenue:,.2f}")
            self.stdout.write(f"Total Commission (4%): ₦{total_commission:,.2f}")
            self.stdout.write(f"Total Seller Payout: ₦{total_seller_payout:,.2f}")
            
            self.stdout.write("\nAfter running this command, your earnings section should show:")
            self.stdout.write(f"  - Total Sales: ₦{total_revenue:,.2f} (instead of just ₦7,000)")
            self.stdout.write(f"  - Platform Fee: ₦{total_commission:,.2f}")
            self.stdout.write(f"  - Net Earnings: ₦{total_seller_payout:,.2f}")














