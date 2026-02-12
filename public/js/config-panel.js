// js/config-panel.js
const socket = io(window.location.origin);

const loadingScreen = document.getElementById('loadingScreen');
const accessDenied = document.getElementById('accessDenied');
const configPanel = document.getElementById('configPanel');

let isAuthenticated = false;
let currentConfig = {};

// Check authentication
async function checkAuth() {
  // Check if session cookie exists before making API call
  const hasSessionCookie = document.cookie.split(';').some(cookie => {
    return cookie.trim().startsWith('killfeed.sid=');
  });
  
  if (!hasSessionCookie) {
    console.log('No session cookie found, redirecting to login');
    window.location.href = '/?error=not_authenticated';
    return;
  }
  
  try {
    const response = await fetch('/auth/user', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      window.location.href = '/?error=not_authenticated';
      return;
    }
    
    const user = await response.json();
    
    if (!user.isAdmin) {
      loadingScreen.style.display = 'none';
      accessDenied.style.display = 'block';
      return;
    }
    
    // User is admin
    isAuthenticated = true;
    loadingScreen.style.display = 'none';
    configPanel.style.display = 'block';
    
    // Set user info
    document.getElementById('adminName').textContent = user.username;
    const avatarUrl = user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : '/default-avatar.png';
    document.getElementById('adminAvatar').src = avatarUrl;
    
    // Set overlay URL
    document.getElementById('overlayUrl').textContent = 
      `${window.location.origin}/obs-overlay.html`;
    
    // Load current config
    requestConfig();
    
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = '/?error=auth_check_failed';
  }
}

// Request current config
function requestConfig() {
  socket.emit('requestConfig');
}

// Receive config from server
socket.on('configUpdate', (config) => {
  currentConfig = config;
  applyConfigToUI(config);
});

// Apply config to UI elements
function applyConfigToUI(config) {
  // Counters
  if (config.counters) {
    document.getElementById('countersEnabled').checked = config.counters.enabled;
    document.getElementById('counterLayout').value = config.counters.layout || 'horizontal';
    
    // Position buttons
    document.querySelectorAll('.position-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.pos === (config.counters.position?.preset || 'bottom-left')) {
        btn.classList.add('active');
      }
    });
    
    // Size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.size === (config.counters.size || 'medium')) {
        btn.classList.add('active');
      }
    });
    
    // Colors
    if (config.counters.style) {
      document.getElementById('killsColor').value = config.counters.style.kills?.color || '#4CAF50';
      document.getElementById('killsColorHex').value = config.counters.style.kills?.color || '#4CAF50';
      document.getElementById('extractedColor').value = config.counters.style.extracted?.color || '#FFC107';
      document.getElementById('extractedColorHex').value = config.counters.style.extracted?.color || '#FFC107';
      document.getElementById('kiaColor').value = config.counters.style.kia?.color || '#F44336';
      document.getElementById('kiaColorHex').value = config.counters.style.kia?.color || '#F44336';
      
      // Update previews
      updateCounterPreview('kills', config.counters.style.kills?.color || '#4CAF50');
      updateCounterPreview('extracted', config.counters.style.extracted?.color || '#FFC107');
      updateCounterPreview('kia', config.counters.style.kia?.color || '#F44336');
    }
    
    // Labels
    if (config.counters.labels) {
      const killsLabelInput = document.getElementById('killsLabel');
      const extractedLabelInput = document.getElementById('extractedLabel');
      const kiaLabelInput = document.getElementById('kiaLabel');
      
      if (killsLabelInput) killsLabelInput.value = config.counters.labels.kills || 'Kills';
      if (extractedLabelInput) extractedLabelInput.value = config.counters.labels.extracted || 'Extracted';
      if (kiaLabelInput) kiaLabelInput.value = config.counters.labels.kia || 'KIA';
    }
    
    // Individual counter visibility
    if (config.counters.visibility) {
      const killsToggle = document.getElementById('killsEnabled');
      const extractedToggle = document.getElementById('extractedEnabled');
      const kiaToggle = document.getElementById('kiaEnabled');
      
      if (killsToggle) {
        killsToggle.checked = config.counters.visibility.kills ?? true;
        const killsItem = killsToggle.closest('.counter-config-item');
        if (!killsToggle.checked) killsItem?.classList.add('disabled');
        else killsItem?.classList.remove('disabled');
      }
      
      if (extractedToggle) {
        extractedToggle.checked = config.counters.visibility.extracted ?? true;
        const extractedItem = extractedToggle.closest('.counter-config-item');
        if (!extractedToggle.checked) extractedItem?.classList.add('disabled');
        else extractedItem?.classList.remove('disabled');
      }
      
      if (kiaToggle) {
        kiaToggle.checked = config.counters.visibility.kia ?? true;
        const kiaItem = kiaToggle.closest('.counter-config-item');
        if (!kiaToggle.checked) kiaItem?.classList.add('disabled');
        else kiaItem?.classList.remove('disabled');
      }
    }
  }

  // Message
  if (config.message) {
    document.getElementById('messageEnabled').checked = config.message.enabled;
    document.getElementById('messagePosition').value = config.message.position || 'bottom';
    document.getElementById('messageFontSize').value = config.message.fontSize || 32;
    document.getElementById('fontSizeValue').textContent = (config.message.fontSize || 32) + 'px';
    document.getElementById('messageColor').value = config.message.color || '#FFC107';
    document.getElementById('scrollSpeed').value = config.message.scrollSpeed || 15;
    document.getElementById('scrollSpeedValue').textContent = (config.message.scrollSpeed || 15) + 'px/s';
  }

  // Celebration
  if (config.celebration) {
    document.getElementById('celebrationEnabled').checked = config.celebration.enabled;
    document.getElementById('celebrationDuration').value = (config.celebration.duration || 5000) / 1000;
    document.getElementById('durationValue').textContent = ((config.celebration.duration || 5000) / 1000) + 's';
    document.getElementById('celebrationTextSize').value = config.celebration.textSize || 120;
    document.getElementById('textSizeValue').textContent = (config.celebration.textSize || 120) + 'px';
    document.getElementById('effectIntensity').value = config.celebration.effectIntensity || 'normal';
  }
}

