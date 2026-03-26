from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Conversation, Message

User = get_user_model()

class ChatTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username='user1', password='password123')
        self.user2 = User.objects.create_user(username='user2', password='password123')
        self.client.force_authenticate(user=self.user1)

    def test_create_conversation(self):
        url = '/api/chat/conversations/'
        data = {
            'participant_ids': [self.user2.id],
            'is_group': False
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(Conversation.objects.first().participants.count(), 2)

    def test_send_message(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.set([self.user1, self.user2])
        
        url = f'/api/chat/conversations/{conv.id}/messages/'
        data = {'text': 'Hello world'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Message.objects.first().text, 'Hello world')

    def test_list_conversations(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.set([self.user1, self.user2])
        
        url = '/api/chat/conversations/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_list_messages(self):
        conv = Conversation.objects.create(is_group=False)
        conv.participants.set([self.user1, self.user2])
        Message.objects.create(conversation=conv, sender=self.user1, text='Test message')
        
        url = f'/api/chat/conversations/{conv.id}/messages/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['text'], 'Test message')
