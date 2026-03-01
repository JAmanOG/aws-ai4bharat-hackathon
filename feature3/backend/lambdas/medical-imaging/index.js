/**
 * Medical Imaging Lambda — handler.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const { initiateUpload, getDocumentStatus, analyzeImage } = require('./imaging');

exports.handler = async (event) => {
  console.log('Medical Imaging event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const path = event.path;
  const userId = event.requestContext?.authorizer?.claims?.sub
    || event.headers?.['x-user-id'] || 'anonymous';

  try {
    // ── Upload Initiation ──
    if (path.match(/\/health\/imaging\/upload$/) && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.imagingType) return badRequest('imagingType is required (xray, mri, ct-scan, ultrasound)');
      const result = await initiateUpload(userId, body.imagingType, body.description);
      return success(result, 201);
    }

    // ── Analyze Document ──
    const analyzeMatch = path.match(/\/health\/imaging\/([a-f0-9-]+)\/analyze$/);
    if (analyzeMatch && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await analyzeImage(analyzeMatch[1], body.imagingType || 'xray');
      return success(result);
    }

    // ── Get Document Status ──
    const statusMatch = path.match(/\/health\/imaging\/([a-f0-9-]+)$/);
    if (statusMatch && method === 'GET') {
      const result = await getDocumentStatus(statusMatch[1]);
      return success(result);
    }

    return notFound(`Route not found: ${method} ${path}`);
  } catch (err) {
    if (err.statusCode) return badRequest(err.message);
    console.error('Medical Imaging error:', err);
    return error('Internal server error', 500, err.message);
  }
};
