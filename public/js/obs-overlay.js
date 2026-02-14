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
  
  // Get individual counters
  const killsCounter = document.querySelector('.counter.kills');
  const extractedCounter = document.querySelector('.counter.extracted');
  const kiaCounter = document.querySelector('.counter.kia');
  
  // Apply individual visibility
  if (counterConfig.visibility) {
    if (killsCounter) {
      killsCounter.style.display = counterConfig.visibility.kills ? '' : 'none';
    }
    if (extractedCounter) {
      extractedCounter.style.display = counterConfig.visibility.extracted ? '' : 'none';
    }
    if (kiaCounter) {
      kiaCounter.style.display = counterConfig.visibility.kia ? '' : 'none';
    }
  }
  
  // Apply labels if they exist
  if (counterConfig.labels) {
    const killsLabelEl = killsCounter?.querySelector('.counter-label');
    const extractedLabelEl = extractedCounter?.querySelector('.counter-label');
    const kiaLabelEl = kiaCounter?.querySelector('.counter-label');
    
    if (killsLabelEl) killsLabelEl.textContent = counterConfig.labels.kills || 'Kills';
    if (extractedLabelEl) extractedLabelEl.textContent = counterConfig.labels.extracted || 'Extracted';
    if (kiaLabelEl) kiaLabelEl.textContent = counterConfig.labels.kia || 'KIA';
  }
  
  // Apply colors
  if (counterConfig.style) {
    if (counterConfig.style.kills && killsCounter) {
      killsCounter.style.borderColor = counterConfig.style.kills.borderColor || '#4CAF50';
      const killsValue = killsCounter.querySelector('.counter-value');
      if (killsValue) killsValue.style.color = counterConfig.style.kills.color || '#4CAF50';
    }
    
    if (counterConfig.style.extracted && extractedCounter) {
      extractedCounter.style.borderColor = counterConfig.style.extracted.borderColor || '#FFC107';
      const extractedValue = extractedCounter.querySelector('.counter-value');
      if (extractedValue) extractedValue.style.color = counterConfig.style.extracted.color || '#FFC107';
    }
    
    if (counterConfig.style.kia && kiaCounter) {
      kiaCounter.style.borderColor = counterConfig.style.kia.borderColor || '#F44336';
      const kiaValue = kiaCounter.querySelector('.counter-value');
      if (kiaValue) kiaValue.style.color = counterConfig.style.kia.color || '#F44336';
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

// ===== CELEBRATIONS =====
const celebrationContainer = document.getElementById('celebrationContainer');
const celebrationText = document.getElementById('celebrationText');
const emojiContainerEl = document.getElementById('emojiContainer');
const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Initialize Web Audio API for HammerTime
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioContext = null;

function initAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
}

function playHammerSound() {
  initAudio();

  const now = audioContext.currentTime;

  const bassOsc = audioContext.createOscillator();
  const bassGain = audioContext.createGain();
  bassOsc.type = 'sine';
  bassOsc.frequency.setValueAtTime(100, now);
  bassOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  bassGain.gain.setValueAtTime(0.8, now);
  bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  bassOsc.connect(bassGain);
  bassGain.connect(audioContext.destination);
  bassOsc.start(now);
  bassOsc.stop(now + 0.3);

  const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }
  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = audioContext.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

  const noiseFilter = audioContext.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 1000;

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioContext.destination);
  noiseSource.start(now);

  setTimeout(() => {
    const echoOsc = audioContext.createOscillator();
    const echoGain = audioContext.createGain();
    const echoTime = audioContext.currentTime;
    echoOsc.type = 'sine';
    echoOsc.frequency.setValueAtTime(80, echoTime);
    echoOsc.frequency.exponentialRampToValueAtTime(30, echoTime + 0.1);
    echoGain.gain.setValueAtTime(0.4, echoTime);
    echoGain.gain.exponentialRampToValueAtTime(0.01, echoTime + 0.2);
    echoOsc.connect(echoGain);
    echoGain.connect(audioContext.destination);
    echoOsc.start(echoTime);
    echoOsc.stop(echoTime + 0.2);
  }, 150);
}

