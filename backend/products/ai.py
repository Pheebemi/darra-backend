import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# The seller form sends the raw storage type, not a label — spelling that out
# for the model keeps it from having to guess what "pdf"/"mp3" means, and
# from defaulting to event language when it isn't sure.
PRODUCT_TYPE_LABELS = {
    'pdf': 'eBook (PDF download)',
    'docx': 'eBook (DOCX download)',
    'mp3': 'Audio (MP3 download)',
    'event': 'Event with tickets',
}


def generate_product_description(product_data, ticket_types=None):
    """Generate a concise buyer-facing description from the product fields."""
    if not settings.SUPPORT_AI_API_KEY:
        return ''

    product_type = product_data.get('product_type', '')
    is_event = product_type == 'event'

    details = {
        'Title': product_data.get('title', ''),
        'Type': PRODUCT_TYPE_LABELS.get(product_type, product_type),
    }
    price = product_data.get('price')
    if price and str(price) != '0':
        details['Price'] = price

    brand = str(product_data.get('brand_name') or '').strip()
    if brand:
        details['Sold by'] = brand

    # Whatever the seller has already typed. This is the most valuable input
    # in the whole payload for a digital download, where the only other facts
    # are a title, a type and a price — the seller knows what is actually
    # inside the file and the model does not.
    notes = str(product_data.get('notes') or '').strip()

    # Event-only fields are omitted entirely for digital downloads — sending
    # them as empty strings still primes the model to write event/ticket
    # copy for products that have nothing to do with an event.
    if is_event:
        event_fields = {
            'Event date': product_data.get('event_date', ''),
            'Event end date': product_data.get('event_end_date', ''),
            'Venue': product_data.get('venue_name', ''),
            'Location': product_data.get('location', ''),
            'Speakers': product_data.get('speakers', ''),
        }
        details.update({k: v for k, v in event_fields.items() if v})
        if ticket_types:
            details['Ticket options'] = ticket_types

    # Two different jobs. With notes the model is editing the seller's own
    # words, which is both more accurate and less likely to invent features;
    # without them it only has the bare facts to work from.
    if notes:
        task = (
            "Rewrite the seller's own notes below into a polished product "
            'description. Keep every fact and claim they made, keep their '
            'meaning, and do not add features, benefits or guarantees they '
            'did not mention. '
            f"Seller's notes: {notes[:2000]}\n"
        )
    else:
        task = (
            'Write a compelling product description. Use only the factual '
            'details provided below. Do not invent claims, features, dates, '
            'or guarantees. '
        )

    prompt = (
        'You are writing for Darra, a digital marketplace where creators sell '
        'eBooks, audio, and event tickets. '
        f'{task}'
        'Do not mention "event" or "ticket" unless the product type given '
        'below is an event. Return plain text in 1-3 short paragraphs, '
        'without a heading, markdown, emojis, or quotation marks. '
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
                        'content': (
                            'You write accurate, useful marketplace copy for Darra. '
                            'You never describe a digital download as an event or a '
                            'ticket, and you never describe an event as a download.'
                        ),
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
