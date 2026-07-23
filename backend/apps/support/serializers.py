from rest_framework import serializers

from .models import Contact


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['name', 'email', 'message', 'source', 'conversation']
        extra_kwargs = {
            'source': {'required': False},
            'conversation': {'required': False},
        }

    def validate_name(self, value):
        value = (value or '').strip()
        if len(value) < 2:
            raise serializers.ValidationError("Please enter your name.")
        return value

    def validate_message(self, value):
        value = (value or '').strip()
        if len(value) < 10:
            raise serializers.ValidationError(
                "Please describe the problem in a bit more detail."
            )
        return value


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['user', 'assistant'])
    content = serializers.CharField(max_length=4000)


class ChatRequestSerializer(serializers.Serializer):
    """
    A short conversation to continue. History is sent by the client each time
    (the chat itself is never stored) and capped so a caller cannot push an
    unbounded prompt through to the provider.
    """
    messages = serializers.ListField(
        child=ChatMessageSerializer(),
        allow_empty=False,
        max_length=20,
    )
