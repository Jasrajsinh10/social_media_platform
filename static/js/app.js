const API = '';
let currentUser = null;

// Auth Check
const token = localStorage.getItem('access_token');
if (!token) {
  window.location.href = '/';
}

const headers = {
  'Authorization': `Bearer ${token}`
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  await fetchUserProfile();
  if (document.getElementById('feed-container')) {
    await loadFeed();
  }
});

// Auth / User Logic
async function fetchUserProfile() {
  try {
    const res = await fetch(`${API}/api/auth/profile/`, { headers });
    if (!res.ok) {
      if (res.status === 401) logout();
      throw new Error('Failed to fetch profile');
    }
    currentUser = await res.json();
    
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('user-role').textContent = currentUser.role;
    document.getElementById('user-avatar-initial').textContent = currentUser.username.charAt(0).toUpperCase();
    document.getElementById('user-followers').textContent = currentUser.followers_count;
    document.getElementById('user-following').textContent = currentUser.following_count;
  } catch (err) {
    console.error(err);
  }
}

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/';
}

// Post Creation / Editing
let uploadedFile = null;
let uploadedFileType = null;

function previewMedia(input, type) {
  const file = input.files[0];
  if (!file) return;
  
  uploadedFile = file;
  uploadedFileType = type;
  
  const url = URL.createObjectURL(file);
  const preview = document.getElementById('media-preview');
  
  let mediaHtml = '';
  if (type === 'image') {
    mediaHtml = `<img src="${url}">`;
  } else {
    mediaHtml = `<video src="${url}" controls></video>`;
  }
  
  preview.innerHTML = `
    <div style="position:relative">
      ${mediaHtml}
      <button type="button" class="remove-btn" onclick="clearMedia()">×</button>
    </div>
  `;
}

function clearMedia() {
  uploadedFile = null;
  uploadedFileType = null;
  document.getElementById('media-preview').innerHTML = '';
  document.getElementById('post-image').value = '';
  document.getElementById('post-video').value = '';
}

async function handleCreatePost(e) {
  e.preventDefault();
  const text = document.getElementById('post-text').value;
  const btn = document.getElementById('submit-post-btn');
  btn.disabled = true;
  btn.textContent = 'Posting...';

  const formData = new FormData();
  formData.append('text', text);
  if (uploadedFile) {
    formData.append(uploadedFileType, uploadedFile);
  }

  try {
    const res = await fetch(`${API}/api/posts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}` // No Content-Type header so browser sets boundary for multipart
      },
      body: formData
    });
    
    if (!res.ok) throw new Error('Failed to create post');
    
    document.getElementById('create-post-form').reset();
    clearMedia();
    await loadFeed();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post';
  }
}

// Feed Rendering
async function loadFeed() {
  const container = document.getElementById('feed-container');
  try {
    const res = await fetch(`${API}/api/posts/`, { headers });
    if (!res.ok) throw new Error('Failed to load posts');
    
    const posts = await res.json();
    if (posts.length === 0) {
      container.innerHTML = `<div class="post-card" style="text-align:center;color:var(--text-muted)">No posts yet. Be the first to vibe!</div>`;
      return;
    }
    
    container.innerHTML = posts.map(createPostCard).join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">Error loading feed: ${err.message}</div>`;
  }
}

