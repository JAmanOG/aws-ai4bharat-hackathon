/**
 * CSV Formatter — converts the unified export JSON into a flat CSV string.
 */

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

function objectToCSV(sectionName, obj) {
  if (!obj) return '';
  const lines = [`--- ${sectionName} ---`, 'Field,Value'];
  for (const [key, value] of Object.entries(obj)) {
    const displayValue = Array.isArray(value) ? value.join('; ') : value;
    lines.push(`${escapeCSV(key)},${escapeCSV(displayValue)}`);
  }
  return lines.join('\n');
}

function toCSV(exportData) {
  const sections = [];

  sections.push(objectToCSV('Export Metadata', exportData.export_metadata));

  if (exportData.profile) {
    sections.push(objectToCSV('Profile', exportData.profile));
  }

  if (exportData.community_posts && exportData.community_posts.length > 0) {
    sections.push(arrayToCSV('Community Posts', exportData.community_posts,
      ['id', 'title', 'content', 'topic', 'created_at']
    ));
  }

  if (exportData.businesses && exportData.businesses.length > 0) {
    sections.push(arrayToCSV('Business Listings', exportData.businesses,
      ['id', 'name', 'category', 'phone', 'address', 'active']
    ));
  }

  if (exportData.complaints && exportData.complaints.length > 0) {
    sections.push(arrayToCSV('Complaints', exportData.complaints,
      ['id', 'portal', 'reference_no', 'description', 'status', 'filed_at']
    ));
  }

  if (exportData.courses && exportData.courses.length > 0) {
    sections.push(arrayToCSV('Courses', exportData.courses,
      ['id', 'title', 'category', 'status', 'progress_pct']
    ));
  }

  if (exportData.learning_profile) {
    sections.push(objectToCSV('Learning Profile', exportData.learning_profile));
  }

  return sections.filter(s => s.length > 0).join('\n\n');
}

module.exports = { toCSV, arrayToCSV, objectToCSV, escapeCSV };
