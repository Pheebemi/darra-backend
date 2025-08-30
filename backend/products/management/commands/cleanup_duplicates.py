from django.core.management.base import BaseCommand
from django.utils import timezone
from products.models import Product
from datetime import timedelta

class Command(BaseCommand):
    help = 'Clean up duplicate products created due to network errors'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Find products created in the last hour
        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_products = Product.objects.filter(created_at__gte=one_hour_ago)
        
        duplicates = []
        
        # Group by owner, title, and product_type
        for product in recent_products:
            similar_products = Product.objects.filter(
                owner=product.owner,
                title=product.title,
                product_type=product.product_type,
                created_at__gte=one_hour_ago
            ).order_by('created_at')
            
            if similar_products.count() > 1:
                # Keep the first one, mark others for deletion
                first_product = similar_products.first()
                for duplicate in similar_products[1:]:
                    duplicates.append({
                        'keep': first_product,
                        'delete': duplicate,
                        'reason': f'Duplicate of {first_product.id}'
                    })
        
        if not duplicates:
            self.stdout.write(self.style.SUCCESS('No duplicate products found'))
            return
        
        self.stdout.write(f'Found {len(duplicates)} duplicate products:')
        
        for dup in duplicates:
            self.stdout.write(
                f'  Keep: {dup["keep"].id} - {dup["keep"].title} '
                f'(created: {dup["keep"].created_at})'
            )
            self.stdout.write(
                f'  Delete: {dup["delete"].id} - {dup["delete"].title} '
                f'(created: {dup["delete"].created_at})'
            )
            self.stdout.write('')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN - No products were deleted')
            )
        else:
            # Ask for confirmation
            confirm = input('Do you want to delete these duplicates? (yes/no): ')
            if confirm.lower() == 'yes':
                deleted_count = 0
                for dup in duplicates:
                    try:
                        dup['delete'].delete()
                        deleted_count += 1
                        self.stdout.write(f'Deleted duplicate: {dup["delete"].id}')
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f'Error deleting {dup["delete"].id}: {e}')
                        )
                
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully deleted {deleted_count} duplicate products')
                )
            else:
                self.stdout.write('Operation cancelled')
