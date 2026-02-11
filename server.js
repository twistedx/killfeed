// server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Import routes
// server.js
const authRoutes = require('./routes/auth');

// IMPORTANT: Mount auth routes BEFORE the root handler
app.use('/auth', authRoutes);  // ✅ This should come first
const panelRoutes = require('./routes/panels');

// Use routes
app.use('/auth', authRoutes);
app.use('/', panelRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Socket.IO handlers
const socketHandlers = require('./socket/handlers');
socketHandlers(io);

// Bot verification on startup (optional)
const { verifyBotToken } = require('./utils/botstartup');

async function startServer() {
  // Verify Discord configuration
  console.log('=== Discord Configuration ===');
  console.log('Client ID:', process.env.DISCORD_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.log('Client Secret:', process.env.DISCORD_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.log('Redirect URI:', process.env.DISCORD_REDIRECT_URI || 'Using default');
  console.log('Server ID:', process.env.DISCORD_SERVER_ID || 'Using default');
  console.log('Admin Role IDs:', process.env.ADMIN_ROLE_IDS || '✗ Not set');
  console.log('Moderator Role IDs:', process.env.MODERATOR_ROLE_IDS || '✗ Not set');
  
  // Verify bot token if provided
  if (process.env.DISCORD_BOT_TOKEN) {
    await verifyBotToken();
  } else {
    console.warn('⚠️  DISCORD_BOT_TOKEN not set - bot features disabled');
  }
  
  console.log('============================\n');

  // Start server
  const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🏠 Homepage: http://localhost:${PORT}/`);
    console.log(`🎮 Moderator Panel: http://localhost:${PORT}/moderator-panel.html`);
    console.log(`👑 Admin Panel: http://localhost:${PORT}/admin-panel.html`);
  });
}

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();