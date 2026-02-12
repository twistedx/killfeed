// moderator-panel.js

// Auto-detect server URL (works in dev and production)
const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL);

console.log('Connecting to:', SERVER_URL);

const loadingScreen = document.getElementById('loadingScreen');
const accessDenied = document.getElementById('accessDenied');
const controlPanel = document.getElementById('controlPanel');
const statusIndicator = document.getElementById('statusIndicator');

// User info elements
const moderatorNameEl = document.getElementById('moderatorName');
const moderatorRoleEl = document.getElementById('moderatorRole');
const moderatorAvatarEl = document.getElementById('moderatorAvatar');

// Counter display elements
const killsDisplayEl = document.getElementById('killsDisplay');
const extractedDisplayEl = document.getElementById('extractedDisplay');
const kiaDisplayEl = document.getElementById('kiaDisplay');

// Message elements
const messageInputEl = document.getElementById('messageInput');
const messageStatusEl = document.getElementById('messageStatus');
const messagePreviewEl = document.getElementById('messagePreview');
const previewTextEl = document.getElementById('previewText');

let currentUser = null;
let isAuthenticated = false;

// Check authentication on page load
async function checkAuth() {
  try {
    console.log('Checking authentication...');
    const response = await fetch('/auth/user');
    
    if (!response.ok) {
      console.error('Not authenticated, redirecting...');
      window.location.href = '/?error=not_authenticated';
      return;
    }
    
    const user = await response.json();
    console.log('User authenticated:', user);
    currentUser = user;
    
    // Check if user is moderator or admin
    if (!user.isModerator && !user.isAdmin) {
      console.warn('User lacks permissions');
      loadingScreen.style.display = 'none';
      accessDenied.style.display = 'block';
      return;
    }
    
    // User is authenticated and authorized
    isAuthenticated = true;
    
    // Set user info
    moderatorNameEl.textContent = `${user.username}#${user.discriminator}`;
    moderatorRoleEl.textContent = user.isAdmin ? 'Administrator' : 'Moderator';
    
    // Set avatar
    if (user.avatar) {
      moderatorAvatarEl.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    } else {
      moderatorAvatarEl.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
    }
    
    // Show control panel
    loadingScreen.style.display = 'none';
    controlPanel.style.display = 'block';
    
    console.log('Control panel loaded successfully');
    
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = '/?error=auth_check_failed';
  }
}

// Connection status
socket.on('connect', () => {
  console.log('Socket connected to', SERVER_URL);
  if (isAuthenticated) {
    statusIndicator.classList.remove('disconnected');
  }
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  if (isAuthenticated) {
    statusIndicator.classList.add('disconnected');
  }
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

// Update counter displays
socket.on('countersUpdate', (counters) => {
  if (!isAuthenticated) return;
  console.log('Counters updated:', counters);
  killsDisplayEl.textContent = counters.kills || 0;
  extractedDisplayEl.textContent = counters.extracted || 0;
  kiaDisplayEl.textContent = counters.kia || 0;
});

// Update message display
socket.on('messageUpdate', (msg) => {
  if (!isAuthenticated) return;
  console.log('Message updated:', msg);
  
  if (msg.text) {
    messageInputEl.value = msg.text;
    previewTextEl.textContent = msg.text;
    messagePreviewEl.classList.add('active');
  } else {
    messagePreviewEl.classList.remove('active');
  }
  
  if (msg.visible) {
    messageStatusEl.textContent = 'Visible';
    messageStatusEl.classList.remove('hidden');
    messageStatusEl.classList.add('visible');
  } else {
    messageStatusEl.textContent = 'Hidden';
    messageStatusEl.classList.remove('visible');
    messageStatusEl.classList.add('hidden');
  }
});

// Counter control functions
function incrementCounter(type) {
  console.log('Incrementing counter:', type);
  socket.emit('incrementCounter', type);
}

function decrementCounter(type) {
  console.log('Decrementing counter:', type);
  socket.emit('decrementCounter', type);
}

function resetAllCounters() {
  if (confirm('Reset all counters to 0?')) {
    console.log('Resetting all counters');
    socket.emit('resetCounters');
  }
}

// Message control functions
function updateMessage() {
  const text = messageInputEl.value.trim();
  if (!text) {
    alert('Please enter a message first');
    return;
  }
  console.log('Updating message:', text);
  socket.emit('updateMessage', { text, visible: false });
}

function showMessage() {
  const text = messageInputEl.value.trim();
  if (!text) {
    alert('Please enter a message first');
    return;
  }
  console.log('Showing message:', text);
  socket.emit('updateMessage', { text, visible: true });
}

function hideMessage() {
  console.log('Hiding message');
  socket.emit('hideMessage');
}

function clearMessage() {
  if (confirm('Clear the message?')) {
    console.log('Clearing message');
    messageInputEl.value = '';
    socket.emit('updateMessage', { text: '', visible: false });
  }
}

// Celebration control function
function triggerCelebration(type) {
  console.log('Triggering celebration:', type);
  socket.emit('triggerCelebration', type);
}

// Check auth on page load
console.log('Page loaded, checking auth...');
checkAuth();
