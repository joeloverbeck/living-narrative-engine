/**
 * @file validation-ipv4-octet-overflow.integration.test.js
 * @description Integration test that simulates permissive URL parsing to ensure
 * the IPv4 octet overflow guard inside the validation middleware cannot be bypassed.
 */

import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { isUrlSafe } from '../../src/middleware/validation.js';

/**
 * Evaluates a URL using isUrlSafe while temporarily swapping in a permissive URL
 * parser when the trigger value is encountered. This mirrors an environment where
 * a custom runtime URL implementation might allow octet overflow.
 *
 * @param {string} value - URL to evaluate
 * @returns {boolean} Whether the URL is considered safe
 */
const evaluateUrlSafety = (value) => {
  if (value !== 'https://trigger.invalid-octet') {
    return isUrlSafe(value);
  }

  const OriginalURL = global.URL;

  class PermissiveURL {
    /**
     * @param {string} input - URL input
     */
    constructor(input) {
      this.href = input;
      this.protocol = 'https:';
      this.hostname = '256.1.1.1';
    }
  }

  try {
    global.URL = PermissiveURL;
    return isUrlSafe(value);
  } finally {
    global.URL = OriginalURL;
  }
};

/**
 * Builds an express application exposing a diagnostics endpoint that runs the
 * isUrlSafe validator against every URL supplied by the caller.
 *
 * @returns {import('express').Express} configured express app
 */
const buildApp = () => {
  const app = express();
  app.use(express.json());

  app.post('/diagnostics/url-safety/permissive', (req, res) => {
    const { urls } = req.body || {};

    const results = Array.isArray(urls)
      ? urls.map((value) => ({ value, safe: evaluateUrlSafety(value) }))
      : [];

    res.status(200).json({
      results,
      summary: {
        total: results.length,
        unsafe: results.filter((entry) => !entry.safe).length,
        safe: results.filter((entry) => entry.safe).length,
      },
    });
  });

  return app;
};

describe('Validation middleware IPv4 octet overflow integration', () => {
  it('rejects IPv4 addresses whose octets overflow after permissive URL parsing', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/diagnostics/url-safety/permissive')
      .send({
        urls: ['https://trigger.invalid-octet', 'https://api.example.com'],
      })
      .expect(200);

    const resultMap = new Map(
      response.body.results.map((entry) => [entry.value, entry.safe])
    );

    expect(resultMap.get('https://trigger.invalid-octet')).toBe(false);
    expect(resultMap.get('https://api.example.com')).toBe(true);
    expect(response.body.summary).toEqual({ total: 2, unsafe: 1, safe: 1 });
  });
});
