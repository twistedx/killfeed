// config/discord.js
const config = {
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
  BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  
  // Legacy: Optional server ID for backward compatibility
  SERVER_ID: process.env.DISCORD_SERVER_ID || null,
  
  // Legacy: Optional role IDs (no longer needed with permission-based system)
  ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
  
  MODERATOR_ROLE_IDS: (process.env.MODERATOR_ROLE_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
};

// Validate critical config
if (!config.CLIENT_ID) {
  console.error('❌ DISCORD_CLIENT_ID is required');
  process.exit(1);
}

if (!config.CLIENT_SECRET) {
  console.error('❌ DISCORD_CLIENT_SECRET is required');
  process.exit(1);
}

if (!config.REDIRECT_URI) {
  console.error('❌ DISCORD_REDIRECT_URI is required');
  process.exit(1);
}

// Bot token is now required for permission checking
if (!config.BOT_TOKEN) {
  console.warn('⚠️  DISCORD_BOT_TOKEN not set - permission checking will be limited');
  console.warn('⚠️  Please add your bot token for full functionality');
}

// Server ID and Role IDs are now optional
if (config.SERVER_ID || config.ADMIN_ROLE_IDS.length > 0 || config.MODERATOR_ROLE_IDS.length > 0) {
  console.log('ℹ️  Legacy server/role configuration detected');
  console.log('ℹ️  The system now uses dynamic permission checking');
  console.log('ℹ️  You can remove SERVER_ID, ADMIN_ROLE_IDS, and MODERATOR_ROLE_IDS from your environment');
}

module.exports = config;
