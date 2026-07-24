"""
Copy existing product files from local disk into the configured R2 bucket.

Run once, after setting the R2_* variables, to move files that were uploaded
while storage was local. New uploads already go straight to R2.

For each product it reads the file from its old on-disk location (private_media
first, then the legacy public media/ folder) and writes it into R2 under the
same key. Idempotent: files already in R2 are skipped. It does NOT delete the
local copies — do that by hand once you've confirmed downloads work.

    python manage.py upload_product_files_to_r2 --dry-run
    python manage.py upload_product_files_to_r2
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from products.models import Product, _r2_configured


class Command(BaseCommand):
    help = "Upload existing local product files into the R2 bucket"

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help="Show what would upload without writing anything.")

    def _local_path(self, product):
        """Where this product's file sits on disk today, or None."""
        name = product.file.name
        for root in (settings.PRIVATE_MEDIA_ROOT, settings.MEDIA_ROOT):
            candidate = os.path.join(root, name)
            if os.path.exists(candidate):
                return candidate
        return None

    def handle(self, *args, **options):
        if not _r2_configured():
            raise CommandError(
                "R2 is not configured. Set R2_ACCESS_KEY_ID, "
                "R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_ENDPOINT_URL first."
            )

        from storages.backends.s3boto3 import S3Boto3Storage
        r2 = S3Boto3Storage(
            access_key=settings.R2_ACCESS_KEY_ID,
            secret_key=settings.R2_SECRET_ACCESS_KEY,
            bucket_name=settings.R2_BUCKET_NAME,
            endpoint_url=settings.R2_ENDPOINT_URL,
            region_name='auto',
            default_acl=None,
            file_overwrite=False,
        )

        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — nothing will be uploaded.\n"))

        uploaded = already = missing = 0

        for product in Product.objects.exclude(file='').exclude(file__isnull=True):
            name = product.file.name

            if r2.exists(name):
                already += 1
                continue

            local_path = self._local_path(product)
            if not local_path:
                missing += 1
                self.stdout.write(self.style.WARNING(
                    f"  missing on disk (product #{product.id}): {name}"
                ))
                continue

            if dry_run:
                self.stdout.write(f"  would upload: {name}")
                uploaded += 1
                continue

            with open(local_path, 'rb') as fh:
                from django.core.files import File
                r2.save(name, File(fh))
            uploaded += 1
            self.stdout.write(self.style.SUCCESS(f"  uploaded: {name}"))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. uploaded={uploaded} already_in_r2={already} missing={missing}"
        ))
        if not dry_run and uploaded:
            self.stdout.write(
                "Local copies were left in place. Delete them once you've "
                "confirmed a buyer can download from R2."
            )
