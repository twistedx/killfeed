// utils/permissions.js
const fetch = require('node-fetch');
const { BOT_TOKEN } = require('../config/discord');

/**
 * Get all guilds (servers) the bot is in
 */
async function getBotGuilds() {
  if (!BOT_TOKEN) {
    console.warn('⚠️  BOT_TOKEN not set - cannot check bot guilds');
    return [];
  }

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch bot guilds:', response.status);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching bot guilds:', error);
    return [];
  }
}

/**
 * Get all guilds the user is in (from OAuth token)
 */
async function getUserGuilds(accessToken) {
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch user guilds:', response.status);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user guilds:', error);
    return [];
  }
}

/**
 * Get user's member data for a specific guild
 */
async function getGuildMember(guildId, userId) {
  if (!BOT_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching member for guild ${guildId}:`, error);
    return null;
  }
}

/**
 * Discord Permission Flags
 * https://discord.com/developers/docs/topics/permissions
 */
const PermissionFlags = {
  ADMINISTRATOR: 0x0000000000000008n,
  MANAGE_GUILD: 0x0000000000000020n,
  MANAGE_ROLES: 0x0000000000010000n,
  MANAGE_CHANNELS: 0x0000000000000010n,
  MANAGE_MEMBERS: 0x0000000000000002n, // Kick Members
  BAN_MEMBERS: 0x0000000000000004n,
  MODERATE_MEMBERS: 0x0000010000000000n
};

/**
 * Check if permissions include a specific flag
 */
function hasPermission(permissions, flag) {
  const permBigInt = BigInt(permissions);
  return (permBigInt & flag) === flag;
}

/**
 * Determine permission level from Discord permissions
 */
function getPermissionLevel(permissions) {
  if (!permissions) {
    return { isAdmin: false, isModerator: false };
  }

  const permBigInt = BigInt(permissions);

  // Check for Administrator permission (highest level)
  if (hasPermission(permBigInt, PermissionFlags.ADMINISTRATOR)) {
    return { isAdmin: true, isModerator: true };
  }

  // Check for management permissions (moderator level)
  const hasManageMembers = hasPermission(permBigInt, PermissionFlags.MANAGE_MEMBERS);
  const hasBanMembers = hasPermission(permBigInt, PermissionFlags.BAN_MEMBERS);
  const hasManageGuild = hasPermission(permBigInt, PermissionFlags.MANAGE_GUILD);
  const hasManageRoles = hasPermission(permBigInt, PermissionFlags.MANAGE_ROLES);
  const hasModerateMembers = hasPermission(permBigInt, PermissionFlags.MODERATE_MEMBERS);

  // Grant moderator if they have any management permissions
  const isModerator = hasManageMembers || hasBanMembers || hasManageGuild || 
                      hasManageRoles || hasModerateMembers;

  return { isAdmin: false, isModerator };
}

/**
 * Check user permissions across all shared guilds
 * Returns the highest permission level found
 */
async function checkUserPermissions(accessToken, userId) {
  try {
    // Get bot's guilds and user's guilds
    const [botGuilds, userGuilds] = await Promise.all([
      getBotGuilds(),
      getUserGuilds(accessToken)
    ]);

    if (botGuilds.length === 0) {
      console.warn('⚠️  Bot is not in any guilds or BOT_TOKEN not set');
      return {
        isAdmin: false,
        isModerator: false,
        sharedGuilds: [],
        error: 'bot_not_configured'
      };
    }

    // Find shared guilds (where both bot and user are members)
    const botGuildIds = new Set(botGuilds.map(g => g.id));
    const sharedGuilds = userGuilds.filter(g => botGuildIds.has(g.id));

    if (sharedGuilds.length === 0) {
      console.log(`User ${userId} is not in any shared guilds with the bot`);
      return {
        isAdmin: false,
        isModerator: false,
        sharedGuilds: [],
        error: 'no_shared_guilds'
      };
    }

    console.log(`Found ${sharedGuilds.length} shared guild(s) with user ${userId}`);

    // Check permissions in each shared guild
    let highestPermissions = { isAdmin: false, isModerator: false };
    const guildPermissions = [];

    for (const guild of sharedGuilds) {
      // First check permissions from the user's guild list (faster)
      const userGuildPerms = getPermissionLevel(guild.permissions);
      
      // Also fetch member data for more detailed info
      const memberData = await getGuildMember(guild.id, userId);
      let memberPerms = { isAdmin: false, isModerator: false };
      
      if (memberData && memberData.permissions) {
        memberPerms = getPermissionLevel(memberData.permissions);
      }

      // Take the highest permission level from either source
      const guildPerms = {
        isAdmin: userGuildPerms.isAdmin || memberPerms.isAdmin,
        isModerator: userGuildPerms.isModerator || memberPerms.isModerator
      };

      guildPermissions.push({
        guildId: guild.id,
        guildName: guild.name,
        ...guildPerms
      });

      // Track highest permission level across all guilds
      if (guildPerms.isAdmin) {
        highestPermissions.isAdmin = true;
        highestPermissions.isModerator = true;
      } else if (guildPerms.isModerator) {
        highestPermissions.isModerator = true;
      }

      console.log(`Guild: ${guild.name} - Admin: ${guildPerms.isAdmin}, Mod: ${guildPerms.isModerator}`);
    }

    return {
      ...highestPermissions,
      sharedGuilds: guildPermissions
    };

  } catch (error) {
    console.error('Error checking user permissions:', error);
    return {
      isAdmin: false,
      isModerator: false,
      sharedGuilds: [],
      error: 'permission_check_failed'
    };
  }
}

module.exports = {
  checkUserPermissions,
  getPermissionLevel,
  getBotGuilds,
  getUserGuilds
};
