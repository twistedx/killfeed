const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  SERVER_ID
} = require('../config/discord');

const { getUserPermissions } = require('../utils/roles');
const { getMemberViaBot } = require('../utils/bot');

// Create session store
const sessionStore = new Map();

// Initiate OAuth
router.get('/discord', (req, res) => {
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.members.read`;
  res.redirect(authUrl);
});

// OAuth Callback
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
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
      console.error('Token failed:', tokenData);
      return res.redirect('/?error=token_failed');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_ID}/member`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (memberResponse.status === 404) {
      return res.redirect('/?error=not_in_server');
    }

    const memberData = await memberResponse.json();

    const perms = await getUserPermissions(memberData.roles, userData.id);
    
    if (perms.error) {
      return res.redirect(`/?error=${perms.error}`);
    }

    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator || '0',
      avatar: userData.avatar,
      isAdmin: perms.isAdmin,
      isModerator: perms.isModerator,
    };

    sessionStore.set(req.session.id, req.session);

// Redirect based on role
if (perms.isAdmin) {
  console.log('➡️  Redirecting to dashboard');
  return res.redirect('/dashboard.html');
}
if (perms.isModerator) {
  console.log('➡️  Redirecting to dashboard');
  return res.redirect('/dashboard.html');
}

return res.redirect('/?error=insufficient_permissions');

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