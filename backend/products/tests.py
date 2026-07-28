"""
Tests for product file privacy, seller-named ticket categories, and the
product list pagination/ordering.
"""

from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import serializers as drf

from core.test_factories import make_seller, make_product, make_event, make_user
from .models import Product, TicketCategory, TicketTier, private_product_storage, _r2_configured
from .serializers import ProductSerializer, parse_ticket_types
from .file_validation import validate_cover_image
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

# Minimal real file headers so magic-byte validation passes.
PNG_BYTES = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64
JPG_BYTES = b'\xff\xd8\xff\xe0' + b'\x00' * 64
PDF_BYTES = b'%PDF-1.4' + b'\x00' * 64


class CoverImageValidationTests(TestCase):
    """
    Covers may be PNG or JPG. The old code accepted PNG only, so every JPG
    cover was silently rejected and the product saved with no files.
    """

    def test_png_cover_is_accepted(self):
        f = SimpleUploadedFile('c.png', PNG_BYTES, content_type='image/png')
        self.assertTrue(validate_cover_image(f))

    def test_jpg_cover_is_accepted(self):
        f = SimpleUploadedFile('c.jpg', JPG_BYTES, content_type='image/jpeg')
        self.assertTrue(validate_cover_image(f))  # the bug: this used to raise

    def test_jpeg_extension_is_accepted(self):
        f = SimpleUploadedFile('c.jpeg', JPG_BYTES, content_type='image/jpeg')
        self.assertTrue(validate_cover_image(f))

    def test_pdf_as_cover_is_rejected(self):
        f = SimpleUploadedFile('c.pdf', PDF_BYTES, content_type='application/pdf')
        with self.assertRaises(DjangoValidationError):
            validate_cover_image(f)

    def test_jpg_renamed_to_png_is_caught_by_magic_bytes(self):
        # Right extension, wrong bytes — the signature check must still reject.
        f = SimpleUploadedFile('c.png', JPG_BYTES, content_type='image/png')
        with self.assertRaises(DjangoValidationError):
            validate_cover_image(f)


