// js/config-panel.js

// ===== CONSTANTS =====
const CONSTANTS = {
  FEEDBACK_DURATION: 2000,
  EMOJI_POPUP_WIDTH: 344,
  EMOJI_POPUP_HEIGHT: 460,
  EMOJI_POPUP_OFFSET: 8,
  EDGE_MARGIN: 16,
  LABEL_WARNING_LENGTH: 15,
  DEBOUNCE_DELAY: 150,
  HEX_COLOR_REGEX: /^#[0-9A-F]{6}$/i,
  SESSION_COOKIE_NAME: 'killfeed.sid',
  DEFAULTS: {
    KILLS_COLOR: '#4CAF50',
    EXTRACTED_COLOR: '#FFC107',
    KIA_COLOR: '#F44336',
    KILLS_LABEL: 'Kills',
    EXTRACTED_LABEL: 'Extracted',
    KIA_LABEL: 'KIA',
    KILLS_ICON: '💀',
    EXTRACTED_ICON: '✅',
    KIA_ICON: '☠️'
  }
};

// ===== UTILITY FUNCTIONS =====
const Utils = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Note: This function can't actually check httpOnly cookies
  // It's kept for compatibility but will always return false for httpOnly cookies
  hasSessionCookie() {
    // Session cookie is httpOnly, so document.cookie won't see it
    // We rely on the server to verify the session instead
    return true; // Skip client-side check, let server verify
  }
};

