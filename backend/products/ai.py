import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def generate_product_description(product_data, ticket_types=None):
    """Generate a concise buyer-facing description from the product fields."""
    if not settings.SUPPORT_AI_API_KEY:
        return ''

    details = {
        'Title': product_data.get('title', ''),
        'Type': product_data.get('product_type', ''),
        'Price': product_data.get('price', ''),
        'Event date': product_data.get('event_date', ''),
        'Event end date': product_data.get('event_end_date', ''),
        'Venue': product_data.get('venue_name', ''),
        'Location': product_data.get('location', ''),
        'Speakers': product_data.get('speakers', ''),
        'Ticket options': ticket_types or [],
    }
    prompt = (
        'Write a compelling product description for an online marketplace. '
        'Use only the factual details provided below. Do not invent claims, '
        'features, dates, or guarantees. Return plain text in 1-3 short '
        'paragraphs, without a heading, markdown, emojis, or quotation marks. '
        f'Product details: {details}'
    )

    try:
        response = requests.post(
            settings.SUPPORT_AI_API_URL,
            headers={
                'Authorization': f'Bearer {settings.SUPPORT_AI_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': settings.SUPPORT_AI_MODEL,
                'messages': [
                    {
                        'role': 'system',
                        'content': 'You write accurate, useful marketplace copy.',
                    },
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 0.4,
                'max_tokens': 300,
            },
            timeout=20,
        )
        response.raise_for_status()
        description = response.json()['choices'][0]['message']['content'].strip()
        return description[:5000]
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as exc:
        logger.warning('Product description generation failed: %s', exc)
        return ''