class ProductCreateUploadTests(TestCase):
    """
    Creating a product with a JPG cover must succeed and actually store both
    files — and a bad upload must fail loudly, not save a fileless product.
    """

    def setUp(self):
        cache.clear()
        self.seller = make_seller()
        self.client.force_authenticate = None  # DRF test client set below

    def _post(self, cover, pfile):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.seller)
        return client.post('/api/products/my-products/', {
            'title': 'JPG Cover Book',
            'description': 'x',
            'price': '1500',
            'product_type': 'pdf',
            'cover_image': cover,
            'file': pfile,
        }, format='multipart')

    def test_create_with_jpg_cover_saves_both_files(self):
        res = self._post(
            SimpleUploadedFile('c.jpg', JPG_BYTES, content_type='image/jpeg'),
            SimpleUploadedFile('b.pdf', PDF_BYTES, content_type='application/pdf'),
        )
        self.assertIn(res.status_code, (200, 201))
        p = Product.objects.get(title='JPG Cover Book')
        self.assertTrue(p.cover_image, "cover was not saved")
        self.assertTrue(p.file, "product file was not saved")

    def test_invalid_cover_fails_loudly_and_saves_no_product(self):
        # A PDF posing as the cover must be rejected with an error — and must
        # NOT leave a half-created product behind.
        res = self._post(
            SimpleUploadedFile('c.pdf', PDF_BYTES, content_type='application/pdf'),
            SimpleUploadedFile('b.pdf', PDF_BYTES, content_type='application/pdf'),
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(
            Product.objects.filter(title='JPG Cover Book').exists(),
            "a product was left behind after a rejected upload",
        )


class DocxUploadValidationTests(TestCase):
    """
    A .docx is a ZIP container, so content detectors report it as
    application/zip — the strict MIME check used to reject every real Word
    file with a 400 while PDFs went through. These lock in the fix.
    """

    def _docx_bytes(self):
        import io
        import zipfile
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            z.writestr('[Content_Types].xml', '<xml/>')
            z.writestr('word/document.xml', '<w:document/>')
        return buf.getvalue()

    def test_real_docx_is_accepted(self):
        from .file_validation import validate_uploaded_file
        f = SimpleUploadedFile('essay.docx', self._docx_bytes(),
                               content_type='application/octet-stream')
        self.assertTrue(validate_uploaded_file(f, 'docx'))

    def test_docx_detected_as_zip_is_accepted(self):
        # Reproduce the server: python-magic reports the docx as application/zip.
        from unittest import mock
        from products import file_validation as fv
        f = SimpleUploadedFile('essay.docx', self._docx_bytes(), content_type='x')
        with mock.patch.object(fv, 'MAGIC_AVAILABLE', True), \
             mock.patch.object(fv, 'magic', create=True) as m:
            m.from_buffer.return_value = 'application/zip'
            self.assertTrue(fv.validate_uploaded_file(f, 'docx'))

    def test_executable_renamed_to_docx_is_blocked(self):
        from .file_validation import validate_uploaded_file
        f = SimpleUploadedFile('malware.docx', b'MZ\x90\x00' + b'\x00' * 128,
                               content_type='application/octet-stream')
        with self.assertRaises(DjangoValidationError):
            validate_uploaded_file(f, 'docx')

    def test_a_png_claiming_to_be_docx_is_blocked(self):
        from .file_validation import validate_uploaded_file
        f = SimpleUploadedFile('fake.docx', PNG_BYTES, content_type='image/png')
        with self.assertRaises(DjangoValidationError):
            validate_uploaded_file(f, 'docx')


class R2DirectUploadTests(TestCase):
    """
    Large files upload straight to R2 via a presigned URL; Django only
    validates the finished object. These cover the key namespacing, the size
    caps, and the validate-and-attach guard — all without touching the network.
    """

    R2 = dict(
        R2_ACCESS_KEY_ID='ak', R2_SECRET_ACCESS_KEY='sk',
        R2_BUCKET_NAME='darra-files',
        R2_ENDPOINT_URL='https://acct.r2.cloudflarestorage.com',
    )

    def test_key_is_namespaced_to_the_uploader(self):
        from products.r2_uploads import build_file_key, key_belongs_to_user
        key = build_file_key(42, 'song.mp3')
        self.assertTrue(key.startswith('products/files/42/'))
        self.assertTrue(key.endswith('.mp3'))
        self.assertTrue(key_belongs_to_user(key, 42))
        self.assertFalse(key_belongs_to_user(key, 43))  # can't claim another's key

    def test_size_caps_per_type(self):
        from products.file_validation import max_file_size_for
        self.assertEqual(max_file_size_for('mp3'), 50 * 1024 * 1024)
        self.assertEqual(max_file_size_for('pdf'), 25 * 1024 * 1024)
        self.assertEqual(max_file_size_for('png'), 500 * 1024)  # cover cap

    @override_settings(**R2)
    def test_attach_rejects_a_key_from_another_user(self):
        from products.r2_uploads import attach_r2_file
        product = make_product(product_type='mp3')
        with self.assertRaises(DjangoValidationError):
            attach_r2_file(product, 'products/files/99999/x.mp3', product.owner, 'mp3')

    @override_settings(**R2)
    def test_attach_validates_bytes_then_sets_file_name(self):
        from unittest import mock
        from products import r2_uploads
        product = make_product(product_type='pdf')
        key = f'products/files/{product.owner.id}/deadbeef.pdf'

        client = mock.MagicMock()
        client.head_object.return_value = {'ContentLength': 1000}
        body = mock.MagicMock(); body.read.return_value = PDF_BYTES
        client.get_object.return_value = {'Body': body}

        with mock.patch.object(r2_uploads, '_r2_client', return_value=client):
            r2_uploads.attach_r2_file(product, key, product.owner, 'pdf')

        product.refresh_from_db()
        self.assertEqual(product.file.name, key)

    @override_settings(**R2)
    def test_attach_rejects_wrong_bytes_and_deletes_the_object(self):
        from unittest import mock
        from products import r2_uploads
        product = make_product(product_type='pdf')
        key = f'products/files/{product.owner.id}/deadbeef.pdf'

        client = mock.MagicMock()
        client.head_object.return_value = {'ContentLength': 1000}
        body = mock.MagicMock(); body.read.return_value = b'MZ\x90\x00' + b'\x00' * 100
        client.get_object.return_value = {'Body': body}

        with mock.patch.object(r2_uploads, '_r2_client', return_value=client):
            with self.assertRaises(DjangoValidationError):
                r2_uploads.attach_r2_file(product, key, product.owner, 'pdf')

        client.delete_object.assert_called_once()  # untrusted object cleaned up


class PresignEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.seller = make_seller()

    def _client(self, user):
        from rest_framework.test import APIClient
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    @override_settings(R2_ACCESS_KEY_ID='', R2_SECRET_ACCESS_KEY='',
                       R2_BUCKET_NAME='', R2_ENDPOINT_URL='')
    def test_503_when_r2_not_configured(self):
        res = self._client(self.seller).post(
            '/api/products/upload/presign/',
            {'filename': 'a.pdf', 'product_type': 'pdf'},
        )
        self.assertEqual(res.status_code, 503)

    @override_settings(R2_ACCESS_KEY_ID='ak', R2_SECRET_ACCESS_KEY='sk',
                       R2_BUCKET_NAME='b', R2_ENDPOINT_URL='https://x.r2.cloudflarestorage.com')
    def test_seller_gets_a_signed_url_and_key(self):
        from unittest import mock
        with mock.patch('products.views.generate_presigned_put', return_value='https://signed.example'):
            res = self._client(self.seller).post(
                '/api/products/upload/presign/',
                {'filename': 'song.mp3', 'product_type': 'mp3'},
            )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['url'], 'https://signed.example')
        self.assertTrue(body['key'].startswith(f'products/files/{self.seller.id}/'))

    @override_settings(R2_ACCESS_KEY_ID='ak', R2_SECRET_ACCESS_KEY='sk',
                       R2_BUCKET_NAME='b', R2_ENDPOINT_URL='https://x.r2.cloudflarestorage.com')
    def test_buyer_is_forbidden(self):
        buyer = make_user(user_type='buyer')
        res = self._client(buyer).post(
            '/api/products/upload/presign/',
            {'filename': 'song.mp3', 'product_type': 'mp3'},
        )
        self.assertEqual(res.status_code, 403)

    @override_settings(R2_ACCESS_KEY_ID='ak', R2_SECRET_ACCESS_KEY='sk',
                       R2_BUCKET_NAME='b', R2_ENDPOINT_URL='https://x.r2.cloudflarestorage.com')
    def test_wrong_extension_for_type_is_rejected(self):
        res = self._client(self.seller).post(
            '/api/products/upload/presign/',
            {'filename': 'notes.txt', 'product_type': 'pdf'},
        )
        self.assertEqual(res.status_code, 400)


