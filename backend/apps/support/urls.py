from django.urls import path

from .views import support_chat, submit_contact

urlpatterns = [
    path('chat/', support_chat, name='support-chat'),
    path('contact/', submit_contact, name='submit-contact'),
]
