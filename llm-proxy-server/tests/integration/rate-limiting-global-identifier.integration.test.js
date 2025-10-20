/**
 * @file rate-limiting-global-identifier.integration.test.js
 * @description Integration coverage focusing on the final fallback branch of
 *              generateRateLimitKey, ensuring the global identifier pathway
 *              executes when all client metadata is unavailable.
 */

import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmRateLimiter } from '../../src/middleware/rateLimiting.js';

/**
 * Removes IP metadata from the Express request instance as thoroughly as
 * possible without mutating the underlying framework internals.
 * @param {import('express').Request} req
 */
function stripClientIp(req) {
  try {
    Object.defineProperty(req, 'ip', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } catch {
    try {
      req.ip = undefined;
    } catch {
      // Ignore if Express keeps the property read-only.
    }
  }

  if (req.connection) {
    try {
      Object.defineProperty(req.connection, 'remoteAddress', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    } catch {
      try {
        req.connection.remoteAddress = undefined;
      } catch {
        // Ignore if the runtime prevents reassignment.
      }
    }
  }

  if (req.socket) {
    try {
      Object.defineProperty(req.socket, 'remoteAddress', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    } catch {
      try {
        req.socket.remoteAddress = undefined;
      } catch {
        // Ignore when socket metadata cannot be modified.
      }
    }
  }
}

describe('Rate limiting global identifier fallback integration', () => {
  it('derives a global:unknown key when API key, IP, and agent information are absent', async () => {
    const app = express();
    app.set('trust proxy', true);

    app.post(
      '/llm-global-fallback',
      (req, _res, next) => {
        delete req.headers['x-api-key'];
        delete req.headers['x-forwarded-for'];
        delete req.headers['x-real-ip'];
        delete req.headers['x-client-ip'];
        delete req.headers['forwarded'];
        delete req.headers['user-agent'];
        stripClientIp(req);
        next();
      },
      createLlmRateLimiter({ trustProxy: true, useApiKey: false }),
      (req, res) => {
        res.status(200).json({
          key: req.rateLimit?.key ?? null,
          remaining: req.rateLimit?.remaining ?? null,
        });
      }
    );

    const response = await request(app)
      .post('/llm-global-fallback')
      .set('User-Agent', '')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.key).toBe('global:unknown');
    expect(response.body.remaining).toBeGreaterThanOrEqual(0);
  });
});
