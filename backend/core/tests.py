"""
Tests for RealClientIPMiddleware — the piece that lets per-IP rate limits see
the real visitor instead of the shared frontend-proxy IP.
"""

from django.core.cache import cache
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
