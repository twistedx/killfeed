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
  console.log('\n========================================');
  console.log('📥 OAUTH CALLBACK RECEIVED');
  console.log('========================================');
  console.log('Time:', new Date().toISOString());
  console.log('Query params:', req.query);
  console.log('Session ID:', req.sessionID);
  console.log('Cookies received:', req.headers.cookie);
  
  const { code } = req.query;

  if (!code) {
    console.error('❌ No authorization code received');
    return res.redirect('/?error=no_code');
  }

  console.log('✅ Authorization code received:', code.substring(0, 10) + '...');

  try {
    console.log('\n--- Step 1: Exchange code for token ---');
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
      console.error('❌ Token exchange failed:', tokenData);
      return res.redirect('/?error=token_failed');
    }

    console.log('✅ Token received, expires in:', tokenData.expires_in, 'seconds');

    console.log('\n--- Step 2: Fetch user data ---');
    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    console.log('✅ User data received:', userData.username, '#', userData.discriminator || '0');
    console.log('User ID:', userData.id);
    console.log(`\n=== Auth Request for ${userData.username}#${userData.discriminator} ===`);

    console.log('\n--- Step 3: Check permissions ---');
    // Check user permissions across all shared guilds
    const permissions = await checkUserPermissions(tokenData.access_token, userData.id);
    
    if (permissions.error) {
      console.error(`❌ Permission check error: ${permissions.error}`);
      
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

    console.log('\n--- Step 4: Create session ---');
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

    console.log('Session object created:', {
      username: req.session.user.username,
      isAdmin: req.session.user.isAdmin,
      isModerator: req.session.user.isModerator,
      sessionID: req.sessionID
    });

    console.log('\n--- Step 5: Save session to store ---');
    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        console.error('Error stack:', err.stack);
        return res.redirect('/?error=session_save_failed');
      }

      console.log('✅ Session saved successfully!');
      console.log('Session ID:', req.sessionID);
      console.log('Session cookie name: killfeed.sid');
      console.log('Session data:', {
        user: req.session.user.username,
        isAdmin: req.session.user.isAdmin,
        cookie: req.session.cookie
      });

      console.log('\n--- Step 6: Set cookie and redirect ---');
      
      // Force set the cookie in response headers
      const cookieValue = `killfeed.sid=${req.sessionID}; Path=/; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''} SameSite=Lax; Max-Age=604800`;
      res.setHeader('Set-Cookie', cookieValue);
      console.log('Manually setting cookie header:', cookieValue);
      
      const redirectUrl = '/dashboard.html';
      console.log('Redirecting to:', redirectUrl);
      console.log('Response headers will include Set-Cookie');
      console.log(`==========================================\n`);
      
      return res.redirect(redirectUrl);
    });

  } catch (err) {
    console.error('\n❌ OAUTH ERROR:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.log('==========================================\n');
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
  console.log('\n========================================');
  console.log('🔍 AUTH CHECK REQUEST');
  console.log('========================================');
  console.log('Time:', new Date().toISOString());
  console.log('Path:', req.path);
  console.log('Protocol:', req.protocol);
  console.log('Secure:', req.secure);
  console.log('Hostname:', req.hostname);
  console.log('Session ID:', req.sessionID);
  console.log('Cookies received:', req.headers.cookie);
  console.log('Session exists:', !!req.session);
  console.log('Session.user exists:', !!req.session?.user);
  
  if (req.session) {
    console.log('Session details:', {
      id: req.session.id,
      cookie: req.session.cookie,
      user: req.session.user ? {
        username: req.session.user.username,
        isAdmin: req.session.user.isAdmin,
        isModerator: req.session.user.isModerator
      } : null
    });
  }
  
  if (req.session?.user) {
    console.log('✅ User authenticated:', req.session.user.username);
    console.log('Returning user data to client');
    console.log('==========================================\n');
    res.json(req.session.user);
  } else {
    console.log('❌ User not authenticated');
    console.log('Reason:', !req.session ? 'No session' : 'No user in session');
    console.log('Returning 401');
    console.log('==========================================\n');
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Test endpoint to check cookie functionality
router.get('/test-cookie', (req, res) => {
  console.log('\n🧪 COOKIE TEST');
  console.log('Protocol:', req.protocol);
  console.log('Secure:', req.secure);
  console.log('Trust proxy:', req.app.get('trust proxy'));
  console.log('Cookies received:', req.headers.cookie);
  
  res.cookie('test-cookie', 'test-value', {
    maxAge: 60000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  res.json({
    message: 'Test cookie set',
    protocol: req.protocol,
    secure: req.secure,
    trustProxy: req.app.get('trust proxy'),
    cookiesReceived: req.headers.cookie,
    environment: process.env.NODE_ENV
  });
});

module.exports = router;
module.exports.sessionStore = sessionStore;