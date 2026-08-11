from django.contrib import admin
from .models import Payment, Purchase, UserLibrary, SellerCommission, PayoutRequest, SellerEarnings

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'amount', 'currency', 'status', 'created_at']
    list_filter = ['status', 'currency', 'created_at']
    search_fields = ['reference', 'user__email', 'paystack_transaction_id']
    readonly_fields = ['reference', 'created_at', 'updated_at']
    ordering = ['-created_at']

@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['id', 'payment', 'product', 'quantity', 'unit_price', 'total_price', 'ticket_tier_info', 'created_at']
    list_filter = ['created_at', 'product__product_type']
    search_fields = ['product__title', 'payment__user__email']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    
    def ticket_tier_info(self, obj):
        # Seller-named tiers have no category (category is nullable now), so
        # never touch .category.name directly — display_name handles both the
        # legacy category-backed tiers and the newer seller-named ones.
        tier = obj.selected_ticket_tier
        return tier.display_name if tier else "N/A"
    ticket_tier_info.short_description = 'Ticket Tier'

@admin.register(UserLibrary)
class UserLibraryAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'quantity', 'added_at']
    list_filter = ['added_at', 'product__product_type']
    search_fields = ['user__email', 'product__title']
    readonly_fields = ['added_at']
    ordering = ['-added_at']

