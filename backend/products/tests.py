"""
Tests for product file privacy, seller-named ticket categories, and the
product list pagination/ordering.
"""

from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers as drf

from core.test_factories import make_seller, make_product, make_event, make_user, make_payment
from .models import Product, Review, TicketCategory, TicketTier, private_product_storage, _r2_configured
from .serializers import ProductSerializer, parse_ticket_types
from .file_validation import validate_cover_image
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

# Minimal real file headers so magic-byte validation passes.
PNG_BYTES = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64
JPG_BYTES = b'\xff\xd8\xff\xe0' + b'\x00' * 64
PDF_BYTES = b'%PDF-1.4' + b'\x00' * 64


def capture_ai_prompt(product_data, ticket_types=None):
    """
    Run the generator against a stubbed HTTP call and return the user prompt
    it would have sent, so tests can assert on what the model actually sees.
    """
    from unittest import mock
    from products.ai import generate_product_description

    captured = {}

    def fake_post(url, headers, json, timeout):
        captured['payload'] = json

        # Mirrors the parts of requests.Response the generator reads: it
        # checks .ok and falls back to .text when the body can't be parsed.
        class FakeResponse:
            status_code = 200
            ok = True
            text = '{"choices": [{"message": {"content": "Generated copy."}}]}'

            def json(self):
                return {'choices': [{'message': {'content': 'Generated copy.'}}]}

        return FakeResponse()

    with mock.patch('products.ai.requests.post', side_effect=fake_post):
        generate_product_description(product_data, ticket_types)

    return captured['payload']['messages'][1]['content']



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


class ProductDescriptionGenerationTests(TestCase):
    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_seller_can_generate_description_from_product_details(self):
        from unittest import mock
        from rest_framework.test import APIClient

        seller = make_seller()
        client = APIClient()
        client.force_authenticate(user=seller)

        with mock.patch(
            'products.views.generate_product_description',
            return_value='A practical guide to taking better product photos.',
        ) as generate:
            response = client.post('/api/products/my-products/generate-description/', {
                'title': 'Learn Product Photography',
                'price': '2500',
                'product_type': 'pdf',
            }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['description'], 'A practical guide to taking better product photos.')
        generate.assert_called_once()
        self.assertEqual(generate.call_args.args[0]['title'], 'Learn Product Photography')

    def test_product_creation_does_not_generate_description(self):
        from rest_framework.test import APIClient
        seller = make_seller()
        client = APIClient()
        client.force_authenticate(user=seller)
        response = client.post('/api/products/my-products/', {
            'title': 'My Custom Guide',
            'description': 'Written by the seller.',
            'price': '2500',
            'product_type': 'pdf',
        }, format='json')
        self.assertIn(response.status_code, (200, 201))
        self.assertEqual(Product.objects.get(title='My Custom Guide').description, 'Written by the seller.')