// ===== MAIN MODULE =====
const ConfigPanel = (() => {
  // Private state
  let isAuthenticated = false;
  let currentConfig = {};
  let socket = null;
  let domCache = {};
  let currentEmojiTarget = null;
  let emojiPickerPopup = null;
  let emojiPickerElement = null;

  // ===== DOM CACHING =====
  function cacheDOMElements() {
    domCache = {
      loadingScreen: document.getElementById('loadingScreen'),
      accessDenied: document.getElementById('accessDenied'),
      configPanel: document.getElementById('configPanel'),
      adminName: document.getElementById('adminName'),
      adminAvatar: document.getElementById('adminAvatar'),
      overlayUrl: document.getElementById('overlayUrl'),

      // Counters
      countersEnabled: document.getElementById('countersEnabled'),
      counterLayout: document.getElementById('counterLayout'),
      killsColor: document.getElementById('killsColor'),
      killsColorHex: document.getElementById('killsColorHex'),
      extractedColor: document.getElementById('extractedColor'),
      extractedColorHex: document.getElementById('extractedColorHex'),
      kiaColor: document.getElementById('kiaColor'),
      kiaColorHex: document.getElementById('kiaColorHex'),
      killsLabel: document.getElementById('killsLabel'),
      extractedLabel: document.getElementById('extractedLabel'),
      kiaLabel: document.getElementById('kiaLabel'),
      killsIcon: document.getElementById('killsIcon'),
      extractedIcon: document.getElementById('extractedIcon'),
      kiaIcon: document.getElementById('kiaIcon'),
      killsEnabled: document.getElementById('killsEnabled'),
      extractedEnabled: document.getElementById('extractedEnabled'),
      kiaEnabled: document.getElementById('kiaEnabled'),

      // Message
      messageEnabled: document.getElementById('messageEnabled'),
      messagePosition: document.getElementById('messagePosition'),
      messageFontSize: document.getElementById('messageFontSize'),
      fontSizeValue: document.getElementById('fontSizeValue'),
      messageColor: document.getElementById('messageColor'),
      scrollSpeed: document.getElementById('scrollSpeed'),
      scrollSpeedValue: document.getElementById('scrollSpeedValue'),

      // Celebration
      celebrationEnabled: document.getElementById('celebrationEnabled'),
      celebrationDuration: document.getElementById('celebrationDuration'),
      durationValue: document.getElementById('durationValue'),
      celebrationTextSize: document.getElementById('celebrationTextSize'),
      textSizeValue: document.getElementById('textSizeValue'),
      effectIntensity: document.getElementById('effectIntensity')
    };
  }

  // ===== AUTHENTICATION =====
  async function checkAuth() {
    // Note: We skip client-side cookie check because the cookie is httpOnly
    // JavaScript cannot read httpOnly cookies, so we rely on the server to verify

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
        domCache.loadingScreen.style.display = 'none';
        domCache.accessDenied.style.display = 'block';
        return;
      }

      // User is admin
      isAuthenticated = true;
      domCache.loadingScreen.style.display = 'none';
      domCache.configPanel.style.display = 'block';

      // Set user info
      domCache.adminName.textContent = user.username;
      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : '/default-avatar.png';
      domCache.adminAvatar.src = avatarUrl;

      // Set overlay URL
      domCache.overlayUrl.textContent = `${window.location.origin}/obs-overlay.html`;

      // Load current config
      requestConfig();

    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/?error=auth_check_failed';
    }
  }

  // ===== SOCKET MANAGEMENT =====
  function initializeSocket() {
    socket = io(window.location.origin);

    socket.on('connect', () => {
      console.log('Socket connected');
      if (isAuthenticated) {
        requestConfig();
      }
    });

    socket.on('disconnect', () => {
      console.warn('Socket disconnected');
      showConnectionWarning();
    });

    socket.on('reconnect', () => {
      console.log('Socket reconnected');
      hideConnectionWarning();
      requestConfig();
    });

    socket.on('configUpdate', (config) => {
      try {
        currentConfig = config;
        applyConfigToUI(config);
      } catch (error) {
        console.error('Error applying config:', error);
        showErrorNotification('Failed to apply configuration');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      showConnectionWarning();
    });
  }

  function requestConfig() {
    if (socket && socket.connected) {
      socket.emit('requestConfig');
    }
  }

  function showConnectionWarning() {
    // Create or show connection warning if needed
    let warning = document.getElementById('connectionWarning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'connectionWarning';
      warning.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #F44336; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
      warning.textContent = '⚠️ Connection lost. Reconnecting...';
      document.body.appendChild(warning);
    }
    warning.style.display = 'block';
  }

  function hideConnectionWarning() {
    const warning = document.getElementById('connectionWarning');
    if (warning) {
      warning.style.display = 'none';
    }
  }

  function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #F44336; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, CONSTANTS.FEEDBACK_DURATION);
  }

  // ===== CONFIG APPLICATION =====
  function applyConfigToUI(config) {
    try {
      applyCountersConfig(config.counters);
      applyMessageConfig(config.message);
      applyCelebrationConfig(config.celebration);
    } catch (error) {
      console.error('Error in applyConfigToUI:', error);
      throw error;
    }
  }

  function applyCountersConfig(counters) {
    if (!counters) return;

    domCache.countersEnabled.checked = counters.enabled;
    domCache.counterLayout.value = counters.layout || 'horizontal';

    // Position buttons
    document.querySelectorAll('.position-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.pos === (counters.position?.preset || 'bottom-left')) {
        btn.classList.add('active');
      }
    });

    // Size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.size === (counters.size || 'medium')) {
        btn.classList.add('active');
      }
    });

    // Colors
    if (counters.style) {
      applyCounterColors(counters.style);
    }

    // Labels
    if (counters.labels) {
      applyCounterLabels(counters.labels);
    }

    // Icons
    if (counters.icons) {
      applyCounterIcons(counters.icons);
    }

    // Individual counter visibility
    if (counters.visibility) {
      applyCounterVisibility(counters.visibility);
    }
  }

  function applyCounterColors(style) {
    const colorMap = [
      { type: 'kills', color: style.kills?.color || CONSTANTS.DEFAULTS.KILLS_COLOR },
      { type: 'extracted', color: style.extracted?.color || CONSTANTS.DEFAULTS.EXTRACTED_COLOR },
      { type: 'kia', color: style.kia?.color || CONSTANTS.DEFAULTS.KIA_COLOR }
    ];

    colorMap.forEach(({ type, color }) => {
      domCache[`${type}Color`].value = color;
      domCache[`${type}ColorHex`].value = color;
      updateCounterPreview(type, color);
    });
  }

  function applyCounterLabels(labels) {
    if (domCache.killsLabel) domCache.killsLabel.value = labels.kills || CONSTANTS.DEFAULTS.KILLS_LABEL;
    if (domCache.extractedLabel) domCache.extractedLabel.value = labels.extracted || CONSTANTS.DEFAULTS.EXTRACTED_LABEL;
    if (domCache.kiaLabel) domCache.kiaLabel.value = labels.kia || CONSTANTS.DEFAULTS.KIA_LABEL;
  }

  function applyCounterIcons(icons) {
    if (domCache.killsIcon) domCache.killsIcon.textContent = icons.kills || CONSTANTS.DEFAULTS.KILLS_ICON;
    if (domCache.extractedIcon) domCache.extractedIcon.textContent = icons.extracted || CONSTANTS.DEFAULTS.EXTRACTED_ICON;
    if (domCache.kiaIcon) domCache.kiaIcon.textContent = icons.kia || CONSTANTS.DEFAULTS.KIA_ICON;
  }

  function applyCounterVisibility(visibility) {
    const visibilityMap = [
      { type: 'kills', toggle: domCache.killsEnabled },
      { type: 'extracted', toggle: domCache.extractedEnabled },
      { type: 'kia', toggle: domCache.kiaEnabled }
    ];

    visibilityMap.forEach(({ type, toggle }) => {
      if (toggle) {
        toggle.checked = visibility[type] ?? true;
        const item = toggle.closest('.counter-config-item');
        if (!toggle.checked) item?.classList.add('disabled');
        else item?.classList.remove('disabled');
      }
    });
  }

  function applyMessageConfig(message) {
    if (!message) return;

    domCache.messageEnabled.checked = message.enabled;
    domCache.messagePosition.value = message.position || 'bottom';
    domCache.messageFontSize.value = message.fontSize || 32;
    domCache.fontSizeValue.textContent = (message.fontSize || 32) + 'px';
    domCache.messageColor.value = message.color || CONSTANTS.DEFAULTS.EXTRACTED_COLOR;
    domCache.scrollSpeed.value = message.scrollSpeed || 15;
    domCache.scrollSpeedValue.textContent = (message.scrollSpeed || 15) + 'px/s';
  }

  function applyCelebrationConfig(celebration) {
    if (!celebration) return;

    domCache.celebrationEnabled.checked = celebration.enabled;
    domCache.celebrationDuration.value = (celebration.duration || 5000) / 1000;
    domCache.durationValue.textContent = ((celebration.duration || 5000) / 1000) + 's';
    domCache.celebrationTextSize.value = celebration.textSize || 120;
    domCache.textSizeValue.textContent = (celebration.textSize || 120) + 'px';
    domCache.effectIntensity.value = celebration.effectIntensity || 'normal';
  }

  // ===== CONFIG BUILDING =====
  function buildConfigFromUI() {
    const activePosition = document.querySelector('.position-btn.active');
    const activeSize = document.querySelector('.size-btn.active');

    return {
      counters: {
        enabled: domCache.countersEnabled.checked,
        position: { preset: activePosition?.dataset.pos || 'bottom-left' },
        layout: domCache.counterLayout.value,
        size: activeSize?.dataset.size || 'medium',
        visibility: {
          kills: domCache.killsEnabled?.checked ?? true,
          extracted: domCache.extractedEnabled?.checked ?? true,
          kia: domCache.kiaEnabled?.checked ?? true
        },
        labels: {
          kills: domCache.killsLabel?.value || CONSTANTS.DEFAULTS.KILLS_LABEL,
          extracted: domCache.extractedLabel?.value || CONSTANTS.DEFAULTS.EXTRACTED_LABEL,
          kia: domCache.kiaLabel?.value || CONSTANTS.DEFAULTS.KIA_LABEL
        },
        icons: {
          kills: domCache.killsIcon?.textContent || CONSTANTS.DEFAULTS.KILLS_ICON,
          extracted: domCache.extractedIcon?.textContent || CONSTANTS.DEFAULTS.EXTRACTED_ICON,
          kia: domCache.kiaIcon?.textContent || CONSTANTS.DEFAULTS.KIA_ICON
        },
        style: {
          kills: {
            color: domCache.killsColor.value,
            borderColor: domCache.killsColor.value
          },
          extracted: {
            color: domCache.extractedColor.value,
            borderColor: domCache.extractedColor.value
          },
          kia: {
            color: domCache.kiaColor.value,
            borderColor: domCache.kiaColor.value
          }
        }
      },
      message: {
        enabled: domCache.messageEnabled.checked,
        position: domCache.messagePosition.value,
        fontSize: parseInt(domCache.messageFontSize.value),
        color: domCache.messageColor.value,
        borderColor: domCache.messageColor.value,
        scrollSpeed: parseInt(domCache.scrollSpeed.value)
      },
      celebration: {
        enabled: domCache.celebrationEnabled.checked,
        duration: parseInt(domCache.celebrationDuration.value) * 1000,
        textSize: parseInt(domCache.celebrationTextSize.value),
        effectIntensity: domCache.effectIntensity.value
      }
    };
  }

  // ===== USER ACTIONS =====
  function saveConfig() {
    try {
      const config = buildConfigFromUI();
      socket.emit('updateConfig', config);

      // Show success feedback
      const saveBtn = document.querySelector('.btn-primary');
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
      saveBtn.style.background = CONSTANTS.DEFAULTS.KILLS_COLOR;

      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.style.background = '';
      }, CONSTANTS.FEEDBACK_DURATION);
    } catch (error) {
      console.error('Error saving config:', error);
      showErrorNotification('Failed to save configuration');
    }
  }

  function resetConfig() {
    if (confirm('Reset all settings to defaults?')) {
      socket.emit('resetConfig');
    }
  }

  function copyUrl() {
    const url = domCache.overlayUrl.textContent;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('.btn-copy');
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = originalText, CONSTANTS.FEEDBACK_DURATION);
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      showErrorNotification('Failed to copy URL');
    });
  }

  // ===== COLOR CONFIGURATOR =====
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

  function setupColorSync(colorId, hexId, previewType) {
    const colorInput = domCache[colorId];
    const hexInput = domCache[hexId];

    if (!colorInput || !hexInput) return;

    // Color picker changes hex input
    colorInput.addEventListener('input', (e) => {
      const color = e.target.value.toUpperCase();
      hexInput.value = color;
      updateCounterPreview(previewType, color);
    });

    // Hex input changes color picker (debounced)
    hexInput.addEventListener('input', Utils.debounce((e) => {
      let hex = e.target.value.trim();

      // Add # if missing
      if (hex && !hex.startsWith('#')) {
        hex = '#' + hex;
      }

      // Validate hex color
      if (CONSTANTS.HEX_COLOR_REGEX.test(hex)) {
        colorInput.value = hex;
        updateCounterPreview(previewType, hex);
      }
    }, CONSTANTS.DEBOUNCE_DELAY));

    // Format on blur
    hexInput.addEventListener('blur', (e) => {
      let hex = e.target.value.trim();
      if (hex && !hex.startsWith('#')) {
        hex = '#' + hex;
      }
      if (CONSTANTS.HEX_COLOR_REGEX.test(hex)) {
        hexInput.value = hex.toUpperCase();
      } else {
        // Reset to color picker value if invalid
        hexInput.value = colorInput.value.toUpperCase();
      }
    });
  }

  // ===== EMOJI PICKER =====
  function createEmojiPickerPopup() {
    if (emojiPickerPopup) return;

    emojiPickerPopup = document.createElement('div');
    emojiPickerPopup.className = 'emoji-picker-popup';
    emojiPickerPopup.innerHTML = `
      <div class="emoji-picker-header">
        <span class="emoji-picker-title">Choose Emoji</span>
        <button class="emoji-picker-close" id="emojiPickerClose">×</button>
      </div>
      <div id="emojiPickerContainer"></div>
    `;
    document.body.appendChild(emojiPickerPopup);

    // Create emoji picker element
    try {
      emojiPickerElement = document.createElement('emoji-picker');
      document.getElementById('emojiPickerContainer').appendChild(emojiPickerElement);

      // Handle emoji selection
      emojiPickerElement.addEventListener('emoji-click', (event) => {
        if (currentEmojiTarget) {
          const emoji = event.detail.unicode;
          const iconSpan = currentEmojiTarget.querySelector('span');
          if (iconSpan) {
            iconSpan.textContent = emoji;
          }
          closeEmojiPicker();
        }
      });
    } catch (error) {
      console.error('Failed to create emoji picker:', error);
      showErrorNotification('Emoji picker not available');
    }

    // Close button
    document.getElementById('emojiPickerClose').addEventListener('click', closeEmojiPicker);

    // Close when clicking outside
    emojiPickerPopup.addEventListener('click', (e) => {
      if (e.target === emojiPickerPopup) {
        closeEmojiPicker();
      }
    });
  }

  function openEmojiPicker(button) {
    if (!emojiPickerPopup) {
      createEmojiPickerPopup();
    }

    if (!emojiPickerElement) {
      showErrorNotification('Emoji picker not available');
      return;
    }

    currentEmojiTarget = button;
    emojiPickerPopup.classList.add('active');

    // Position popup near the button
    const rect = button.getBoundingClientRect();

    let left = rect.left;
    let top = rect.bottom + CONSTANTS.EMOJI_POPUP_OFFSET;

    // Adjust if off screen
    if (left + CONSTANTS.EMOJI_POPUP_WIDTH > window.innerWidth) {
      left = window.innerWidth - CONSTANTS.EMOJI_POPUP_WIDTH - CONSTANTS.EDGE_MARGIN;
    }
    if (top + CONSTANTS.EMOJI_POPUP_HEIGHT > window.innerHeight) {
      top = rect.top - CONSTANTS.EMOJI_POPUP_HEIGHT - CONSTANTS.EMOJI_POPUP_OFFSET;
    }

    emojiPickerPopup.style.left = left + 'px';
    emojiPickerPopup.style.top = top + 'px';
  }

  function closeEmojiPicker() {
    if (emojiPickerPopup) {
      emojiPickerPopup.classList.remove('active');
    }
    currentEmojiTarget = null;
  }

  // ===== EVENT LISTENERS SETUP =====
  function setupEventListeners() {
    // Real-time slider updates (debounced)
    const sliderUpdates = [
      { input: domCache.messageFontSize, output: domCache.fontSizeValue, suffix: 'px' },
      { input: domCache.scrollSpeed, output: domCache.scrollSpeedValue, suffix: 'px/s' },
      { input: domCache.celebrationDuration, output: domCache.durationValue, suffix: 's' },
      { input: domCache.celebrationTextSize, output: domCache.textSizeValue, suffix: 'px' }
    ];

    sliderUpdates.forEach(({ input, output, suffix }) => {
      input.addEventListener('input', Utils.debounce((e) => {
        output.textContent = e.target.value + suffix;
      }, CONSTANTS.DEBOUNCE_DELAY));
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

    // Color sync
    setupColorSync('killsColor', 'killsColorHex', 'kills');
    setupColorSync('extractedColor', 'extractedColorHex', 'extracted');
    setupColorSync('kiaColor', 'kiaColorHex', 'kia');

    // Preset swatch buttons
    document.querySelectorAll('.preset-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        const color = btn.dataset.color;

        domCache[`${target}Color`].value = color;
        domCache[`${target}ColorHex`].value = color;
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

        if (preview) {
          preview.style.borderColor = defaultColor;
          const valueEl = preview.querySelector('.preview-value');
          if (valueEl) valueEl.style.color = defaultColor;
        }
      });
    });

    // Label input handlers
    document.querySelectorAll('.preview-label-input').forEach(input => {
      input.addEventListener('focus', (e) => e.target.select());

      input.addEventListener('blur', (e) => {
        if (!e.target.value.trim()) {
          const defaults = {
            killsLabel: CONSTANTS.DEFAULTS.KILLS_LABEL,
            extractedLabel: CONSTANTS.DEFAULTS.EXTRACTED_LABEL,
            kiaLabel: CONSTANTS.DEFAULTS.KIA_LABEL
          };
          e.target.value = defaults[e.target.id] || '';
        }
      });

      input.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        e.target.style.color = value.length >= CONSTANTS.LABEL_WARNING_LENGTH ? CONSTANTS.DEFAULTS.EXTRACTED_COLOR : '';
      });
    });

    // Counter toggle handlers
    const counterToggles = [
      { id: 'killsEnabled', type: 'kills' },
      { id: 'extractedEnabled', type: 'extracted' },
      { id: 'kiaEnabled', type: 'kia' }
    ];

    counterToggles.forEach(({ id }) => {
      const toggle = domCache[id];
      if (toggle) {
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
    });

    // Emoji picker buttons
    document.querySelectorAll('.preview-icon-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEmojiPicker(btn);
      });
    });

    // Close emoji picker on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && emojiPickerPopup?.classList.contains('active')) {
        closeEmojiPicker();
      }
    });
  }

  // ===== INITIALIZATION =====
  function init() {
    cacheDOMElements();
    initializeSocket();
    setupEventListeners();
    checkAuth();
  }

  // ===== PUBLIC API =====
  return {
    init,
    saveConfig,
    resetConfig,
    copyUrl
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ConfigPanel.init);
} else {
  ConfigPanel.init();
}

// Expose functions for inline event handlers
window.saveConfig = ConfigPanel.saveConfig;
window.resetConfig = ConfigPanel.resetConfig;
window.copyUrl = ConfigPanel.copyUrl;
