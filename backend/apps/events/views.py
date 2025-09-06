from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import EventTicket
from .fast_models import FastEventTicket
from .serializers import EventTicketSerializer, EventTicketDetailSerializer

class SellerEventTicketsView(generics.ListAPIView):
    """Get all event tickets for seller's events"""
    serializer_class = EventTicketSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Get both old and fast tickets for events owned by the seller
        from django.db import models
        
        # Combine both querysets
        old_tickets = EventTicket.objects.filter(
            event__owner=self.request.user
        ).select_related('buyer', 'event', 'purchase__payment')
        
        fast_tickets = FastEventTicket.objects.filter(
            event__owner=self.request.user
        ).select_related('buyer', 'event', 'purchase__payment')
        
        # Combine and order by created_at
        all_tickets = list(old_tickets) + list(fast_tickets)
        all_tickets.sort(key=lambda x: x.created_at, reverse=True)
        
        return all_tickets
    
    def list(self, request, *args, **kwargs):
        """Override list to handle mixed ticket types"""
        queryset = self.get_queryset()
        
        # Serialize each ticket individually to handle different types
        serialized_tickets = []
        for ticket in queryset:
            try:
                if hasattr(ticket, 'ticket_png'):
                    # Fast ticket - create a custom representation
                    ticket_data = {
                        'ticket_id': str(ticket.ticket_id),
                        'buyer': {
                            'full_name': ticket.buyer.full_name,
                            'email': ticket.buyer.email,
                        },
                        'event': {
                            'title': ticket.event.title,
                            'event_date': ticket.event.event_date,
                            'description': ticket.event.description,
                        },
                        'verified_by': {
                            'full_name': ticket.verified_by.full_name,
                        } if ticket.verified_by else None,
                        'quantity': ticket.quantity,
                        'is_used': ticket.is_used,
                        'used_at': ticket.used_at,
                        'verified_at': ticket.verified_at,
                        'created_at': ticket.created_at,
                        'purchase_reference': ticket.purchase.payment.reference if ticket.purchase and ticket.purchase.payment else 'N/A',
                        'payment_amount': str(ticket.purchase.total_price) if ticket.purchase else '0.00',
                        'ticket_tier': {
                            'name': ticket.purchase.selected_ticket_tier.name,
                            'price': str(ticket.purchase.selected_ticket_tier.price),
                            'category': {
                                'name': ticket.purchase.selected_ticket_tier.category.name,
                                'color': ticket.purchase.selected_ticket_tier.category.color,
                            }
                        } if ticket.purchase and ticket.purchase.selected_ticket_tier else None,
                        'qr_code_url': ticket.ticket_png.url if ticket.ticket_png else None,
                        'pdf_ticket_url': None,
                        'ticket_png_url': ticket.ticket_png.url if ticket.ticket_png else None,
                    }
                else:
                    # Old ticket - use regular serializer
                    serializer = self.get_serializer(ticket)
                    ticket_data = serializer.data
                
                serialized_tickets.append(ticket_data)
            except Exception as e:
                print(f"Error serializing ticket {ticket.ticket_id}: {str(e)}")
                continue
        
        return Response(serialized_tickets)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_ticket_details(request, ticket_id):
    """Get detailed information about a specific ticket - FAST TICKETS ONLY"""
    try:
        # Only look for fast tickets
        from .fast_models import FastEventTicket
        
        ticket = FastEventTicket.objects.select_related(
            'buyer', 
            'event', 
            'purchase__payment',
            'purchase__selected_ticket_tier',
            'purchase__selected_ticket_tier__category'
        ).get(ticket_id=ticket_id)
        print(f"DEBUG: Found fast ticket: {ticket.ticket_id}")
        
        # Check if seller owns this event
        if ticket.event.owner != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        # Debug logging
        print(f"DEBUG: Ticket found: {ticket.ticket_id}")
        print(f"DEBUG: Purchase: {ticket.purchase}")
        print(f"DEBUG: Purchase selected_ticket_tier: {ticket.purchase.selected_ticket_tier}")
        if ticket.purchase.selected_ticket_tier:
            print(f"DEBUG: Ticket tier category: {ticket.purchase.selected_ticket_tier.category}")
        
        # Create fast ticket response
        ticket_data = {
            'ticket_id': str(ticket.ticket_id),
            'purchase': ticket.purchase.id,
            'buyer': {
                'full_name': ticket.buyer.full_name,
                'email': ticket.buyer.email,
            },
            'event': {
                'title': ticket.event.title,
                'event_date': ticket.event.event_date,
                'description': ticket.event.description,
            },
            'verified_by': {
                'full_name': ticket.verified_by.full_name,
            } if ticket.verified_by else None,
            'quantity': ticket.quantity,
            'is_used': ticket.is_used,
            'used_at': ticket.used_at,
            'verified_at': ticket.verified_at,
            'created_at': ticket.created_at,
            'purchase_reference': ticket.purchase.payment.reference if ticket.purchase and ticket.purchase.payment else 'N/A',
            'payment_amount': str(ticket.purchase.total_price) if ticket.purchase else '0.00',
            'ticket_tier': {
                'name': ticket.purchase.selected_ticket_tier.name,
                'price': str(ticket.purchase.selected_ticket_tier.price),
                'category': {
                    'name': ticket.purchase.selected_ticket_tier.category.name,
                    'color': ticket.purchase.selected_ticket_tier.category.color,
                }
            } if ticket.purchase and ticket.purchase.selected_ticket_tier else None,
            'qr_code_url': ticket.ticket_png.url if ticket.ticket_png else None,
            'pdf_ticket_url': None,
            'ticket_png_url': ticket.ticket_png.url if ticket.ticket_png else None,
        }
        print(f"DEBUG: Fast ticket data created successfully")
        return Response(ticket_data)
        
    except FastEventTicket.DoesNotExist:
        return Response({'error': 'Fast ticket not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_ticket(request, ticket_id):
    """Verify an event ticket - FAST TICKETS ONLY"""
    try:
        # Only look for fast tickets
        from .fast_models import FastEventTicket
        
        ticket = FastEventTicket.objects.get(ticket_id=ticket_id)
        print(f"DEBUG: Verifying fast ticket: {ticket.ticket_id}")
        
        # Check if seller owns this event
        if ticket.event.owner != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if ticket is already used
        if ticket.is_used:
            return Response({
                'error': 'Ticket already used',
                'used_at': ticket.used_at,
                'verified_by': ticket.verified_by.full_name if ticket.verified_by else None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Mark ticket as used
        ticket.is_used = True
        ticket.used_at = timezone.now()
        ticket.verified_by = request.user
        ticket.verified_at = timezone.now()
        ticket.save()
        
        # Create fast ticket response for verification (same format as get_ticket_details)
        ticket_data = {
            'ticket_id': str(ticket.ticket_id),
            'purchase': ticket.purchase.id,
            'buyer': {
                'full_name': ticket.buyer.full_name,
                'email': ticket.buyer.email,
            },
            'event': {
                'title': ticket.event.title,
                'event_date': ticket.event.event_date,
                'description': ticket.event.description,
            },
            'verified_by': {
                'full_name': ticket.verified_by.full_name,
            } if ticket.verified_by else None,
            'quantity': ticket.quantity,
            'is_used': ticket.is_used,
            'used_at': ticket.used_at,
            'verified_at': ticket.verified_at,
            'created_at': ticket.created_at,
            'purchase_reference': ticket.purchase.payment.reference if ticket.purchase and ticket.purchase.payment else 'N/A',
            'payment_amount': str(ticket.purchase.total_price) if ticket.purchase else '0.00',
            'ticket_tier': {
                'name': ticket.purchase.selected_ticket_tier.name,
                'price': str(ticket.purchase.selected_ticket_tier.price),
                'category': {
                    'name': ticket.purchase.selected_ticket_tier.category.name,
                    'color': ticket.purchase.selected_ticket_tier.category.color,
                }
            } if ticket.purchase and ticket.purchase.selected_ticket_tier else None,
            'qr_code_url': ticket.ticket_png.url if ticket.ticket_png else None,
            'pdf_ticket_url': None,
            'ticket_png_url': ticket.ticket_png.url if ticket.ticket_png else None,
        }
        
        return Response({
            'message': 'Fast ticket verified successfully',
            'ticket': ticket_data
        })
        
    except FastEventTicket.DoesNotExist:
        return Response({'error': 'Fast ticket not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_ticket(request, ticket_id):
    """Regenerate ticket files (QR code and PDF) and upload to Cloudinary"""
    try:
        ticket = EventTicket.objects.get(ticket_id=ticket_id)
        
        # Check if seller owns this event
        if ticket.event.owner != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        # Regenerate QR code
        qr_code = ticket.generate_qr_code()
        
        # Generate PDF ticket
        pdf_ticket = ticket.generate_pdf_ticket()
        
        # Save the updated ticket
        ticket.save()
        
        return Response({
            'message': 'Ticket regenerated successfully',
            'ticket': EventTicketDetailSerializer(ticket).data,
            'qr_code_url': ticket.get_qr_code_url(),
            'pdf_ticket_url': ticket.get_pdf_ticket_url()
        })
        
    except EventTicket.DoesNotExist:
        return Response({'error': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': f'Failed to regenerate ticket: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_event_stats(request):
    """Get statistics for seller's events"""
    try:
        # Get all tickets for seller's events (both old and fast)
        old_tickets = EventTicket.objects.filter(event__owner=request.user)
        fast_tickets = FastEventTicket.objects.filter(event__owner=request.user)
        
        # Combine both ticket types
        all_tickets = list(old_tickets) + list(fast_tickets)
        
        total_tickets = len(all_tickets)
        used_tickets = len([t for t in all_tickets if t.is_used])
        valid_tickets = total_tickets - used_tickets
        
        # Get events with ticket counts
        events = {}
        for ticket in all_tickets:
            event_title = ticket.event.title
            if event_title not in events:
                events[event_title] = {
                    'total': 0,
                    'used': 0,
                    'valid': 0
                }
            events[event_title]['total'] += 1
            if ticket.is_used:
                events[event_title]['used'] += 1
            else:
                events[event_title]['valid'] += 1
        
        return Response({
            'total_tickets': total_tickets,
            'used_tickets': used_tickets,
            'valid_tickets': valid_tickets,
            'events': events
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




