// utils/roles.js
const fetch = require('node-fetch');
const { SERVER_ID } = require('../config/discord');

async function getUserPermissions(accessToken) {
  const { ADMIN_ROLE_IDS, MODERATOR_ROLE_IDS } = require('../config/discord');

  try {
    // Get member info (includes role IDs)
    const memberRes = await fetch(`https://discord.com/api/users/@me/guilds/${SERVER_ID}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (memberRes.status === 404) return { error: 'not_in_server' };
    if (!memberRes.ok) throw new Error('Failed to fetch member');

    const member = await memberRes.json();

    let isAdmin = ADMIN_ROLE_IDS.length > 0 && member.roles.some(id => ADMIN_ROLE_IDS.includes(id));
    let isModerator = MODERATOR_ROLE_IDS.length > 0 && member.roles.some(id => MODERATOR_ROLE_IDS.includes(id));
    isModerator = isModerator || isAdmin;

    // Optional: owner fallback
    if (!isAdmin) {
      const guildRes = await fetch(`https://discord.com/api/guilds/${SERVER_ID}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (guildRes.ok) {
        const guild = await guildRes.json();
        if (guild.owner_id === member.user.id) {
          isAdmin = true;
          isModerator = true;
        }
      }
    }

    return { isAdmin, isModerator };
  } catch (err) {
    console.error('Role check error:', err);
    return { error: 'auth_failed' };
  }
}

module.exports = { getUserPermissions };