import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

const ORIGINAL_ENV = { ...process.env };

const overrideRequestIdentity = (req) => {
  delete req.headers['x-forwarded-for'];
  delete req.headers['x-real-ip'];
  delete req.headers['x-client-ip'];
  delete req.headers['x-forwarded'];
  delete req.headers['forwarded'];
  delete req.headers['forwarded-for'];
  delete req.headers['user-agent'];

  Reflect.deleteProperty(req, 'connection');
  Object.defineProperty(req, 'connection', {
    configurable: true,
    value: { remoteAddress: undefined },
  });

  Reflect.deleteProperty(req, 'socket');
  Object.defineProperty(req, 'socket', {
    configurable: true,
    value: { remoteAddress: undefined },
  });

  Reflect.deleteProperty(req, 'ip');
  Object.defineProperty(req, 'ip', {
    configurable: true,
    get() {
      return undefined;
    },
  });

  Reflect.deleteProperty(req, 'ips');
  Object.defineProperty(req, 'ips', {
    configurable: true,
    get() {
      return [];
    },
  });
};

describe('rate limiting proxy fallbacks integration coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const buildApp = async (identityMiddleware) => {
    const { createApiRateLimiter } = await import(
      '../../src/middleware/rateLimiting.js'
    );

    const app = express();
    app.get(
      '/identity-check',
      identityMiddleware,
      createApiRateLimiter({ trustProxy: true }),
      (req, res) => {
        const key = req.rateLimit?.key;
        res.status(200).json({
          key,
          clientType: key ? key.split(':')[0] : 'unknown',
        });
      }
    );

    return app;
  };

  it('ignores private x-forwarded-for addresses and trusts alternative proxy headers', async () => {
    const app = await buildApp((req, _res, next) => {
      req.headers['x-forwarded-for'] = '192.168.0.25';
      req.headers['x-real-ip'] = '198.51.100.45';
      req.headers['x-client-ip'] = '198.51.100.60';
      req.headers['forwarded'] = 'for=192.168.0.25';

      Reflect.deleteProperty(req, 'connection');
      Object.defineProperty(req, 'connection', {
        configurable: true,
        value: { remoteAddress: '10.0.0.3' },
      });

      Reflect.deleteProperty(req, 'socket');
      Object.defineProperty(req, 'socket', {
        configurable: true,
        value: { remoteAddress: '10.0.0.3' },
      });

      Reflect.deleteProperty(req, 'ip');
      Object.defineProperty(req, 'ip', {
        configurable: true,
        get() {
          return '10.0.0.3';
        },
      });

      next();
    });

    const response = await request(app)
      .get('/identity-check')
      .set('X-Forwarded-For', '192.168.0.25')
      .set('X-Real-IP', '198.51.100.45')
      .set('X-Client-IP', '198.51.100.60')
      .set('Forwarded', 'for=192.168.0.25');

    expect(response.status).toBe(200);
    expect(response.body.key).toBe('ip:198.51.100.45');
    expect(response.body.clientType).toBe('ip');
  });

  it('falls back to global identity when proxy metadata is unavailable', async () => {
    const app = await buildApp((req, _res, next) => {
      overrideRequestIdentity(req);
      next();
    });

    const response = await request(app)
      .get('/identity-check')
      .unset('User-Agent');

    expect(response.status).toBe(200);
    expect(response.body.key).toBe('global:unknown');
    expect(response.body.clientType).toBe('global');
  });
});
