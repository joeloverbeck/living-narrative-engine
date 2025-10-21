/**
 * @file timeout-middleware-unknown-unit-limit.integration.test.js
 * @description Verifies that the timeout middleware's size limit configuration
 *              defends against exotic limits that omit units by clamping to the
 *              security maximum while interacting with the real Express JSON
 *              parser.
 */

import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createSizeLimitConfig } from '../../src/middleware/timeout.js';

const ELEVEN_MB = 11 * 1024 * 1024;

describe('timeout middleware size limit integration for unitless overrides', () => {
  it('coerces oversized custom limits without units to the security maximum', async () => {
    const config = createSizeLimitConfig({
      jsonLimit: '9999999999',
      enforceMaxLimit: true,
    });

    expect(config.json.limit).toBe('10mb');

    const app = express();
    app.use(express.json(config.json));

    app.post('/payload', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({
        message: err.message,
        type: err.type,
      });
    });

    const largePayload = 'x'.repeat(ELEVEN_MB);

    const response = await request(app)
      .post('/payload')
      .set('content-type', 'application/json')
      .send({ data: largePayload });

    expect(response.status).toBe(413);
    expect(response.body.message).toMatch(/too large/i);
    expect(response.body.type).toBe('entity.too.large');
  });
});
