/**
 * Adapter Layer — normalizes each service response into a stable export DTO.
 *
 * Each adapter takes raw API response data and returns a
 * standardized structure. This ensures the export format remains
 * consistent even if upstream services change their response shapes.
 */

/**
 * Normalize user profile from feature1.
 * Input may have: fullName/name, mobile/phone, avatar_url, email, language
 * Output: { name, phone, email, language, verified, avatar }
 */
function adaptProfile(raw) {
  if (!raw) return null;
  return {
    name: raw.fullName || raw.name || raw.userName || null,
    phone: raw.mobile || raw.phone || raw.phone_number || null,
    email: raw.email || null,
    language: raw.language || raw.preferred_language || 'en',
    verified: raw.verified || raw.is_verified || false,
    avatar: raw.avatar_url || raw.avatar || null,
  };
}

/**
 * Normalize community posts from feature1.
 * Input: array of posts from /community/posts
 * Output: [{ id, title, content, topic, created_at }]
 */
function adaptCommunityPosts(rawPosts) {
  if (!Array.isArray(rawPosts)) return [];
  return rawPosts.map(p => ({
    id: p.id,
    title: p.title || '',
    content: p.content || '',
    topic: p.topic || 'general',
    created_at: p.created_at || p.createdAt || null,
  }));
}

/**
 * Normalize business listings from feature1.
 * Input: array of businesses from /community/businesses
 * Output: [{ id, name, category, phone, address, active }]
 */
function adaptBusinesses(rawBusinesses) {
  if (!Array.isArray(rawBusinesses)) return [];
  return rawBusinesses.map(b => ({
    id: b.id,
    name: b.name || '',
    category: b.category_name || b.category || '',
    phone: b.phone || '',
    address: b.address || '',
    active: b.is_active !== undefined ? b.is_active : true,
  }));
}

/**
 * Normalize complaints from feature1.
 * Input: array of complaints from /community/government/complaints
 * Output: [{ id, portal, reference_no, description, status, filed_at }]
 */
function adaptComplaints(rawComplaints) {
  if (!Array.isArray(rawComplaints)) return [];
  return rawComplaints.map(c => ({
    id: c.id,
    portal: c.portal_name || c.portalName || '',
    reference_no: c.reference_no || c.referenceNo || '',
    description: c.description || null,
    status: c.status || 'unknown',
    filed_at: c.filed_at || c.filedAt || c.created_at || null,
  }));
}

/**
 * Normalize courses from feature2.
 * Input: array from /knowledge/my-courses
 * Output: [{ id, title, category, status, progress_pct }]
 */
function adaptCourses(rawCourses) {
  if (!Array.isArray(rawCourses)) return [];
  return rawCourses.map(c => ({
    id: c.id || c.courseId,
    title: c.title || c.course?.title || '',
    category: c.category || c.course?.category || '',
    status: c.status || c.enrollmentStatus || 'unknown',
    progress_pct: c.completionPct || c.progress_pct || c.progress || 0,
  }));
}

/**
 * Normalize learning profile from feature2.
 * Input: object from /knowledge/learning-profile
 * Output: { preferred_language, interests, completed_courses, skill_level }
 */
function adaptLearningProfile(raw) {
  if (!raw) return null;
  return {
    preferred_language: raw.preferredLanguage || raw.preferred_language || 'en',
    interests: raw.interests || raw.topics || [],
    completed_courses: raw.completedCourses || raw.completed_courses || 0,
    skill_level: raw.skillLevel || raw.skill_level || 'beginner',
  };
}

module.exports = {
  adaptProfile,
  adaptCommunityPosts,
  adaptBusinesses,
  adaptComplaints,
  adaptCourses,
  adaptLearningProfile,
};
