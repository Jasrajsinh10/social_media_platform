from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Conversation, Message
from accounts.serializers import UserSerializer

User = get_user_model()

class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    
    class Meta:
        model = Message
        fields = ('id', 'conversation', 'sender', 'sender_username', 'text', 'created_at')
        read_only_fields = ('id', 'sender', 'conversation', 'created_at')

class ConversationSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ('id', 'name', 'participants', 'participant_ids', 'is_group', 'created_at', 'updated_at', 'last_message')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_last_message(self, obj):
        last_msg = obj.messages.last()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None

    def create(self, validated_data):
        participant_ids = validated_data.pop('participant_ids', [])
        is_group = validated_data.get('is_group', False)
        
        # Add current user to participants
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user.id not in participant_ids:
                participant_ids.append(request.user.id)

        # For non-group chats (DMs), check if a conversation already exists between these two specifically
        if not is_group and len(participant_ids) == 2:
            existing = Conversation.objects.filter(is_group=False, participants__id=participant_ids[0]).filter(participants__id=participant_ids[1]).distinct()
            if existing.exists():
                return existing.first()

        conversation = Conversation.objects.create(**validated_data)
        conversation.participants.set(User.objects.filter(id__in=participant_ids))
        return conversation
