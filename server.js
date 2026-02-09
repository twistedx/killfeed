// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');

const { verifyBotToken } = require('./utils/botstartup');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Bot token verification at startup
(async () => {
  console.log('Verifying Discord bot token...');
  const botIsValid = await verifyBotToken();

  if (!botIsValid) {
    console.warn('⚠️  Bot checks will be disabled or limited.');
    // Uncomment to make it strict:
    // process.exit(1);
  }
})();

// Routes
app.use(require('./routes/auth'));
app.use(require('./routes/panels'));

// Root page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check (useful for Render)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    port: PORT,
    baseUrl: BASE_URL,
    timestamp: new Date().toISOString()
  });
});

// Socket.IO handlers
require('./socket/handlers')(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Homepage: ${BASE_URL}/`);
  console.log(`Login: ${BASE_URL}/auth/discord`);
  console.log(`Health: ${BASE_URL}/health`);
});