from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Count

from .models import Post, Like, Comment
from .serializers import PostSerializer, PostCreateUpdateSerializer, CommentSerializer
from .permissions import IsOwnerOrAdmin, IsCommentOwnerOrAdmin


class PostViewSet(viewsets.ModelViewSet):
    """Full CRUD for posts. Owners can update/delete; admins can delete any."""
    permission_classes = (permissions.IsAuthenticated, IsOwnerOrAdmin)

    def get_queryset(self):
        return (
            Post.objects.select_related('author')
            .prefetch_related('likes', 'comments', 'comments__user')
            .annotate(
                likes_count=Count('likes', distinct=True),
                comments_count=Count('comments', distinct=True),
            )
            .order_by('-created_at')
        )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PostCreateUpdateSerializer
        return PostSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class LikeToggleView(APIView):
    """POST to toggle like on a post. One like per user per post."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, post_id):
        post = get_object_or_404(Post, id=post_id)
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
            return Response({'liked': False, 'likes_count': post.likes.count()})
        return Response({'liked': True, 'likes_count': post.likes.count()}, status=status.HTTP_201_CREATED)


class CommentListCreateView(generics.ListCreateAPIView):
    """List and create comments for a specific post."""
    serializer_class = CommentSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Comment.objects.filter(post_id=self.kwargs['post_id']).select_related('user')

    def perform_create(self, serializer):
        post = get_object_or_404(Post, id=self.kwargs['post_id'])
        serializer.save(user=self.request.user, post=post)


class CommentDestroyView(generics.DestroyAPIView):
    """Delete a comment. Owner or admin only."""
    serializer_class = CommentSerializer
    permission_classes = (permissions.IsAuthenticated, IsCommentOwnerOrAdmin)
    queryset = Comment.objects.all()
