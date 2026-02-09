// utils/bot.js
const fetch = require('node-fetch');
const { SERVER_ID } = require('../config/discord');

async function getMemberViaBot(userId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.warn('DISCORD_BOT_TOKEN not set - skipping bot member check');
    return null;
  }

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${SERVER_ID}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 404) {
      return null; // not in server
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Bot fetch failed: ${res.status} - ${errorText}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Bot member fetch error:', err.message);
    return null;
  }
}

module.exports = { getMemberViaBot };