class ProductDescriptionPromptTests(TestCase):
    """
    A seller who hasn't set up an event should never get event-flavoured
    copy back — the prompt built for the model must not carry event-only
    fields (or event language) for a plain digital download, and must still
    carry them for an actual event.
    """

    _capture_prompt = staticmethod(capture_ai_prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_ebook_prompt_omits_event_fields(self):
        prompt = self._capture_prompt({
            'title': 'My eBook',
            'product_type': 'pdf',
            'price': '2500',
            'event_date': '',
            'venue_name': '',
            'location': '',
            'speakers': '',
        })

        self.assertIn('eBook (PDF download)', prompt)
        self.assertNotIn('Venue', prompt)
        self.assertNotIn('Speakers', prompt)
        self.assertNotIn('Ticket options', prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_event_prompt_includes_event_fields(self):
        prompt = self._capture_prompt(
            {
                'title': 'Music Night',
                'product_type': 'event',
                'price': '5000',
                'event_date': '2026-09-01T18:00',
                'venue_name': 'City Hall',
                'location': 'Lagos',
                'speakers': '',
            },
            ticket_types=[{'name': 'VIP', 'price': 10000, 'quantity': 50}],
        )

        self.assertIn('Event with tickets', prompt)
        self.assertIn('City Hall', prompt)
        self.assertIn('Ticket options', prompt)


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


class ProductSlugTests(TestCase):
    """Products get a URL slug from their title; the detail endpoint resolves
    either the slug or the numeric id."""

    def test_slug_is_generated_from_title(self):
        p = make_product(title='Great E-Book!')
        self.assertEqual(p.slug, 'great-e-book')

    def test_duplicate_titles_get_distinct_slugs(self):
        a = make_product(title='Same Title')
        b = make_product(title='Same Title')
        self.assertNotEqual(a.slug, b.slug)
        self.assertTrue(b.slug.startswith('same-title'))

    def test_detail_resolves_by_slug_and_by_id(self):
        p = make_product(title='Findable Thing')
        by_slug = self.client.get(f'/api/products/{p.slug}/')
        by_id = self.client.get(f'/api/products/{p.id}/')
        self.assertEqual(by_slug.status_code, 200)
        self.assertEqual(by_id.status_code, 200)
        self.assertEqual(by_slug.json()['id'], p.id)
        self.assertEqual(by_id.json()['slug'], p.slug)

    def test_unknown_slug_404s(self):
        self.assertEqual(self.client.get('/api/products/does-not-exist/').status_code, 404)


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


class ProductPublishStateTests(TestCase):
    """Drafts are hidden from buyers but stay intact for their owner."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.seller = make_seller()
        self.client_api = APIClient()

    def test_existing_products_default_to_published(self):
        # The migration adds is_published with default=True precisely so no
        # live listing silently disappears on deploy.
        product = make_product(owner=self.seller)
        self.assertTrue(product.is_published)

    def test_draft_is_absent_from_public_list(self):
        visible = make_product(owner=self.seller, title='Visible One')
        hidden = make_product(owner=self.seller, title='Hidden One', is_published=False)

        res = self.client_api.get('/api/products/')
        titles = [p['title'] for p in res.data['results']]

        self.assertIn(visible.title, titles)
        self.assertNotIn(hidden.title, titles)

    def test_draft_detail_404s_for_the_public(self):
        hidden = make_product(owner=self.seller, is_published=False)
        res = self.client_api.get(f'/api/products/{hidden.id}/')
        self.assertEqual(res.status_code, 404)

    def test_owner_can_still_preview_their_own_draft(self):
        hidden = make_product(owner=self.seller, is_published=False)
        self.client_api.force_authenticate(user=self.seller)
        res = self.client_api.get(f'/api/products/{hidden.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_published'])

    def test_seller_can_toggle_publish_state(self):
        product = make_product(owner=self.seller)
        self.client_api.force_authenticate(user=self.seller)

        res = self.client_api.post(f'/api/products/my-products/{product.id}/publish/', {}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_published'])
        product.refresh_from_db()
        self.assertFalse(product.is_published)

        # Explicit value rather than a flip.
        res = self.client_api.post(
            f'/api/products/my-products/{product.id}/publish/',
            {'is_published': True}, format='json',
        )
        self.assertTrue(res.data['is_published'])

    def test_cannot_toggle_someone_elses_product(self):
        other = make_seller()
        product = make_product(owner=other)
        self.client_api.force_authenticate(user=self.seller)
        res = self.client_api.post(f'/api/products/my-products/{product.id}/publish/', {}, format='json')
        self.assertEqual(res.status_code, 404)
        product.refresh_from_db()
        self.assertTrue(product.is_published, "another seller's product was modified")


class ProductReviewTests(TestCase):
    """Only verified buyers can review, once each."""

    def setUp(self):
        from rest_framework.test import APIClient
        from apps.payments.models import Payment
        self.Payment = Payment
        self.seller = make_seller()
        self.product = make_product(owner=self.seller)
        self.buyer = make_user()
        self.client_api = APIClient()

    def _buy(self, user=None, product=None):
        """Give `user` a completed purchase of `product`."""
        payment = make_payment(
            user=user or self.buyer,
            product=product or self.product,
            status=self.Payment.PaymentStatus.SUCCESS,
        )
        return payment

    def test_non_purchaser_cannot_review(self):
        self.client_api.force_authenticate(user=self.buyer)
        res = self.client_api.post(
            f'/api/products/{self.product.id}/reviews/',
            {'rating': 5, 'comment': 'Never bought it'}, format='json',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(Review.objects.count(), 0)

    def test_pending_payment_does_not_unlock_a_review(self):
        # A checkout that never completed must not count as a purchase.
        make_payment(user=self.buyer, product=self.product)  # defaults to PENDING
        self.client_api.force_authenticate(user=self.buyer)
        res = self.client_api.post(
            f'/api/products/{self.product.id}/reviews/',
            {'rating': 5}, format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_purchaser_can_review(self):
        self._buy()
        self.client_api.force_authenticate(user=self.buyer)
        res = self.client_api.post(
            f'/api/products/{self.product.id}/reviews/',
            {'rating': 4, 'comment': 'Solid guide.'}, format='json',
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Review.objects.count(), 1)

    def test_second_review_updates_instead_of_duplicating(self):
        self._buy()
        self.client_api.force_authenticate(user=self.buyer)
        url = f'/api/products/{self.product.id}/reviews/'
        self.client_api.post(url, {'rating': 2, 'comment': 'First take'}, format='json')
        res = self.client_api.post(url, {'rating': 5, 'comment': 'Changed my mind'}, format='json')

        self.assertEqual(res.status_code, 200)
        self.assertEqual(Review.objects.count(), 1, 'a duplicate review row was created')
        review = Review.objects.get()
        self.assertEqual(review.rating, 5)
        self.assertEqual(review.comment, 'Changed my mind')

    def test_seller_cannot_review_own_product(self):
        # Even if the seller somehow has a purchase row against their own item.
        self._buy(user=self.seller)
        self.client_api.force_authenticate(user=self.seller)
        res = self.client_api.post(
            f'/api/products/{self.product.id}/reviews/',
            {'rating': 5}, format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_rating_must_be_within_range(self):
        self._buy()
        self.client_api.force_authenticate(user=self.buyer)
        for bad in (0, 6, 99):
            res = self.client_api.post(
                f'/api/products/{self.product.id}/reviews/',
                {'rating': bad}, format='json',
            )
            self.assertEqual(res.status_code, 400, f'rating {bad} was accepted')

    def test_anonymous_gets_401_not_a_crash(self):
        res = self.client_api.post(
            f'/api/products/{self.product.id}/reviews/',
            {'rating': 5}, format='json',
        )
        self.assertEqual(res.status_code, 401)

    def test_reviews_are_publicly_listable_without_leaking_emails(self):
        self._buy()
        Review.objects.create(product=self.product, user=self.buyer, rating=5, comment='Great')

        res = self.client_api.get(f'/api/products/{self.product.id}/reviews/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['review_count'], 1)
        self.assertEqual(res.data['average_rating'], 5.0)
        body = str(res.data)
        self.assertNotIn(self.buyer.email, body, 'reviewer email leaked into a public response')

    def test_product_payload_exposes_aggregates(self):
        buyer2 = make_user()
        self._buy()
        self._buy(user=buyer2)
        Review.objects.create(product=self.product, user=self.buyer, rating=5)
        Review.objects.create(product=self.product, user=buyer2, rating=2)

        res = self.client_api.get(f'/api/products/{self.product.id}/')
        self.assertEqual(res.data['average_rating'], 3.5)
        self.assertEqual(res.data['review_count'], 2)

    def test_unreviewed_product_reports_none_not_zero(self):
        # None and 0 must stay distinguishable — "no reviews" is not "rated 0".
        res = self.client_api.get(f'/api/products/{self.product.id}/')
        self.assertIsNone(res.data['average_rating'])
        self.assertEqual(res.data['review_count'], 0)

    def test_list_endpoint_annotates_ratings(self):
        self._buy()
        Review.objects.create(product=self.product, user=self.buyer, rating=4)
        res = self.client_api.get('/api/products/')
        row = next(p for p in res.data['results'] if p['id'] == self.product.id)
        self.assertEqual(row['average_rating'], 4.0)
        self.assertEqual(row['review_count'], 1)

    def test_buyer_can_delete_own_review(self):
        self._buy()
        Review.objects.create(product=self.product, user=self.buyer, rating=3)
        self.client_api.force_authenticate(user=self.buyer)
        res = self.client_api.delete(f'/api/products/{self.product.id}/reviews/mine/')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(Review.objects.count(), 0)

    def test_cannot_delete_another_persons_review(self):
        other = make_user()
        self._buy()
        Review.objects.create(product=self.product, user=self.buyer, rating=3)
        self.client_api.force_authenticate(user=other)
        res = self.client_api.delete(f'/api/products/{self.product.id}/reviews/mine/')
        self.assertEqual(res.status_code, 404)
        self.assertEqual(Review.objects.count(), 1, "someone else's review was deleted")


class SellerAnalyticsRatingTests(TestCase):
    """The dashboard's avg_rating is a real store-wide figure, not a placeholder."""

    def setUp(self):
        from rest_framework.test import APIClient
        from apps.payments.models import Payment
        self.Payment = Payment
        self.seller = make_seller()
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.seller)

    def _review(self, product, rating):
        buyer = make_user()
        make_payment(user=buyer, product=product, status=self.Payment.PaymentStatus.SUCCESS)
        return Review.objects.create(product=product, user=buyer, rating=rating)

    def test_no_reviews_reports_none_not_zero(self):
        make_product(owner=self.seller)
        res = self.client_api.get('/api/products/analytics/')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['avg_rating'])
        self.assertEqual(res.data['review_count'], 0)

    def test_averages_across_all_of_the_sellers_products(self):
        a = make_product(owner=self.seller)
        b = make_product(owner=self.seller)
        self._review(a, 5)
        self._review(a, 4)
        self._review(b, 3)

        res = self.client_api.get('/api/products/analytics/')
        self.assertEqual(res.data['avg_rating'], 4.0)
        self.assertEqual(res.data['review_count'], 3)

    def test_another_sellers_reviews_are_excluded(self):
        mine = make_product(owner=self.seller)
        theirs = make_product(owner=make_seller())
        self._review(mine, 5)
        self._review(theirs, 1)

        res = self.client_api.get('/api/products/analytics/')
        self.assertEqual(res.data['avg_rating'], 5.0, "another seller's reviews leaked in")
        self.assertEqual(res.data['review_count'], 1)

    def test_rating_ignores_the_selected_period(self):
        # A rating earned earlier must not vanish just because the seller is
        # looking at a short window with no recent reviews.
        product = make_product(owner=self.seller)
        review = self._review(product, 5)
        Review.objects.filter(pk=review.pk).update(
            created_at=timezone.now() - timedelta(days=400)
        )

        res = self.client_api.get('/api/products/analytics/?time_range=7d')
        self.assertEqual(res.data['avg_rating'], 5.0)
        self.assertEqual(res.data['review_count'], 1)


