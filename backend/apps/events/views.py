from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import EventTicket
from .serializers import EventTicketSerializer, EventTicketDetailSerializer

class SellerEventTicketsView(generics.ListAPIView):
    """Get all event tickets for seller's events"""
    serializer_class = EventTicketSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only return tickets for events owned by the seller
        return EventTicket.objects.filter(
            event__owner=self.request.user
        ).select_related('buyer', 'event', 'purchase__payment').order_by('-created_at')

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_ticket_details(request, ticket_id):
    """Get detailed information about a specific ticket"""
    try:
        ticket = EventTicket.objects.get(ticket_id=ticket_id)
        
        # Check if seller owns this event
        if ticket.event.owner != request.user:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = EventTicketDetailSerializer(ticket)
        return Response(serializer.data)
        
    except EventTicket.DoesNotExist:
        return Response({'error': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_ticket(request, ticket_id):
    """Verify an event ticket"""
    try:
        ticket = EventTicket.objects.get(ticket_id=ticket_id)
        
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
        
        return Response({
            'message': 'Ticket verified successfully',
            'ticket': EventTicketDetailSerializer(ticket).data
        })
        
    except EventTicket.DoesNotExist:
        return Response({'error': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_event_stats(request):
    """Get statistics for seller's events"""
    try:
        # Get all tickets for seller's events
        tickets = EventTicket.objects.filter(event__owner=request.user)
        
        total_tickets = tickets.count()
        used_tickets = tickets.filter(is_used=True).count()
        valid_tickets = total_tickets - used_tickets
        
        # Get events with ticket counts
        events = {}
        for ticket in tickets:
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



