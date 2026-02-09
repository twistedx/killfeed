const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Get port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Admin password from environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

// CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Redirect root to index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    counters, 
    message,
    pendingConnections: pendingConnections.length,
    approvedModerators: Object.keys(approvedModerators).length
  });
});

let counters = {
  kills: 0,
  extracted: 0,
  kia: 0
};

let message = {
  text: '',
  visible: false
};

// Configuration storage
let overlayConfigs = {
  default: {
    counters: {
      enabled: true,
      position: { x: 20, y: 20 },
      layout: 'horizontal', // horizontal, vertical
      size: 'medium', // small, medium, large
      style: {
        kills: { color: '#4CAF50', borderColor: '#4CAF50' },
        extracted: { color: '#FFC107', borderColor: '#FFC107' },
        kia: { color: '#F44336', borderColor: '#F44336' }
      }
    },
    message: {
      enabled: true,
      position: 'bottom', // top, bottom, custom
      customPosition: { x: 0, y: 100 },
      fontSize: 32,
      color: '#FFC107',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderColor: '#FFC107',
      scrollSpeed: 15 // seconds for full scroll
    },
    celebration: {
      enabled: true,
      duration: 5000, // milliseconds
      textSize: 120,
      effectIntensity: 'normal' // low, normal, high
    }
  }
};

// Connection management
let pendingConnections = [];
let approvedModerators = {};
let adminSockets = new Set();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current config to new connections
  socket.emit('configUpdate', overlayConfigs.default);
  
  // Admin authentication
  socket.on('authenticateAdmin', (password) => {
    console.log('Admin authentication attempt:', socket.id);
    
    if (password === ADMIN_PASSWORD) {
      adminSockets.add(socket.id);
      console.log('Admin authenticated:', socket.id);
      
      socket.emit('adminAuthenticated', true);
      socket.emit('countersUpdate', counters);
      socket.emit('messageUpdate', message);
      socket.emit('pendingConnectionsUpdate', pendingConnections);
      socket.emit('approvedModeratorsUpdate', Object.values(approvedModerators));
      socket.emit('configUpdate', overlayConfigs.default);
    } else {
      console.log('Admin authentication failed:', socket.id);
      socket.emit('adminAuthenticated', false);
    }
  });
  
  // Update configuration (only admins)
  socket.on('updateConfig', (newConfig) => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized config update attempt:', socket.id);
      return;
    }
    
    console.log('Configuration updated by admin:', socket.id);
    overlayConfigs.default = { ...overlayConfigs.default, ...newConfig };
    
    // Broadcast to all clients
    io.emit('configUpdate', overlayConfigs.default);
  });
  
  // Reset configuration to defaults (only admins)
  socket.on('resetConfig', () => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized config reset attempt:', socket.id);
      return;
    }
    
    console.log('Configuration reset by admin:', socket.id);
    overlayConfigs.default = getDefaultConfig();
    io.emit('configUpdate', overlayConfigs.default);
  });
  
  const isAdmin = (socketId) => {
    return adminSockets.has(socketId);
  };
  
  const isApproved = (socketId) => {
    return approvedModerators.hasOwnProperty(socketId);
  };
  
  // Moderator requests access
  socket.on('requestModeratorAccess', (name) => {
    console.log('Moderator access requested:', name, socket.id);
    
    const request = {
      socketId: socket.id,
      name: name,
      requestedAt: new Date().toISOString()
    };
    
    pendingConnections.push(request);
    
    adminSockets.forEach(adminId => {
      io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
    });
  });
  
  socket.on('approveModerator', (socketId) => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized approve attempt:', socket.id);
      return;
    }
    
    console.log('Approving moderator:', socketId);
    
    const request = pendingConnections.find(r => r.socketId === socketId);
    if (request) {
      pendingConnections = pendingConnections.filter(r => r.socketId !== socketId);
      
      approvedModerators[socketId] = {
        socketId: request.socketId,
        name: request.name,
        connectedAt: new Date().toISOString()
      };
      
      io.to(socketId).emit('moderatorApproved');
      io.to(socketId).emit('countersUpdate', counters);
      io.to(socketId).emit('messageUpdate', message);
      
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
        io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
      });
    }
  });
  
  socket.on('denyModerator', (socketId) => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized deny attempt:', socket.id);
      return;
    }
    
    console.log('Denying moderator:', socketId);
    pendingConnections = pendingConnections.filter(r => r.socketId !== socketId);
    io.to(socketId).emit('moderatorDenied');
    
    adminSockets.forEach(adminId => {
      io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
    });
  });
  
  socket.on('kickModerator', (socketId) => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized kick attempt:', socket.id);
      return;
    }
    
    console.log('Kicking moderator:', socketId);
    delete approvedModerators[socketId];
    io.to(socketId).emit('moderatorKicked');
    
    adminSockets.forEach(adminId => {
      io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
    });
  });
  
  // Send current state to overlay connections
  socket.emit('countersUpdate', counters);
  socket.emit('messageUpdate', message);
  
  socket.on('incrementCounter', (type) => {
    if (!isApproved(socket.id)) {
      console.log('Unauthorized counter increment attempt:', socket.id);
      return;
    }
    
    if (counters.hasOwnProperty(type)) {
      counters[type]++;
      console.log(`Counter incremented by ${approvedModerators[socket.id].name}:`, type, counters[type]);
      io.emit('countersUpdate', counters);
    }
  });
  
  socket.on('decrementCounter', (type) => {
    if (!isApproved(socket.id)) {
      console.log('Unauthorized counter decrement attempt:', socket.id);
      return;
    }
    
    if (counters.hasOwnProperty(type)) {
      counters[type] = Math.max(0, counters[type] - 1);
      console.log(`Counter decremented by ${approvedModerators[socket.id].name}:`, type, counters[type]);
      io.emit('countersUpdate', counters);
    }
  });
  
  socket.on('resetCounters', () => {
    if (!isApproved(socket.id)) {
      console.log('Unauthorized counter reset attempt:', socket.id);
      return;
    }
    
    console.log(`Counters reset by ${approvedModerators[socket.id].name}`);
    counters = { kills: 0, extracted: 0, kia: 0 };
    io.emit('countersUpdate', counters);
  });
  
  socket.on('updateMessage', (newMessage) => {
    if (!isApproved(socket.id)) {
      console.log('Unauthorized message update attempt:', socket.id);
      return;
    }
    
    console.log(`Message updated by ${approvedModerators[socket.id].name}:`, newMessage);
    message = newMessage;
    io.emit('messageUpdate', message);
  });
  
  socket.on('showMessage', () => {
    if (!isApproved(socket.id)) return;
    console.log(`Message shown by ${approvedModerators[socket.id].name}`);
    message.visible = true;
    io.emit('messageUpdate', message);
  });
  
  socket.on('hideMessage', () => {
    if (!isApproved(socket.id)) return;
    console.log(`Message hidden by ${approvedModerators[socket.id].name}`);
    message.visible = false;
    io.emit('messageUpdate', message);
  });
  
  socket.on('triggerCelebration', (type = 'hurrah') => {
    if (!isApproved(socket.id)) {
      console.log('Unauthorized celebration attempt:', socket.id);
      return;
    }
    
    console.log(`Celebration triggered by ${approvedModerators[socket.id].name}: ${type}`);
    io.emit('triggerCelebration', type);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (approvedModerators[socket.id]) {
      console.log('Approved moderator disconnected:', approvedModerators[socket.id].name);
      delete approvedModerators[socket.id];
      
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
      });
    }
    
    const wasPending = pendingConnections.some(r => r.socketId === socket.id);
    pendingConnections = pendingConnections.filter(r => r.socketId !== socket.id);
    if (wasPending) {
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
      });
    }
    
    if (adminSockets.has(socket.id)) {
      adminSockets.delete(socket.id);
      console.log('Admin disconnected:', socket.id);
    }
  });
});

