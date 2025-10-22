import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createTimeoutMiddleware } from '../../src/middleware/timeout.js';

/**
 * @file timeout-middleware-missing-commit.integration.test.js
 * @description Validates timeout middleware behavior when the request tracking
 *              helpers that normally guard duplicate responses are absent.
 */

describe('timeout middleware missing commit integration coverage', () => {
  let logger;
  let app;

  beforeEach(() => {
    jest.useRealTimers();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    app = express();

    app.post(
      '/timeout-no-commit-helpers',
      createTimeoutMiddleware(30, { logger }),
      (_req, _res) => {
        // Intentionally left blank to simulate a stalled handler; the timeout
        // middleware must perform the response without assistance from
        // request-tracking helpers such as commitResponse.
      }
    );
  });

  it('sends timeout responses even when commitResponse is undefined', async () => {
    const response = await request(app)
      .post('/timeout-no-commit-helpers')
      .send({});

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: true,
      stage: 'request_timeout',
      details: expect.objectContaining({ timeoutMs: 30 }),
    });

    const warnMessages = logger.warn.mock.calls.map((call) => call[0]);

    expect(
      warnMessages.some((message) => message.includes('Timeout fired after'))
    ).toBe(true);
    expect(
      warnMessages.some((message) => message.includes('Timeout response sent'))
    ).toBe(true);
    expect(
      warnMessages.some((message) =>
        message.includes('Timeout cannot commit response')
      )
    ).toBe(false);
  });
});
