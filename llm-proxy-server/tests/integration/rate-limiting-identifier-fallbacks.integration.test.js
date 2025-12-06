import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

let createLlmRateLimiter;

const stripRemoteAddress = (req) => {
  if (req.connection && 'remoteAddress' in req.connection) {
    try {
      req.connection.remoteAddress = undefined;
    } catch {
      Object.defineProperty(req.connection, 'remoteAddress', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      req.connection.remoteAddress = undefined;
    }
  }

  if (req.socket && 'remoteAddress' in req.socket) {
    try {
      req.socket.remoteAddress = undefined;
    } catch {
      Object.defineProperty(req.socket, 'remoteAddress', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      req.socket.remoteAddress = undefined;
    }
  }
};

const stripClientIp = (req) => {
  try {
    Object.defineProperty(req, 'ip', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } catch {
    // If property cannot be redefined, fall back to assignment attempt
    try {
      req.ip = undefined;
    } catch {
      // Ignore if Express keeps getter-only property
    }
  }

  stripRemoteAddress(req);
};

describe('rate limiting identifier fallback integration', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    ({ createLlmRateLimiter } = await import(
      '../../src/middleware/rateLimiting.js'
    ));
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  let app;

  beforeEach(() => {
    app = express();
  });

  const exhaustLimiter = async (route) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const okResponse = await request(app).post(route).send({});
      expect(okResponse.status).toBe(200);
    }
  };

  it('uses user-agent hashing when IP metadata is unavailable', async () => {
    app.post(
      '/llm-ua-fallback',
      (req, _res, next) => {
        delete req.headers['x-forwarded-for'];
        delete req.headers['x-real-ip'];
        delete req.headers['x-client-ip'];
        delete req.headers['forwarded'];
        req.headers = {
          ...req.headers,
          'user-agent': 'integration-fallback-agent/1.0',
        };
        stripClientIp(req);
        next();
      },
      createLlmRateLimiter({ trustProxy: true, useApiKey: false }),
      (_req, res) => {
        res.status(200).json({ handled: true });
      }
    );

    await exhaustLimiter('/llm-ua-fallback');

    const limitedResponse = await request(app)
      .post('/llm-ua-fallback')
      .send({});

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body.error.details.clientType).toBe('ua');
    expect(limitedResponse.body.error.details.rateLimitType).toBe('llm');
  });

  it('identifies clients via API key when available even without IP data', async () => {
    const apiKeyValue = 'integration-secret-key';

    app.post(
      '/llm-api-key',
      (req, _res, next) => {
        req.headers = {
          ...req.headers,
          'x-api-key': apiKeyValue,
          'user-agent': 'integration-client',
        };
        delete req.headers['x-forwarded-for'];
        delete req.headers['x-real-ip'];
        stripClientIp(req);
        next();
      },
      createLlmRateLimiter({ trustProxy: true, useApiKey: true }),
      (_req, res) => {
        res.status(200).json({ handled: true });
      }
    );

    await exhaustLimiter('/llm-api-key');

    const limitedResponse = await request(app).post('/llm-api-key').send({});

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body.error.details.clientType).toBe('api');
    expect(limitedResponse.body.error.details.rateLimitType).toBe('llm');
  });

  it('falls back to global identifier when no metadata is available', async () => {
    app.post(
      '/llm-global',
      (req, _res, next) => {
        delete req.headers['x-api-key'];
        delete req.headers['x-forwarded-for'];
        delete req.headers['x-real-ip'];
        delete req.headers['user-agent'];
        stripClientIp(req);
        next();
      },
      createLlmRateLimiter({ trustProxy: true, useApiKey: false }),
      (_req, res) => {
        res.status(200).json({ handled: true });
      }
    );

    await exhaustLimiter('/llm-global');

    const limitedResponse = await request(app).post('/llm-global').send({});

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body.error.details.clientType).toBe('global');
    expect(limitedResponse.body.error.details.rateLimitType).toBe('llm');
  });
});
