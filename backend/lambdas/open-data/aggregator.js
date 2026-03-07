/**
 * Open Data Export – Aggregator.
 * Instead of HTTP calls to separate services, queries the unified DB directly.
 */

const { query } = require('../../utils/db');
const adapters = require('./adapters');

/**
 * Aggregate all user data from the unified database for export.
 */
async function aggregateUserData(userId) {
  const exportData = {
    export_metadata: {
      user_id: userId,
      exported_at: new Date().toISOString(),
      services_included: [],
      services_failed: [],
      format: 'json',
    },
  };

  // Profile
  try {
    const profileResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (profileResult.rows[0]) {
      exportData.profile = adapters.adaptProfile(profileResult.rows[0]);
      exportData.export_metadata.services_included.push('profile');
    }
  } catch (err) {
    console.warn('[OpenData] Failed to fetch profile:', err.message);
    exportData.export_metadata.services_failed.push('profile');
    exportData.profile = null;
  }

  // Community Posts
  try {
    const postsResult = await query(
      'SELECT * FROM knowledge_posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    exportData.community_posts = adapters.adaptCommunityPosts(postsResult.rows);
    exportData.export_metadata.services_included.push('community_posts');
  } catch (err) {
    console.warn('[OpenData] Failed to fetch posts:', err.message);
    exportData.export_metadata.services_failed.push('community_posts');
    exportData.community_posts = [];
  }

  // Businesses
  try {
    const bizResult = await query(
      `SELECT b.*, c.name as category_name
       FROM businesses b
       LEFT JOIN business_categories c ON b.category_id = c.id
       WHERE b.owner_id = $1 LIMIT 100`,
      [userId]
    );
    exportData.businesses = adapters.adaptBusinesses(bizResult.rows);
    exportData.export_metadata.services_included.push('businesses');
  } catch (err) {
    console.warn('[OpenData] Failed to fetch businesses:', err.message);
    exportData.export_metadata.services_failed.push('businesses');
    exportData.businesses = [];
  }

  // Complaints
  try {
    const complaintResult = await query(
      'SELECT * FROM saved_complaints WHERE user_id = $1 ORDER BY filed_at DESC LIMIT 100',
      [userId]
    );
    exportData.complaints = adapters.adaptComplaints(complaintResult.rows);
    exportData.export_metadata.services_included.push('complaints');
  } catch (err) {
    console.warn('[OpenData] Failed to fetch complaints:', err.message);
    exportData.export_metadata.services_failed.push('complaints');
    exportData.complaints = [];
  }

  return exportData;
}

module.exports = { aggregateUserData };
