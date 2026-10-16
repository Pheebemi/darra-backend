"""
Tests for RealClientIPMiddleware — the piece that lets per-IP rate limits see
the real visitor instead of the shared frontend-proxy IP.
"""

from django.core.cache import cache
from django.core.mail import EmailMessage, get_connection
from django.core.mail.backends.base import BaseEmailBackend
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings

from core.middleware import RealClientIPMiddleware, AdminLoginRateLimitMiddleware

SECRET = 'test-proxy-secret-value'


@override_settings(ADMIN_URL='admin/')
class AdminLoginRateLimitTests(TestCase):
    """The admin login form has no DRF throttle, so this middleware is its only
    brute-force protection."""

    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()

    def _mw(self, status):
        # status 200 == Django re-rendered the login form (failed login);
        # 302 == successful login redirect.
        return AdminLoginRateLimitMiddleware(lambda r: HttpResponse(status=status))

    def _login(self, mw, ip='203.0.113.5'):
        return mw(self.factory.post('/admin/login/', REMOTE_ADDR=ip))

    def test_blocks_after_too_many_failed_logins(self):
        mw = self._mw(200)  # every attempt fails
        for _ in range(8):
            self.assertNotEqual(self._login(mw).status_code, 429)
        self.assertEqual(self._login(mw).status_code, 429)  # 9th blocked

    def test_successful_logins_are_not_counted(self):
        mw = self._mw(302)  # every attempt succeeds
        last = None
        for _ in range(20):
            last = self._login(mw)
        self.assertNotEqual(last.status_code, 429)

    def test_only_the_login_path_is_guarded(self):
        mw = self._mw(200)
        for _ in range(20):
            res = mw(self.factory.post('/api/auth/login/', REMOTE_ADDR='203.0.113.5'))
        self.assertNotEqual(res.status_code, 429)

    def test_block_is_per_ip(self):
        mw = self._mw(200)
        for _ in range(9):
            self._login(mw, ip='203.0.113.5')
        self.assertEqual(self._login(mw, ip='203.0.113.5').status_code, 429)
        self.assertNotEqual(self._login(mw, ip='198.51.100.9').status_code, 429)


class RealClientIPMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _run(self, **headers):
        # RequestFactory maps kwargs straight into request.META.
        request = self.factory.get('/api/products/', REMOTE_ADDR='10.0.0.1', **headers)
        captured = {}

        def get_response(req):
            captured['remote_addr'] = req.META.get('REMOTE_ADDR')
            captured['xff'] = req.META.get('HTTP_X_FORWARDED_FOR')
            return 'ok'

        RealClientIPMiddleware(get_response)(request)
        return captured

    @override_settings(PROXY_SHARED_SECRET=SECRET)
    def test_trusts_client_ip_when_secret_matches(self):
        out = self._run(HTTP_X_PROXY_SECRET=SECRET, HTTP_X_CLIENT_IP='203.0.113.9')
        self.assertEqual(out['remote_addr'], '203.0.113.9')
        self.assertEqual(out['xff'], '203.0.113.9')

    @override_settings(PROXY_SHARED_SECRET=SECRET)
    def test_ignores_client_ip_when_secret_wrong(self):
        out = self._run(HTTP_X_PROXY_SECRET='not-the-secret', HTTP_X_CLIENT_IP='203.0.113.9')
        self.assertEqual(out['remote_addr'], '10.0.0.1')  # unchanged

    @override_settings(PROXY_SHARED_SECRET=SECRET)
    def test_rejects_a_non_ip_value(self):
        out = self._run(HTTP_X_PROXY_SECRET=SECRET, HTTP_X_CLIENT_IP='not-an-ip')
        self.assertEqual(out['remote_addr'], '10.0.0.1')  # unchanged

    @override_settings(PROXY_SHARED_SECRET=SECRET)
    def test_takes_first_ip_if_a_list_is_sent(self):
        out = self._run(HTTP_X_PROXY_SECRET=SECRET, HTTP_X_CLIENT_IP='203.0.113.9, 10.0.0.5')
        self.assertEqual(out['remote_addr'], '203.0.113.9')

    @override_settings(PROXY_SHARED_SECRET='')
    def test_noop_when_secret_not_configured(self):
        # An attacker cannot enable trust just by sending the headers.
        out = self._run(HTTP_X_PROXY_SECRET='', HTTP_X_CLIENT_IP='203.0.113.9')
        self.assertEqual(out['remote_addr'], '10.0.0.1')  # unchanged

    @override_settings(PROXY_SHARED_SECRET=SECRET)
    def test_throttle_get_ident_uses_the_recovered_ip(self):
        # End result: DRF's throttle identity is now the real visitor.
        from rest_framework.throttling import SimpleRateThrottle
        request = self.factory.get('/api/products/', REMOTE_ADDR='10.0.0.1',
                                   HTTP_X_PROXY_SECRET=SECRET, HTTP_X_CLIENT_IP='198.51.100.7')
        RealClientIPMiddleware(lambda r: 'ok')(request)

        class _T(SimpleRateThrottle):
            scope = 'anon'
            def get_cache_key(self, request, view):
                return None

        # DRF wraps the WSGIRequest; get_ident reads the same META we rewrote.
        from rest_framework.request import Request
        ident = _T().get_ident(Request(request))
        self.assertEqual(ident, '198.51.100.7')


