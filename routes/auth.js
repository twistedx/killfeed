// routes/auth.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
} = require('../config/discord');

const { checkUserPermissions } = require('../utils/permissions');

// Create session store
const sessionStore = new Map();

// Initiate OAuth
router.get('/discord', (req, res) => {
  // Request guilds scope to check user's servers
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(authUrl);
});

// OAuth Callback
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect('/?error=token_failed');
    }

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    console.log(`\n=== Auth Request for ${userData.username}#${userData.discriminator} ===`);

    // Check user permissions across all shared guilds
    const permissions = await checkUserPermissions(tokenData.access_token, userData.id);
    
    if (permissions.error) {
      console.error(`Permission check error: ${permissions.error}`);
      
      if (permissions.error === 'no_shared_guilds') {
        return res.redirect('/?error=not_in_server');
      }
      
      if (permissions.error === 'bot_not_configured') {
        return res.redirect('/?error=bot_not_configured');
      }
      
      return res.redirect('/?error=permission_check_failed');
    }

    // Check if user has at least moderator permissions
    if (!permissions.isModerator && !permissions.isAdmin) {
      console.log(`❌ User has no management permissions in any shared guild`);
      return res.redirect('/?error=insufficient_permissions');
    }

    // Log permission results
    console.log(`✅ Permission Check Results:`);
    console.log(`   - Admin: ${permissions.isAdmin}`);
    console.log(`   - Moderator: ${permissions.isModerator}`);
    console.log(`   - Shared Guilds: ${permissions.sharedGuilds.length}`);
    
    permissions.sharedGuilds.forEach(guild => {
      console.log(`   - ${guild.guildName}: Admin=${guild.isAdmin}, Mod=${guild.isModerator}`);
    });

    // Create session
    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator || '0',
      avatar: userData.avatar,
      isAdmin: permissions.isAdmin,
      isModerator: permissions.isModerator,
      sharedGuilds: permissions.sharedGuilds
    };

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/?error=session_save_failed');
      }

      console.log(`✅ Session created for ${userData.username}`);
      console.log(`==========================================\n`);

      // Redirect based on role
      if (permissions.isAdmin) {
        return res.redirect('/dashboard.html');
      }
      if (permissions.isModerator) {
        return res.redirect('/dashboard.html');
      }

      return res.redirect('/?error=insufficient_permissions');
    });

  } catch (err) {
    console.error('Auth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

// Logout
router.get('/logout', (req, res) => {
  if (req.session) {
    sessionStore.delete(req.session.id);
    req.session.destroy();
  }
  res.redirect('/');
});

// Get user
router.get('/user', (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;
module.exports.sessionStore = sessionStore;