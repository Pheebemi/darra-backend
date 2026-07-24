"""
Tests for the support chat proxy and the contact / human-handoff endpoint.

The AI provider is never called for real — either the key is unset (so the
endpoint short-circuits) or the outbound request is mocked.
"""

import json
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings

from core.test_factories import make_superuser
from .models import Contact

CHAT = '/api/support/chat/'
CONTACT = '/api/support/contact/'


class SupportChatTests(TestCase):
    def setUp(self):
        cache.clear()

    def _post(self, body):
        return self.client.post(CHAT, data=json.dumps(body),
                                content_type='application/json')

    @override_settings(SUPPORT_AI_API_KEY='')
    def test_chat_without_key_fails_safely(self):
        res = self._post({'messages': [{'role': 'user', 'content': 'hi'}]})
        self.assertEqual(res.status_code, 503)
        # It points the user at the human option rather than erroring blankly.
        self.assertIn('contact', res.json()['message'].lower())

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    def test_malformed_payloads_are_rejected(self):
        self.assertEqual(self._post({'messages': []}).status_code, 400)
        self.assertEqual(
            self._post({'messages': [{'role': 'system', 'content': 'x'}]}).status_code,
            400,
        )
        too_many = [{'role': 'user', 'content': 'x'} for _ in range(50)]
        self.assertEqual(self._post({'messages': too_many}).status_code, 400)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    @patch('apps.support.views.requests.post')
    def test_reply_is_relayed_and_nothing_is_stored(self, mock_post):
        mock_post.return_value.ok = True
        mock_post.return_value.json.return_value = {
            'choices': [{'message': {'content': 'eBooks and event tickets.'}}]
        }
        res = self._post({'messages': [{'role': 'user', 'content': 'what can I sell?'}]})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['reply'], 'eBooks and event tickets.')
        # The conversation itself is never persisted — only an explicit handoff.
        self.assertEqual(Contact.objects.count(), 0)

    @override_settings(SUPPORT_AI_API_KEY='test-key')
    @patch('apps.support.views.requests.post')
    def test_provider_error_is_not_leaked_to_the_user(self, mock_post):
        mock_post.return_value.ok = False
        mock_post.return_value.status_code = 401
        mock_post.return_value.text = 'Invalid API key: sk-secret-123'
        res = self._post({'messages': [{'role': 'user', 'content': 'hi'}]})
        self.assertEqual(res.status_code, 502)
        self.assertNotIn('sk-secret', json.dumps(res.json()))


class ContactSubmitTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = make_superuser(email='ops@example.com')

    def _post(self, **over):
        body = {
            'name': 'Ada Buyer',
            'email': 'ada@example.com',
            'message': 'I paid for an ebook but it is not in my library.',
            'source': 'chat',
            'conversation': 'Them: where is my ebook?',
        }
        body.update(over)
        return self.client.post(CONTACT, data=json.dumps(body),
                                content_type='application/json')

    def test_valid_message_is_saved(self):
        res = self._post()
        self.assertEqual(res.status_code, 201)
        contact = Contact.objects.get()
        self.assertEqual(contact.name, 'Ada Buyer')
        self.assertEqual(contact.source, 'chat')
        self.assertEqual(contact.status, Contact.Status.NEW)
        self.assertTrue(contact.conversation)

    def test_admins_are_emailed_with_the_transcript(self):
        self._post()
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('ops@example.com', mail.outbox[0].to)
        html = mail.outbox[0].alternatives[0][0]
        self.assertIn('not in my library', html)
        self.assertIn('where is my ebook', html)  # transcript included

    def test_short_name_is_rejected(self):
        self.assertEqual(self._post(name='A').status_code, 400)

    def test_bad_email_is_rejected(self):
        self.assertEqual(self._post(email='nope').status_code, 400)

    def test_short_message_is_rejected(self):
        self.assertEqual(self._post(message='hi').status_code, 400)

    def test_message_saved_even_if_admin_email_fails(self):
        # The view imports this from users.utils at call time, so patch it there.
        with patch('users.utils.send_contact_admin_alert_email', side_effect=Exception('smtp down')):
            res = self._post()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Contact.objects.count(), 1)


class ContactThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        make_superuser(email='ops2@example.com')

    def test_contact_form_is_rate_limited(self):
        codes = []
        for i in range(7):  # limit is 5/hour per IP
            res = self.client.post(
                CONTACT,
                data=json.dumps({
                    'name': f'Spammer {i}',
                    'email': f's{i}@example.com',
                    'message': 'flooding the contact form with junk messages',
                }),
                content_type='application/json',
            )
            codes.append(res.status_code)
        self.assertIn(429, codes, "contact endpoint never throttled")
