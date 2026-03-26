from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Post, Like, Comment

User = get_user_model()


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'user', 'username', 'post', 'text', 'created_at')
        read_only_fields = ('id', 'user', 'username', 'post', 'created_at')


class PostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_profile_picture = serializers.ImageField(source='author.profile_picture', read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    author_is_following = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = (
            'id', 'author', 'author_username', 'author_profile_picture',
            'author_is_following',
            'text', 'image', 'video',
            'likes_count', 'comments_count', 'is_liked',
            'comments',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'author', 'created_at', 'updated_at')

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_author_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user == obj.author:
                return None  # Cannot follow yourself
            from follows.models import Follow
            return Follow.objects.filter(follower=request.user, following=obj.author).exists()
        return False


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ('id', 'text', 'image', 'video', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')
