const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Get port from environment or default to 3000
const PORT = process.env.PORT || 3000;

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
  res.json({ status: 'ok', counters, message });
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current state to new connections
  socket.emit('countersUpdate', counters);
  socket.emit('messageUpdate', message);
  
  // Increment counter
  socket.on('incrementCounter', (type) => {
    if (counters.hasOwnProperty(type)) {
      counters[type]++;
      console.log('Counter incremented:', type, counters[type]);
      io.emit('countersUpdate', counters);
    }
  });
  
  // Decrement counter
  socket.on('decrementCounter', (type) => {
    if (counters.hasOwnProperty(type)) {
      counters[type] = Math.max(0, counters[type] - 1);
      console.log('Counter decremented:', type, counters[type]);
      io.emit('countersUpdate', counters);
    }
  });
  
  // Reset counters
  socket.on('resetCounters', () => {
    console.log('Counters reset');
    counters = { kills: 0, extracted: 0, kia: 0 };
    io.emit('countersUpdate', counters);
  });
  
  // Update message
  socket.on('updateMessage', (newMessage) => {
    console.log('Message updated:', newMessage);
    message = newMessage;
    io.emit('messageUpdate', message);
  });
  
  // Show message
  socket.on('showMessage', () => {
    console.log('Message shown');
    message.visible = true;
    io.emit('messageUpdate', message);
  });
  
  // Hide message
  socket.on('hideMessage', () => {
    console.log('Message hidden');
    message.visible = false;
    io.emit('messageUpdate', message);
  });
  
  // Trigger celebration
  socket.on('triggerCelebration', () => {
    console.log('Celebration triggered!');
    io.emit('triggerCelebration');
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📺 OBS Overlay: ${BASE_URL}/obs-overlay.html`);
  console.log(`📺 OBS Message: ${BASE_URL}/obs-message.html`);
  console.log(`📺 OBS Celebration: ${BASE_URL}/obs-celebration.html`);
  console.log(`🎮 Moderator Panel: ${BASE_URL}/moderator-panel.html`);
});