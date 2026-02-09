// config/discord.js
module.exports = {
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
  SERVER_ID: process.env.DISCORD_SERVER_ID || '236974299053948928',

  ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
  MODERATOR_ROLE_IDS: (process.env.MODERATOR_ROLE_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
};