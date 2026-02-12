// obs-overlay.js - Complete OBS Overlay Logic

const socket = io(window.location.origin);

// DOM Elements
const countersContainer = document.getElementById('countersContainer');
const messageContainer = document.getElementById('messageContainer');
const messageContent = document.getElementById('messageContent');

const killsCount = document.getElementById('killsCount');
const extractedCount = document.getElementById('extractedCount');
const kiaCount = document.getElementById('kiaCount');

// Current state
let currentConfig = {};
let currentCounters = { kills: 0, extracted: 0, kia: 0 };
let currentMessage = { text: '', visible: false };

// ===== CONFIG MANAGEMENT =====
socket.on('configUpdate', (config) => {
  console.log('Config updated:', config);
  currentConfig = config;
  applyConfig(config);
});

function applyConfig(config) {
  // Apply counter config
  if (config.counters) {
    applyCounterConfig(config.counters);
  }
  
  // Apply message config
  if (config.message) {
    applyMessageConfig(config.message);
  }
}

function applyCounterConfig(counterConfig) {
  // Show/hide counters
  if (counterConfig.enabled) {
    countersContainer.classList.remove('hidden');
  } else {
    countersContainer.classList.add('hidden');
    return;
  }
  
  // Apply position
  countersContainer.className = 'counters-container';
  const position = counterConfig.position?.preset || 'bottom-left';
  countersContainer.classList.add(position);
  
  // Apply layout
  const layout = counterConfig.layout || 'horizontal';
  countersContainer.classList.add(layout);
  
  // Apply size
  const size = counterConfig.size || 'medium';
  countersContainer.classList.add(size);
  
  // Apply custom position if provided
  if (counterConfig.position?.x !== undefined) {
    countersContainer.style.left = counterConfig.position.x + 'px';
    countersContainer.style.top = counterConfig.position.y + 'px';
  }
  
  // Apply colors
  if (counterConfig.style) {
    const killsCounter = document.querySelector('.counter.kills');
    const extractedCounter = document.querySelector('.counter.extracted');
    const kiaCounter = document.querySelector('.counter.kia');
    
    if (counterConfig.style.kills) {
      killsCounter.style.borderColor = counterConfig.style.kills.borderColor || '#4CAF50';
      killsCounter.querySelector('.counter-value').style.color = counterConfig.style.kills.color || '#4CAF50';
    }
    
    if (counterConfig.style.extracted) {
      extractedCounter.style.borderColor = counterConfig.style.extracted.borderColor || '#FFC107';
      extractedCounter.querySelector('.counter-value').style.color = counterConfig.style.extracted.color || '#FFC107';
    }
    
    if (counterConfig.style.kia) {
      kiaCounter.style.borderColor = counterConfig.style.kia.borderColor || '#F44336';
      kiaCounter.querySelector('.counter-value').style.color = counterConfig.style.kia.color || '#F44336';
    }
  }
}

function applyMessageConfig(messageConfig) {
  // Show/hide message
  if (!messageConfig.enabled || !currentMessage.visible) {
    messageContainer.classList.add('hidden');
  } else {
    messageContainer.classList.remove('hidden');
  }
  
  // Apply position
  messageContainer.className = 'message-container';
  const position = messageConfig.position || 'bottom';
  messageContainer.classList.add(position);
  
  // Apply font size
  if (messageConfig.fontSize) {
    messageContent.style.fontSize = messageConfig.fontSize + 'px';
  }
  
  // Apply color
  if (messageConfig.color) {
    messageContent.style.color = messageConfig.color;
    messageContainer.style.borderColor = messageConfig.borderColor || messageConfig.color;
  }
  
  // Apply scroll speed
  if (messageConfig.scrollSpeed) {
    const speed = messageConfig.scrollSpeed;
    let duration;
    if (speed < 10) {
      duration = '30s'; // slow
    } else if (speed > 20) {
      duration = '10s'; // fast
    } else {
      duration = '20s'; // normal
    }
    messageContent.style.animationDuration = duration;
  }
}

// ===== COUNTER UPDATES =====
socket.on('countersUpdate', (counters) => {
  console.log('Counters updated:', counters);
  
  // Update kills
  if (counters.kills !== currentCounters.kills) {
    updateCounter('kills', counters.kills);
  }
  
  // Update extracted
  if (counters.extracted !== currentCounters.extracted) {
    updateCounter('extracted', counters.extracted);
  }
  
  // Update kia
  if (counters.kia !== currentCounters.kia) {
    updateCounter('kia', counters.kia);
  }
  
  currentCounters = counters;
});

function updateCounter(type, value) {
  let element, counterElement;
  
  switch(type) {
    case 'kills':
      element = killsCount;
      counterElement = document.querySelector('.counter.kills');
      break;
    case 'extracted':
      element = extractedCount;
      counterElement = document.querySelector('.counter.extracted');
      break;
    case 'kia':
      element = kiaCount;
      counterElement = document.querySelector('.counter.kia');
      break;
  }
  
  if (element) {
    // Update value
    element.textContent = value;
    
    // Pulse animation
    counterElement.classList.add('pulse');
    setTimeout(() => {
      counterElement.classList.remove('pulse');
    }, 300);
  }
}

// ===== MESSAGE UPDATES =====
socket.on('messageUpdate', (message) => {
  console.log('Message updated:', message);
  currentMessage = message;
  
  // Update message text
  if (message.text) {
    messageContent.textContent = message.text;
    messageContainer.classList.remove('empty');
  } else {
    messageContent.textContent = '';
    messageContainer.classList.add('empty');
  }
  
  // Show/hide based on visibility and config
  if (message.visible && currentConfig.message?.enabled) {
    messageContainer.classList.remove('hidden');
  } else {
    messageContainer.classList.add('hidden');
  }
});

// ===== CONNECTION STATUS =====
socket.on('connect', () => {
  console.log('✅ Connected to server');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

// ===== INITIALIZE =====
console.log('🎮 Kill Feed OBS Overlay Ready');
console.log('Waiting for config and data...');
