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
      // Note: We skip client-side cookie check because the cookie is httpOnly
      // JavaScript cannot read httpOnly cookies, so we rely on the server to verify

      try {
        const response = await fetch('/auth/user', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          // Not authenticated - redirect to home
          window.location.href = '/?error=not_authenticated';
          return;
        }
        
        const user = await response.json();
        currentUser = user;
        
        // Check if user is moderator or admin
        if (!user.isModerator && !user.isAdmin) {
          // Not a moderator - show access denied
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
        
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/?error=auth_check_failed';
      }
    }
    
    // Connection status
    socket.on('connect', () => {
      console.log('Connected to server');
      if (isAuthenticated) {
        statusIndicator.classList.remove('disconnected');
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      if (isAuthenticated) {
        statusIndicator.classList.add('disconnected');
      }
    });
    
    // Listen for config updates to get custom labels
    socket.on('configUpdate', (config) => {
      if (!isAuthenticated) return;
      console.log('Config update received:', config);
      
      // Get counter elements
      const killsItem = document.querySelector('.counter-item.kills');
      const extractedItem = document.querySelector('.counter-item.extracted');
      const kiaItem = document.querySelector('.counter-item.kia');
      
      // Update counter labels if custom labels are set
      if (config.counters && config.counters.labels) {
        const killsLabelEl = document.getElementById('killsLabelDisplay');
        const extractedLabelEl = document.getElementById('extractedLabelDisplay');
        const kiaLabelEl = document.getElementById('kiaLabelDisplay');
        
        if (killsLabelEl) {
          killsLabelEl.textContent = '💀 ' + (config.counters.labels.kills || 'Kills');
        }
        if (extractedLabelEl) {
          extractedLabelEl.textContent = '✅ ' + (config.counters.labels.extracted || 'Extracted');
        }
        if (kiaLabelEl) {
          kiaLabelEl.textContent = '☠️ ' + (config.counters.labels.kia || 'KIA');
        }
      }
      
      // Update individual counter visibility
      if (config.counters && config.counters.visibility) {
        if (killsItem) {
          killsItem.style.display = config.counters.visibility.kills ? '' : 'none';
        }
        if (extractedItem) {
          extractedItem.style.display = config.counters.visibility.extracted ? '' : 'none';
        }
        if (kiaItem) {
          kiaItem.style.display = config.counters.visibility.kia ? '' : 'none';
        }
      }
      
      // Update counter colors if custom colors are set
      if (config.counters && config.counters.style) {
        if (killsItem && config.counters.style.kills) {
          const killsValue = killsItem.querySelector('.counter-value');
          if (killsValue) {
            killsValue.style.color = config.counters.style.kills.color || '#4CAF50';
          }
        }
        
        if (extractedItem && config.counters.style.extracted) {
          const extractedValue = extractedItem.querySelector('.counter-value');
          if (extractedValue) {
            extractedValue.style.color = config.counters.style.extracted.color || '#FFC107';
          }
        }
        
        if (kiaItem && config.counters.style.kia) {
          const kiaValue = kiaItem.querySelector('.counter-value');
          if (kiaValue) {
            kiaValue.style.color = config.counters.style.kia.color || '#F44336';
          }
        }
      }
    });
    
    // Update counter displays
    socket.on('countersUpdate', (counters) => {
      if (!isAuthenticated) return;
      killsDisplayEl.textContent = counters.kills || 0;
      extractedDisplayEl.textContent = counters.extracted || 0;
      kiaDisplayEl.textContent = counters.kia || 0;
    });
    
    // Update message display
    socket.on('messageUpdate', (msg) => {
      if (!isAuthenticated) return;
      
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
      socket.emit('incrementCounter', type);
    }
    
    function decrementCounter(type) {
      socket.emit('decrementCounter', type);
    }
    
    function resetAllCounters() {
      if (confirm('Reset all counters to 0?')) {
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
      socket.emit('updateMessage', { text, visible: false });
    }
    
    function showMessage() {
      const text = messageInputEl.value.trim();
      if (!text) {
        alert('Please enter a message first');
        return;
      }
      socket.emit('updateMessage', { text, visible: true });
    }
    
    function hideMessage() {
      socket.emit('hideMessage');
    }
    
    function clearMessage() {
      if (confirm('Clear the message?')) {
        messageInputEl.value = '';
        socket.emit('updateMessage', { text: '', visible: false });
      }
    }
    
    // Celebration control function
    function triggerCelebration(type) {
      console.log('🎉 Triggering celebration:', type);
      console.log('Socket connected:', socket.connected);
      console.log('Is authenticated:', isAuthenticated);
      socket.emit('triggerCelebration', type);
    }
    
    // Check auth on page load
    checkAuth();

    // Expose functions globally for inline event handlers
    window.incrementCounter = incrementCounter;
    window.decrementCounter = decrementCounter;
    window.resetAllCounters = resetAllCounters;
    window.updateMessage = updateMessage;
    window.showMessage = showMessage;
    window.hideMessage = hideMessage;
    window.clearMessage = clearMessage;
    window.triggerCelebration = triggerCelebration;