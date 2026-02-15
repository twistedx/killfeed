// middleware/auth.js
const requireAuth = (req, res, next) => {
  if (req.session?.user) {
    next();
  } else {
    // Redirect to home with error
    res.redirect('/?error=not_authenticated');
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.session?.user) {
    return res.redirect('/?error=not_authenticated');
  }
  
  if (req.session.user.isAdmin) {
    next();
  } else {
    res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0f0f0f;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: #1a1a1a;
            border-radius: 16px;
            border: 3px solid #f44336;
          }
          h1 { color: #f44336; margin-bottom: 20px; }
          p { color: #999; margin-bottom: 30px; }
          a {
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔒 Admin Access Required</h1>
          <p>You must be an admin to access this page.</p>
          <a href="/">← Back to Home</a>
        </div>
      </body>
      </html>
    `);
  }
};

const requireModerator = (req, res, next) => {
  if (!req.session?.user) {
    return res.redirect('/?error=not_authenticated');
  }

  if (req.session.user.isModerator || req.session.user.isAdmin) {
    next();
  } else {
    res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0f0f0f;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: #1a1a1a;
            border-radius: 16px;
            border: 3px solid #f44336;
          }
          h1 { color: #f44336; margin-bottom: 20px; }
          p { color: #999; margin-bottom: 30px; }
          a {
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔒 Moderator Access Required</h1>
          <p>You must be a moderator or admin to access this page.</p>
          <a href="/">← Back to Home</a>
        </div>
      </body>
      </html>
    `);
  }
};

// Validate user has access to selected server
const validateServerAccess = (req, res, next) => {
  if (!req.session?.user || !req.session?.selectedServer) {
    return res.redirect('/?error=not_authenticated');
  }

  // Verify user still has access to the selected server
  const hasAccess = req.session.user.sharedGuilds.some(
    g => g.guildId === req.session.selectedServer.id
  );

  if (!hasAccess) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0f0f0f;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: #1a1a1a;
            border-radius: 16px;
            border: 3px solid #f44336;
          }
          h1 { color: #f44336; margin-bottom: 20px; }
          p { color: #999; margin-bottom: 30px; }
          a {
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔒 Server Access Denied</h1>
          <p>You no longer have access to this server.</p>
          <a href="/">← Back to Home</a>
        </div>
      </body>
      </html>
    `);
  }

  next();
};

module.exports = { requireAuth, requireAdmin, requireModerator, validateServerAccess };