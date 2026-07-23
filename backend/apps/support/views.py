import logging

import requests
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.throttling import SupportChatRateThrottle, ContactRateThrottle

from .models import Contact
from .serializers import ChatRequestSerializer, ContactSerializer

logger = logging.getLogger(__name__)


from .knowledge import build_system_prompt


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SupportChatRateThrottle])
def support_chat(request):
    """
    Proxy a short conversation to the support AI provider.

    Exists so the API key stays on the server. The browser talks to us; we
    talk to the provider. Nothing from this endpoint is stored — only an explicit
    handoff via /contact/ is saved.

    Open to anonymous visitors, since someone deciding whether to buy is
    exactly who has questions. That makes the per-IP rate limit the only thing
    standing between a bored stranger and your API bill, so it is kept tight.
    """
    if not settings.SUPPORT_AI_API_KEY:
        logger.error("Support chat called but SUPPORT_AI_API_KEY is not configured.")
        return Response(
            {'message': "The assistant isn't available right now. "
                        "Please use the contact option below."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    serializer = ChatRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    messages = [{'role': 'system', 'content': build_system_prompt()}]
    messages += [
        {'role': m['role'], 'content': m['content']}
        for m in serializer.validated_data['messages']
    ]

    try:
        resp = requests.post(
            settings.SUPPORT_AI_API_URL,
            headers={
                'Authorization': f'Bearer {settings.SUPPORT_AI_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': settings.SUPPORT_AI_MODEL,
                'messages': messages,
                'temperature': 0.2,
                'max_tokens': 400,
            },
            timeout=30,
        )
    except requests.exceptions.RequestException as e:
        logger.error("Support AI request failed: %s", e)
        return Response(
            {'message': "The assistant is unreachable right now. "
                        "Please try again or contact us directly."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    if not resp.ok:
        # Log the provider's reason for us, but never surface it — it can
        # contain account and billing detail.
        logger.error("Support AI returned %s: %s", resp.status_code, resp.text[:500])
        return Response(
            {'message': "The assistant couldn't answer that right now. "
                        "Please try again or contact us directly."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    try:
        payload = resp.json()
        reply = payload['choices'][0]['message']['content'].strip()
    except (ValueError, KeyError, IndexError, AttributeError) as e:
        logger.error("Unexpected support AI response shape: %s", e)
        return Response(
            {'message': "The assistant gave an unexpected response. "
                        "Please try again."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response({'reply': reply})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([ContactRateThrottle])
def submit_contact(request):
    """
    Save a message for a human to answer and alert the admins.

    This is the only point at which anything from the chat widget is stored.
    """
    serializer = ContactSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    contact = serializer.save(
        user=request.user if request.user.is_authenticated else None
    )

    from users.utils import send_contact_admin_alert_email
    try:
        notified = send_contact_admin_alert_email(contact)
    except Exception as e:
        logger.exception("Contact admin alert failed: %s", e)
        notified = False

    if notified:
        Contact.objects.filter(pk=contact.pk).update(admin_notified=True)

    # The message is saved either way, so the sender is told it worked even if
    # the alert email failed — it is visible in admin regardless.
    return Response(
        {'message': "Thanks — we've got your message and will reply by email."},
        status=status.HTTP_201_CREATED,
    )
