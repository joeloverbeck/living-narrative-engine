import { beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { isUrlSafe } from '../../src/middleware/validation.js';

/**
 * @file validation-ipv4-octet-guards.integration.test.js
 * @description Ensures the URL safety validator rejects IPv4 addresses that
 *              contain octets outside the allowed range while still allowing
 *              legitimate public addresses through an Express integration
 *              endpoint.
 */
describe('Validation middleware IPv4 octet guard integration', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    app.post('/diagnostics/url-safety', (req, res) => {
      const { urls } = req.body || {};

      const results = Array.isArray(urls)
        ? urls.map((value) => ({ value, safe: isUrlSafe(value) }))
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
  });

  it('flags IPv4 addresses with out-of-range octets while accepting legitimate hosts', async () => {
    const payload = {
      urls: [
        'https://1.2.3.256',
        'https://999.20.30.40',
        'https://1.2.3.4',
        'https://93.184.216.34',
      ],
    };

    const response = await request(app)
      .post('/diagnostics/url-safety')
      .send(payload)
      .expect(200);

    expect(response.body).toHaveProperty('results');

    const resultMap = new Map(
      response.body.results.map((entry) => [entry.value, entry.safe])
    );

    expect(resultMap.get('https://1.2.3.256')).toBe(false);
    expect(resultMap.get('https://999.20.30.40')).toBe(false);
    expect(resultMap.get('https://1.2.3.4')).toBe(true);
    expect(resultMap.get('https://93.184.216.34')).toBe(true);

    expect(response.body.summary).toEqual({ total: 4, unsafe: 2, safe: 2 });
  });
});
