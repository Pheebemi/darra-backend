"""
Tests for registration validation, the password reset flow, and that the
authentication rate limit actually fires (it was a silent no-op before).
"""

import json

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.test import TestCase
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

from core.test_factories import make_user

User = get_user_model()


class RegistrationValidationTests(TestCase):
    def setUp(self):
        cache.clear()

    def _register(self, **over):
        body = {
            'email': 'new@example.com',
            'password': 'Str0ng-Pass-42!',
            'full_name': 'New User',
            'user_type': 'buyer',
        }
        body.update(over)
        return self.client.post('/api/auth/register/', data=json.dumps(body),
                                content_type='application/json')

    def test_valid_registration_succeeds(self):
        res = self._register()
        self.assertEqual(res.status_code, 201)

    def test_common_password_is_rejected(self):
        res = self._register(password='password')
        self.assertEqual(res.status_code, 400)

    def test_all_numeric_password_is_rejected(self):
        res = self._register(password='12345678')
        self.assertEqual(res.status_code, 400)

    def test_duplicate_email_is_rejected(self):
        make_user(email='taken@example.com')
        res = self._register(email='taken@example.com')
        self.assertEqual(res.status_code, 400)


class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user(email='reset@example.com', is_verified=False)
        self.user.set_password('OldPass-123!')
        self.user.save()

    def _request(self, email):
        return self.client.post('/api/auth/password-reset/',
                                data=json.dumps({'email': email}),
                                content_type='application/json')

    def _link_parts(self):
        token = default_token_generator.make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        return uid, token

    def test_request_does_not_reveal_whether_account_exists(self):
        known = self._request('reset@example.com').json()['message']
        unknown = self._request('nobody@example.com').json()['message']
        self.assertEqual(known, unknown)

    def test_get_validates_a_good_link(self):
        uid, token = self._link_parts()
        res = self.client.get(f'/api/auth/password-reset/{uid}/{token}/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['valid'])

    def test_get_rejects_a_bad_token(self):
        uid, _ = self._link_parts()
        res = self.client.get(f'/api/auth/password-reset/{uid}/not-a-token/')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['valid'])

    def test_reset_sets_password_and_verifies_account(self):
        uid, token = self._link_parts()
        res = self.client.post(
            f'/api/auth/password-reset/{uid}/{token}/',
            data=json.dumps({'password': 'BrandNew-Pass-9!'}),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNew-Pass-9!'))
        self.assertFalse(self.user.check_password('OldPass-123!'))
        # An unverified user who proved control of their email is now verified.
        self.assertTrue(self.user.is_verified)

    def test_token_is_single_use(self):
        uid, token = self._link_parts()
        url = f'/api/auth/password-reset/{uid}/{token}/'
        self.client.post(url, data=json.dumps({'password': 'FirstReset-1!'}),
                         content_type='application/json')
        second = self.client.post(url, data=json.dumps({'password': 'SecondReset-2!'}),
                                  content_type='application/json')
        self.assertEqual(second.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('FirstReset-1!'))

    def test_weak_password_is_rejected_on_reset(self):
        uid, token = self._link_parts()
        res = self.client.post(f'/api/auth/password-reset/{uid}/{token}/',
                               data=json.dumps({'password': 'password'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)


class AuthThrottleTests(TestCase):
    """The scoped throttles used to be a no-op. Prove login now blocks."""

    def setUp(self):
        cache.clear()

    def test_login_is_rate_limited_after_repeated_attempts(self):
        make_user(email='target@example.com')
        codes = []
        # Limit is 10/minute per IP.
        for i in range(13):
            res = self.client.post(
                '/api/auth/login/',
                data=json.dumps({'email': 'target@example.com', 'password': f'wrong{i}'}),
                content_type='application/json',
            )
            codes.append(res.status_code)
        self.assertIn(429, codes, "login endpoint never throttled")
        self.assertEqual(codes.index(429), 10)  # first ten allowed, then blocked


class StoreRatingTests(TestCase):
    """
    Shop ratings are derived from the reviews on a seller's products, not
    collected separately — and a public storefront must not expose drafts.
    """

    def setUp(self):
        from rest_framework.test import APIClient
        from core.test_factories import make_seller
        self.client_api = APIClient()
        self.seller = make_seller(brand_name='Rated Store', brand_slug='rated-store')

    def _reviewed_product(self, ratings, owner=None, **kwargs):
        from core.test_factories import make_product, make_payment, make_user
        from apps.payments.models import Payment
        from products.models import Review
        product = make_product(owner=owner or self.seller, **kwargs)
        for rating in ratings:
            buyer = make_user()
            make_payment(user=buyer, product=product, status=Payment.PaymentStatus.SUCCESS)
            Review.objects.create(product=product, user=buyer, rating=rating)
        return product

    def test_store_detail_derives_rating_from_product_reviews(self):
        self._reviewed_product([5, 4])
        self._reviewed_product([3])

        res = self.client_api.get('/api/auth/store/rated-store/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['average_rating'], 4.0)
        self.assertEqual(res.data['review_count'], 3)

    def test_unrated_store_reports_none_not_zero(self):
        from core.test_factories import make_product
        make_product(owner=self.seller)
        res = self.client_api.get('/api/auth/store/rated-store/')
        self.assertIsNone(res.data['average_rating'])
        self.assertEqual(res.data['review_count'], 0)

    def test_store_page_hides_unpublished_products(self):
        from core.test_factories import make_product
        make_product(owner=self.seller, title='Live One', is_published=True)
        make_product(owner=self.seller, title='Secret Draft', is_published=False)

        res = self.client_api.get('/api/auth/store/rated-store/')
        titles = [p['title'] for p in res.data['products']]
        self.assertIn('Live One', titles)
        self.assertNotIn('Secret Draft', titles, 'a draft leaked onto the public storefront')

    def test_stores_list_includes_rating(self):
        self._reviewed_product([5, 4])
        res = self.client_api.get('/api/auth/stores/')
        row = next(s for s in res.data['results'] if s['brand_slug'] == 'rated-store')
        self.assertEqual(row['average_rating'], 4.5)
        self.assertEqual(row['review_count'], 2)

    def test_stores_list_product_count_is_not_inflated_by_reviews(self):
        # Joining through reviews fans each product into one row per review.
        # Without distinct=True a 1-product store with 3 reviews would report
        # 3 products.
        self._reviewed_product([5, 4, 3])

        res = self.client_api.get('/api/auth/stores/')
        row = next(s for s in res.data['results'] if s['brand_slug'] == 'rated-store')
        self.assertEqual(row['product_count'], 1)
        self.assertEqual(row['review_count'], 3)

    def test_stores_list_product_count_excludes_drafts(self):
        from core.test_factories import make_product
        make_product(owner=self.seller, is_published=True)
        make_product(owner=self.seller, is_published=False)

        res = self.client_api.get('/api/auth/stores/')
        row = next(s for s in res.data['results'] if s['brand_slug'] == 'rated-store')
        self.assertEqual(row['product_count'], 1, 'drafts were counted on the public listing')

    def test_another_sellers_reviews_do_not_affect_this_store(self):
        from core.test_factories import make_seller
        other = make_seller(brand_name='Other Store', brand_slug='other-store')
        self._reviewed_product([5])
        self._reviewed_product([1], owner=other)

        res = self.client_api.get('/api/auth/store/rated-store/')
        self.assertEqual(res.data['average_rating'], 5.0)
        self.assertEqual(res.data['review_count'], 1)