class ReviewEligibilityConsistencyTests(TestCase):
    """
    The flag the product page reads and the rule the write endpoint enforces
    must agree. They used to drift: can_review checked only the purchase, so
    a seller holding a purchase of their own product was shown a form that
    then 403'd on submit.
    """

    def setUp(self):
        from rest_framework.test import APIClient
        from apps.payments.models import Payment
        self.Payment = Payment
        self.seller = make_seller()
        self.product = make_product(owner=self.seller)
        self.client_api = APIClient()

    def test_owner_with_a_purchase_is_not_offered_the_form(self):
        # Contrive the state the cart normally prevents.
        make_payment(user=self.seller, product=self.product,
                     status=self.Payment.PaymentStatus.SUCCESS)
        self.client_api.force_authenticate(user=self.seller)

        listing = self.client_api.get(f'/api/products/{self.product.id}/reviews/')
        self.assertFalse(listing.data['can_review'], 'seller was offered a form they cannot submit')

        posting = self.client_api.post(
            f'/api/products/{self.product.id}/reviews/', {'rating': 5}, format='json',
        )
        self.assertEqual(posting.status_code, 403)

    def test_flag_matches_the_endpoint_for_a_real_buyer(self):
        buyer = make_user()
        make_payment(user=buyer, product=self.product,
                     status=self.Payment.PaymentStatus.SUCCESS)
        self.client_api.force_authenticate(user=buyer)

        listing = self.client_api.get(f'/api/products/{self.product.id}/reviews/')
        self.assertTrue(listing.data['can_review'])

        posting = self.client_api.post(
            f'/api/products/{self.product.id}/reviews/', {'rating': 5}, format='json',
        )
        self.assertEqual(posting.status_code, 201)

    def test_anonymous_visitor_is_not_offered_the_form(self):
        listing = self.client_api.get(f'/api/products/{self.product.id}/reviews/')
        self.assertFalse(listing.data['can_review'])


