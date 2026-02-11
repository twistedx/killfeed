// utils/roles.js
const fetch = require('node-fetch');
const { SERVER_ID, ADMIN_ROLE_IDS, MODERATOR_ROLE_IDS } = require('../config/discord');

/**
 * Check user permissions based on their role IDs
 * @param {string[]} userRoleIds - Array of role IDs the user has
 * @param {string} userId - User's Discord ID (for owner check)
 * @returns {Promise<{isAdmin: boolean, isModerator: boolean, error?: string}>}
 */
async function getUserPermissions(userRoleIds, userId) {
  try {
    // Check if user has admin role
    let isAdmin = ADMIN_ROLE_IDS.length > 0 && 
                  userRoleIds.some(id => ADMIN_ROLE_IDS.includes(id));
    
    // Check if user has moderator role
    let isModerator = MODERATOR_ROLE_IDS.length > 0 && 
                      userRoleIds.some(id => MODERATOR_ROLE_IDS.includes(id));
    
    // Admins are also moderators
    if (isAdmin) {
      isModerator = true;
    }

    // Optional: Check if user is server owner (requires bot token)
    if (!isAdmin && process.env.DISCORD_BOT_TOKEN) {
      const guildRes = await fetch(`https://discord.com/api/v10/guilds/${SERVER_ID}`, {
        headers: { 
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (guildRes.ok) {
        const guild = await guildRes.json();
        if (guild.owner_id === userId) {
          console.log(`User ${userId} is server owner - granting admin access`);
          isAdmin = true;
          isModerator = true;
        }
      }
    }

    // Check if user has at least one required role
    if (!isAdmin && !isModerator) {
      console.warn(`User ${userId} has no moderator or admin roles`);
      return { isAdmin: false, isModerator: false, error: 'insufficient_permissions' };
    }

    return { isAdmin, isModerator };
    
  } catch (err) {
    console.error('Role check error:', err);
    return { isAdmin: false, isModerator: false, error: 'auth_failed' };
  }
}

module.exports = { getUserPermissions };