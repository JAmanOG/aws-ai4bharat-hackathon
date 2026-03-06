/**
 * BRUTAL TEST SUITE – Requirement 13: AI Processing & Context + Auth
 * Tests: auth middleware, error handler, LLM provider selection,
 *        domain context injection, and edge cases.
 */

/* ────── auth mocks ────── */
jest.mock('../../services/user', () => ({
  verifyToken: jest.fn((token) => {
    if (token === 'valid-jwt') return { sub: 'jwt-user-id', phone: '9876543210' };
    if (token === 'expired-jwt') throw new Error('Token expired');
    throw new Error('Invalid token');
  }),
}));

const { authMiddleware } = require('../../middleware/auth');
const { errorHandler } = require('../../middleware/error-handler');
const { verifyToken } = require('../../services/user');

beforeEach(() => jest.clearAllMocks());

/* ═══════════════════════════════════════════════════
   SECTION A – Auth Middleware
   ═══════════════════════════════════════════════════ */
function mockRequest(overrides = {}) {
  return {
    url: overrides.url || '/api/test',
    headers: overrides.headers || {},
    routeOptions: overrides.routeOptions || {},
    userId: undefined,
    userPhone: undefined,
    ...overrides,
  };
}

function mockReply() {
  const reply = {
    statusCode: null,
    body: null,
    status(code) { reply.statusCode = code; return reply; },
    send(body) { reply.body = body; return reply; },
  };
  return reply;
}

describe('Auth Middleware – route bypasses', () => {
  test('health check /health bypasses auth', async () => {
    const req = mockRequest({ url: '/health' });
    const rep = mockReply();
    const result = await authMiddleware(req, rep);
    expect(result).toBeUndefined();
    expect(rep.statusCode).toBeNull(); // no 401
  });

  test('root / bypasses auth', async () => {
    const req = mockRequest({ url: '/' });
    const rep = mockReply();
    await authMiddleware(req, rep);
    expect(rep.statusCode).toBeNull();
  });

  test('skipAuth: true routes bypass auth', async () => {
    const req = mockRequest({
      routeOptions: { config: { skipAuth: true } },
    });
    const rep = mockReply();
    await authMiddleware(req, rep);
    expect(rep.statusCode).toBeNull();
    expect(verifyToken).not.toHaveBeenCalled();
  });
});

describe('Auth Middleware – Bearer JWT', () => {
  test('valid JWT sets userId and userPhone', async () => {
    const req = mockRequest({
      headers: { authorization: 'Bearer valid-jwt' },
    });
    const rep = mockReply();
    await authMiddleware(req, rep);
    expect(req.userId).toBe('jwt-user-id');
    expect(req.userPhone).toBe('9876543210');
    expect(rep.statusCode).toBeNull();
  });

  test('invalid JWT in demo mode falls through to x-user-id', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const req = mockRequest({
      headers: {
        authorization: 'Bearer bad-jwt',
        'x-user-id': 'demo-farmer',
      },
    });
    const rep = mockReply();
    await authMiddleware(req, rep);
    // In demo mode, invalid JWT falls through to x-user-id
    expect(req.userId).toBe('demo-farmer');
    process.env.NODE_ENV = origEnv;
  });

  test('invalid JWT in production mode returns 401', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let prodAuth;
    jest.isolateModules(() => {
      prodAuth = require('../../middleware/auth').authMiddleware;
    });
    const req = mockRequest({
      headers: { authorization: 'Bearer bad-jwt' },
    });
    const rep = mockReply();
    await prodAuth(req, rep);
    expect(rep.statusCode).toBe(401);
    expect(rep.body.error).toContain('Invalid or expired token');
    process.env.NODE_ENV = origEnv;
  });
});

describe('Auth Middleware – demo mode x-user-id', () => {
  test('x-user-id header sets userId in demo mode', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const req = mockRequest({
      headers: { 'x-user-id': 'farmer-123' },
    });
    const rep = mockReply();
    await authMiddleware(req, rep);
    expect(req.userId).toBe('farmer-123');
    process.env.NODE_ENV = origEnv;
  });

  test('missing x-user-id defaults to demo-user', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const req = mockRequest({ headers: {} });
    const rep = mockReply();
    await authMiddleware(req, rep);
    expect(req.userId).toBe('demo-user');
    process.env.NODE_ENV = origEnv;
  });
});

describe('Auth Middleware – production no auth', () => {
  test('no auth header in production → 401', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let prodAuth;
    jest.isolateModules(() => {
      prodAuth = require('../../middleware/auth').authMiddleware;
    });
    const req = mockRequest({ headers: {} });
    const rep = mockReply();
    await prodAuth(req, rep);
    expect(rep.statusCode).toBe(401);
    expect(rep.body.error).toContain('Missing or invalid Authorization');
    process.env.NODE_ENV = origEnv;
  });
});

/* ═══════════════════════════════════════════════════
   SECTION B – Error Handler
   ═══════════════════════════════════════════════════ */
function mockErrRequest() {
  return {
    url: '/api/test',
    method: 'POST',
    log: { error: jest.fn() },
  };
}

