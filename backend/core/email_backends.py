"""
Email delivery with a safety net.

Darra sends through Resend's HTTPS API because PythonAnywhere's free tier only
allows outbound connections to an allowlist of hosts. Resend's free plan caps
at 100 emails a day, and the emails that matter most (signup verification
codes, password resets) are exactly the ones a signup spike would exhaust it
on — and a failed send there is silent, the user just never gets their code.

This backend sends each message through the primary backend, and if that
fails for any reason (quota, outage, network) retries that one message through
a fallback SMTP account so mail keeps flowing.
"""
import copy
import logging
from email.utils import formataddr, parseaddr

from django.conf import settings
from django.core.mail import get_connection
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class FallbackEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        # Both children are built non-silent: this class decides what a
        # failure means, so it needs to see the exception. The SMTP child
        # does not touch the network until it actually sends.
        self.primary = get_connection(settings.EMAIL_PRIMARY_BACKEND, fail_silently=False)
        self.fallback = get_connection(settings.EMAIL_FALLBACK_BACKEND, fail_silently=False)

    def send_messages(self, email_messages):
        # One message at a time, so a failure part-way through a batch retries
        # only what did not go out. Sending a batch and retrying all of it
        # would double-send the messages that had already succeeded.
        sent = 0
        for message in email_messages:
            if not message.recipients():
                # Same as Django's own backends: nothing to send is not an error.
                continue

            error = self._send(self.primary, message, "primary")
            if error is None:
                sent += 1
                continue

            error = self._send(self.fallback, self._for_fallback(message), "fallback")
            if error is None:
                sent += 1
                continue

            if not self.fail_silently:
                raise error
        return sent

    def _send(self, backend, message, label):
        """Send one message. Returns None on success, otherwise the failure."""
        try:
            if backend.send_messages([message]):
                return None
            return RuntimeError(f"The {label} email backend reported nothing sent")
        except Exception as exc:
            log = logger.warning if label == "primary" else logger.error
            log(
                "Email via %s backend failed (%s: %s)%s",
                label, type(exc).__name__, exc,
                "; trying fallback" if label == "primary" else "",
            )
            return exc

    def _for_fallback(self, message):
        # A mailbox can only send as itself: Gmail either rewrites a foreign
        # From address or rejects it, so the fallback sends from the SMTP
        # account. The display name is carried over, which is why the sender
        # reads the same ("Darra") whichever service delivered the email.
        name, _ = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)
        rewritten = copy.copy(message)
        rewritten.from_email = formataddr((name, settings.EMAIL_HOST_USER))
        return rewritten
