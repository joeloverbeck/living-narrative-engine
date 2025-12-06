/**
 * @file validation-extended-coverage.integration.test.js
 * @description Integration tests extending coverage for validation middleware edge cases
 *              including non-string header sanitisation and IPv4 safety guards.
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  handleValidationErrors,
  isUrlSafe,
  validateRequestHeaders,
} from '../../src/middleware/validation.js';

/**
 * Builds an Express app that exposes routes exercising validation middleware edge cases.
 * @returns {import('express').Express}
 */
const buildApp = () => {
  const app = express();

  app.post(
    '/headers/sanitiser',
    (
      /** @type {import('express').Request} */ req,
      /** @type {import('express').Response} */ _res,
      /** @type {import('express').NextFunction} */ next
    ) => {
      req.headers['content-type'] =
        req.headers['content-type'] || 'application/json';
      req.headers['x-array-header'] = ['value-one', 'value-two'];
      req.headers['x-object-header'] = { enabled: true };
      next();
    },
    express.json(),
    ...validateRequestHeaders(),
    handleValidationErrors,
    (req, res) => {
      res.status(200).json({
        arrayHeader: req.headers['x-array-header'],
        objectHeader: req.headers['x-object-header'],
      });
    }
  );

  app.post(
    '/urls/safety-check',
    express.json({ limit: '2mb' }),
    ...validateRequestHeaders(),
    handleValidationErrors,
    (req, res) => {
      const { urls = [] } = req.body || {};
      res.status(200).json({
        results: urls.map((value) => ({ value, safe: isUrlSafe(value) })),
      });
    }
  );

  return app;
};

describe('Validation middleware extended integration coverage', () => {
  /** @type {import('express').Express} */
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  test('preserves non-string header values when sanitising request headers', async () => {
    const response = await request(app)
      .post('/headers/sanitiser')
      .set('Content-Type', 'application/json')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.arrayHeader).toEqual(['value-one', 'value-two']);
    expect(response.body.objectHeader).toEqual({ enabled: true });
  });

  test('identifies additional IPv4 unsafe targets beyond direct blacklist matches', async () => {
    const urls = [
      'https://256.1.1.1',
      'https://127.4.5.6',
      'https://0.10.20.30',
      'https://203.0.113.5',
    ];

    const response = await request(app)
      .post('/urls/safety-check')
      .set('Content-Type', 'application/json')
      .send({ urls });

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([
      { value: 'https://256.1.1.1', safe: false },
      { value: 'https://127.4.5.6', safe: false },
      { value: 'https://0.10.20.30', safe: false },
      { value: 'https://203.0.113.5', safe: true },
    ]);
  });
});