// Build config from UI
function buildConfigFromUI() {
  const activePosition = document.querySelector('.position-btn.active');
  const activeSize = document.querySelector('.size-btn.active');
  
  return {
    counters: {
      enabled: document.getElementById('countersEnabled').checked,
      position: { preset: activePosition?.dataset.pos || 'bottom-left' },
      layout: document.getElementById('counterLayout').value,
      size: activeSize?.dataset.size || 'medium',
      visibility: {
        kills: document.getElementById('killsEnabled')?.checked ?? true,
        extracted: document.getElementById('extractedEnabled')?.checked ?? true,
        kia: document.getElementById('kiaEnabled')?.checked ?? true
      },
      labels: {
        kills: document.getElementById('killsLabel')?.value || 'Kills',
        extracted: document.getElementById('extractedLabel')?.value || 'Extracted',
        kia: document.getElementById('kiaLabel')?.value || 'KIA'
      },
      style: {
        kills: { 
          color: document.getElementById('killsColor').value,
          borderColor: document.getElementById('killsColor').value
        },
        extracted: { 
          color: document.getElementById('extractedColor').value,
          borderColor: document.getElementById('extractedColor').value
        },
        kia: { 
          color: document.getElementById('kiaColor').value,
          borderColor: document.getElementById('kiaColor').value
        }
      }
    },
    message: {
      enabled: document.getElementById('messageEnabled').checked,
      position: document.getElementById('messagePosition').value,
      fontSize: parseInt(document.getElementById('messageFontSize').value),
      color: document.getElementById('messageColor').value,
      borderColor: document.getElementById('messageColor').value,
      scrollSpeed: parseInt(document.getElementById('scrollSpeed').value)
    },
    celebration: {
      enabled: document.getElementById('celebrationEnabled').checked,
      duration: parseInt(document.getElementById('celebrationDuration').value) * 1000,
      textSize: parseInt(document.getElementById('celebrationTextSize').value),
      effectIntensity: document.getElementById('effectIntensity').value
    }
  };
}

// Save configuration
function saveConfig() {
  const config = buildConfigFromUI();
  socket.emit('updateConfig', config);
  
  // Show success feedback
  const saveBtn = document.querySelector('.btn-primary');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
  saveBtn.style.background = '#4CAF50';
  
  setTimeout(() => {
    saveBtn.innerHTML = originalText;
    saveBtn.style.background = '';
  }, 2000);
}

// Reset configuration
function resetConfig() {
  if (confirm('Reset all settings to defaults?')) {
    socket.emit('resetConfig');
  }
}

// Copy URL
function copyUrl() {
  const url = document.getElementById('overlayUrl').textContent;
  navigator.clipboard.writeText(url);
  
  const btn = document.querySelector('.btn-copy');
  btn.textContent = '✓ Copied!';
  setTimeout(() => btn.textContent = 'Copy URL', 2000);
}

// Event listeners for real-time updates
document.getElementById('messageFontSize').addEventListener('input', (e) => {
  document.getElementById('fontSizeValue').textContent = e.target.value + 'px';
});

document.getElementById('scrollSpeed').addEventListener('input', (e) => {
  document.getElementById('scrollSpeedValue').textContent = e.target.value + 'px/s';
});