class ProductFilePrivacyTests(TestCase):
    """A paid file must never be discoverable from the public product API."""

    def test_serializer_never_exposes_the_file(self):
        product = make_product(product_type='pdf')
        data = ProductSerializer(product).data
        self.assertNotIn('file', data)
        self.assertIsNone(data['file_url'])  # kept as a key, but always null

    def test_has_file_is_a_safe_boolean(self):
        product = make_product()
        self.assertFalse(ProductSerializer(product).data['has_file'])

    def test_file_url_stays_none_even_for_owner(self):
        product = make_product()

        class Req:
            user = product.owner

        data = ProductSerializer(product, context={'request': Req()}).data
        self.assertIsNone(data['file_url'])


class TicketCategoryTests(TestCase):
    def test_seller_can_name_categories_per_event(self):
        product = make_event(tiers=[
            ('Table for 2', 150000, 10),
            ('Regular', 5000, 200),
            ('Twitter', 2500, 50),
        ])
        names = {t.name for t in product.ticket_tiers.all()}
        self.assertEqual(names, {'Table for 2', 'Regular', 'Twitter'})

    def test_two_events_can_share_a_category_name(self):
        # The old unique_together on (category, name) forbade this.
        make_event(tiers=[('Regular', 5000, 100)])
        try:
            make_event(tiers=[('Regular', 3000, 80)])
        except Exception as exc:  # pragma: no cover - failure path
            self.fail(f"second 'Regular' should be allowed, got {exc!r}")
        self.assertEqual(TicketTier.objects.filter(name='Regular').count(), 2)

    def test_legacy_generated_name_displays_as_category(self):
        cat = TicketCategory.objects.create(name='VIP', color='#F7B500')
        tier = TicketTier.objects.create(
            category=cat, name='VIP_a3f9c2b1',
            price=Decimal('10000'), quantity_available=50,
        )
        self.assertEqual(tier.display_name, 'VIP')

    def test_seller_named_tier_has_no_category(self):
        product = make_event(tiers=[('Gold', 20000, 5)])
        tier = product.ticket_tiers.first()
        self.assertIsNone(tier.category)
        self.assertEqual(tier.display_name, 'Gold')

    def test_parse_rejects_duplicate_names(self):
        with self.assertRaises(drf.ValidationError):
            parse_ticket_types([
                {'name': 'VIP', 'price': 1, 'quantity': 1},
                {'name': 'vip', 'price': 2, 'quantity': 2},
            ])

    def test_parse_rejects_missing_name(self):
        with self.assertRaises(drf.ValidationError):
            parse_ticket_types([{'price': 1000, 'quantity': 5}])

    def test_parse_rejects_bad_numbers(self):
        for bad in (
            [{'name': 'X', 'price': -5, 'quantity': 5}],
            [{'name': 'X', 'price': 100, 'quantity': 0}],
            [{'name': 'X', 'price': 'free', 'quantity': 5}],
        ):
            with self.assertRaises(drf.ValidationError):
                parse_ticket_types(bad)

    def test_legacy_category_id_payload_still_resolves_a_name(self):
        cat = TicketCategory.objects.create(name='Early Bird', color='#00B42A')
        parsed = parse_ticket_types([{'category_id': cat.id, 'price': 7500, 'quantity': 20}])
        self.assertEqual(parsed[0]['name'], 'Early Bird')