function createPostCard(post) {
  const isOwner = currentUser && post.author === currentUser.id;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin;
  
  const timeStr = new Date(post.created_at).toLocaleString();
  const postHtmlEscaped = escapeHtml(post.text);
  
  let mediaHtml = '';
  if (post.image) mediaHtml += `<img src="${post.image}" loading="lazy">`;
  if (post.video) mediaHtml += `<video src="${post.video}" controls></video>`;

  let menuHtml = '';
  if (canEdit || canDelete) {
    menuHtml = `
      <div class="post-menu">
        <button class="post-menu-btn" onclick="toggleMenu(${post.id})">⋮</button>
        <div class="post-menu-dropdown" id="menu-${post.id}">
          ${canEdit ? `<button onclick="openEditModal(${post.id}, '${postHtmlEscaped.replace(/'/g, "\\'")}')">Edit Post</button>` : ''}
          ${canDelete ? `<button class="delete-btn" onclick="deletePost(${post.id})">Delete Post</button>` : ''}
        </div>
      </div>
    `;
  }

  const commentsHtml = post.comments.map(c => `
    <div class="comment-item" id="comment-${c.id}">
      <div class="avatar">${c.username.charAt(0).toUpperCase()}</div>
      <div class="comment-body">
        <div class="comment-author">
          ${c.username}
          ${(currentUser && (c.user === currentUser.id || currentUser.role === 'admin')) ? `<button onclick="deleteComment(${c.id})" style="float:right;background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px;">Delete</button>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div class="comment-time">${new Date(c.created_at).toLocaleString()}</div>
      </div>
    </div>
  `).join('');

  let followBtnHtml = '';
  if (post.author_is_following !== null) {
      followBtnHtml = `
      <button class="btn btn-ghost btn-sm follow-btn ${post.author_is_following ? 'following' : ''}" 
              id="follow-btn-${post.id}" 
              onclick="toggleFollow(${post.author}, ${post.id})">
        ${post.author_is_following ? 'Unfollow' : 'Follow'}
      </button>
      `;
  }

  return `
    <article class="post-card" id="post-${post.id}">
      <div class="post-header">
        <div class="post-author">
          <div class="avatar">${post.author_username.charAt(0).toUpperCase()}</div>
          <div class="author-info">
            <div class="name">${post.author_username}</div>
            <div class="time">${timeStr}</div>
          </div>
          ${followBtnHtml}
        </div>
        ${menuHtml}
      </div>
      
      <div class="post-text">${postHtmlEscaped}</div>
      ${mediaHtml ? `<div class="post-media">${mediaHtml}</div>` : ''}
      
      <div class="post-actions">
        <button class="action-btn ${post.is_liked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="toggleLike(${post.id})">
          <span class="icon">❤️</span> <span id="like-count-${post.id}">${post.likes_count}</span>
        </button>
        <button class="action-btn" onclick="toggleComments(${post.id})">
          <span class="icon">💬</span> ${post.comments_count}
        </button>
      </div>

      <div class="comments-section" id="comments-${post.id}">
        <div id="comments-list-${post.id}">${commentsHtml}</div>
        <form class="comment-form" onsubmit="handleComment(event, ${post.id})">
          <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." required>
          <button type="submit">Post</button>
        </form>
      </div>
    </article>
  `;
}

// Interactions
async function toggleFollow(authorId, postId) {
  const btn = document.getElementById(`follow-btn-${postId}`);
  const isCurrentlyFollowing = btn.classList.contains('following');
  const action = isCurrentlyFollowing ? 'unfollow' : 'follow';

  try {
    const res = await fetch(`${API}/api/${action}/${authorId}/`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error(`${action} failed`);
    
    // Update the feed to reflect the change
    await loadFeed(); 
    // Also update current user profile to refresh following count
    await fetchUserProfile();
  } catch (err) {
    console.error(err);
  }
}

async function toggleLike(postId) {
  const btn = document.getElementById(`like-btn-${postId}`);
  const countSpan = document.getElementById(`like-count-${postId}`);
  try {
    const res = await fetch(`${API}/api/posts/${postId}/like/`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error('Toggle failed');
    const data = await res.json();
    
    btn.classList.toggle('liked', data.liked);
    countSpan.textContent = data.likes_count;
  } catch (err) {
    console.error(err);
  }
}

function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  section.classList.toggle('open');
}

async function handleComment(e, postId) {
  e.preventDefault();
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input.value;
  if (!text.trim()) return;
  
  try {
    const res = await fetch(`${API}/api/posts/${postId}/comments/`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Comment failed');
    
    // Reload full feed for simplicity, could also append specific comment
    await loadFeed();
  } catch (err) {
    console.error(err);
  }
}

async function deleteComment(commentId) {
  if (!confirm('Delete this comment?')) return;
  try {
    const res = await fetch(`${API}/api/comments/${commentId}/`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error('Failed to delete comment');
    document.getElementById(`comment-${commentId}`).remove();
  } catch (err) {
    console.error(err);
  }
}

// Post Actions (Edit / Delete)
function toggleMenu(postId) {
  document.querySelectorAll('.post-menu-dropdown.show').forEach(el => {
    if (el.id !== `menu-${postId}`) el.classList.remove('show');
  });
  document.getElementById(`menu-${postId}`).classList.toggle('show');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.post-menu')) {
    document.querySelectorAll('.post-menu-dropdown').forEach(el => el.classList.remove('show'));
  }
});

async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) return;
  
  try {
    const res = await fetch(`${API}/api/posts/${postId}/`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error('Failed to delete');
    await loadFeed();
  } catch(err) {
    alert(err.message);
  }
}

function openEditModal(postId, text) {
  document.getElementById('edit-modal').classList.add('show');
  document.getElementById('edit-post-id').value = postId;
  // Unescape HTML for editing
  const txtarea = document.createElement("textarea");
  txtarea.innerHTML = text;
  document.getElementById('edit-post-text').value = txtarea.value;
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('show');
}

async function handleUpdatePost(e) {
  e.preventDefault();
  const postId = document.getElementById('edit-post-id').value;
  const text = document.getElementById('edit-post-text').value;
  const btn = document.getElementById('update-post-btn');
  
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/posts/${postId}/`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Update failed');
    
    closeEditModal();
    await loadFeed();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
