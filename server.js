// server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
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

// Session configuration with FileStore for production
app.use(session({
  store: new FileStore({
    path: './sessions',           // Directory to store session files
    ttl: 86400,                    // Session TTL in seconds (24 hours)
    retries: 0,                    // Number of retries if file is locked
    reapInterval: 3600             // Clean up expired sessions every hour
  }),
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
const authRoutes = require('./routes/auth');
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
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.IO handlers
const socketHandlers = require('./socket/handlers');
socketHandlers(io);

// Bot verification
const { verifyBotToken } = require('./utils/botstartup');

async function startServer(retries = 3) {
  // Display Discord configuration
  console.log('=== Discord Configuration ===');
  console.log('Client ID:', process.env.DISCORD_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.log('Client Secret:', process.env.DISCORD_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.log('Redirect URI:', process.env.DISCORD_REDIRECT_URI || 'Not set');
  console.log('Server ID:', process.env.DISCORD_SERVER_ID || 'Not set');
  console.log('Admin Role IDs:', process.env.ADMIN_ROLE_IDS || '✗ Not set');
  console.log('Moderator Role IDs:', process.env.MODERATOR_ROLE_IDS || '✗ Not set');

  // Verify bot token if provided
  if (process.env.DISCORD_BOT_TOKEN) {
    await verifyBotToken();
  } else {
    console.warn('⚠️  DISCORD_BOT_TOKEN not set - bot features disabled');
  }
  
  console.log('============================\n');

  // Port - cPanel sets this via environment variable
  const PORT = process.env.PORT || 3000;
  
  // Start server with retry logic for port conflicts
  server.listen(PORT, function(err) {
    if (err) {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        
        if (retries > 0) {
          console.log(`Retrying in 2 seconds... (${retries} attempts remaining)`);
          setTimeout(() => startServer(retries - 1), 2000);
        } else {
          console.error('\n=== Port Conflict Resolution ===');
          console.error(`Port ${PORT} is still in use after multiple retries.`);
          console.error('\nTo fix this, run:');
          console.error(`  kill -9 $(lsof -t -i:${PORT})`);
          console.error('Or:');
          console.error('  killall -9 node');
          console.error('\nThen restart the app in cPanel Node.js manager.');
          console.error('================================\n');
          process.exit(1);
        }
      } else {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
      }
    } else {
      const address = server.address();
      console.log(`✅ Server running on port ${address.port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🏠 Base URL: ${process.env.DISCORD_REDIRECT_URI?.replace('/auth/discord/callback', '') || 'http://localhost:' + address.port}`);
      console.log('\nServer is ready! 🚀\n');
    }
  });
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Log to Discord webhook if available
  if (process.env.DISCORD_WEBHOOK_URL) {
    const fetch = require('node-fetch');
    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '❌ Server Crash',
          description: `**Uncaught Exception**\n\`\`\`${error.message}\`\`\``,
          color: 15158332,
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {});
  }
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log to Discord webhook if available
  if (process.env.DISCORD_WEBHOOK_URL) {
    const fetch = require('node-fetch');
    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '⚠️ Unhandled Promise Rejection',
          description: `\`\`\`${reason}\`\`\``,
          color: 16776960,
          timestamp: new Date().toISOString()
        }]
      })
    }).catch(() => {});
  }
});

// Start the server
startServer();