@admin.register(SellerCommission)
class SellerCommissionAdmin(admin.ModelAdmin):
    list_display = [
        'seller', 'product_title', 'product_price', 'commission_amount', 
        'seller_payout', 'status', 'created_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['seller__email', 'purchase__product__title']
    readonly_fields = ['created_at', 'paid_at']
    ordering = ['-created_at']
    
    def product_title(self, obj):
        return obj.purchase.product.title
    product_title.short_description = 'Product'
    
    actions = ['mark_as_paid', 'mark_as_failed']
    
    def mark_as_paid(self, request, queryset):
        """Mark selected commissions as paid"""
        from django.utils import timezone
        count = queryset.update(status='paid', paid_at=timezone.now())
        self.message_user(request, f"Marked {count} commissions as paid.")
    mark_as_paid.short_description = "Mark commissions as paid"
    
    def mark_as_failed(self, request, queryset):
        """Mark selected commissions as failed"""
        count = queryset.update(status='failed')
        self.message_user(request, f"Marked {count} commissions as failed.")
    mark_as_failed.short_description = "Mark commissions as failed"

@admin.register(PayoutRequest)
class PayoutRequestAdmin(admin.ModelAdmin):
    list_display = [
        'seller', 'amount', 'bank_name', 'account_number', 
        'status', 'created_at', 'processed_at', 'transfer_provider'
    ]
    list_filter = ['status', 'created_at']
    list_editable = ['status']
    search_fields = ['seller__email', 'transfer_reference']
    readonly_fields = ['transfer_reference', 'created_at']
    ordering = ['-created_at']
    
    def bank_name(self, obj):
        return obj.bank_details.bank_name
    bank_name.short_description = 'Bank'
    
    def account_number(self, obj):
        return obj.bank_details.account_number
    account_number.short_description = 'Account Number'
    
    def transfer_provider(self, obj):
        if obj.flutterwave_transfer_id:
            return 'Flutterwave'
        elif obj.paystack_transfer_id:
            return 'Paystack'
        return 'N/A'
    transfer_provider.short_description = 'Provider'
    
    actions = ['approve_and_send', 'sync_status_from_flutterwave', 'mark_as_completed', 'mark_as_failed']

    def approve_and_send(self, request, queryset):
        """
        Approve pending payouts and fire the Flutterwave transfer for each.
        The request moves to 'processing'; the final completed/failed outcome
        (and its email) arrives on the transfer webhook.
        """
        from apps.payments.services import PayoutService
        svc = PayoutService()
        initiated = failed = skipped = 0
        for payout in queryset:
            if payout.status != 'pending':
                skipped += 1
                continue
            svc.process_payout(payout)
            payout.refresh_from_db()
            if payout.status == 'processing':
                self._notify_status_change(payout, 'processing')
                initiated += 1
            else:
                self._notify_status_change(payout, 'failed')
                failed += 1
        self.message_user(
            request,
            f"{initiated} transfer(s) initiated (now processing — completion arrives via "
            f"webhook); {failed} rejected at send; {skipped} skipped (not pending)."
        )
    approve_and_send.short_description = "Approve & send payout (Flutterwave)"

    def sync_status_from_flutterwave(self, request, queryset):
        """
        Reconcile stuck 'processing' payouts against Flutterwave's real transfer
        status — the one-click fix for a missed confirmation webhook. Updates the
        record, releases the balance if it failed, and emails the seller.
        """
        from apps.payments.services import FlutterwaveService
        svc = FlutterwaveService()
        completed = failed = unchanged = 0
        for payout in queryset:
            before = payout.status
            after = svc.sync_payout_status(payout)
            if after == 'completed' and before != 'completed':
                completed += 1
            elif after == 'failed' and before != 'failed':
                failed += 1
            else:
                unchanged += 1
        self.message_user(
            request,
            f"Synced from Flutterwave — {completed} completed, {failed} failed, "
            f"{unchanged} unchanged."
        )
    sync_status_from_flutterwave.short_description = "Sync status from Flutterwave (fix missed webhooks)"

    def _notify_status_change(self, payout, new_status):
        """
        Send the seller the email for whichever status the payout moved to.

        Lives here, keyed off the status itself, so the notification is tied to
        the transition rather than to one particular admin button. `status` is
        in list_editable, so it can also be changed straight from the list page
        or the change form — those used to save silently and the seller was
        never told.
        """
        from users.utils import (
            send_payout_processing_email,
            send_payout_completed_email,
            send_payout_failed_email,
        )
        senders = {
            'processing': send_payout_processing_email,
            'completed': send_payout_completed_email,
            'failed': send_payout_failed_email,
        }
        sender = senders.get(new_status)
        if not sender:
            return False
        try:
            return sender(payout)
        except Exception as e:
            print(f"Payout {new_status} email error for {payout.id}: {e}")
            return False

    def save_model(self, request, obj, form, change):
        """
        Notify the seller whenever the status changes from the admin UI —
        the change form or the inline dropdown on the list page — not just
        from the actions menu.
        """
        previous_status = None
        if change and obj.pk:
            previous_status = (
                PayoutRequest.objects.filter(pk=obj.pk)
                .values_list('status', flat=True)
                .first()
            )

        if obj.status == 'completed' and not obj.processed_at:
            from django.utils import timezone
            obj.processed_at = timezone.now()

        super().save_model(request, obj, form, change)

        if previous_status != obj.status:
            if obj.status == 'failed':
                from apps.payments.services import FlutterwaveService
                FlutterwaveService().update_seller_earnings(obj.seller)
            self._notify_status_change(obj, obj.status)

    def _bulk_transition(self, request, queryset, new_status, label):
        from django.utils import timezone
        changed = notified = 0
        for payout in queryset:
            if payout.status == new_status:
                continue
            payout.status = new_status
            if new_status == 'completed' and not payout.processed_at:
                payout.processed_at = timezone.now()
            payout.save()
            if new_status == 'failed':
                # A failed payout is no longer reserved — release the balance.
                from apps.payments.services import FlutterwaveService
                FlutterwaveService().update_seller_earnings(payout.seller)
            changed += 1
            if self._notify_status_change(payout, new_status):
                notified += 1

        skipped = queryset.count() - changed
        message = f"Marked {changed} payouts as {label}; {notified} sellers notified."
        if skipped:
            message += f" {skipped} already had that status and were left alone."
        self.message_user(request, message)

    def mark_as_completed(self, request, queryset):
        """Mark selected payouts as completed and notify sellers"""
        self._bulk_transition(request, queryset, 'completed', 'completed')
    mark_as_completed.short_description = "Mark payouts as completed"

    def mark_as_processing(self, request, queryset):
        """Mark selected payouts as processing and notify sellers"""
        self._bulk_transition(request, queryset, 'processing', 'processing')
    mark_as_processing.short_description = "Mark payouts as processing"

    def mark_as_failed(self, request, queryset):
        """Mark selected payouts as failed and notify sellers"""
        self._bulk_transition(request, queryset, 'failed', 'failed')
    mark_as_failed.short_description = "Mark payouts as failed"

@admin.register(SellerEarnings)
class SellerEarningsAdmin(admin.ModelAdmin):
    list_display = [
        'seller', 'total_sales', 'total_commission', 
        'total_payouts', 'available_balance', 'last_updated'
    ]
    list_filter = ['last_updated']
    search_fields = ['seller__email', 'seller__brand_name']
    readonly_fields = ['last_updated']
    ordering = ['-last_updated']
    
    actions = ['recalculate_earnings']
    
    def recalculate_earnings(self, request, queryset):
        """Recalculate earnings for selected sellers"""
        from .services import PaystackService
        paystack_service = PaystackService()
        
        count = 0
        for earnings in queryset:
            try:
                paystack_service.update_seller_earnings(earnings.seller)
                count += 1
            except Exception as e:
                self.message_user(request, f"Error updating {earnings.seller.email}: {str(e)}", level='ERROR')
        
        self.message_user(request, f"Recalculated earnings for {count} sellers.")
    recalculate_earnings.short_description = "Recalculate earnings" 