class StorageSelectionTests(TestCase):
    """
    private_product_storage() must fall back to local disk when R2 is not
    configured, and switch to the R2 backend when all four settings are set —
    without any network call.
    """

    R2 = dict(
        R2_ACCESS_KEY_ID='ak',
        R2_SECRET_ACCESS_KEY='sk',
        R2_BUCKET_NAME='darra-files',
        R2_ENDPOINT_URL='https://acct.r2.cloudflarestorage.com',
    )

    @override_settings(R2_ACCESS_KEY_ID='', R2_SECRET_ACCESS_KEY='',
                       R2_BUCKET_NAME='', R2_ENDPOINT_URL='')
    def test_falls_back_to_local_disk_without_r2(self):
        from django.core.files.storage import FileSystemStorage
        self.assertFalse(_r2_configured())
        self.assertIsInstance(private_product_storage(), FileSystemStorage)

    @override_settings(**R2)
    def test_uses_r2_when_configured(self):
        from storages.backends.s3boto3 import S3Boto3Storage
        self.assertTrue(_r2_configured())
        storage = private_product_storage()
        self.assertIsInstance(storage, S3Boto3Storage)
        self.assertEqual(storage.bucket_name, 'darra-files')
        self.assertEqual(storage.endpoint_url, 'https://acct.r2.cloudflarestorage.com')

    @override_settings(R2_ACCESS_KEY_ID='ak', R2_SECRET_ACCESS_KEY='sk',
                       R2_BUCKET_NAME='darra-files', R2_ENDPOINT_URL='')
    def test_partial_config_stays_local(self):
        # One missing value must not half-enable R2.
        from django.core.files.storage import FileSystemStorage
        self.assertFalse(_r2_configured())
        self.assertIsInstance(private_product_storage(), FileSystemStorage)


class ProductListPaginationTests(TestCase):
    def setUp(self):
        cache.clear()
        seller = make_seller()
        for i in range(30):
            make_product(owner=seller, title=f'Item {i:02d}',
                         price=Decimal(str(1000 + i * 100)))

    def test_response_has_pagination_envelope(self):
        res = self.client.get('/api/products/?page_size=10')
        body = res.json()
        self.assertEqual(res.status_code, 200)
        self.assertIn('results', body)
        self.assertIn('pagination', body)
        self.assertEqual(len(body['results']), 10)
        self.assertEqual(body['pagination']['total_items'], 30)
        self.assertTrue(body['pagination']['has_next'])

    def test_pages_do_not_overlap(self):
        p1 = self.client.get('/api/products/?page_size=10&page=1').json()['results']
        p2 = self.client.get('/api/products/?page_size=10&page=2').json()['results']
        ids1 = {x['id'] for x in p1}
        ids2 = {x['id'] for x in p2}
        self.assertEqual(ids1 & ids2, set())

    def test_price_ordering_applies_across_the_whole_set(self):
        res = self.client.get('/api/products/?page_size=5&ordering=price_asc')
        prices = [float(x['price']) for x in res.json()['results']]
        self.assertEqual(prices, sorted(prices))
        self.assertEqual(prices[0], 1000.0)  # cheapest overall, not of a page

    def test_page_size_is_capped(self):
        res = self.client.get('/api/products/?page_size=99999')
        # 30 items exist; the cap (100) means we still get all 30, not an error.
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['pagination']['page_size'], 100)
