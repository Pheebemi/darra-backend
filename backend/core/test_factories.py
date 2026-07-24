"""
Small factory helpers for tests. Not a full factory_boy setup — just enough to
build the objects the tests need without repeating field lists everywhere.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model

from apps.payments.models import Payment, Purchase, UserLibrary
from products.models import Product, TicketCategory, TicketTier

User = get_user_model()

_counter = {'n': 0}


def _uniq():
    _counter['n'] += 1
    return _counter['n']


def make_user(**kwargs):
    n = _uniq()
    defaults = {
        'email': f'user{n}@example.com',
        'password': 'Str0ng-Pass-42!',
        'full_name': f'User {n}',
        'user_type': 'buyer',
        'is_verified': True,
    }
    defaults.update(kwargs)
    password = defaults.pop('password')
    return User.objects.create_user(password=password, **defaults)


def make_seller(**kwargs):
    n = _uniq()
    kwargs.setdefault('user_type', 'seller')
    kwargs.setdefault('brand_name', f'Brand {n}')
    kwargs.setdefault('brand_slug', f'brand-{n}')
    kwargs.setdefault('store_active', True)
    return make_user(**kwargs)


def make_superuser(**kwargs):
    kwargs.setdefault('is_staff', True)
    kwargs.setdefault('is_superuser', True)
    kwargs.setdefault('user_type', 'admin')
    return make_user(**kwargs)


def make_product(owner=None, **kwargs):
    owner = owner or make_seller()
    n = _uniq()
    defaults = {
        'owner': owner,
        'title': f'Product {n}',
        'price': Decimal('1000.00'),
        'product_type': 'pdf',
    }
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def make_event(owner=None, tiers=None, **kwargs):
    """An event product with optional (name, price, qty) ticket categories."""
    kwargs.setdefault('product_type', 'event')
    kwargs.setdefault('price', Decimal('0'))
    product = make_product(owner=owner, **kwargs)
    for name, price, qty in (tiers or []):
        tier = TicketTier.objects.create(
            name=name, color='#5465FF',
            price=Decimal(str(price)), quantity_available=qty,
        )
        product.ticket_tiers.add(tier)
    return product


def make_payment(user=None, product=None, amount='1000.00', status=None, **kwargs):
    """A pending payment with one purchase for `product`."""
    user = user or make_user()
    product = product or make_product()
    n = _uniq()
    payment = Payment.objects.create(
        user=user,
        reference=kwargs.get('reference', f'REF-TEST-{n}'),
        amount=Decimal(str(amount)),
        status=status or Payment.PaymentStatus.PENDING,
        payment_provider=kwargs.get('payment_provider', 'paystack'),
    )
    Purchase.objects.create(
        payment=payment, product=product, quantity=1,
        unit_price=Decimal(str(amount)), total_price=Decimal(str(amount)),
    )
    return payment
