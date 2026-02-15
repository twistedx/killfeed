// Auto-detect server URL (works in dev and production)
const SERVER_URL = window.location.origin;

// Socket will be initialized after auth check to include server ID
let socket = null;
    
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
      console.log('\n========================================');
      console.log('📊 DASHBOARD AUTH CHECK');
      console.log('========================================');
      console.log('Time:', new Date().toISOString());
      console.log('Current URL:', window.location.href);

      // NOTE: We don't check document.cookie because the session cookie is httpOnly
      // (JavaScript cannot read httpOnly cookies - that's a security feature)
      // Instead, we just try to authenticate with the server

      console.log('Verifying authentication with server...');

      try {
        console.log('Making fetch request to /auth/user...');
        const response = await fetch('/auth/user', {
          credentials: 'include' // Ensure cookies are sent
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);
        
        if (!response.ok) {
          console.log('❌ Auth check failed - not authenticated');
          console.log('Redirecting to /?error=not_authenticated');
          console.log('==========================================\n');
          window.location.href = '/?error=not_authenticated';
          return;
        }
        
        currentUser = await response.json();
        console.log('✅ Auth successful!');
        console.log('User:', currentUser.username);
        console.log('Admin:', currentUser.isAdmin);
        console.log('Moderator:', currentUser.isModerator);
        console.log('Selected Server:', currentUser.selectedServer?.name);
        console.log('Loading dashboard...');
        console.log('==========================================\n');

        // Initialize Socket.IO with server parameter
        if (currentUser.selectedServer) {
          socket = io(SERVER_URL, {
            query: { server: currentUser.selectedServer.id },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
          });
          console.log('Socket.IO connecting to server:', currentUser.selectedServer.name);

          // Socket events for stats
          socket.on('countersUpdate', (counters) => {
            document.getElementById('statKills').textContent = counters.kills || 0;
            document.getElementById('statExtracted').textContent = counters.extracted || 0;
            document.getElementById('statKia').textContent = counters.kia || 0;
          });

          socket.on('approvedModeratorsUpdate', (mods) => {
            document.getElementById('statModerators').textContent = mods.length;
          });
        }

        // Load dashboard
        loadDashboard();
        
      } catch (error) {
        console.error('❌ Auth check exception:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.log('Redirecting to /?error=auth_check_failed');
        console.log('==========================================\n');
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

      // Setup server selector if user has access to multiple servers
      setupServerSelector();

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

    // Setup server selector dropdown
    function setupServerSelector() {
      if (!currentUser.sharedGuilds || currentUser.sharedGuilds.length === 0) {
        return;
      }

      const serverSelector = document.getElementById('serverSelector');
      const serverDropdown = document.getElementById('serverDropdown');

      // Only show selector if user has access to servers
      if (currentUser.sharedGuilds.length > 0) {
        serverSelector.style.display = 'flex';

        // Populate dropdown with user's servers
        serverDropdown.innerHTML = '';
        currentUser.sharedGuilds.forEach(guild => {
          const option = document.createElement('option');
          option.value = guild.guildId;
          option.textContent = guild.guildName;

          // Mark as selected if it's the current server
          if (currentUser.selectedServer && guild.guildId === currentUser.selectedServer.id) {
            option.selected = true;
          }

          serverDropdown.appendChild(option);
        });

        // Handle server switching
        serverDropdown.addEventListener('change', handleServerSwitch);
      }
    }

    // Handle server switching
    async function handleServerSwitch(event) {
      const newServerId = event.target.value;

      // Don't switch if it's the same server
      if (currentUser.selectedServer && newServerId === currentUser.selectedServer.id) {
        return;
      }

      const selectedGuild = currentUser.sharedGuilds.find(g => g.guildId === newServerId);
      if (!selectedGuild) {
        alert('Error: Server not found');
        return;
      }

      // Confirm switch
      if (!confirm(`Switch to controlling ${selectedGuild.guildName}?`)) {
        // Reset dropdown to current server
        event.target.value = currentUser.selectedServer.id;
        return;
      }

      try {
        // Call server switch endpoint
        const response = await fetch('/auth/switch-server', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ serverId: newServerId })
        });

        if (!response.ok) {
          throw new Error('Failed to switch server');
        }

        const result = await response.json();
        console.log('Server switched:', result);

        // Reload the page to reinitialize with new server
        window.location.reload();

      } catch (error) {
        console.error('Error switching server:', error);
        alert('Failed to switch server. Please try again.');
        // Reset dropdown to current server
        event.target.value = currentUser.selectedServer.id;
      }
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
    
    // Show OBS info
    function showOBSInfo() {
      if (!currentUser || !currentUser.selectedServer) {
        alert('Error: No server selected');
        return;
      }

      const baseUrl = window.location.origin;
      const serverId = currentUser.selectedServer.id;
      const serverName = currentUser.selectedServer.name;

      const message = `OBS Browser Source URLs for ${serverName}:

📺 Kill Feed Overlay (All-in-One):
${baseUrl}/obs-overlay.html?server=${serverId}

Add this as a Browser Source in OBS:
- Width: 1920
- Height: 1080
- Check "Shutdown source when not visible"

⚠️ IMPORTANT: Each Discord server has its own overlay.
Make sure to use the correct server ID in the URL.

Server: ${serverName}
Server ID: ${serverId}`;

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