from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import Follow
from .serializers import FollowSerializer
from accounts.serializers import UserSerializer

User = get_user_model()

class FollowView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, user_id):
        following_user = get_object_or_404(User, id=user_id)
        if request.user == following_user:
            return Response({"error": "You cannot follow yourself."}, status=status.HTTP_400_BAD_REQUEST)
        
        follow, created = Follow.objects.get_or_create(follower=request.user, following=following_user)
        
        if not created:
            return Response({"message": "Already following this user."}, status=status.HTTP_200_OK)
        
        return Response({"followed": True}, status=status.HTTP_201_CREATED)

class UnfollowView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, user_id):
        following_user = get_object_or_404(User, id=user_id)
        follow = Follow.objects.filter(follower=request.user, following=following_user).first()
        
        if follow:
            follow.delete()
            return Response({"followed": False}, status=status.HTTP_200_OK)
        
        return Response({"message": "You are not following this user."}, status=status.HTTP_400_BAD_REQUEST)

class FollowersListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = get_object_or_404(User, id=self.kwargs['user_id'])
        return User.objects.filter(following__following=user)

class FollowingListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = get_object_or_404(User, id=self.kwargs['user_id'])
        return User.objects.filter(followers__follower=user)
