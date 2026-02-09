const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

let counters = {
  kills: 0,
  extracted: 0,
  kia: 0
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current counters to new connections
  socket.emit('countersUpdate', counters);
  
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
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📺 OBS Overlay: http://localhost:${PORT}/obs-overlay.html`);
  console.log(`🎮 Moderator Panel: http://localhost:${PORT}/moderator-panel.html`);
});