// routes/panels.js
const express = require('express');
const router = express.Router();
const path = require('path');
const { requireAdmin, requireModerator, validateServerAccess } = require('../middleware/auth');

// Dashboard - requires authentication and server access
router.get('/dashboard.html', requireModerator, validateServerAccess, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Moderator panel - requires moderator access and server access
router.get('/moderator-panel.html', requireModerator, validateServerAccess, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/moderator-panel.html'));
});

// Admin panel - requires admin access and server access
router.get('/admin-panel.html', requireAdmin, validateServerAccess, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-panel.html'));
});

// Config panel - requires admin access and server access
router.get('/config-panel.html', requireAdmin, validateServerAccess, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/config-panel.html'));
});

module.exports = router;