// Celebration types configuration
const celebrationTypes = {
  hurrah: {
    text: 'HURRAH!',
    className: 'success',
    useFireworks: true,
    colors: ['#FFD700', '#FFC400', '#FFEA00', '#76FF03', '#00E676', '#00E5FF'],
    particleCount: 50,
    launches: 15
  },
  failure: {
    text: 'FAILURE!',
    className: 'failure',
    useEmojis: true,
    emojis: ['💀', '☠️', '👻'],
    emojiCount: 50
  },
  rats: {
    text: 'DAMN RATS!',
    className: 'rats',
    useEmojis: true,
    emojis: ['🐀', '🐁'],
    emojiCount: 60
  },
  luck: {
    text: 'BETTER LUCK\nNEXT TIME!',
    className: 'luck',
    useEmojis: true,
    emojis: ['🍀', '☘️'],
    emojiCount: 40
  },
  hammertime: {
    text: 'HAMMER TIME!',
    className: 'hammertime',
    useEmojis: true,
    emojis: ['🔨', '⚒️'],
    emojiCount: 30,
    hasSound: true,
    hasShockwave: true
  }
};

// Fireworks code
let particles = [];
let animationId = null;

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.velocity = {
      x: (Math.random() - 0.5) * 8,
      y: (Math.random() - 0.5) * 8
    };
    this.alpha = 1;
    this.decay = Math.random() * 0.015 + 0.015;
    this.radius = Math.random() * 3 + 2;
  }

  update() {
    this.velocity.y += 0.1;
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

function createFirework(x, y, colors, particleCount) {
  const color = colors[Math.floor(Math.random() * colors.length)];

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function animate() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  particles = particles.filter(particle => particle.alpha > 0);

  particles.forEach(particle => {
    particle.update();
    particle.draw();
  });

  if (particles.length > 0) {
    animationId = requestAnimationFrame(animate);
  }
}

function launchFireworks(config) {
  const launches = config.launches;
  const duration = 5000;

  for (let i = 0; i < launches; i++) {
    setTimeout(() => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height * 0.6;
      createFirework(x, y, config.colors, config.particleCount);

      if (i === 0) {
        animate();
      }
    }, (duration / launches) * i);
  }
}

// Emoji code
function createEmoji(emoji) {
  const emojiEl = document.createElement('div');
  emojiEl.className = 'emoji';
  emojiEl.textContent = emoji;

  emojiEl.style.left = Math.random() * 100 + '%';
  emojiEl.style.bottom = '-50px';

  const duration = 2 + Math.random() * 2;
  emojiEl.style.animationDuration = duration + 's';

  const delay = Math.random() * 2;
  emojiEl.style.animationDelay = delay + 's';

  const size = 40 + Math.random() * 40;
  emojiEl.style.fontSize = size + 'px';

  emojiContainerEl.appendChild(emojiEl);

  setTimeout(() => {
    emojiEl.remove();
  }, (duration + delay) * 1000);
}

function launchEmojis(config) {
  const count = config.emojiCount;
  const duration = 3000;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const emoji = config.emojis[Math.floor(Math.random() * config.emojis.length)];
      createEmoji(emoji);
    }, (duration / count) * i);
  }
}

function createShockwave() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const wave = document.createElement('div');
      wave.className = 'shockwave';
      celebrationContainer.appendChild(wave);
      setTimeout(() => wave.remove(), 1000);
    }, i * 200);
  }
}

// Celebration trigger
socket.on('triggerCelebration', (type = 'hurrah') => {
  console.log('🎉 Celebration triggered:', type);

  // Check if celebrations are enabled in config
  if (!currentConfig.celebration?.enabled) {
    console.log('⚠️  Celebrations are disabled in config');
    return;
  }

  const config = celebrationTypes[type] || celebrationTypes.hurrah;

  // Apply text and styling
  celebrationText.textContent = config.text;
  celebrationText.className = config.className;

  // Apply configured text size
  if (currentConfig.celebration?.textSize) {
    celebrationText.style.fontSize = currentConfig.celebration.textSize + 'px';
  }

  celebrationContainer.classList.add('active');

  // Clear previous animations
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  particles = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  emojiContainerEl.innerHTML = '';

  // Launch appropriate effect
  if (config.useFireworks) {
    launchFireworks(config);
  } else if (config.useEmojis) {
    launchEmojis(config);
  }

  if (config.hasSound) {
    playHammerSound();
  }

  if (config.hasShockwave) {
    createShockwave();
  }

  // Hide after configured duration (default 5 seconds)
  const duration = currentConfig.celebration?.duration || 5000;
  setTimeout(() => {
    celebrationContainer.classList.remove('active');
    particles = [];
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    emojiContainerEl.innerHTML = '';
  }, duration);
});

// ===== INITIALIZE =====
console.log('🎮 Kill Feed OBS Overlay Ready');
console.log('Waiting for config and data...');