class ProductDescriptionNotesTests(TestCase):
    """
    A seller's own words are the most valuable input the model gets — for an
    eBook or audio file they are the only real detail beyond a title, a type
    and a price.
    """

    _capture_prompt = staticmethod(capture_ai_prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_seller_notes_are_sent_as_the_brief(self):
        prompt = self._capture_prompt({
            'title': 'Lighting for Beginners',
            'product_type': 'pdf',
            'notes': 'Covers three-point lighting and shooting on a phone.',
        })

        self.assertIn('three-point lighting', prompt)
        self.assertIn("Rewrite the seller's own notes", prompt)
        # The model must not embellish beyond what the seller claimed.
        self.assertIn('do not add features', prompt.lower().replace('  ', ' '))

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_without_notes_it_writes_from_the_facts(self):
        prompt = self._capture_prompt({
            'title': 'Lighting for Beginners',
            'product_type': 'pdf',
        })

        self.assertNotIn("Rewrite the seller's own notes", prompt)
        self.assertIn('Do not invent claims', prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_blank_notes_do_not_trigger_rewrite_mode(self):
        prompt = self._capture_prompt({
            'title': 'Lighting for Beginners',
            'product_type': 'pdf',
            'notes': '   ',
        })
        self.assertNotIn("Rewrite the seller's own notes", prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_brand_name_is_included_when_present(self):
        prompt = self._capture_prompt({
            'title': 'Lighting for Beginners',
            'product_type': 'pdf',
            'brand_name': 'Demo Store',
        })
        self.assertIn('Demo Store', prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_very_long_notes_are_truncated(self):
        prompt = self._capture_prompt({
            'title': 'Long One',
            'product_type': 'pdf',
            'notes': 'x' * 5000,
        })
        # Capped so one seller cannot blow up the request body.
        self.assertLess(prompt.count('x'), 2100)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_view_forwards_notes_and_uses_the_accounts_brand(self):
        from unittest import mock
        from rest_framework.test import APIClient

        seller = make_seller(brand_name='Real Brand')
        client = APIClient()
        client.force_authenticate(user=seller)

        with mock.patch(
            'products.views.generate_product_description', return_value='copy',
        ) as generate:
            client.post('/api/products/my-products/generate-description/', {
                'title': 'Lighting for Beginners',
                'product_type': 'pdf',
                'notes': 'My own rough notes.',
                # A client must not be able to claim someone else's shop name.
                'brand_name': 'Somebody Elses Shop',
            }, format='json')

        payload = generate.call_args.args[0]
        self.assertEqual(payload['notes'], 'My own rough notes.')
        self.assertEqual(payload['brand_name'], 'Real Brand')


class ProductDescriptionUnknownTypeTests(TestCase):
    """
    The generate button is available as soon as there is a title, so the
    seller may not have chosen a product type yet. An unknown type must make
    the copy format-neutral rather than guessing — the form's dropdown
    defaults to "event", and guessing is what described eBooks as events.
    """

    _capture_prompt = staticmethod(capture_ai_prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_unknown_type_is_omitted_from_the_details(self):
        prompt = self._capture_prompt({'title': 'Untyped Thing', 'product_type': ''})
        self.assertIn('Untyped Thing', prompt)
        self.assertNotIn("'Type'", prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_unknown_type_asks_for_format_neutral_copy(self):
        prompt = self._capture_prompt({'title': 'Untyped Thing', 'product_type': ''})
        self.assertIn('product type is not known yet', prompt)
        self.assertIn('Do not call it an event, a ticket, a download', prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_unknown_type_never_pulls_in_event_fields(self):
        prompt = self._capture_prompt(
            {
                'title': 'Untyped Thing',
                'product_type': '',
                'venue_name': 'City Hall',
                'speakers': 'Someone',
            },
            ticket_types=[{'name': 'VIP', 'price': 1, 'quantity': 1}],
        )
        self.assertNotIn('City Hall', prompt)
        self.assertNotIn('Ticket options', prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_a_chosen_type_still_states_it(self):
        prompt = self._capture_prompt({'title': 'My eBook', 'product_type': 'pdf'})
        self.assertIn('eBook (PDF download)', prompt)
        self.assertNotIn('product type is not known yet', prompt)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_notes_still_drive_a_rewrite_without_a_type(self):
        prompt = self._capture_prompt({
            'title': 'Untyped Thing',
            'product_type': '',
            'notes': 'It teaches phone photography.',
        })
        self.assertIn("Rewrite the seller's own notes", prompt)
        self.assertIn('phone photography', prompt)
        self.assertIn('product type is not known yet', prompt)


class ProductDescriptionFailureDiagnosticsTests(TestCase):
    """
    When the AI call fails, the reason has to reach the log. It previously
    went through raise_for_status() and a warning on a logger with no
    handler, so a failure showed up only as Django's bare "Bad Gateway" with
    nothing explaining it.
    """

    @staticmethod
    def _call_with_response(status_code, body, ok=None):
        from unittest import mock
        from products.ai import generate_product_description

        class FakeResponse:
            status_code = None
            text = ''

            @property
            def ok(self):
                return 200 <= self.status_code < 300

            def json(self):
                import json as _json
                return _json.loads(self.text)

        resp = FakeResponse()
        resp.status_code = status_code
        resp.text = body

        with mock.patch('products.ai.requests.post', return_value=resp):
            return generate_product_description({'title': 'X', 'product_type': 'pdf'})

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_provider_error_body_is_logged(self):
        with self.assertLogs('products.ai', level='ERROR') as logs:
            result = self._call_with_response(429, '{"error":{"message":"Rate limit reached"}}')

        self.assertEqual(result, '')
        joined = '\n'.join(logs.output)
        self.assertIn('429', joined)
        self.assertIn('Rate limit reached', joined, 'the provider reason was not logged')

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_decommissioned_model_reason_is_logged(self):
        with self.assertLogs('products.ai', level='ERROR') as logs:
            self._call_with_response(400, '{"error":{"message":"model has been decommissioned"}}')
        self.assertIn('decommissioned', '\n'.join(logs.output))

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_unreachable_provider_is_logged(self):
        from unittest import mock
        import requests as requests_lib
        from products.ai import generate_product_description

        with mock.patch(
            'products.ai.requests.post',
            side_effect=requests_lib.ConnectionError('name resolution failed'),
        ):
            with self.assertLogs('products.ai', level='ERROR') as logs:
                result = generate_product_description({'title': 'X', 'product_type': 'pdf'})

        self.assertEqual(result, '')
        self.assertIn('unreachable', '\n'.join(logs.output))

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_unexpected_shape_is_logged_with_the_body(self):
        with self.assertLogs('products.ai', level='ERROR') as logs:
            result = self._call_with_response(200, '{"unexpected":"shape"}')
        self.assertEqual(result, '')
        self.assertIn('Unexpected', '\n'.join(logs.output))

    @override_settings(SUPPORT_AI_API_KEY='')
    def test_missing_key_returns_a_config_error_not_try_again(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=make_seller())
        res = client.post('/api/products/my-products/generate-description/', {
            'title': 'X', 'product_type': 'pdf',
        }, format='json')

        self.assertEqual(res.status_code, 503)
        self.assertIn('not configured', res.data['message'])
        self.assertNotIn('try again', res.data['message'].lower())


class CouponScopingTests(TestCase):
    """apply_coupon only ever touches the issuing seller's own cart lines."""

    def setUp(self):
        from .models import Coupon
        self.Coupon = Coupon
        self.seller = make_seller()
        self.other_seller = make_seller()
        self.buyer = make_user()

    def _coupon(self, **kwargs):
        kwargs.setdefault('seller', self.seller)
        kwargs.setdefault('code', 'SAVE20')
        kwargs.setdefault('discount_type', self.Coupon.DiscountType.PERCENT)
        kwargs.setdefault('value', Decimal('20'))
        return self.Coupon.objects.create(**kwargs)

    def test_percent_discount_applies_only_to_matching_seller(self):
        from .coupons import apply_coupon

        coupon = self._coupon()
        mine = make_product(owner=self.seller, price=Decimal('1000.00'))
        theirs = make_product(owner=self.other_seller, price=Decimal('500.00'))

        cart_lines = [
            {'product': mine, 'quantity': 1, 'unit_price': mine.price},
            {'product': theirs, 'quantity': 1, 'unit_price': theirs.price},
        ]
        _, discounts = apply_coupon(coupon.code, cart_lines, self.buyer)

        self.assertEqual(discounts[0], Decimal('200.00'))  # 20% of 1000
        self.assertEqual(discounts[1], Decimal('0'))  # untouched — different seller

    def test_code_is_matched_case_insensitively_and_trimmed(self):
        from .coupons import apply_coupon

        self._coupon(code='LAUNCH')
        product = make_product(owner=self.seller, price=Decimal('1000.00'))
        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]

        coupon, discounts = apply_coupon('  launch  ', cart_lines, self.buyer)
        self.assertEqual(coupon.code, 'LAUNCH')
        self.assertGreater(discounts[0], Decimal('0'))

    def test_scoped_to_specific_products_skips_the_rest(self):
        from .coupons import apply_coupon

        coupon = self._coupon()
        included = make_product(owner=self.seller, price=Decimal('1000.00'))
        excluded = make_product(owner=self.seller, price=Decimal('1000.00'))
        coupon.products.add(included)

        cart_lines = [
            {'product': included, 'quantity': 1, 'unit_price': included.price},
            {'product': excluded, 'quantity': 1, 'unit_price': excluded.price},
        ]
        _, discounts = apply_coupon(coupon.code, cart_lines, self.buyer)

        self.assertGreater(discounts[0], Decimal('0'))
        self.assertEqual(discounts[1], Decimal('0'))

    def test_fixed_discount_never_goes_past_free(self):
        from .coupons import apply_coupon

        coupon = self._coupon(discount_type=self.Coupon.DiscountType.FIXED, value=Decimal('5000'))
        product = make_product(owner=self.seller, price=Decimal('2000.00'))
        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]

        _, discounts = apply_coupon(coupon.code, cart_lines, self.buyer)
        self.assertEqual(discounts[0], Decimal('2000.00'))

    def test_unknown_code_raises(self):
        from .coupons import apply_coupon, CouponError

        product = make_product(owner=self.seller, price=Decimal('1000.00'))
        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]
        with self.assertRaises(CouponError):
            apply_coupon('NOPE', cart_lines, self.buyer)

    def test_inactive_coupon_raises(self):
        from .coupons import apply_coupon, CouponError

        coupon = self._coupon(is_active=False)
        product = make_product(owner=self.seller, price=Decimal('1000.00'))
        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]
        with self.assertRaises(CouponError):
            apply_coupon(coupon.code, cart_lines, self.buyer)

    def test_expired_coupon_raises(self):
        from .coupons import apply_coupon, CouponError

        coupon = self._coupon(expires_at=timezone.now() - timedelta(days=1))
        product = make_product(owner=self.seller, price=Decimal('1000.00'))
        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]
        with self.assertRaises(CouponError):
            apply_coupon(coupon.code, cart_lines, self.buyer)

    def test_coupon_matching_nothing_in_cart_raises(self):
        from .coupons import apply_coupon, CouponError

        coupon = self._coupon()
        theirs = make_product(owner=self.other_seller, price=Decimal('1000.00'))
        cart_lines = [{'product': theirs, 'quantity': 1, 'unit_price': theirs.price}]
        with self.assertRaises(CouponError):
            apply_coupon(coupon.code, cart_lines, self.buyer)

    def test_max_redemptions_exhausted_raises(self):
        from .coupons import apply_coupon, CouponError
        from apps.payments.models import Payment, Purchase

        coupon = self._coupon(max_redemptions=1)
        product = make_product(owner=self.seller, price=Decimal('1000.00'))

        payment = make_payment(user=self.buyer, product=product, status=Payment.PaymentStatus.SUCCESS)
        payment.purchases.update(coupon=coupon)

        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]
        with self.assertRaises(CouponError):
            apply_coupon(coupon.code, cart_lines, make_user())

    def test_per_buyer_limit_blocks_repeat_use_by_same_buyer(self):
        from .coupons import apply_coupon, CouponError
        from apps.payments.models import Payment

        coupon = self._coupon(max_redemptions_per_buyer=1)
        product = make_product(owner=self.seller, price=Decimal('1000.00'))

        payment = make_payment(user=self.buyer, product=product, status=Payment.PaymentStatus.SUCCESS)
        payment.purchases.update(coupon=coupon)

        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]
        # Same buyer, already redeemed once — blocked.
        with self.assertRaises(CouponError):
            apply_coupon(coupon.code, cart_lines, self.buyer)
        # A different buyer is unaffected by the first buyer's usage.
        _, discounts = apply_coupon(coupon.code, cart_lines, make_user())
        self.assertGreater(discounts[0], Decimal('0'))

    def test_pending_purchase_does_not_count_toward_limit(self):
        from .coupons import apply_coupon
        from apps.payments.models import Payment

        coupon = self._coupon(max_redemptions=1)
        product = make_product(owner=self.seller, price=Decimal('1000.00'))

        # A payment that was created but never completed must not burn the
        # one available redemption.
        payment = make_payment(user=self.buyer, product=product, status=Payment.PaymentStatus.PENDING)
        payment.purchases.update(coupon=coupon)

        cart_lines = [{'product': product, 'quantity': 1, 'unit_price': product.price}]
        _, discounts = apply_coupon(coupon.code, cart_lines, make_user())
        self.assertGreater(discounts[0], Decimal('0'))


class CouponSerializerValidationTests(TestCase):
    """Percent coupons are capped at 50% so a payout can never go negative."""

    def setUp(self):
        self.seller = make_seller()

    def _serializer(self, data):
        from unittest.mock import Mock
        from .serializers import CouponSerializer
        request = Mock(user=self.seller)
        return CouponSerializer(data=data, context={'request': request})

    def test_percent_over_fifty_is_rejected(self):
        serializer = self._serializer({'code': 'HALFOFF', 'discount_type': 'percent', 'value': '60'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('value', serializer.errors)

    def test_percent_at_fifty_is_allowed(self):
        serializer = self._serializer({'code': 'HALFOFF', 'discount_type': 'percent', 'value': '50'})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_fixed_discount_is_not_capped_by_the_percent_rule(self):
        serializer = self._serializer({'code': 'BIGFIXED', 'discount_type': 'fixed', 'value': '9000'})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_duplicate_code_is_rejected(self):
        from .models import Coupon
        Coupon.objects.create(
            seller=self.seller, code='TAKEN', discount_type='percent', value=Decimal('10')
        )
        serializer = self._serializer({'code': 'taken', 'discount_type': 'percent', 'value': '10'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('code', serializer.errors)

    def test_zero_value_is_rejected(self):
        serializer = self._serializer({'code': 'ZERO', 'discount_type': 'fixed', 'value': '0'})
        self.assertFalse(serializer.is_valid())

    def test_seller_can_only_scope_to_own_products(self):
        other_seller = make_seller()
        their_product = make_product(owner=other_seller)
        serializer = self._serializer({
            'code': 'SCOPED', 'discount_type': 'percent', 'value': '10',
            'products': [their_product.id],
        })
        self.assertFalse(serializer.is_valid())


class CouponCheckoutIntegrationTests(TestCase):
    """
    End-to-end: a coupon applied at checkout discounts only the matching
    seller's lines, and commission is still calculated off the pre-discount
    list price — the seller absorbs the discount, Darra's cut doesn't move.
    """

    def setUp(self):
        from .models import Coupon
        self.Coupon = Coupon
        self.seller = make_seller()
        self.buyer = make_user()
        self.product = make_product(owner=self.seller, price=Decimal('10000.00'))
        self.coupon = Coupon.objects.create(
            seller=self.seller, code='LAUNCH20', discount_type='percent', value=Decimal('20'),
        )

    def test_checkout_applies_discount_and_commission_stays_on_list_price(self):
        from apps.payments.services import PaymentService, PaystackService
        from apps.payments.models import SellerCommission

        payment = PaymentService.create_payment_from_cart(
            self.buyer,
            [{'product_id': self.product.id, 'quantity': 1}],
            'paystack',
            coupon_code='launch20',
        )

        purchase = payment.purchases.get()
        self.assertEqual(purchase.unit_price, Decimal('8000.00'))  # 20% off 10000
        self.assertEqual(purchase.total_price, Decimal('8000.00'))
        self.assertEqual(purchase.discount_amount, Decimal('2000.00'))
        self.assertEqual(purchase.coupon_id, self.coupon.id)
        self.assertEqual(payment.amount, Decimal('8000.00'))  # what Paystack actually charges

        commission = PaystackService().create_seller_commission(purchase)
        self.assertEqual(commission.commission_amount, Decimal('400.00'))  # 4% of the 10000 list price
        self.assertEqual(commission.seller_payout, Decimal('7600.00'))  # 8000 collected - 400 commission
        self.assertEqual(SellerCommission.objects.get(purchase=purchase).product_price, Decimal('8000.00'))

    def test_checkout_without_a_coupon_is_unaffected(self):
        from apps.payments.services import PaymentService

        payment = PaymentService.create_payment_from_cart(
            self.buyer,
            [{'product_id': self.product.id, 'quantity': 1}],
            'paystack',
        )
        purchase = payment.purchases.get()
        self.assertEqual(purchase.unit_price, Decimal('10000.00'))
        self.assertEqual(purchase.discount_amount, Decimal('0'))
        self.assertIsNone(purchase.coupon_id)

    def test_checkout_rejects_an_invalid_coupon(self):
        from apps.payments.services import PaymentService
        from django.core.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            PaymentService.create_payment_from_cart(
                self.buyer,
                [{'product_id': self.product.id, 'quantity': 1}],
                'paystack',
                coupon_code='DOES-NOT-EXIST',
            )

    def test_validate_endpoint_reports_the_discount_without_charging(self):
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.buyer)
        res = client.post(
            '/api/payments/coupons/validate/',
            {'code': 'launch20', 'items': [{'product_id': self.product.id, 'quantity': 1}]},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['discount_total'], '2000.00')
        self.assertEqual(len(res.data['lines']), 1)
        self.assertEqual(res.data['lines'][0]['product_id'], self.product.id)


class SellerCouponApiTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.seller = make_seller()
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.seller)

    def test_seller_can_create_and_list_a_coupon(self):
        res = self.client_api.post(
            '/api/products/coupons/', {'code': 'NEWCODE', 'discount_type': 'percent', 'value': '15'},
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)

        res = self.client_api.get('/api/products/coupons/')
        self.assertEqual(res.status_code, 200)
        codes = [c['code'] for c in res.data]
        self.assertIn('NEWCODE', codes)

    def test_cannot_edit_another_sellers_coupon(self):
        from .models import Coupon
        other_seller = make_seller()
        coupon = Coupon.objects.create(
            seller=other_seller, code='NOTYOURS', discount_type='percent', value=Decimal('10'),
        )
        res = self.client_api.patch(
            f'/api/products/coupons/{coupon.id}/', {'is_active': False}, format='json'
        )
        self.assertEqual(res.status_code, 404)

    def test_list_reports_redemptions_and_revenue(self):
        from .models import Coupon
        from apps.payments.services import PaymentService

        product = make_product(owner=self.seller, price=Decimal('1000.00'))
        Coupon.objects.create(seller=self.seller, code='TRACKED', discount_type='percent', value=Decimal('10'))
        buyer = make_user()
        payment = PaymentService.create_payment_from_cart(
            buyer, [{'product_id': product.id, 'quantity': 1}], 'paystack', coupon_code='TRACKED',
        )
        from apps.payments.services import PaymentService as PS
        PS.process_successful_payment(payment)

        res = self.client_api.get('/api/products/coupons/')
        row = next(c for c in res.data if c['code'] == 'TRACKED')
        self.assertEqual(row['redemptions'], 1)
        self.assertEqual(Decimal(row['revenue']), Decimal('900.00'))
