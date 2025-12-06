import { describe, it, expect } from '@jest/globals';
import { validationResult } from 'express-validator';
import { validateLlmRequest } from '../../../src/middleware/validation.js';

/**
 * Helper to run an express-validator middleware against a mock request.
 * Supports both synchronous and promise-returning middlewares.
 * @param {Function} middleware - Middleware under test
 * @param {object} req - Mock Express request
 * @param {object} res - Mock Express response
 * @returns {Promise<void>} Resolves when middleware completes
 */
const runMiddleware = async (middleware, req, res) => {
  await new Promise((resolve, reject) => {
    const maybePromise = middleware(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });

    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(resolve).catch(reject);
    }
  });
};

describe('validateLlmRequest header sanitization', () => {
  it('removes dangerous headers and normalizes allowed ones', async () => {
    const middlewares = validateLlmRequest();
    const req = {
      body: {
        llmId: 'test-llm',
        targetPayload: { prompt: 'Hello' },
        targetHeaders: {
          'X-Good_Header ': 'safe-value',
          __proto__: 'should-be-removed',
          'X-Bad\nName': 'bad-value',
          'X-Looooong-Header!!!!': 'a'.repeat(1_200),
          'X-Value-With-Newline': 'line1\nline2',
          'X Clean': 'needs cleaning',
          '': 'empty key',
          'X-OK-123': 42,
        },
      },
    };
    const res = {};

    for (const middleware of middlewares) {
      await runMiddleware(middleware, req, res);
    }

    const result = validationResult(req);
    expect(result.isEmpty()).toBe(true);

    const sanitizedHeaders = req.body.targetHeaders;
    expect(Object.getPrototypeOf(sanitizedHeaders)).toBeNull();
    expect(sanitizedHeaders).toEqual({
      'X-Good_Header': 'safe-value',
      'X-Looooong-Header': 'a'.repeat(1_000),
      XClean: 'needs cleaning',
      'X-OK-123': '42',
    });
  });

  it('sanitizes non-object targetHeaders to an empty object and reports validation error', async () => {
    const middlewares = validateLlmRequest();
    const req = {
      body: {
        llmId: 'another-llm',
        targetPayload: { foo: 'bar' },
        targetHeaders: 'not-an-object',
      },
    };
    const res = {};

    for (const middleware of middlewares) {
      await runMiddleware(middleware, req, res);
    }

    const result = validationResult(req);
    expect(result.isEmpty()).toBe(false);
    expect(result.array()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'targetHeaders',
          msg: 'targetHeaders must be an object if provided',
        }),
      ])
    );
    expect(req.body.targetHeaders).toEqual({});
  });
});