document.getElementById('celebrationDuration').addEventListener('input', (e) => {
  document.getElementById('durationValue').textContent = e.target.value + 's';
});

document.getElementById('celebrationTextSize').addEventListener('input', (e) => {
  document.getElementById('textSizeValue').textContent = e.target.value + 'px';
});

// Position button handlers
document.querySelectorAll('.position-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Size button handlers
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ===== COLOR CONFIGURATOR =====

// Update preview when color changes
function updateCounterPreview(type, color) {
  const preview = document.querySelector(`.${type}-preview`);
  if (preview) {
    preview.style.borderColor = color;
    const valueEl = preview.querySelector('.preview-value');
    if (valueEl) {
      valueEl.style.color = color;
    }
  }
}

// Sync color picker and hex input
function setupColorSync(colorId, hexId, previewType) {
  const colorInput = document.getElementById(colorId);
  const hexInput = document.getElementById(hexId);
  
  if (!colorInput || !hexInput) return;
  
  // Color picker changes hex input
  colorInput.addEventListener('input', (e) => {
    const color = e.target.value.toUpperCase();
    hexInput.value = color;
    updateCounterPreview(previewType, color);
  });
  
  // Hex input changes color picker
  hexInput.addEventListener('input', (e) => {
    let hex = e.target.value.trim();
    
    // Add # if missing
    if (hex && !hex.startsWith('#')) {
      hex = '#' + hex;
    }
    
    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      colorInput.value = hex;
      updateCounterPreview(previewType, hex);
    }
  });
  
  // Format on blur
  hexInput.addEventListener('blur', (e) => {
    let hex = e.target.value.trim();
    if (hex && !hex.startsWith('#')) {
      hex = '#' + hex;
    }
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      hexInput.value = hex.toUpperCase();
    } else {
      // Reset to color picker value if invalid
      hexInput.value = colorInput.value.toUpperCase();
    }
  });
}

// Setup color sync for all counters
setupColorSync('killsColor', 'killsColorHex', 'kills');
setupColorSync('extractedColor', 'extractedColorHex', 'extracted');
setupColorSync('kiaColor', 'kiaColorHex', 'kia');

// Preset swatch buttons
document.querySelectorAll('.preset-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const color = btn.dataset.color;
    
    // Update color picker
    const colorInput = document.getElementById(`${target}Color`);
    const hexInput = document.getElementById(`${target}ColorHex`);
    
    if (colorInput) colorInput.value = color;
    if (hexInput) hexInput.value = color;
    
    // Update preview
    updateCounterPreview(target, color);
    
    // Visual feedback
    btn.style.transform = 'scale(0.9)';
    setTimeout(() => btn.style.transform = '', 200);
  });
});

// Reset buttons
document.querySelectorAll('.color-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const defaultColor = btn.dataset.color;
    const group = btn.closest('.counter-config-item');
    const colorInput = group.querySelector('input[type="color"]');
    const hexInput = group.querySelector('.color-hex');
    const preview = group.querySelector('.counter-preview');
    
    if (colorInput) colorInput.value = defaultColor;
    if (hexInput) hexInput.value = defaultColor;
    
    // Update preview border
    if (preview) {
      preview.style.borderColor = defaultColor;
      const valueEl = preview.querySelector('.preview-value');
      if (valueEl) valueEl.style.color = defaultColor;
    }
  });
});

// Label input handlers
document.querySelectorAll('.preview-label-input').forEach(input => {
  // Auto-select text on focus
  input.addEventListener('focus', (e) => {
    e.target.select();
  });
  
  // Prevent empty labels
  input.addEventListener('blur', (e) => {
    if (!e.target.value.trim()) {
      // Reset to default based on ID
      if (e.target.id === 'killsLabel') e.target.value = 'Kills';
      if (e.target.id === 'extractedLabel') e.target.value = 'Extracted';
      if (e.target.id === 'kiaLabel') e.target.value = 'KIA';
    }
  });
  
  // Visual feedback when typing
  input.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    if (value.length >= 15) {
      e.target.style.color = '#FFC107'; // Warning color
    } else {
      e.target.style.color = '';
    }
  });
});

// Individual counter toggle handlers
function setupCounterToggle(toggleId, counterType) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;
  
  toggle.addEventListener('change', (e) => {
    const configItem = e.target.closest('.counter-config-item');
    const isEnabled = e.target.checked;
    
    if (isEnabled) {
      configItem.classList.remove('disabled');
    } else {
      configItem.classList.add('disabled');
    }
  });
}

setupCounterToggle('killsEnabled', 'kills');
setupCounterToggle('extractedEnabled', 'extracted');
setupCounterToggle('kiaEnabled', 'kia');

// Check auth on page load
checkAuth();