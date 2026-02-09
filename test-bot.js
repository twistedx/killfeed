require('dotenv').config();
const fetch = require('node-fetch');

async function test() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log("No token found in .env");
    return;
  }

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      console.log("Bot is valid! Logged in as:", data.username);
    } else {
      console.log("Invalid token. Status:", res.status);
      console.log(await res.text());
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();