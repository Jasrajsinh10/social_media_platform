let activeConversationId = null;
let pollInterval = null;
let chatSocket = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for app.js to fetch profile
    while (!currentUser) {
        await new Promise(r => setTimeout(r, 100));
    }

    loadConversations();
    loadContacts();
});

async function loadConversations() {
    try {
        const res = await fetch(`${API}/api/chat/conversations/`, { headers });
        if (!res.ok) throw new Error('Failed to load conversations');
        
        const conversations = await res.json();
        renderConversations(conversations);
        // After loading conversations, refresh contacts to hide those already in chats
        loadContacts(conversations);
    } catch (err) {
        console.error(err);
    }
}

async function loadContacts(activeConversations = []) {
    const list = document.getElementById('contacts-list');
    try {
        const res = await fetch(`${API}/api/following/${currentUser.id}/`, { headers });
        const following = await res.json();
        
        const res2 = await fetch(`${API}/api/followers/${currentUser.id}/`, { headers });
        const followers = await res2.json();

        // Combine unique users (excluding self)
        const usersMap = new Map();
        [...following, ...followers].forEach(u => {
            if (u.id !== currentUser.id) usersMap.set(u.id, u);
        });

        const users = Array.from(usersMap.values());
        
        // Filter out users who already have an active direct conversation
        const dmParticipantIds = new Set();
        activeConversations.forEach(conv => {
            if (!conv.is_group) {
                conv.participants.forEach(p => {
                    if (p.id !== currentUser.id) dmParticipantIds.add(p.id);
                });
            }
        });

        const availableUsers = users.filter(u => !dmParticipantIds.has(u.id));
        renderContacts(availableUsers);
    } catch (err) {
        console.error('Failed to load contacts', err);
    }
}

