// socket/handlers.js
const fs = require('fs');
const path = require('path');

// Per-server storage (keyed by guild ID)
let serverStates = {};
let approvedModerators = {};
let adminSockets = new Set();

// Use Render persistent disk if available, otherwise use local ./data
const dataPath = process.env.PERSISTENT_STORAGE_PATH
  ? path.join(process.env.PERSISTENT_STORAGE_PATH, 'data')
  : path.join(__dirname, '../data');

function getDefaultConfig() {
  return {
    counters: {
      enabled: true,
      position: { x: 20, y: 20 },
      layout: 'horizontal',
      size: 'medium',
      visibility: {
        kills: true,
        extracted: true,
        kia: true
      },
      labels: {
        kills: 'Kills',
        extracted: 'Extracted',
        kia: 'KIA'
      },
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

// Load config for a specific server
function loadConfig(serverId) {
  const configFile = path.join(dataPath, `overlay-config-${serverId}.json`);
  try {
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf8');
      console.log(`✅ Loaded saved overlay config for server ${serverId}`);
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Failed to load config for server ${serverId}:`, error);
  }
  console.log(`📋 Using default overlay config for server ${serverId}`);
  return getDefaultConfig();
}

// Save config for a specific server
function saveConfig(serverId, config) {
  const configFile = path.join(dataPath, `overlay-config-${serverId}.json`);
  try {
    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log(`💾 Config saved to disk for server ${serverId}`);
  } catch (error) {
    console.error(`Failed to save config for server ${serverId}:`, error);
  }
}

// Get or initialize server state
function getServerState(serverId) {
  if (!serverStates[serverId]) {
    serverStates[serverId] = {
      counters: { kills: 0, extracted: 0, kia: 0 },
      message: { text: '', visible: false },
      config: loadConfig(serverId)
    };
  }
  return serverStates[serverId];
}

module.exports = (io, sessionMiddleware) => {
  // Convert Express middleware to Socket.IO middleware with error handling
  const wrap = middleware => (socket, next) => {
    middleware(socket.request, {}, (err) => {
      if (err) {
        console.error('Socket.IO session middleware error:', err);
        // Continue anyway - unauthenticated connections are allowed
        return next();
      }
      next();
    });
  };

  // Use session middleware for Socket.IO
  io.use(wrap(sessionMiddleware));

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    // Get user and server from session
    const session = socket.request.session;
    const user = session?.user;
    const selectedServer = session?.selectedServer;

    // Get server ID from query parameter (for OBS overlays) or session (for control panels)
    const serverId = socket.handshake.query.server || selectedServer?.id;

    if (!serverId) {
      console.warn(`⚠️ No server ID provided for socket ${socket.id}`);
      socket.disconnect();
      return;
    }

    // Join server-specific room
    socket.join(`server:${serverId}`);
    socket.serverId = serverId;

    // Get server state
    const state = getServerState(serverId);

    if (user) {
      socket.user = user;
      socket.selectedServer = selectedServer;
      console.log(`✅ Authenticated: ${user.username} (${user.isAdmin ? 'Admin' : 'Moderator'}) - Server: ${selectedServer.name}`);
    } else {
      console.log(`📺 OBS Overlay connected: ${socket.id} - Server: ${serverId}`);
    }

    // Send current state for this server
    socket.emit('configUpdate', state.config);
    socket.emit('countersUpdate', state.counters);
    socket.emit('messageUpdate', state.message);

    // Handle authenticated users
    if (socket.user) {
      // Validate user has access to this server
      const hasServerAccess = socket.user.sharedGuilds.some(g => g.guildId === serverId);
      if (!hasServerAccess) {
        console.warn(`❌ ${socket.user.username} has no access to server ${serverId}`);
        socket.disconnect();
        return;
      }

      // Check if user is admin for THIS specific server
      const serverGuild = socket.user.sharedGuilds.find(g => g.guildId === serverId);
      const isServerAdmin = serverGuild?.isAdmin || false;
      const isServerMod = serverGuild?.isModerator || false;

      if (isServerAdmin) {
        adminSockets.add(socket.id);
      }

      if (isServerMod || isServerAdmin) {
        approvedModerators[socket.id] = {
          socketId: socket.id,
          serverId: serverId,
          name: socket.user.username,
          discordId: socket.user.id,
          isAdmin: isServerAdmin,
          connectedAt: new Date().toISOString()
        };

        // Notify all admins in THIS server
        adminSockets.forEach(adminId => {
          const adminSocket = io.sockets.sockets.get(adminId);
          if (adminSocket && adminSocket.serverId === serverId) {
            io.to(adminId).emit('approvedModeratorsUpdate',
              Object.values(approvedModerators).filter(m => m.serverId === serverId)
            );
          }
        });
      }
    }

    const isAdmin = (socketId) => adminSockets.has(socketId);
    const isApprovedForServer = (socketId, serverId) => {
      const mod = approvedModerators[socketId];
      return mod && mod.serverId === serverId;
    };

    // Counter events
    socket.on('incrementCounter', (type) => {
      if (!isApprovedForServer(socket.id, serverId)) {
        console.warn(`Unauthorized increment attempt from ${socket.id}`);
        return;
      }

      const state = getServerState(serverId);
      if (state.counters.hasOwnProperty(type)) {
        state.counters[type]++;
        console.log(`${type} incremented by ${approvedModerators[socket.id].name}: ${state.counters[type]} (Server: ${serverId})`);
        io.to(`server:${serverId}`).emit('countersUpdate', state.counters);
      }
    });

    socket.on('decrementCounter', (type) => {
      if (!isApprovedForServer(socket.id, serverId)) {
        console.warn(`Unauthorized decrement attempt from ${socket.id}`);
        return;
      }

      const state = getServerState(serverId);
      if (state.counters.hasOwnProperty(type)) {
        state.counters[type] = Math.max(0, state.counters[type] - 1);
        console.log(`${type} decremented by ${approvedModerators[socket.id].name}: ${state.counters[type]} (Server: ${serverId})`);
        io.to(`server:${serverId}`).emit('countersUpdate', state.counters);
      }
    });

    socket.on('resetCounters', () => {
      if (!isApprovedForServer(socket.id, serverId)) {
        console.warn(`Unauthorized reset attempt from ${socket.id}`);
        return;
      }

      const state = getServerState(serverId);
      console.log(`Counters reset by ${approvedModerators[socket.id].name} (Server: ${serverId})`);
      state.counters = { kills: 0, extracted: 0, kia: 0 };
      io.to(`server:${serverId}`).emit('countersUpdate', state.counters);
    });

    // Message events
    socket.on('updateMessage', (newMessage) => {
      if (!isApprovedForServer(socket.id, serverId)) {
        console.warn(`Unauthorized message update from ${socket.id}`);
        return;
      }

      const state = getServerState(serverId);
      console.log(`Message updated by ${approvedModerators[socket.id].name} (Server: ${serverId})`);
      state.message = newMessage;
      io.to(`server:${serverId}`).emit('messageUpdate', state.message);
    });

    socket.on('showMessage', () => {
      if (!isApprovedForServer(socket.id, serverId)) return;

      const state = getServerState(serverId);
      console.log(`Message shown by ${approvedModerators[socket.id].name} (Server: ${serverId})`);
      state.message.visible = true;
      io.to(`server:${serverId}`).emit('messageUpdate', state.message);
    });

    socket.on('hideMessage', () => {
      if (!isApprovedForServer(socket.id, serverId)) return;

      const state = getServerState(serverId);
      console.log(`Message hidden by ${approvedModerators[socket.id].name} (Server: ${serverId})`);
      state.message.visible = false;
      io.to(`server:${serverId}`).emit('messageUpdate', state.message);
    });

    // Celebration events
    socket.on('triggerCelebration', (type = 'hurrah') => {
      if (!isApprovedForServer(socket.id, serverId)) {
        console.warn(`Unauthorized celebration from ${socket.id}`);
        return;
      }

      console.log(`${type} celebration by ${approvedModerators[socket.id].name} (Server: ${serverId})`);
      io.to(`server:${serverId}`).emit('triggerCelebration', type);
    });

    // Config events (admin only)
    socket.on('requestConfig', () => {
      const state = getServerState(serverId);
      socket.emit('configUpdate', state.config);
    });

    socket.on('updateConfig', (newConfig) => {
      if (!isAdmin(socket.id) || !isApprovedForServer(socket.id, serverId)) {
        console.warn(`Unauthorized config update from ${socket.id}`);
        return;
      }

      const state = getServerState(serverId);
      console.log(`Config updated by admin (Server: ${serverId})`);
      state.config = { ...state.config, ...newConfig };
      saveConfig(serverId, state.config);
      io.to(`server:${serverId}`).emit('configUpdate', state.config);
    });

    socket.on('resetConfig', () => {
      if (!isAdmin(socket.id) || !isApprovedForServer(socket.id, serverId)) {
        console.warn(`Unauthorized config reset from ${socket.id}`);
        return;
      }

      const state = getServerState(serverId);
      console.log(`Config reset by admin (Server: ${serverId})`);
      state.config = getDefaultConfig();
      saveConfig(serverId, state.config);
      io.to(`server:${serverId}`).emit('configUpdate', state.config);
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (approvedModerators[socket.id]) {
        const mod = approvedModerators[socket.id];
        console.log(`👋 ${mod.name} disconnected (Server: ${mod.serverId})`);
        delete approvedModerators[socket.id];

        // Notify all admins in THIS server
        adminSockets.forEach(adminId => {
          const adminSocket = io.sockets.sockets.get(adminId);
          if (adminSocket && adminSocket.serverId === serverId) {
            io.to(adminId).emit('approvedModeratorsUpdate',
              Object.values(approvedModerators).filter(m => m.serverId === serverId)
            );
          }
        });
      }

      if (adminSockets.has(socket.id)) {
        adminSockets.delete(socket.id);
      }

      if (!socket.user) {
        console.log(`📺 OBS Overlay disconnected: ${socket.id} (Server: ${serverId})`);
      }
    });
  });
};