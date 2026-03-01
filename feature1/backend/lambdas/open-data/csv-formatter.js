/**
 * CSV Formatter — converts the unified export JSON into a flat CSV string.
 *
 * Each data section becomes a separate block in the CSV, separated by
 * blank lines and section headers. This makes the export readable
 * in spreadsheet software.
 */

/**
 * Escape a CSV field value.
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects into CSV rows.
 * @param {string} sectionName — header label for this section
 * @param {object[]} items — array of flat objects
 * @param {string[]} columns — ordered column names
 * @returns {string} — CSV string for this section
 */
function arrayToCSV(sectionName, items, columns) {
  if (!items || items.length === 0) return '';

  const lines = [];
  lines.push(`--- ${sectionName} ---`);
  lines.push(columns.map(escapeCSV).join(','));

  for (const item of items) {
    const row = columns.map(col => escapeCSV(item[col]));
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Convert a flat object into CSV key-value rows.
 * @param {string} sectionName
 * @param {object} obj
 * @returns {string}
 */
function objectToCSV(sectionName, obj) {
  if (!obj) return '';

  const lines = [`--- ${sectionName} ---`, 'Field,Value'];
  for (const [key, value] of Object.entries(obj)) {
    const displayValue = Array.isArray(value) ? value.join('; ') : value;
    lines.push(`${escapeCSV(key)},${escapeCSV(displayValue)}`);
  }
  return lines.join('\n');
}

/**
 * Convert complete export data into a single CSV string.
 * @param {object} exportData — the full unified export DTO
 * @returns {string}
 */
function toCSV(exportData) {
  const sections = [];

  // Metadata
  sections.push(objectToCSV('Export Metadata', exportData.export_metadata));

  // Profile
  if (exportData.profile) {
    sections.push(objectToCSV('Profile', exportData.profile));
  }

  // Community Posts
  if (exportData.community_posts && exportData.community_posts.length > 0) {
    sections.push(arrayToCSV('Community Posts', exportData.community_posts,
      ['id', 'title', 'content', 'topic', 'created_at']
    ));
  }

  // Businesses
  if (exportData.businesses && exportData.businesses.length > 0) {
    sections.push(arrayToCSV('Business Listings', exportData.businesses,
      ['id', 'name', 'category', 'phone', 'address', 'active']
    ));
  }

  // Complaints
  if (exportData.complaints && exportData.complaints.length > 0) {
    sections.push(arrayToCSV('Complaints', exportData.complaints,
      ['id', 'portal', 'reference_no', 'description', 'status', 'filed_at']
    ));
  }

  // Courses
  if (exportData.courses && exportData.courses.length > 0) {
    sections.push(arrayToCSV('Courses', exportData.courses,
      ['id', 'title', 'category', 'status', 'progress_pct']
    ));
  }

  // Learning Profile
  if (exportData.learning_profile) {
    sections.push(objectToCSV('Learning Profile', exportData.learning_profile));
  }

  return sections.filter(s => s.length > 0).join('\n\n');
}

module.exports = { toCSV, arrayToCSV, objectToCSV, escapeCSV };
