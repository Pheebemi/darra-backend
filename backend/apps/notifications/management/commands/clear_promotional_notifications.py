from django.core.management.base import BaseCommand
from apps.notifications.models import Notification


class Command(BaseCommand):
    help = 'Clear all promotional notifications from the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm that you want to delete all promotional notifications',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    'This will delete ALL promotional notifications. '
                    'Use --confirm to proceed.'
                )
            )
            return

        # Count promotional notifications
        promotional_count = Notification.objects.filter(type='promotional').count()
        
        if promotional_count == 0:
            self.stdout.write(
                self.style.SUCCESS('No promotional notifications found.')
            )
            return

        # Delete promotional notifications
        deleted_count, _ = Notification.objects.filter(type='promotional').delete()
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully deleted {deleted_count} promotional notifications.'
            )
        )
