"""
Tests for the payment webhook and fulfilment.

The webhook is the security-critical endpoint: it is unauthenticated by
necessity and, if it can be forged, grants products for free and credits
seller earnings that turn into real payouts. These tests pin the two defences
(signature + provider re-verification) and the idempotency guard.

Provider verification is mocked so nothing hits the network and the "provider
says X" cases are deterministic.
"""

import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from core.test_factories import make_payment, make_user, make_product
from .models import Payment, UserLibrary

PAYSTACK_KEY = 'sk_test_webhook_key'
FLW_HASH = 'test-flutterwave-secret-hash'


def paystack_sig(raw_body, key=PAYSTACK_KEY):
    return hmac.new(key.encode(), raw_body, hashlib.sha512).hexdigest()


@override_settings(
    PAYSTACK_SECRET_KEY=PAYSTACK_KEY,
    FLUTTERWAVE_SECRET_HASH=FLW_HASH,
)
class PaymentWebhookSecurityTests(TestCase):
    def setUp(self):
        cache.clear()  # webhook is throttled; don't let state leak between tests
        self.url = '/api/payments/webhook/'
        self.payment = make_payment(amount='5000.00', payment_provider='paystack')

    def _post(self, body, **headers):
        return self.client.post(
            self.url, data=json.dumps(body),
            content_type='application/json', **headers,
        )

    def assert_not_fulfilled(self):
        self.payment.refresh_from_db()
        self.assertNotEqual(self.payment.status, Payment.PaymentStatus.SUCCESS)
        self.assertEqual(UserLibrary.objects.filter(user=self.payment.user).count(), 0)

    # --- the original exploit -------------------------------------------
    def test_unsigned_forged_webhook_is_rejected(self):
        res = self._post({'data': {'reference': self.payment.reference, 'status': 'success'}})
        self.assertEqual(res.status_code, 401)
        self.assert_not_fulfilled()

    def test_wrong_paystack_signature_rejected(self):
        body = {'data': {'reference': self.payment.reference, 'status': 'success'}}
        res = self._post(body, HTTP_X_PAYSTACK_SIGNATURE='deadbeef')
        self.assertEqual(res.status_code, 401)
        self.assert_not_fulfilled()

    def test_wrong_flutterwave_hash_rejected(self):
        p = make_payment(amount='5000.00', payment_provider='flutterwave')
        res = self._post({'tx_ref': p.reference, 'status': 'successful'},
                         HTTP_VERIF_HASH='not-the-hash')
        self.assertEqual(res.status_code, 401)
        p.refresh_from_db()
        self.assertNotEqual(p.status, Payment.PaymentStatus.SUCCESS)

    # --- signed, but the body is still never trusted --------------------
    @patch('apps.payments.views.PaystackService.verify_payment')
    def test_valid_signature_but_provider_says_unpaid(self, mock_verify):
        mock_verify.return_value = {'data': {'status': 'failed', 'amount': 500000}}
        body = {'data': {'reference': self.payment.reference, 'status': 'success'}}
        raw = json.dumps(body).encode()
        res = self._post(body, HTTP_X_PAYSTACK_SIGNATURE=paystack_sig(raw))
        self.assertEqual(res.status_code, 200)  # acknowledged, but nothing granted
        self.assert_not_fulfilled()

    @patch('apps.payments.views.PaystackService.verify_payment')
    def test_amount_tampering_is_rejected(self, mock_verify):
        # Provider confirms success but for a DIFFERENT amount than the record.
        mock_verify.return_value = {'data': {'status': 'success', 'amount': 100}}  # 1 NGN in kobo
        body = {'data': {'reference': self.payment.reference, 'status': 'success'}}
        raw = json.dumps(body).encode()
        res = self._post(body, HTTP_X_PAYSTACK_SIGNATURE=paystack_sig(raw))
        self.assertEqual(res.status_code, 409)
        self.assert_not_fulfilled()

    @patch('apps.payments.views.PaystackService.verify_payment')
    def test_valid_signature_and_provider_confirms_grants_product(self, mock_verify):
        # 5000 NGN == 500000 kobo
        mock_verify.return_value = {'data': {'status': 'success', 'amount': 500000}}
        body = {'data': {'reference': self.payment.reference, 'status': 'success'}}
        raw = json.dumps(body).encode()
        res = self._post(body, HTTP_X_PAYSTACK_SIGNATURE=paystack_sig(raw))
        self.assertEqual(res.status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, Payment.PaymentStatus.SUCCESS)
        self.assertEqual(UserLibrary.objects.filter(user=self.payment.user).count(), 1)


class ProcessPaymentIdempotencyTests(TestCase):
    def test_processing_twice_does_not_duplicate_library_entries(self):
        from .services import PaymentService
        payment = make_payment(amount='2000.00')

        PaymentService.process_successful_payment(payment)
        first = UserLibrary.objects.filter(user=payment.user).count()

        PaymentService.process_successful_payment(payment)
        second = UserLibrary.objects.filter(user=payment.user).count()

        self.assertEqual(first, 1)
        self.assertEqual(second, 1)  # retry granted nothing extra

    def test_already_successful_payment_is_left_alone(self):
        from .services import PaymentService
        payment = make_payment(status=Payment.PaymentStatus.SUCCESS)
        # Should return without creating anything, not raise.
        PaymentService.process_successful_payment(payment)
        self.assertEqual(UserLibrary.objects.filter(user=payment.user).count(), 0)
