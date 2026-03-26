let currentTab = 'followers';

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for app.js to fetch profile if it hasn't already
    if (!currentUser) {
        // Retry for a bit or just wait
        let retries = 0;
        while (!currentUser && retries < 10) {
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
    }

    if (!currentUser) return;

    // Check URL for tab parameter
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'following') {
        switchFollowsTab('following');
    } else {
        loadUsers('followers');
    }
});

function switchFollowsTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.follows-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    loadUsers(tab);
}

async function loadUsers(type) {
    const container = document.getElementById('user-list-container');
    container.innerHTML = '<div class="loading" style="text-align:center;"><span class="spinner"></span> Loading...</div>';

    try {
        const res = await fetch(`${API}/api/${type}/${currentUser.id}/`, { headers });
        if (!res.ok) throw new Error('Failed to load users');
        
        const users = await res.json();
        renderUserList(users, type);
    } catch (err) {
        container.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
    }
}

function renderUserList(users, type) {
    const container = document.getElementById('user-list-container');
    if (users.length === 0) {
        container.innerHTML = `<div class="empty-state">No ${type} yet.</div>`;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info-main">
                <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="username">${user.username}</div>
            </div>
            ${user.id !== currentUser.id ? `
            <button class="btn btn-ghost btn-sm follow-btn ${user.is_following ? 'following' : ''}" 
                    onclick="toggleUserFollow(${user.id}, this)">
                ${user.is_following ? 'Unfollow' : 'Follow'}
            </button>
            ` : ''}
        </div>
    `).join('');
}

async function toggleUserFollow(userId, btn) {
    const isCurrentlyFollowing = btn.classList.contains('following');
    const action = isCurrentlyFollowing ? 'unfollow' : 'follow';

    btn.disabled = true;
    try {
        const res = await fetch(`${API}/api/${action}/${userId}/`, {
            method: 'POST',
            headers
        });
        if (!res.ok) throw new Error(`${action} failed`);
        
        const data = await res.json();
        
        // Update button state
        btn.classList.toggle('following', !isCurrentlyFollowing);
        btn.textContent = !isCurrentlyFollowing ? 'Unfollow' : 'Follow';
        
        // Refresh profile stats in sidebar
        if (typeof fetchUserProfile === 'function') {
            await fetchUserProfile();
        }
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
}