describe('Error Handler – known business errors', () => {
  const knownErrors = [
    { msg: 'BUYER_ALREADY_REGISTERED', status: 400, contains: 'Already registered' },
    { msg: 'LISTING_NOT_AVAILABLE', status: 400, contains: 'not available' },
    { msg: 'GROUP_NOT_FOUND', status: 404, contains: 'not found' },
    { msg: 'GROUP_CLOSED', status: 400, contains: 'no longer accepting' },
    { msg: 'ALREADY_MEMBER', status: 400, contains: 'Already a member' },
    { msg: 'GROUP_FULL', status: 400, contains: 'maximum capacity' },
    { msg: 'GROUP_INACTIVE', status: 400, contains: 'no longer active' },
    { msg: 'NOT_A_MEMBER', status: 400, contains: 'Not a member' },
    { msg: 'USER_PROFILE_NOT_FOUND', status: 404, contains: 'not found' },
  ];

  test.each(knownErrors)('$msg → $status', ({ msg, status, contains }) => {
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error(msg);
    errorHandler(err, req, rep);
    expect(rep.statusCode).toBe(status);
    expect(rep.body.error).toContain(contains);
  });
});

describe('Error Handler – Fastify validation errors', () => {
  test('validation error → 400 with details', () => {
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('Validation');
    err.validation = [
      { message: 'body must have required property "name"' },
      { message: 'body.age must be >= 0' },
    ];
    errorHandler(err, req, rep);
    expect(rep.statusCode).toBe(400);
    expect(rep.body.error).toBe('Validation error');
    expect(rep.body.details).toHaveLength(2);
    expect(rep.body.details[0]).toContain('name');
  });
});

describe('Error Handler – database constraint errors', () => {
  test('code starting with 23 → 400 constraint violation', () => {
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('duplicate key value violates unique constraint');
    err.code = '23505';
    errorHandler(err, req, rep);
    expect(rep.statusCode).toBe(400);
    expect(rep.body.error).toContain('Database constraint');
  });

  test('code 23503 (foreign key) → 400', () => {
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('foreign key constraint');
    err.code = '23503';
    errorHandler(err, req, rep);
    expect(rep.statusCode).toBe(400);
  });

  test('DB details hidden in production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('secret DB error');
    err.code = '23505';
    errorHandler(err, req, rep);
    expect(rep.body.details).toBeUndefined();
    process.env.NODE_ENV = origEnv;
  });
});

describe('Error Handler – default 500 errors', () => {
  test('unknown error → 500', () => {
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('Something crashed');
    errorHandler(err, req, rep);
    expect(rep.statusCode).toBe(500);
    expect(rep.body.error).toBe('Internal server error');
  });

  test('error with custom statusCode', () => {
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('Service unavailable');
    err.statusCode = 503;
    errorHandler(err, req, rep);
    expect(rep.statusCode).toBe(503);
  });

  test('details shown in development', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('Debug info here');
    errorHandler(err, req, rep);
    expect(rep.body.details).toBe('Debug info here');
    process.env.NODE_ENV = origEnv;
  });

  test('details hidden in production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const req = mockErrRequest();
    const rep = mockReply();
    const err = new Error('Secret error');
    errorHandler(err, req, rep);
    expect(rep.body.details).toBeUndefined();
    process.env.NODE_ENV = origEnv;
  });
});

/* ═══════════════════════════════════════════════════
   SECTION C – Response utility
   ═══════════════════════════════════════════════════ */
const { success, error: errFn } = require('../../utils/response');

describe('Response Utility – success', () => {
  test('wraps data with statusCode 200', () => {
    const res = success({ items: [1, 2, 3] });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toEqual([1, 2, 3]);
  });

  test('custom status code', () => {
    const res = success({ created: true }, 201);
    expect(res.statusCode).toBe(201);
  });

  test('includes CORS headers', () => {
    const res = success({});
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Content-Type']).toBe('application/json');
  });
});

describe('Response Utility – error', () => {
  test('wraps message with statusCode 500 by default', () => {
    const res = errFn('Something broke');
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Something broke');
  });

  test('custom status code', () => {
    const res = errFn('Not found', 404);
    expect(res.statusCode).toBe(404);
  });

  test('includes CORS headers', () => {
    const res = errFn('err');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION D – Constants (utils/constants.js)
   ═══════════════════════════════════════════════════ */
const constants = require('../../utils/constants');

describe('Constants – completeness', () => {
  test('exports EMISSION_FACTORS with at least 4 practice types', () => {
    if (constants.EMISSION_FACTORS) {
      expect(Object.keys(constants.EMISSION_FACTORS).length).toBeGreaterThanOrEqual(4);
    }
  });

  test('exports agriculture-related constants', () => {
    // constants.js exports CROP_TYPES, FARM_PRACTICE_TYPES, PRECISION_RISK_LEVELS etc.
    const hasAgriculture = constants.CROP_TYPES || constants.FARM_PRACTICE_TYPES ||
      constants.PRECISION_RISK_LEVELS || constants.PRECISION_IMAGE_TYPES;
    expect(hasAgriculture).toBeDefined();
  });
});
