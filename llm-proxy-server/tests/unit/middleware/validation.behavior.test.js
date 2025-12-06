/**
 * @file Behavioral tests for validation middleware
 * @description Executes express-validator chains to ensure sanitizers and validators run end-to-end
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
  validateDebugLogRequest,
  isUrlSafe,
} from '../../../src/middleware/validation.js';
import { validationResult } from 'express-validator';

const runValidators = async (validators, req) => {
  for (const validator of validators) {
    if (typeof validator === 'function') {
      await validator.run?.(req);
    }
  }
};

describe('Validation middleware behavior', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { body: {}, headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('validateLlmRequest', () => {
    it('sanitizes dangerous target headers and preserves safe ones', async () => {
      const validators = validateLlmRequest();
      req.body = {
        llmId: 'openai-gpt4',
        targetPayload: { prompt: 'Hello' },
        targetHeaders: {
          __proto__: 'bad',
          'X-Safe-Header': 'value',
          'Bad\r\nHeader': 'ignored',
          'Set-Cookie': 'session',
          'Long-Header': 'x'.repeat(1200),
        },
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      const sanitized = req.body.targetHeaders;
      expect(Object.keys(sanitized)).toContain('X-Safe-Header');
      expect(Object.keys(sanitized)).toContain('Set-Cookie');
      expect(Object.keys(sanitized)).not.toContain('__proto__');
      expect(Object.keys(sanitized)).not.toContain('Bad\r\nHeader');
      expect(sanitized['Long-Header']).toHaveLength(1000);
    });

    it('removes headers with dangerous characters', async () => {
      const validators = validateLlmRequest();
      const request = {
        body: {
          llmId: 'test',
          targetPayload: { prompt: 'hi' },
          targetHeaders: { 'bad\nheader': 'value' },
        },
      };

      for (const validator of validators) {
        await validator.run(request);
      }

      expect(request.body.targetHeaders).toEqual({});
    });

    it('skips headers that resolve to dangerous prototype keys', async () => {
      const validators = validateLlmRequest();
      const request = {
        body: {
          llmId: 'test',
          targetPayload: { prompt: 'hi' },
          targetHeaders: { prototype: 'value', constructor: 'value' },
        },
      };

      for (const validator of validators) {
        await validator.run(request);
      }

      expect(request.body.targetHeaders).toEqual({});
    });

    it('returns empty headers when non-object input is provided', async () => {
      const validators = validateLlmRequest();
      req.body = {
        llmId: 'model',
        targetPayload: { foo: 'bar' },
        targetHeaders: 'not-an-object',
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      expect(req.body.targetHeaders).toEqual({});
      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('rejects unexpected fields in request body', async () => {
      const validators = validateLlmRequest();
      req.body = {
        llmId: 'valid-model',
        targetPayload: { foo: 'bar' },
        extraField: true,
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain('Unexpected fields');
    });
  });

  describe('handleValidationErrors integration', () => {
    it('returns structured error when validation fails', async () => {
      const validators = validateLlmRequest();
      req.body = { targetPayload: {} }; // missing llmId

      for (const validator of validators) {
        await validator.run(req);
      }

      handleValidationErrors(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          stage: 'request_validation',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('delegates to next when validation succeeds', async () => {
      const validators = validateLlmRequest();
      req.body = {
        llmId: 'model-1',
        targetPayload: { message: 'hello' },
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      handleValidationErrors(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateRequestHeaders', () => {
    it('enforces application/json content type and sanitizes header values', async () => {
      const validators = validateRequestHeaders();
      req.headers = {
        'content-type': 'application/json; charset=utf-8',
        'x-custom-header': 'value\r\nmalicious',
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
      expect(req.headers['x-custom-header']).toBe('valuemalicious');
    });

    it('reports error when content type is missing', async () => {
      const validators = validateRequestHeaders();
      req.headers = { 'x-custom-header': 'value' };

      for (const validator of validators) {
        await validator.run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain(
        'Content-Type header is required'
      );
    });
  });

  describe('validateDebugLogRequest', () => {
    it('accepts well-formed log payloads', async () => {
      const validators = validateDebugLogRequest();
      req.body = {
        logs: [
          {
            level: 'info',
            message: 'processed',
            timestamp: new Date().toISOString(),
            category: 'system',
            source: 'unit-test',
            metadata: { id: 1 },
          },
        ],
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('rejects payloads with oversized metadata', async () => {
      const validators = validateDebugLogRequest();
      req.body = {
        logs: [
          {
            level: 'debug',
            message: 'too large metadata',
            timestamp: new Date().toISOString(),
            metadata: { blob: 'x'.repeat(60000) },
          },
        ],
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain('metadata object is too large');
    });

    it('validates minimum and maximum log array sizes', async () => {
      const validators = validateDebugLogRequest();
      const emptyRequest = { body: { logs: [] } };

      for (const validator of validators) {
        await validator.run(emptyRequest);
      }

      let errors = validationResult(emptyRequest);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain('logs array cannot be empty');

      const oversizedRequest = {
        body: {
          logs: Array.from({ length: 5001 }, (_, index) => ({
            level: 'info',
            message: `entry-${index}`,
            timestamp: new Date().toISOString(),
          })),
        },
      };

      for (const validator of validators) {
        await validator.run(oversizedRequest);
      }

      errors = validationResult(oversizedRequest);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain(
        'logs array cannot contain more than 5000 entries'
      );
    });

    it('flags unexpected root fields in debug log payloads', async () => {
      const validators = validateDebugLogRequest();
      req.body = {
        logs: [
          {
            level: 'info',
            message: 'ok',
            timestamp: new Date().toISOString(),
          },
        ],
        extra: true,
      };

      for (const validator of validators) {
        await validator.run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toContain(
        'Unexpected fields in request body'
      );
    });
  });

  describe('isUrlSafe additional coverage', () => {
    it('rejects when IPv6 hostname resolves to unsafe address', () => {
      expect(isUrlSafe('https://[::ffff:192.168.0.1]')).toBe(false);
      expect(isUrlSafe('https://[::ffff:10.0.0.5]')).toBe(false);
    });

    it('accepts safe https URLs with ports and paths', () => {
      expect(isUrlSafe('https://example.com:9443/api')).toBe(true);
    });
  });
});
