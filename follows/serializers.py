from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Follow

User = get_user_model()

class FollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Follow
        fields = ('id', 'follower', 'following', 'created_at')
        read_only_fields = ('id', 'created_at', 'follower')

    def validate(self, attrs):
        if self.context['request'].user == attrs['following']:
            raise serializers.ValidationError({"following": "You cannot follow yourself."})
        return attrs
