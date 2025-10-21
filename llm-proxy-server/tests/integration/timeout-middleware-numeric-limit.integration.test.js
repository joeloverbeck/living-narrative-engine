/**
 * @file timeout-middleware-numeric-limit.integration.test.js
 * @description Validates that the timeout utility correctly interprets numeric size limits
 *              without explicit units by wiring the generated configuration into an Express
 *              JSON parser and exercising both success and overflow scenarios.
 */

import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createSizeLimitConfig } from '../../src/middleware/timeout.js';

describe('Timeout middleware numeric size limit integration', () => {
  it('accepts requests under the numeric limit and rejects larger payloads', async () => {
    const app = express();
    const { json: jsonOptions } = createSizeLimitConfig({
      jsonLimit: '512',
      enforceMaxLimit: true,
    });

    app.use(express.json(jsonOptions));

    app.post('/limited', (req, res) => {
      res.json({ received: req.body.message.length });
    });

    const smallPayload = { message: 'a'.repeat(200) };
    const largePayload = { message: 'b'.repeat(600) };

    await request(app).post('/limited').send(smallPayload).expect(200, {
      received: smallPayload.message.length,
    });

    const overflowResponse = await request(app)
      .post('/limited')
      .send(largePayload);

    expect(overflowResponse.status).toBe(413);
    expect(overflowResponse.body).toEqual({});
  });
});
