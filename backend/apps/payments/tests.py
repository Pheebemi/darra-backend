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
from unittest.mock import patch, Mock

from django.core.cache import cache
from django.test import TestCase, override_settings

from core.test_factories import make_payment, make_user, make_product, make_seller
from users.models import BankDetail
from .models import Payment, UserLibrary, PayoutRequest
from .services import FlutterwaveService

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


def _bank_for(seller):
    return BankDetail.objects.create(
        user=seller, bank_code='044', bank_name='Access Bank',
        account_number='0690000031', account_name='Test Seller',
    )


def _flw_transfer_response(transfer_id=999, accepted=True):
    resp = Mock()
    resp.ok = accepted
    resp.content = b'{"status": "success"}'
    resp.json.return_value = (
        {'status': 'success', 'data': {'id': transfer_id, 'status': 'NEW'}}
        if accepted else
        {'status': 'error', 'message': 'Invalid account'}
    )
    return resp


class PayoutInitiationTests(TestCase):
    """Approving a payout initiates a Flutterwave transfer — it must move to
    'processing' (never 'completed' here), be idempotent, and fail cleanly."""

    def setUp(self):
        # The seller bears the fee: mock the fee lookup so tests never hit the
        # network, and so we can assert we send (amount - fee).
        fee_patch = patch.object(FlutterwaveService, 'get_transfer_fee', return_value=Decimal('10.00'))
        fee_patch.start()
        self.addCleanup(fee_patch.stop)
        self.seller = make_seller()
        self.payout = PayoutRequest.objects.create(
            seller=self.seller, amount=Decimal('1000.00'),
            bank_details=_bank_for(self.seller), status='pending',
        )

    @patch('apps.payments.services.requests.post')
    def test_initiates_and_moves_to_processing(self, mock_post):
        mock_post.return_value = _flw_transfer_response(transfer_id=555)
        ok = FlutterwaveService().process_seller_payout(self.payout)
        self.assertTrue(ok)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, 'processing')   # NOT completed
        self.assertEqual(self.payout.flutterwave_transfer_id, '555')
        self.assertTrue(self.payout.transfer_reference)
        # Seller pays the fee: we send amount - fee = 1000 - 10 = 990.
        self.assertEqual(mock_post.call_args.kwargs['json']['amount'], 990.0)

    @patch('apps.payments.services.requests.post')
    def test_second_send_is_a_noop(self, mock_post):
        mock_post.return_value = _flw_transfer_response()
        FlutterwaveService().process_seller_payout(self.payout)  # -> processing
        mock_post.reset_mock()
        again = FlutterwaveService().process_seller_payout(self.payout)
        self.assertFalse(again)
        mock_post.assert_not_called()                           # never sent twice

    @patch('apps.payments.services.requests.post')
    def test_rejected_transfer_marks_failed(self, mock_post):
        mock_post.return_value = _flw_transfer_response(accepted=False)
        ok = FlutterwaveService().process_seller_payout(self.payout)
        self.assertFalse(ok)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, 'failed')


class PayoutBalanceReservationTests(TestCase):
    """In-flight payouts (pending/processing) reserve the balance so a seller
    can't request two payouts against the same funds; a failed one releases."""

    def test_in_flight_reserved_failed_released(self):
        seller = make_seller()
        bank = _bank_for(seller)
        PayoutRequest.objects.create(seller=seller, amount=Decimal('500'), bank_details=bank, status='pending')
        PayoutRequest.objects.create(seller=seller, amount=Decimal('300'), bank_details=bank, status='processing')
        PayoutRequest.objects.create(seller=seller, amount=Decimal('200'), bank_details=bank, status='failed')
        FlutterwaveService().update_seller_earnings(seller)
        self.assertEqual(seller.earnings.total_payouts, Decimal('800'))  # 500+300; failed excluded


@override_settings(FLUTTERWAVE_SECRET_HASH=FLW_HASH)
class PayoutTransferWebhookTests(TestCase):
    """The transfer webhook is what actually completes/fails a payout — signed,
    idempotent, and it releases funds on failure."""

    def setUp(self):
        cache.clear()  # webhook is throttled
        self.seller = make_seller()
        self.payout = PayoutRequest.objects.create(
            seller=self.seller, amount=Decimal('1000'), bank_details=_bank_for(self.seller),
            status='processing', transfer_reference='DARRA-PO-1-abc123',
            flutterwave_transfer_id='999',
        )

    def _post(self, body, **headers):
        return self.client.post('/api/payments/webhook/', data=json.dumps(body),
                                content_type='application/json', **headers)

    def _body(self, status='SUCCESSFUL', ref='DARRA-PO-1-abc123'):
        return {'event': 'transfer.completed',
                'data': {'id': 999, 'reference': ref, 'status': status, 'complete_message': 'ok'}}

    def test_bad_hash_rejected(self):
        res = self._post(self._body(), HTTP_VERIF_HASH='wrong')
        self.assertEqual(res.status_code, 401)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, 'processing')

    def test_successful_marks_completed(self):
        res = self._post(self._body('SUCCESSFUL'), HTTP_VERIF_HASH=FLW_HASH)
        self.assertEqual(res.status_code, 200)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, 'completed')

    def test_failed_marks_failed(self):
        res = self._post(self._body('FAILED'), HTTP_VERIF_HASH=FLW_HASH)
        self.assertEqual(res.status_code, 200)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, 'failed')

    def test_duplicate_is_ignored(self):
        self.payout.status = 'completed'
        self.payout.save()
        res = self._post(self._body('FAILED'), HTTP_VERIF_HASH=FLW_HASH)
        self.assertEqual(res.status_code, 200)
        self.payout.refresh_from_db()
        self.assertEqual(self.payout.status, 'completed')  # a final state never flips

    def test_unknown_reference_is_acknowledged(self):
        res = self._post(self._body(ref='does-not-exist'), HTTP_VERIF_HASH=FLW_HASH)
        self.assertEqual(res.status_code, 200)
