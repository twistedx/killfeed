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

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

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

// Connection management
let pendingConnections = []; // Moderators waiting for approval
let approvedModerators = {}; // { socketId: { name, socketId, connectedAt } }
let adminSockets = new Set(); // Track multiple admin connections

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Admin authentication
  socket.on('authenticateAdmin', (password) => {
    console.log('Admin authentication attempt:', socket.id);
    
    if (password === ADMIN_PASSWORD) {
      adminSockets.add(socket.id);
      console.log('Admin authenticated:', socket.id);
      
      // Send success and current state
      socket.emit('adminAuthenticated', true);
      socket.emit('countersUpdate', counters);
      socket.emit('messageUpdate', message);
      socket.emit('pendingConnectionsUpdate', pendingConnections);
      socket.emit('approvedModeratorsUpdate', Object.values(approvedModerators));
    } else {
      console.log('Admin authentication failed:', socket.id);
      socket.emit('adminAuthenticated', false);
    }
  });
  
  // Check if socket is authenticated admin
  const isAdmin = (socketId) => {
    return adminSockets.has(socketId);
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
    
    // Notify all admins
    adminSockets.forEach(adminId => {
      io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
    });
  });
  
  // Admin approves moderator (requires authentication)
  socket.on('approveModerator', (socketId) => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized approve attempt:', socket.id);
      return;
    }
    
    console.log('Approving moderator:', socketId);
    
    const request = pendingConnections.find(r => r.socketId === socketId);
    if (request) {
      // Remove from pending
      pendingConnections = pendingConnections.filter(r => r.socketId !== socketId);
      
      // Add to approved
      approvedModerators[socketId] = {
        socketId: request.socketId,
        name: request.name,
        connectedAt: new Date().toISOString()
      };
      
      // Notify the moderator they're approved
      io.to(socketId).emit('moderatorApproved');
      
      // Send current state to the newly approved moderator
      io.to(socketId).emit('countersUpdate', counters);
      io.to(socketId).emit('messageUpdate', message);
      
      // Notify all admins
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
        io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
      });
    }
  });
  
  // Admin denies moderator (requires authentication)
  socket.on('denyModerator', (socketId) => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized deny attempt:', socket.id);
      return;
    }
    
    console.log('Denying moderator:', socketId);
    
    // Remove from pending
    pendingConnections = pendingConnections.filter(r => r.socketId !== socketId);
    
    // Notify the moderator they're denied
    io.to(socketId).emit('moderatorDenied');
    
    // Notify all admins
    adminSockets.forEach(adminId => {
      io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
    });
  });
  
  // Admin kicks moderator (requires authentication)
  socket.on('kickModerator', (socketId) => {
    if (!isAdmin(socket.id)) {
      console.log('Unauthorized kick attempt:', socket.id);
      return;
    }
    
    console.log('Kicking moderator:', socketId);
    
    delete approvedModerators[socketId];
    
    // Notify the moderator they're kicked
    io.to(socketId).emit('moderatorKicked');
    
    // Notify all admins
    adminSockets.forEach(adminId => {
      io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
    });
  });
  
  // Check if moderator is approved (helper function)
  const isApproved = (socketId) => {
    return approvedModerators.hasOwnProperty(socketId);
  };
  
  // Send current state to overlay connections (no auth needed for overlays)
  socket.emit('countersUpdate', counters);
  socket.emit('messageUpdate', message);
  
  // Increment counter (only approved moderators)
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
  
  // Decrement counter (only approved moderators)
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
  
  // Reset counters (only approved moderators)
  socket.on('resetCounters', () => {
    if (!isApproved(socket.id)) {
      console.log('Unauthorized counter reset attempt:', socket.id);
      return;
    }
    
    console.log(`Counters reset by ${approvedModerators[socket.id].name}`);
    counters = { kills: 0, extracted: 0, kia: 0 };
    io.emit('countersUpdate', counters);
  });
  
  // Update message (only approved moderators)
  socket.on('updateMessage', (newMessage) => {
    if (!isApproved(socket.id)) {
      console.log('Unauthorized message update attempt:', socket.id);
      return;
    }
    
    console.log(`Message updated by ${approvedModerators[socket.id].name}:`, newMessage);
    message = newMessage;
    io.emit('messageUpdate', message);
  });
  
  // Show message (only approved moderators)
  socket.on('showMessage', () => {
    if (!isApproved(socket.id)) return;
    console.log(`Message shown by ${approvedModerators[socket.id].name}`);
    message.visible = true;
    io.emit('messageUpdate', message);
  });
  
  // Hide message (only approved moderators)
  socket.on('hideMessage', () => {
    if (!isApproved(socket.id)) return;
    console.log(`Message hidden by ${approvedModerators[socket.id].name}`);
    message.visible = false;
    io.emit('messageUpdate', message);
  });
  
  // Trigger celebration (only approved moderators)
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
    
    // Remove from approved if disconnected
    if (approvedModerators[socket.id]) {
      console.log('Approved moderator disconnected:', approvedModerators[socket.id].name);
      delete approvedModerators[socket.id];
      
      // Notify all admins
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
      });
    }
    
    // Remove from pending if disconnected
    const wasPending = pendingConnections.some(r => r.socketId === socket.id);
    pendingConnections = pendingConnections.filter(r => r.socketId !== socket.id);
    if (wasPending) {
      adminSockets.forEach(adminId => {
        io.to(adminId).emit('pendingConnectionsUpdate', pendingConnections);
      });
    }
    
    // Remove from admin sockets if they disconnect
    if (adminSockets.has(socket.id)) {
      adminSockets.delete(socket.id);
      console.log('Admin disconnected:', socket.id);
    }
  });
});

const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔐 Admin password: ${ADMIN_PASSWORD === 'changeme123' ? '⚠️  USING DEFAULT PASSWORD!' : '✓ Custom password set'}`);
  console.log(`📺 OBS Overlay: ${BASE_URL}/obs-overlay.html`);
  console.log(`📺 OBS Message: ${BASE_URL}/obs-message.html`);
  console.log(`📺 OBS Celebration: ${BASE_URL}/obs-celebration.html`);
  console.log(`🎮 Moderator Panel: ${BASE_URL}/moderator-panel.html`);
  console.log(`👑 Admin Panel: ${BASE_URL}/admin-panel.html`);
});