// socket/handlers.js
const fs = require('fs');
const path = require('path');

let counters = { kills: 0, extracted: 0, kia: 0 };
let message = { text: '', visible: false };
let overlayConfigs = { default: loadConfig() };
let approvedModerators = {};
let adminSockets = new Set();

const CONFIG_FILE = path.join(__dirname, '../data/overlay-config.json');

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
      fontSize: 32,
      color: '#FFC107',
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

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      console.log('✅ Loaded saved overlay config');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  console.log('📋 Using default overlay config');
  return getDefaultConfig();
}

function saveConfig(config) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('💾 Config saved to disk');
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

module.exports = (io, sessionMiddleware) => {
  // Convert Express middleware to Socket.IO middleware
  const wrap = middleware => (socket, next) => {
    middleware(socket.request, {}, next);
  };
  
  // Use session middleware for Socket.IO
  io.use(wrap(sessionMiddleware));
  
  // Socket.IO connection handler
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Get user from session
    const session = socket.request.session;
    const user = session?.user;
    
    if (user) {
      socket.user = user;
      console.log(`Authenticated user connected: ${user.username}`);
    }

    // Send current state to all clients
    socket.emit('configUpdate', overlayConfigs.default);
    socket.emit('countersUpdate', counters);
    socket.emit('messageUpdate', message);

    // Handle authenticated users
    if (socket.user) {
      if (socket.user.isAdmin) {
        adminSockets.add(socket.id);
        console.log(`Admin connected: ${socket.user.username}`);
      }
      
      if (socket.user.isModerator || socket.user.isAdmin) {
        approvedModerators[socket.id] = {
          socketId: socket.id,
          name: socket.user.username,
          discordId: socket.user.id,
          isAdmin: socket.user.isAdmin,
          connectedAt: new Date().toISOString()
        };
        
        // Notify all admins
        adminSockets.forEach(adminId => {
          io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
        });
      }
    } else {
      console.log('Unauthenticated client connected');
    }

    const isAdmin = (socketId) => adminSockets.has(socketId);
    const isApproved = (socketId) => approvedModerators.hasOwnProperty(socketId);

    // Counter events
    socket.on('incrementCounter', (type) => {
      if (!isApproved(socket.id)) {
        console.warn(`Unauthorized increment attempt from ${socket.id}`);
        return;
      }
      
      if (counters.hasOwnProperty(type)) {
        counters[type]++;
        console.log(`${type} incremented by ${approvedModerators[socket.id].name}: ${counters[type]}`);
        io.emit('countersUpdate', counters);
      }
    });

    socket.on('decrementCounter', (type) => {
      if (!isApproved(socket.id)) {
        console.warn(`Unauthorized decrement attempt from ${socket.id}`);
        return;
      }
      
      if (counters.hasOwnProperty(type)) {
        counters[type] = Math.max(0, counters[type] - 1);
        console.log(`${type} decremented by ${approvedModerators[socket.id].name}: ${counters[type]}`);
        io.emit('countersUpdate', counters);
      }
    });

    socket.on('resetCounters', () => {
      if (!isApproved(socket.id)) {
        console.warn(`Unauthorized reset attempt from ${socket.id}`);
        return;
      }
      
      console.log(`Counters reset by ${approvedModerators[socket.id].name}`);
      counters = { kills: 0, extracted: 0, kia: 0 };
      io.emit('countersUpdate', counters);
    });

    // Message events
    socket.on('updateMessage', (newMessage) => {
      if (!isApproved(socket.id)) {
        console.warn(`Unauthorized message update from ${socket.id}`);
        return;
      }
      
      console.log(`Message updated by ${approvedModerators[socket.id].name}`);
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

    // Celebration events
    socket.on('triggerCelebration', (type = 'hurrah') => {
      if (!isApproved(socket.id)) {
        console.warn(`Unauthorized celebration from ${socket.id}`);
        return;
      }
      
      console.log(`${type} celebration by ${approvedModerators[socket.id].name}`);
      io.emit('triggerCelebration', type);
    });

    // Config events (admin only)
    socket.on('requestConfig', () => {
      socket.emit('configUpdate', overlayConfigs.default);
    });

    socket.on('updateConfig', (newConfig) => {
      if (!isAdmin(socket.id)) {
        console.warn(`Unauthorized config update from ${socket.id}`);
        return;
      }
      
      console.log('Config updated by admin');
      overlayConfigs.default = { ...overlayConfigs.default, ...newConfig };
      saveConfig(overlayConfigs.default);
      io.emit('configUpdate', overlayConfigs.default);
    });

    socket.on('resetConfig', () => {
      if (!isAdmin(socket.id)) {
        console.warn(`Unauthorized config reset from ${socket.id}`);
        return;
      }
      
      console.log('Config reset by admin');
      overlayConfigs.default = getDefaultConfig();
      saveConfig(overlayConfigs.default);
      io.emit('configUpdate', overlayConfigs.default);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      if (approvedModerators[socket.id]) {
        console.log(`${approvedModerators[socket.id].name} disconnected`);
        delete approvedModerators[socket.id];
        
        adminSockets.forEach(adminId => {
          io.to(adminId).emit('approvedModeratorsUpdate', Object.values(approvedModerators));
        });
      }
      
      if (adminSockets.has(socket.id)) {
        adminSockets.delete(socket.id);
        console.log('Admin disconnected');
      }
    });
  });
};
