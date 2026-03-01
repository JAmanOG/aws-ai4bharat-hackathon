/**
 * Local Express server for Feature 4 — Health Services.
 * Run from backend/: node local-server.js
 */
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3004;

app.use(cors());
app.use(express.json());

const healthAiHandler = require('./lambdas/health-ai/index');
const imagingHandler = require('./lambdas/medical-imaging/index');
const directoryHandler = require('./lambdas/health-directory/index');

function toLambdaEvent(req) {
  return {
    httpMethod: req.method,
    path: req.originalUrl.split('?')[0],
    queryStringParameters: Object.keys(req.query).length ? req.query : null,
    headers: req.headers,
    body: req.body ? JSON.stringify(req.body) : null,
    requestContext: {
      authorizer: { claims: { sub: req.headers['x-user-id'] || 'demo-user' } },
      http: { method: req.method },
    },
  };
}

function lambdaRoute(handler) {
  return async (req, res) => {
    try {
      const event = toLambdaEvent(req);
      const result = await handler.handler(event);
      const statusCode = result.statusCode || 200;
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      res.status(statusCode).json(body);
    } catch (err) {
      console.error('Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  };
}

app.use('/health/symptom-check', lambdaRoute(healthAiHandler));
app.use('/health/articles', lambdaRoute(healthAiHandler));
app.use('/health/imaging', lambdaRoute(imagingHandler));
app.use('/health/govt-portals', lambdaRoute(directoryHandler));
app.use('/health/eligibility', lambdaRoute(directoryHandler));
app.use('/health/providers', lambdaRoute(directoryHandler));

app.listen(PORT, () => {
  console.log(`✅ Feature 4 (Health) running at http://localhost:${PORT}`);
  console.log(`   Routes: /health/*`);
});
