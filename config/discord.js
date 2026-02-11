// config/discord.js
const config = {
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
  SERVER_ID: process.env.DISCORD_SERVER_ID,
  BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  
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

if (!config.SERVER_ID) {
  console.error('❌ DISCORD_SERVER_ID is required');
  process.exit(1);
}

if (config.ADMIN_ROLE_IDS.length === 0 && config.MODERATOR_ROLE_IDS.length === 0) {
  console.warn('⚠️  No admin or moderator role IDs configured - relying on server owner only');
}

module.exports = config;