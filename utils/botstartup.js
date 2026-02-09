// utils/botStartup.js
const fetch = require('node-fetch');

async function verifyBotToken() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN not set');
    return false;
  }

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Bot token invalid (HTTP ${res.status}): ${text}`);
      return false;
    }

    const data = await res.json();
    console.log('✅ Bot token is valid');
    console.log(`   Logged in as: ${data.username}#${data.discriminator || '0'}`);
    console.log(`   Bot ID: ${data.id}`);
    return true;
  } catch (err) {
    console.error('Bot verification error:', err.message);
    return false;
  }
}

module.exports = { verifyBotToken };