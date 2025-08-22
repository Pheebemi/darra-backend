from django.urls import path
from . import views

app_name = 'events'

urlpatterns = [
    path('seller-tickets/', views.SellerEventTicketsView.as_view(), name='seller_tickets'),
    path('ticket/<str:ticket_id>/', views.get_ticket_details, name='ticket_details'),
    path('verify/<str:ticket_id>/', views.verify_ticket, name='verify_ticket'),
    path('seller-stats/', views.seller_event_stats, name='seller_stats'),
]