function renderConversations(conversations) {
    const list = document.getElementById('conversations-list');
    if (conversations.length === 0) {
        list.innerHTML = '<div style="padding:12px 20px; font-size:0.85rem; color:var(--text-muted);">No active chats</div>';
        return;
    }

    list.innerHTML = conversations.map(conv => {
        const otherParticipants = conv.participants.filter(p => p.id !== currentUser.id);
        const name = conv.is_group ? conv.name : (otherParticipants[0]?.username || 'User');
        const initial = name.charAt(0).toUpperCase();
        const lastMsgText = conv.last_message ? conv.last_message.text : 'No messages yet';

        return `
            <div class="conversation-item ${activeConversationId === conv.id ? 'active' : ''}" onclick="selectConversation(${conv.id}, '${name}')">
                <div class="avatar">${initial}</div>
                <div class="conversation-info">
                    <div class="conversation-name">${name}</div>
                    <div class="last-message">${lastMsgText}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function selectConversation(convId, name) {
    activeConversationId = convId;
    
    // UI Updates
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('chat-window').style.display = 'flex';
    document.getElementById('active-chat-name').textContent = name;
    document.getElementById('active-chat-avatar').textContent = name.charAt(0).toUpperCase();

    // Load initial Messages
    await loadMessages();

    // --- WEBSOCKET IMPLEMENTATION ---
    if (chatSocket) {
        chatSocket.close();
    }

    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsScheme}://${window.location.host}/ws/chat/${activeConversationId}/`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    chatSocket = new WebSocket(wsUrl);

    chatSocket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        const container = document.getElementById('messages-container');
        const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
        
        // Append single message instead of reloading all
        const msgHtml = `
            <div class="message-item ${data.sender_id == currentUser.id ? 'sent' : 'received'}">
                <div class="message-text">${data.message}</div>
                <div class="message-info">${new Date(data.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHtml);

        if (wasAtBottom) {
            container.scrollTop = container.scrollHeight;
        }
        
        // Update conversation list preview
        loadConversations();
    };

    chatSocket.onclose = function(e) {
        console.error('Chat socket closed unexpectedly');
    };

    /* --- POLLING (COMMENTED OUT AS REQUESTED) ---
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 5000); 
    */
}

async function loadMessages() {
    if (!activeConversationId) return;

    try {
        const res = await fetch(`${API}/api/chat/conversations/${activeConversationId}/messages/`, { headers });
        if (!res.ok) throw new Error('Failed to load messages');
        
        const messages = await res.json();
        renderMessages(messages);
    } catch (err) {
        console.error(err);
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messages-container');
    const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

    container.innerHTML = messages.map(msg => {
        const isSent = msg.sender === currentUser.id;
        return `
            <div class="message-item ${isSent ? 'sent' : 'received'}">
                <div class="message-text">${msg.text}</div>
                <div class="message-info">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
    }).join('');

    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

async function handleSendMessage(e) {
    e.preventDefault();
    if (!activeConversationId || !chatSocket) return;

    const input = document.getElementById('message-input');
    const text = input.value;
    if (!text.trim()) return;

    input.value = '';

    // Send via WebSocket
    chatSocket.send(JSON.stringify({
        'message': text,
        'sender_id': currentUser.id
    }));
    
    /* --- AJAX POST (COMMENTED OUT IN FAVOR OF WEBSOCKET) ---
    try {
        const res = await fetch(`${API}/api/chat/conversations/${activeConversationId}/messages/`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error('Failed to send message');
        
        await loadMessages();
        await loadConversations(); 
    } catch (err) {
        alert(err.message);
    }
    */
}

// New Chat Modal Logic
function openNewChatModal() {
    document.getElementById('new-chat-modal').classList.add('show');
    loadUsersForSelection();
}

function closeNewChatModal() {
    document.getElementById('new-chat-modal').classList.remove('show');
}

async function loadUsersForSelection() {
    // For now, let's fetch all people we follow or follow us (existing followers/following API)
    // Actually, let's fetch characters we follow+followers
    try {
        const res = await fetch(`${API}/api/following/${currentUser.id}/`, { headers });
        const following = await res.json();
        
        const res2 = await fetch(`${API}/api/followers/${currentUser.id}/`, { headers });
        const followers = await res2.json();

        // Combine and unique
        const usersMap = new Map();
        [...following, ...followers].forEach(u => {
            if (u.id !== currentUser.id) usersMap.set(u.id, u);
        });

        const users = Array.from(usersMap.values());
        const list = document.getElementById('user-selection-list');
        
        if (users.length === 0) {
            list.innerHTML = '<div style="padding:10px; color:var(--text-muted);">Follow someone to start chatting!</div>';
            return;
        }

        list.innerHTML = users.map(u => `
            <label class="user-select-item">
                <input type="checkbox" name="chat-user" value="${u.id}" data-username="${u.username}">
                <div class="avatar" style="width:30px; height:30px; font-size:0.7rem;">${u.username.charAt(0).toUpperCase()}</div>
                <span>${u.username}</span>
            </label>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

async function handleCreateChat() {
    const name = document.getElementById('new-chat-name').value;
    const checkboxes = document.querySelectorAll('input[name="chat-user"]:checked');
    const participantIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (participantIds.length === 0) {
        alert('Select at least one person');
        return;
    }

    const isGroup = participantIds.length > 1;

    try {
        const res = await fetch(`${API}/api/chat/conversations/`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name || null,
                is_group: isGroup,
                participant_ids: participantIds
            })
        });
        if (!res.ok) throw new Error('Failed to create chat');
        
        const conversation = await res.json();
        closeNewChatModal();
        await loadConversations();
        
        const otherParticipants = conversation.participants.filter(p => p.id !== currentUser.id);
        const convName = conversation.is_group ? conversation.name : (otherParticipants[0]?.username || 'User');
        selectConversation(conversation.id, convName);
    } catch (err) {
        alert(err.message);
    }
}

function renderContacts(users) {
    const list = document.getElementById('contacts-list');
    if (users.length === 0) {
        list.innerHTML = '<div style="padding:12px 20px; font-size:0.85rem; color:var(--text-muted);">No contacts available</div>';
        return;
    }

    list.innerHTML = users.map(user => `
        <div class="conversation-item" onclick="startDirectChat(${user.id}, '${user.username}')">
            <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-name">${user.username}</div>
                <div class="last-message">Click to start chatting</div>
            </div>
        </div>
    `).join('');
}

async function startDirectChat(userId, username) {
    try {
        const res = await fetch(`${API}/api/chat/conversations/`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_group: false,
                participant_ids: [userId]
            })
        });
        if (!res.ok) throw new Error('Failed to start chat');
        
        const conversation = await res.json();
        await loadConversations();
        selectConversation(conversation.id, username);
    } catch (err) {
        alert(err.message);
    }
}
