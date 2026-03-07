/**
 * Local Express server for Feature 4 — Health Services.
 * Run from backend/: node local-server.js
 */
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

// Global Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`\n[API:REQUEST] ${req.method} ${req.url}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.log(`[API:ERROR] ${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
    } else {
      console.log(`[API:SUCCESS] ${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

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
      console.log(`\n[API:REQ_PAYLOAD] ${req.method} ${req.originalUrl} =>\n  Query: ${JSON.stringify(event.queryStringParameters)}\n  Body:  ${JSON.stringify(req.body)}`);
      const result = await handler.handler(event);
      const statusCode = result.statusCode || 200;
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      const resLog = JSON.stringify(body) || 'empty';
      console.log(`[API:RES_PAYLOAD] ${req.method} ${req.originalUrl} <= Status: ${statusCode}\n  Body:  ${resLog.substring(0, 1000)}${resLog.length > 1000 ? '...' : ''}`);
      res.status(statusCode).json(body);
    } catch (err) {
      console.error(`[API:ERR_PAYLOAD] ${req.method} ${req.originalUrl} <=`, err.message);
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Feature 3 (Health) running at http://localhost:${PORT}`);
  console.log(`   Routes: /health/*`);
});
