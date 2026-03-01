/**
 * Local Express server for Feature 1 — Community, Government, Voice Rooms.
 * Run from backend/: node local-server.js
 */
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const communityHandler = require('./lambdas/community/index');
const governmentHandler = require('./lambdas/government/index');
const voiceRoomHandler = require('./lambdas/voice-room/index');

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

// Use app.use() for prefix matching (Express v5 compatible)
app.use('/posts', lambdaRoute(communityHandler));
app.use('/bookmarks', lambdaRoute(communityHandler));
app.use('/follow', lambdaRoute(communityHandler));
app.use('/following', lambdaRoute(communityHandler));
app.use('/government', lambdaRoute(governmentHandler));
app.use('/voice-rooms', lambdaRoute(voiceRoomHandler));

app.listen(PORT, () => {
  console.log(`✅ Feature 1 (Community) running at http://localhost:${PORT}`);
  console.log(`   Routes: /posts, /bookmarks, /government/*, /voice-rooms/*`);
});
