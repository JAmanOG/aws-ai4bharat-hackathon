/**
 * Agora RTC Token Generation Utility.
 */
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

function getNumericUid(userId) {
  if (!userId) return 0;
  if (typeof userId === 'number') return userId;
  const hex = userId.replace(/-/g, '').substring(0, 8);
  const uid = parseInt(hex, 16);
  return isNaN(uid) ? 0 : uid % 0xFFFFFFFF;
}

/**
 * Generates an RTC token for joining a channel.
 * @param {string} channelName The name of the channel.
 * @param {string|number} userId The ID of the user (uid).
 * @param {string} role User role: 'moderator', 'speaker', or 'listener'.
 * @param {number} privilegeExpiredTs Privilege expiration timestamp.
 * @returns {string} The generated token.
 */
function generateRtcToken(channelName, userId, role, privilegeExpiredTs) {
  if (!APP_ID || !APP_CERTIFICATE) {
    console.error('[AGORA:ERROR] Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE in environment');
    return null;
  }

  // Map roles to Agora roles
  // Broadcaster (Host/Speaker) can send and receive audio
  // Subscriber (Audience) can only receive audio
  let agoraRole;
  if (role === 'moderator' || role === 'speaker') {
    agoraRole = RtcRole.PUBLISHER;
  } else {
    agoraRole = RtcRole.SUBSCRIBER;
  }

  const uid = getNumericUid(userId);

  console.log(`[AGORA:TOKEN] Generating token: channel=${channelName}, uid=${uid}, role=${agoraRole}`);

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs || Math.floor(Date.now() / 1000) + 3600 // default 1 hour
  );

  return token;
}

module.exports = { generateRtcToken };
