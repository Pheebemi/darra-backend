"""
Give existing ticket categories their real names.

Ticket rows used to be created with a generated name like "VIP_a3f9c2b1",
because a unique_together constraint on (category, name) meant two events
could not both have a "VIP". The real label lived on the linked global
category, and the generated name leaked into buyers' carts.

Sellers now name ticket categories themselves and that constraint is gone, so
this rewrites old rows to use the category's name, and copies its colour.

Safe to run more than once. Use --dry-run to preview.
"""

from django.core.management.base import BaseCommand

from products.models import TicketTier


class Command(BaseCommand):
    help = "Replace generated ticket tier names with their category name"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Show what would change without writing anything.",
        )

    def _looks_generated(self, name):
        """True for names shaped like "<something>_<8 hex chars>"."""
        head, sep, tail = name.rpartition('_')
        if not sep or not head or len(tail) != 8:
            return False
        return all(ch in '0123456789abcdef' for ch in tail.lower())

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be written.\n"))

        renamed = colored = skipped = orphaned = 0

        for tier in TicketTier.objects.select_related('category').all():
            changes = []

            if self._looks_generated(tier.name):
                if tier.category:
                    new_name = tier.category.name
                else:
                    # No category to recover the label from; keep the readable
                    # part rather than showing a hex suffix to buyers.
                    new_name = tier.name.rpartition('_')[0]
                    orphaned += 1

                if new_name and new_name != tier.name:
                    changes.append(f"name {tier.name!r} -> {new_name!r}")
                    tier.name = new_name
                    renamed += 1
            else:
                skipped += 1

            if tier.category and tier.category.color and tier.color != tier.category.color:
                changes.append(f"color -> {tier.category.color}")
                tier.color = tier.category.color
                colored += 1

            if changes:
                self.stdout.write(f"  tier #{tier.id}: " + "; ".join(changes))
                if not dry_run:
                    tier.save(update_fields=['name', 'color'])

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. renamed={renamed} recoloured={colored} "
            f"already_fine={skipped} no_category={orphaned}"
        ))
