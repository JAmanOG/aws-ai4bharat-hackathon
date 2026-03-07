/**
 * Open Data Export – Data adapters/normalizers.
 */

function adaptProfile(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw.userId,
    name: raw.name || '',
    phone: raw.phone || '',
    email: raw.email || '',
    language: raw.language || 'hi',
    is_verified: !!raw.is_verified,
  };
}

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
