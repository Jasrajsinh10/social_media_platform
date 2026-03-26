from django.urls import path
from . import views

urlpatterns = [
    path('follow/<int:user_id>/', views.FollowView.as_view(), name='follow'),
    path('unfollow/<int:user_id>/', views.UnfollowView.as_view(), name='unfollow'),
    path('followers/<int:user_id>/', views.FollowersListView.as_view(), name='followers-list'),
    path('following/<int:user_id>/', views.FollowingListView.as_view(), name='following-list'),
]
