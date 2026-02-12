    // Auto-detect server URL (works in dev and production)
const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL);
console.log('Connecting to:', SERVER_URL);
    
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const messageBox = document.getElementById('messageBox');
    const messageTitle = document.getElementById('messageTitle');
    const messageText = document.getElementById('messageText');
    
    // Connection status
    socket.on('connect', () => {
      statusDot.classList.remove('disconnected');
      statusText.textContent = 'Connected';
    });
    
    socket.on('disconnect', () => {
      statusDot.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
    });
    
    // Check for error messages in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
      messageBox.classList.add('error');
      
      switch(error) {
        case 'no_code':
          messageTitle.textContent = '❌ Authentication Error';
          messageText.textContent = 'No authorization code received from Discord.';
          break;
        case 'token_failed':
          messageTitle.textContent = '❌ Authentication Failed';
          messageText.textContent = 'Failed to exchange authorization code. Please try again.';
          break;
        case 'not_in_server':
          messageTitle.textContent = '❌ Not in Server';
          messageText.textContent = 'You must be a member of the TwistedXvs Discord server.';
          break;
        case 'insufficient_permissions':
          messageTitle.textContent = '❌ Insufficient Permissions';
          messageText.textContent = 'You need the Moderator or Admin role to access this system.';
          break;
        case 'not_authenticated':
          messageTitle.textContent = '🔐 Login Required';
          messageText.textContent = 'Please login with Discord to access that page.';
          break;
        default:
          messageTitle.textContent = '❌ Error';
          messageText.textContent = 'An error occurred. Please try again.';
      }
      
      // Clear error from URL
      setTimeout(() => {
        window.history.replaceState({}, document.title, '/');
      }, 10000);
    }
