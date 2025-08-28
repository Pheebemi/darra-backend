from django.core.management.base import BaseCommand
from products.models import TicketCategory, TicketTier

class Command(BaseCommand):
    help = 'Create sample ticket categories and tiers for testing'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample ticket categories and tiers...')
        
        # Create VIP Category
        vip_category, created = TicketCategory.objects.get_or_create(
            name='VIP',
            defaults={
                'description': 'Premium VIP experience with exclusive benefits',
                'color': '#FFD700'  # Gold
            }
        )
        if created:
            self.stdout.write(f'Created VIP category: {vip_category.name}')
        
        # Create Regular Category
        regular_category, created = TicketCategory.objects.get_or_create(
            name='Regular',
            defaults={
                'description': 'Standard admission with basic benefits',
                'color': '#007AFF'  # Blue
            }
        )
        if created:
            self.stdout.write(f'Created Regular category: {regular_category.name}')
        
        # Create Early Bird Category
        early_bird_category, created = TicketCategory.objects.get_or_create(
            name='Early Bird',
            defaults={
                'description': 'Limited time discounted tickets',
                'color': '#34C759'  # Green
            }
        )
        if created:
            self.stdout.write(f'Created Early Bird category: {early_bird_category.name}')
        
        # Create VIP Tiers
        vip_tier1, created = TicketTier.objects.get_or_create(
            category=vip_category,
            name='VIP Premium',
            defaults={
                'price': 50000.00,
                'quantity_available': 50,
                'description': 'Ultimate VIP experience with front row seating',
                'benefits': 'Front row seating, Meet & Greet, Exclusive merchandise, Priority entry'
            }
        )
        if created:
            self.stdout.write(f'Created VIP Premium tier: ₦{vip_tier1.price}')
        
        vip_tier2, created = TicketTier.objects.get_or_create(
            category=vip_category,
            name='VIP Standard',
            defaults={
                'price': 35000.00,
                'quantity_available': 100,
                'description': 'VIP experience with premium seating',
                'benefits': 'Premium seating, Exclusive merchandise, Priority entry'
            }
        )
        if created:
            self.stdout.write(f'Created VIP Standard tier: ₦{vip_tier2.price}')
        
        # Create Regular Tiers
        regular_tier1, created = TicketTier.objects.get_or_create(
            category=regular_category,
            name='Regular Premium',
            defaults={
                'price': 25000.00,
                'quantity_available': 200,
                'description': 'Standard admission with good seating',
                'benefits': 'Good seating, Event access'
            }
        )
        if created:
            self.stdout.write(f'Created Regular Premium tier: ₦{regular_tier1.price}')
        
        regular_tier2, created = TicketTier.objects.get_or_create(
            category=regular_category,
            name='Regular Standard',
            defaults={
                'price': 15000.00,
                'quantity_available': 300,
                'description': 'Basic admission',
                'benefits': 'Event access'
            }
        )
        if created:
            self.stdout.write(f'Created Regular Standard tier: ₦{regular_tier2.price}')
        
        # Create Early Bird Tiers
        early_bird_tier1, created = TicketTier.objects.get_or_create(
            category=early_bird_category,
            name='Early Bird VIP',
            defaults={
                'price': 40000.00,
                'quantity_available': 25,
                'description': 'Limited VIP tickets at discounted price',
                'benefits': 'VIP benefits, Limited availability, Discounted price'
            }
        )
        if created:
            self.stdout.write(f'Created Early Bird VIP tier: ₦{early_bird_tier1.price}')
        
        early_bird_tier2, created = TicketTier.objects.get_or_create(
            category=early_bird_category,
            name='Early Bird Regular',
            defaults={
                'price': 12000.00,
                'quantity_available': 100,
                'description': 'Limited regular tickets at discounted price',
                'benefits': 'Discounted price, Limited availability'
            }
        )
        if created:
            self.stdout.write(f'Created Early Bird Regular tier: ₦{early_bird_tier2.price}')
        
        self.stdout.write(
            self.style.SUCCESS('Successfully created sample ticket categories and tiers!')
        )
        self.stdout.write(f'Created {TicketCategory.objects.count()} categories')
        self.stdout.write(f'Created {TicketTier.objects.count()} tiers')
