from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    # API
    path('api/', include('accounts.urls')),
    path('api/', include('posts.urls')),
    path('api/', include('follows.urls')),
    path('api/chat/', include('chat.urls')),
    # Frontend
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('feed/', TemplateView.as_view(template_name='feed.html'), name='feed'),
    path('follows/', TemplateView.as_view(template_name='follows.html'), name='follows'),
    path('chat/', TemplateView.as_view(template_name='chat.html'), name='chat'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
