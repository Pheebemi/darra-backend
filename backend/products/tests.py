"""
Tests for product file privacy, seller-named ticket categories, and the
product list pagination/ordering.
"""

from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import serializers as drf

from core.test_factories import make_seller, make_product, make_event
from .models import Product, TicketCategory, TicketTier, private_product_storage, _r2_configured
from .serializers import ProductSerializer, parse_ticket_types


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
