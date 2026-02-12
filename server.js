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
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Trust proxy - CRITICAL for Render/HTTPS to work with secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  console.log('✅ Trust proxy enabled (production mode)');
}

// Session configuration with file-based persistence
// Use Render disk path if available, otherwise use local ./sessions
const sessionPath = process.env.PERSISTENT_STORAGE_PATH 
  ? path.join(process.env.PERSISTENT_STORAGE_PATH, 'sessions')
  : './sessions';

console.log('\n========================================');
console.log('🔧 SESSION CONFIGURATION');
console.log('========================================');
console.log('Storage path:', sessionPath);
console.log('Cookie name:', 'killfeed.sid');
console.log('Cookie maxAge:', '7 days');
console.log('Cookie secure:', process.env.NODE_ENV === 'production');
console.log('Cookie httpOnly:', true);
console.log('Cookie sameSite:', 'lax');
console.log('Session TTL:', '7 days');
console.log('==========================================\n');

const sessionMiddleware = session({
  store: new FileStore({
    path: sessionPath,
    ttl: 86400 * 7,              // 7 days in seconds
    retries: 0,
    reapInterval: 3600,
    secret: process.env.SESSION_SECRET || 'file-store-secret'
  }),
  name: 'killfeed.sid',          // Custom cookie name
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,                 // Don't save session if unmodified
  saveUninitialized: false,      // Don't create session until something stored
  rolling: true,                 // Reset maxAge on every response
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,              // Prevent XSS attacks
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax'  // Allow cookie on OAuth redirects (was 'strict')
  }
});

app.use(sessionMiddleware);

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

// Session debug endpoint (remove in production)
app.get('/debug/session', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not found');
  }
  res.json({
    sessionID: req.sessionID,
    session: req.session,
    cookie: req.session?.cookie
  });
});

// Socket.IO handlers - PASS SESSION MIDDLEWARE
const socketHandlers = require('./socket/handlers');
socketHandlers(io, sessionMiddleware);

// Optional: Bot verification
async function verifyBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log('⚠️  Bot token not set - skipping bot verification');
    return;
  }

  try {
    const { verifyBotToken } = require('./utils/botstartup');
    await verifyBotToken();
  } catch (err) {
    console.warn('⚠️  Bot verification skipped:', err.message);
  }
}

async function startServer(retries = 3) {
  // Display Discord configuration
  console.log('=== Discord Configuration ===');
  console.log('Client ID:', process.env.DISCORD_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.log('Client Secret:', process.env.DISCORD_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.log('Redirect URI:', process.env.DISCORD_REDIRECT_URI || 'Not set');
  console.log('Bot Token:', process.env.DISCORD_BOT_TOKEN ? '✓ Set' : '✗ Not set (required for permissions)');
  console.log('');
  console.log('🆕 Permission System: Dynamic (checks Discord permissions)');
  console.log('   - Admins: Users with Administrator permission');
  console.log('   - Moderators: Users with Manage Members or similar permissions');
  console.log('   - Works across all servers where bot is present');

  // Verify bot token if provided (optional)
  await verifyBot();
  
  console.log('============================\n');

  // Port - Render/cPanel sets this via environment variable
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
          console.error('  pkill -9 node');
          console.error('\nThen restart the server.');
          console.error('================================\n');
          process.exit(1);
        }
      } else {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
      }
    } else {
      const address = server.address();
      const storagePath = process.env.PERSISTENT_STORAGE_PATH || 'local filesystem';
      
      console.log(`✅ Server running on port ${address.port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Storage: ${storagePath}`);
      console.log(`📁 Sessions: ${sessionPath}`);
      console.log(`⚙️  Config: ${process.env.PERSISTENT_STORAGE_PATH ? path.join(process.env.PERSISTENT_STORAGE_PATH, 'data') : './data'}`);
      console.log(`🍪 Session cookie: killfeed.sid (7 days expiry)`);
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
  
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Don't exit on header errors (Socket.IO race conditions)
  if (error.code === 'ERR_HTTP_HEADERS_SENT') {
    console.warn('⚠️  Headers already sent - ignoring (Socket.IO race condition)');
    return;
  }
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();