function getDefaultConfig() {
  return {
    counters: {
      enabled: true,
      position: { x: 20, y: 20 },
      layout: 'horizontal',
      size: 'medium',
      style: {
        kills: { color: '#4CAF50', borderColor: '#4CAF50' },
        extracted: { color: '#FFC107', borderColor: '#FFC107' },
        kia: { color: '#F44336', borderColor: '#F44336' }
      }
    },
    message: {
      enabled: true,
      position: 'bottom',
      customPosition: { x: 0, y: 100 },
      fontSize: 32,
      color: '#FFC107',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderColor: '#FFC107',
      scrollSpeed: 15
    },
    celebration: {
      enabled: true,
      duration: 5000,
      textSize: 120,
      effectIntensity: 'normal'
    }
  };
}

const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔐 Admin password: ${ADMIN_PASSWORD === 'changeme123' ? '⚠️  USING DEFAULT PASSWORD!' : '✓ Custom password set'}`);
  console.log(`🏠 Homepage: ${BASE_URL}/`);
  console.log(`📺 OBS Overlay: ${BASE_URL}/obs-overlay.html`);
  console.log(`📺 OBS Message: ${BASE_URL}/obs-message.html`);
  console.log(`📺 OBS Celebration: ${BASE_URL}/obs-celebration.html`);
  console.log(`🎮 Moderator Panel: ${BASE_URL}/moderator-panel.html`);
  console.log(`👑 Admin Panel: ${BASE_URL}/admin-panel.html`);
  console.log(`⚙️  Config Panel: ${BASE_URL}/config-panel.html`);
});