// socket/handlers.js
const sessionStore = new Map();
require('../routes/auth').setSessionStore(sessionStore); // share session store

let counters = { kills: 0, extracted: 0, kia: 0 };
let message = { text: '', visible: false };
let overlayConfigs = {
  default: getDefaultConfig()
};
let approvedModerators = {};
let adminSockets = new Set();

function getDefaultConfig() { /* ... same as before ... */ }

module.exports = (io) => {
  io.use((socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;
    if (sessionId) {
      const session = sessionStore.get(sessionId);
      if (session?.user) socket.user = session.user;
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.emit('configUpdate', overlayConfigs.default);
    socket.emit('countersUpdate', counters);
    socket.emit('messageUpdate', message);

    if (socket.user) {
      if (socket.user.isAdmin) adminSockets.add(socket.id);
      if (socket.user.isModerator || socket.user.isAdmin) {
        approvedModerators[socket.id] = {
          socketId: socket.id,
          name: socket.user.username,
          discordId: socket.user.id,
          isAdmin: socket.user.isAdmin,
          connectedAt: new Date().toISOString()
        };
        adminSockets.forEach(id => io.to(id).emit('approvedModeratorsUpdate', Object.values(approvedModerators)));
      }
    }

    // All your socket.on(...) handlers go here (unchanged)
    // ... incrementCounter, updateConfig, etc.

    socket.on('disconnect', () => {
      // cleanup logic
    });
  });

  // Export for health endpoint
  module.exports.getHealth = (req, res) => {
    res.json({
      status: 'ok',
      counters,
      message,
      moderatorsOnline: Object.keys(approvedModerators).length,
      adminsOnline: adminSockets.size,
      uptime: process.uptime()
    });
  };
};