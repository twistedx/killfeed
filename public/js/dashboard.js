    // Auto-detect server URL (works in dev and production)
const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL);
console.log('Connecting to:', SERVER_URL);
    
    const loadingScreen = document.getElementById('loadingScreen');
    const dashboardContent = document.getElementById('dashboardContent');
    const actionsGrid = document.getElementById('actionsGrid');
    const statsGrid = document.getElementById('statsGrid');
    
    let currentUser = null;
    
    // Action card templates
    const actionCards = {
      moderatorPanel: {
        icon: '🎮',
        title: 'Moderator Panel',
        description: 'Control stream overlays in real-time',
        features: [
          'Adjust kill, extracted, and KIA counters',
          'Update scrolling messages',
          'Trigger celebration animations',
          'Real-time sync with OBS'
        ],
        cta: 'Open Control Panel',
        link: '/moderator-panel.html',
        class: 'moderator',
        roles: ['moderator', 'admin']
      },
      
      adminPanel: {
        icon: '👑',
        title: 'Admin Panel',
        description: 'Manage moderators and monitor activity',
        features: [
          'View connected moderators',
          'Monitor system activity',
          'Disconnect users if needed',
          'Real-time dashboard updates'
        ],
        cta: 'Manage System',
        link: '/admin-panel.html',
        class: 'admin',
        roles: ['admin']
      },
      
      configPanel: {
        icon: '⚙️',
        title: 'Configuration',
        description: 'Customize overlay appearance and behavior',
        features: [
          'Adjust overlay positions and sizes',
          'Change colors and themes',
          'Configure animation settings',
          'Preview changes live'
        ],
        cta: 'Configure Overlays',
        link: '/config-panel.html',
        class: 'admin',
        roles: ['admin']
      },
      
      obsOverlays: {
        icon: '📺',
        title: 'OBS Browser Sources',
        description: 'Get URLs for your streaming software',
        features: [
          'Counters overlay (kills, extracted, KIA)',
          'Scrolling message banner',
          'Celebration animations',
          'Copy-paste ready URLs'
        ],
        cta: 'View OBS URLs',
        link: '#',
        class: 'obs',
        roles: ['moderator', 'admin'],
        onClick: 'showOBSInfo()'
      }
    };
    
    // Check authentication
    async function checkAuth() {
      try {
        const response = await fetch('/auth/user');
        
        if (!response.ok) {
          window.location.href = '/?error=not_authenticated';
          return;
        }
        
        currentUser = await response.json();
        
        // Load dashboard
        loadDashboard();
        
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/?error=auth_check_failed';
      }
    }
    
    function loadDashboard() {
      // Set user info
      document.getElementById('userName').textContent = `${currentUser.username}#${currentUser.discriminator}`;
      
      if (currentUser.isAdmin) {
        document.getElementById('userRole').textContent = '👑 Administrator';
        document.getElementById('welcomeSubtitle').textContent = 'Full system access';
      } else if (currentUser.isModerator) {
        document.getElementById('userRole').textContent = '🎮 Moderator';
        document.getElementById('welcomeSubtitle').textContent = 'Stream control access';
      }
      
      // Set avatar
      if (currentUser.avatar) {
        document.getElementById('userAvatar').src = `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`;
      } else {
        document.getElementById('userAvatar').src = `https://cdn.discordapp.com/embed/avatars/${parseInt(currentUser.discriminator) % 5}.png`;
      }
      
      // Show stats for admins
      if (currentUser.isAdmin) {
        statsGrid.style.display = 'grid';
      }
      
      // Load action cards based on role
      loadActionCards();
      
      // Show dashboard
      loadingScreen.style.display = 'none';
      dashboardContent.style.display = 'block';
    }
    
    function loadActionCards() {
      actionsGrid.innerHTML = '';
      
      Object.entries(actionCards).forEach(([key, card]) => {
        // Check if user has required role
        const hasAccess = card.roles.some(role => {
          if (role === 'admin') return currentUser.isAdmin;
          if (role === 'moderator') return currentUser.isModerator || currentUser.isAdmin;
          return false;
        });
        
        if (!hasAccess) return;
        
        const cardEl = document.createElement('a');
        cardEl.className = `action-card ${card.class}`;
        cardEl.href = card.link;
        
        if (card.onClick) {
          cardEl.onclick = (e) => {
            e.preventDefault();
            eval(card.onClick);
          };
        }
        
        cardEl.innerHTML = `
          <div class="action-icon">${card.icon}</div>
          <div class="action-title">${card.title}</div>
          <div class="action-description">${card.description}</div>
          <ul class="action-features">
            ${card.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
          <span class="action-cta">${card.cta} →</span>
        `;
        
        actionsGrid.appendChild(cardEl);
      });
    }
    
    // Socket events for stats
    socket.on('countersUpdate', (counters) => {
      document.getElementById('statKills').textContent = counters.kills || 0;
      document.getElementById('statExtracted').textContent = counters.extracted || 0;
      document.getElementById('statKia').textContent = counters.kia || 0;
    });
    
    socket.on('approvedModeratorsUpdate', (mods) => {
      document.getElementById('statModerators').textContent = mods.length;
    });
    
    // Show OBS info
    function showOBSInfo() {
      const baseUrl = window.location.origin;
      
      const message = `OBS Browser Source URLs:

📊 Counters Overlay:
${baseUrl}/obs-overlay.html

📢 Message Overlay:
${baseUrl}/obs-message.html

🎉 Celebration Overlay:
${baseUrl}/obs-celebration.html

Add these as Browser Sources in OBS:
- Width: 1920
- Height: 1080
- Check "Shutdown source when not visible"`;
      
      alert(message);
    }
    
    // Logout
    function logout() {
      if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/auth/logout';
      }
    }
    
    // Check auth on load
    checkAuth();
