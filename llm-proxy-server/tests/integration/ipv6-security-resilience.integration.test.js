/**
 * @file ipv6-security-resilience.integration.test.js
 * @description Integration tests that harden IPv6 utility coverage by simulating
 *              dependency failures and ensuring validation middleware continues
 *              to provide safe classifications when upstream helpers behave
 *              unexpectedly.
 */

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

/**
 * Builds a minimal Express app that surfaces IPv6 classifications so that
 * validation utilities can be exercised end-to-end.
 * @param {typeof import('../../src/utils/ipv6Utils.js')} ipv6Utils - Utility module under test.
 * @returns {import('express').Express}
 */
const buildIpv6App = (ipv6Utils) => {
  const app = express();
  app.use(express.json());

  app.post('/ipv6/resilience', (req, res) => {
    const candidates = Array.isArray(req.body?.ipv6Candidates)
      ? req.body.ipv6Candidates
      : [];

    const normalized = candidates.map((value) =>
      ipv6Utils.normalizeIPv6Address(value)
    );
    const classifications = ipv6Utils.validateMultipleIPv6Addresses(candidates);
    const summary = ipv6Utils.getIPv6ValidationSummary(classifications);

    return res.status(200).json({ normalized, classifications, summary });
  });

  return app;
};

describe('IPv6 validation resilience integration', () => {
  let ipaddrModule;
  let ipaddr;

  beforeEach(async () => {
    jest.resetModules();
    ipaddrModule = await import('ipaddr.js');
    ipaddr = ipaddrModule.default;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('classifies IPv6 addresses safely when ipaddr.js helpers throw or return unknown ranges', async () => {
    const originalIsValid = ipaddr.isValid;
    jest.spyOn(ipaddr, 'isValid').mockImplementation((input) => {
      if (input === 'trigger-error') {
        throw new Error('synthetic-validation-failure');
      }
      return originalIsValid(input);
    });

    const originalRange = ipaddr.IPv6.prototype.range;
    jest.spyOn(ipaddr.IPv6.prototype, 'range').mockImplementation(function (
      ...args
    ) {
      const normalized = this.toNormalizedString();
      if (normalized === '2001:db8:ffff:0:0:0:0:1') {
        return 'mysteryRange';
      }
      return originalRange.apply(this, args);
    });

    const originalToIpv4 = ipaddr.IPv6.prototype.toIPv4Address;
    jest
      .spyOn(ipaddr.IPv6.prototype, 'toIPv4Address')
      .mockImplementation(function (...args) {
        const normalized = this.toNormalizedString();
        if (normalized === '0:0:0:0:0:ffff:808:404') {
          throw new Error('unable to derive ipv4 mapping');
        }
        return originalToIpv4.apply(this, args);
      });

    const ipv6Utils = await import('../../src/utils/ipv6Utils.js');
    const app = buildIpv6App(ipv6Utils);
    const agent = request(app);

    const response = await agent
      .post('/ipv6/resilience')
      .set('content-type', 'application/json')
      .send({
        ipv6Candidates: ['::ffff:8.8.4.4', '2001:db8:ffff::1', 'trigger-error'],
      });

    expect(response.status).toBe(200);

    const { normalized, classifications, summary } = response.body;

    expect(normalized).toEqual(['::ffff:808:404', '2001:db8:ffff::1', null]);

    const mappedClassification = classifications[0];
    expect(mappedClassification.isValid).toBe(true);
    expect(mappedClassification.isReserved).toBe(true);
    expect(mappedClassification.type).toBe('reserved');
    expect(mappedClassification.range).toContain('IPv4-mapped');

    const mysteryClassification = classifications[1];
    expect(mysteryClassification.isValid).toBe(true);
    expect(mysteryClassification.isReserved).toBe(true);
    expect(mysteryClassification.type).toBe('reserved');
    expect(mysteryClassification.range).toBe('mysteryRange');

    const failedClassification = classifications[2];
    expect(failedClassification.isValid).toBe(false);
    expect(failedClassification.details.reason).toContain(
      'synthetic-validation-failure'
    );

    expect(summary.total).toBe(3);
    expect(summary.reserved).toBe(2);
    expect(summary.invalid).toBe(1);
  });
});
