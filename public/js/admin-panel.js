    // Auto-detect server URL (works in dev and production)
const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL);
console.log('Connecting to:', SERVER_URL);
    
    const loadingScreen = document.getElementById('loadingScreen');
    const accessDenied = document.getElementById('accessDenied');
    const dashboardPanel = document.getElementById('dashboardPanel');
    const statusIndicator = document.getElementById('statusIndicator');
    const connectionText = document.getElementById('connectionText');
    const approvedListEl = document.getElementById('approvedList');
    const approvedCountEl = document.getElementById('approvedCount');
    const adminNameEl = document.getElementById('adminName');
    const adminAvatarEl = document.getElementById('adminAvatar');
    
    let currentUser = null;
    
    // Check authentication on page load
    async function checkAuth() {
      try {
        const response = await fetch('/auth/user');
        
        if (!response.ok) {
          // Not authenticated - redirect to home
          window.location.href = '/?error=not_authenticated';
          return;
        }
        
        const user = await response.json();
        currentUser = user;
        
        // Check if user is admin
        if (!user.isAdmin) {
          // Not an admin - show access denied
          loadingScreen.style.display = 'none';
          accessDenied.style.display = 'block';
          return;
        }
        
        // User is admin - show dashboard
        loadingScreen.style.display = 'none';
        dashboardPanel.style.display = 'block';
        
        // Set admin info
        adminNameEl.textContent = `${user.username}#${user.discriminator}`;
        
        if (user.avatar) {
          adminAvatarEl.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
        } else {
          adminAvatarEl.src = `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
        }
        
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/?error=auth_check_failed';
      }
    }
    
    // Connection status
    socket.on('connect', () => {
      console.log('Connected to server');
      statusIndicator.classList.remove('disconnected');
      connectionText.textContent = 'Connected';
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      statusIndicator.classList.add('disconnected');
      connectionText.textContent = 'Disconnected';
    });
    
    // Update approved moderators list
    socket.on('approvedModeratorsUpdate', (mods) => {
      console.log('Approved moderators:', mods);
      approvedCountEl.textContent = mods.length;
      
      if (mods.length === 0) {
        approvedListEl.innerHTML = '<div class="empty-state">No moderators currently connected</div>';
        return;
      }
      
      approvedListEl.innerHTML = '';
      mods.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'moderator-card';
        
        // Get Discord avatar
        const avatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(mod.discordId || '0') % 5}.png`;
        
        card.innerHTML = `
          <div class="moderator-info">
            <img class="moderator-avatar" src="${avatarUrl}" alt="${escapeHtml(mod.name)}">
            <div class="moderator-details">
              <div class="moderator-name">${mod.isAdmin ? '👑' : '🎮'} ${escapeHtml(mod.name)}</div>
              <div class="moderator-meta">
                Connected: ${new Date(mod.connectedAt).toLocaleString()}<br>
                Role: ${mod.isAdmin ? '<strong>Admin</strong>' : 'Moderator'}<br>
                Socket: <code>${mod.socketId}</code>
              </div>
            </div>
          </div>
          <div class="moderator-actions">
            <button class="btn btn-kick" onclick="kickModerator('${mod.socketId}')">
              ⛔ Disconnect
            </button>
          </div>
        `;
        approvedListEl.appendChild(card);
      });
    });
    
    // Kick moderator
    function kickModerator(socketId) {
      if (confirm('Disconnect this moderator? They will need to reconnect.')) {
        console.log('Kicking moderator:', socketId);
        socket.emit('kickModerator', socketId);
      }
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Check auth on page load
    checkAuth();
