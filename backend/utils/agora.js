/**
 * Agora RTC Token Generation Utility.
 */
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

/**
 * Convert a UUID string to a numeric uid for Agora.
 */
function getNumericUid(userId) {
  if (!userId) return 0;
  if (typeof userId === 'number') return userId;
  const hex = userId.replace(/-/g, '').substring(0, 8);
  const uid = parseInt(hex, 16);
  return isNaN(uid) ? 0 : uid % 0xFFFFFFFF;
}

/**
 * Generates an RTC token for joining a channel.
 * @param {string} channelName - Room / channel name.
 * @param {string|number} userId - User identifier.
 * @param {string} role - 'moderator' | 'speaker' | 'listener'.
 * @param {number} [privilegeExpiredTs] - Expiry timestamp (default: +1 hour).
 * @returns {string|null} The generated token, or null if credentials are missing.
 */
function generateRtcToken(channelName, userId, role, privilegeExpiredTs) {
  if (!APP_ID || !APP_CERTIFICATE) {
    console.warn('[AGORA] Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE — returning null token');
    return null;
  }

  const agoraRole = (role === 'moderator' || role === 'speaker')
    ? RtcRole.PUBLISHER
    : RtcRole.SUBSCRIBER;

  const uid = getNumericUid(userId);
  const expiry = privilegeExpiredTs || Math.floor(Date.now() / 1000) + 3600;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    agoraRole,
    expiry,
  );

  return token;
}

module.exports = { generateRtcToken, getNumericUid };
