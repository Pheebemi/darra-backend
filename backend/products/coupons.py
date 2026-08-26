"""
Shared coupon logic used by both the cart's "apply code" check and checkout
itself, so the two can never disagree about whether a code is valid or how
much it's worth. Checkout must call this again even after the cart already
validated the same code — the client's numbers are never trusted for what
actually gets charged.
"""
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

from .models import Coupon


class CouponError(Exception):
    """Raised with a message that's safe to show the buyer directly."""


def _find_coupon(code):
    code = (code or '').strip().upper()
    if not code:
        raise CouponError("Enter a discount code.")
    try:
        return Coupon.objects.get(code=code)
    except Coupon.DoesNotExist:
        raise CouponError("That code doesn't exist.")


def _check_limits(coupon, user):
    if not coupon.is_active:
        raise CouponError("This code is no longer active.")
    if coupon.expires_at and coupon.expires_at < timezone.now():
        raise CouponError("This code has expired.")

    # Local import: products <-> apps.payments already cross-reference each
    # other elsewhere in this codebase (Review.user_has_purchased does the
    # same), and keeping it local here avoids import-order surprises.
    from apps.payments.models import Purchase, Payment

    successful = Purchase.objects.filter(
        coupon=coupon, payment__status=Payment.PaymentStatus.SUCCESS
    )
    if coupon.max_redemptions is not None and successful.count() >= coupon.max_redemptions:
        raise CouponError("This code has been fully redeemed.")

    if user is not None and getattr(user, 'is_authenticated', False):
        used_by_buyer = successful.filter(payment__user=user).count()
        if used_by_buyer >= coupon.max_redemptions_per_buyer:
            raise CouponError("You've already used this code.")


def apply_coupon(code, cart_lines, user=None):
    """
    cart_lines: list of {'product': Product, 'quantity': int, 'unit_price': Decimal}

    Only discounts the lines whose product belongs to the coupon's seller
    (and, if the coupon is scoped to specific products, only those). Every
    other line — including another seller's products in the same cart — is
    left untouched.

    Returns (coupon, per_unit_discounts), a list of Decimals the same length
    and order as cart_lines (0 for a line the coupon didn't touch).

    Raises CouponError, with a message safe to show the buyer, if the code
    is invalid, inactive, expired, exhausted, or matches nothing in the cart.
    """
    coupon = _find_coupon(code)
    _check_limits(coupon, user)

    scoped_product_ids = set(coupon.products.values_list('id', flat=True))

    per_unit_discounts = []
    touched = False
    for line in cart_lines:
        product = line['product']
        in_scope = product.owner_id == coupon.seller_id and (
            not scoped_product_ids or product.id in scoped_product_ids
        )
        if not in_scope:
            per_unit_discounts.append(Decimal('0'))
            continue

        touched = True
        unit_price = line['unit_price']
        if coupon.discount_type == Coupon.DiscountType.PERCENT:
            discount = (unit_price * coupon.value / Decimal('100')).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        else:
            # Never discount past free, e.g. a ₦5,000-off code against a
            # ₦2,000 line.
            discount = min(coupon.value, unit_price)
        per_unit_discounts.append(discount)

    if not touched:
        raise CouponError("This code doesn't apply to anything in your cart.")

    return coupon, per_unit_discounts
