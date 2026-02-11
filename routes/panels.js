// routes/panels.js
const express = require('express');
const router = express.Router();
const path = require('path');
const { requireAdmin, requireModerator } = require('../middleware/auth');

// Dashboard - requires any authentication
router.get('/dashboard.html', requireModerator, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Other routes...
router.get('/moderator-panel.html', requireModerator, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/moderator-panel.html'));
});

router.get('/admin-panel.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-panel.html'));
});

router.get('/config-panel.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/config-panel.html'));
});

module.exports = router;