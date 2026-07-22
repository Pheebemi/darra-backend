"""
Move already-uploaded product files out of the public media folder and into
PRIVATE_MEDIA_ROOT.

Product files used to be stored under MEDIA_ROOT, which the web server serves
directly — meaning anyone with the URL could download a paid ebook without
buying it. The Product.file field now points at PRIVATE_MEDIA_ROOT instead.
The path stored in the database is relative (e.g. "products/files/book.pdf"),
so nothing in the DB needs to change; the files just need to physically move
to the new root.

Safe to run more than once. Use --dry-run to preview.
"""

import os
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand

from products.models import Product


class Command(BaseCommand):
    help = "Move existing product files from MEDIA_ROOT into PRIVATE_MEDIA_ROOT"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Show what would move without touching any files.",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        public_root = settings.MEDIA_ROOT
        private_root = settings.PRIVATE_MEDIA_ROOT

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no files will be moved.\n"))
        else:
            os.makedirs(private_root, exist_ok=True)

        moved = skipped = already = missing = 0

        for product in Product.objects.exclude(file='').exclude(file__isnull=True):
            name = product.file.name  # e.g. products/files/book.pdf
            old_path = os.path.join(public_root, name)
            new_path = os.path.join(private_root, name)

            if os.path.exists(new_path):
                already += 1
                # Old copy still sitting in public media is the actual leak.
                if os.path.exists(old_path):
                    if dry_run:
                        self.stdout.write(f"  would remove public copy: {name}")
                    else:
                        os.remove(old_path)
                        self.stdout.write(self.style.SUCCESS(f"  removed public copy: {name}"))
                    skipped += 1
                continue

            if not os.path.exists(old_path):
                missing += 1
                self.stdout.write(self.style.WARNING(
                    f"  missing on disk (product #{product.id}): {name}"
                ))
                continue

            if dry_run:
                self.stdout.write(f"  would move: {name}")
                moved += 1
                continue

            os.makedirs(os.path.dirname(new_path), exist_ok=True)
            shutil.move(old_path, new_path)
            moved += 1
            self.stdout.write(self.style.SUCCESS(f"  moved: {name}"))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. moved={moved} already_private={already} "
            f"public_copies_removed={skipped} missing={missing}"
        ))

        if missing:
            self.stdout.write(self.style.WARNING(
                "\nSome files were not found on disk. Those products will show "
                "'File not found on server' if a buyer tries to download them; "
                "the seller needs to re-upload."
            ))