class _FakeBackend(BaseEmailBackend):
    """Records what it was asked to send; can be told to fail."""

    outbox = None
    fail = False
    fail_subjects = ()

    @classmethod
    def reset(cls):
        cls.outbox = []
        cls.fail = False
        cls.fail_subjects = ()

    def send_messages(self, email_messages):
        cls = type(self)
        for message in email_messages:
            if cls.fail or message.subject in cls.fail_subjects:
                raise ConnectionError(f'{cls.__name__} is down')
        cls.outbox.extend(email_messages)
        return len(email_messages)


class FakePrimary(_FakeBackend):
    pass


class FakeFallback(_FakeBackend):
    pass


@override_settings(
    EMAIL_BACKEND='core.email_backends.FallbackEmailBackend',
    EMAIL_PRIMARY_BACKEND='core.tests.FakePrimary',
    EMAIL_FALLBACK_BACKEND='core.tests.FakeFallback',
    EMAIL_HOST_USER='darrasupport@gmail.com',
    DEFAULT_FROM_EMAIL='Darra <support@darra.com.ng>',
)
class FallbackEmailBackendTests(TestCase):
    """
    Resend's free plan stops at 100 emails a day. Past that, a signup's
    verification code silently never arrives — so a failed send must retry
    through the SMTP account instead of vanishing.
    """

    def setUp(self):
        FakePrimary.reset()
        FakeFallback.reset()

    def _message(self, subject='Your code', **kwargs):
        kwargs.setdefault('to', ['buyer@example.com'])
        return EmailMessage(subject, 'Body', **kwargs)

    def test_primary_success_never_touches_the_fallback(self):
        message = self._message()
        self.assertEqual(message.send(), 1)

        self.assertEqual(len(FakePrimary.outbox), 1)
        self.assertEqual(FakeFallback.outbox, [])
        self.assertEqual(FakePrimary.outbox[0].from_email, 'Darra <support@darra.com.ng>')

    def test_primary_failure_retries_through_fallback_as_the_smtp_account(self):
        FakePrimary.fail = True
        message = self._message()

        self.assertEqual(message.send(), 1)

        self.assertEqual(len(FakeFallback.outbox), 1)
        # Sent as the SMTP mailbox, but under the same display name.
        self.assertEqual(FakeFallback.outbox[0].from_email, 'Darra <darrasupport@gmail.com>')
        # The caller's own message is left alone — only a copy was rewritten.
        self.assertEqual(message.from_email, 'Darra <support@darra.com.ng>')

    def test_fallback_sender_without_a_display_name_is_the_bare_account(self):
        FakePrimary.fail = True
        self._message(from_email='support@darra.com.ng').send()

        self.assertEqual(FakeFallback.outbox[0].from_email, 'darrasupport@gmail.com')

    def test_a_batch_retries_only_the_message_that_failed(self):
        FakePrimary.fail_subjects = ('second',)
        first, second = self._message('first'), self._message('second')

        sent = get_connection().send_messages([first, second])

        self.assertEqual(sent, 2)
        self.assertEqual([m.subject for m in FakePrimary.outbox], ['first'])
        self.assertEqual([m.subject for m in FakeFallback.outbox], ['second'])

    def test_both_failing_raises_unless_silent(self):
        FakePrimary.fail = True
        FakeFallback.fail = True

        with self.assertRaises(ConnectionError):
            self._message().send()
        self.assertEqual(self._message().send(fail_silently=True), 0)

    def test_a_message_with_no_recipients_is_skipped_without_error(self):
        self.assertEqual(self._message(to=[]).send(), 0)

        self.assertEqual(FakePrimary.outbox, [])
        self.assertEqual(FakeFallback.outbox, [])
