import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let isIPv6Hostname;
let extractIPv6FromHostname;
let normalizeIPv6Address;
let validateMultipleIPv6Addresses;
let getIPv6ValidationSummary;
let isIPv6AddressSafeForSSRF;
let isValidPublicIPv6;

const buildEdgeCaseApp = () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ipv6/edge-cases', (req, res) => {
    const { hostCandidate, extractionTarget, normalizationTarget, addresses } =
      req.body;

    const hostIsIPv6 = isIPv6Hostname(hostCandidate);
    const extractedAddress = extractIPv6FromHostname(extractionTarget);
    const normalizedFromInvalid = normalizeIPv6Address(extractionTarget);
    const normalizedFromValid = normalizeIPv6Address(normalizationTarget);

    const addressesToValidate = Array.isArray(addresses) ? addresses : [];
    const classifications = validateMultipleIPv6Addresses(addressesToValidate);
    const summary = getIPv6ValidationSummary(classifications);
    const invalidSummary = getIPv6ValidationSummary('not-an-array');
    const emptyFallback = validateMultipleIPv6Addresses('not-an-array');

    const safetyMatrix = addressesToValidate.map((address) => ({
      address,
      safeForSsrF: isIPv6AddressSafeForSSRF(address),
      public: isValidPublicIPv6(address),
    }));

    res.json({
      hostIsIPv6,
      extractedAddress,
      normalizedFromInvalid,
      normalizedFromValid,
      classifications,
      summary,
      invalidSummary,
      emptyFallbackLength: emptyFallback.length,
      safetyMatrix,
    });
  });

  return app;
};

describe('IPv6 utility integration edge cases', () => {
  let originalEnv;

  beforeAll(async () => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    ({
      isIPv6Hostname,
      extractIPv6FromHostname,
      normalizeIPv6Address,
      validateMultipleIPv6Addresses,
      getIPv6ValidationSummary,
      isIPv6AddressSafeForSSRF,
      isValidPublicIPv6,
    } = await import('../../src/utils/ipv6Utils.js'));
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('surfaces defensive IPv6 handling for malformed hosts and reserved documentation ranges', async () => {
    const app = buildEdgeCaseApp();
    const agent = request(app);

    const response = await agent.post('/api/ipv6/edge-cases').send({
      hostCandidate: 12345,
      extractionTarget: true,
      normalizationTarget: '[2001:4860:4860::8888]',
      addresses: [
        null,
        '::ffff:192.168.0.1',
        '::ffff:8.8.8.8',
        '2001:db8::1',
        'not-an-ip',
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.hostIsIPv6).toBe(false);
    expect(response.body.extractedAddress).toBeNull();
    expect(response.body.normalizedFromInvalid).toBeNull();
    expect(response.body.normalizedFromValid).toBe('2001:4860:4860::8888');

    expect(response.body.invalidSummary).toEqual({
      error: 'Invalid input - classifications must be an array',
    });
    expect(response.body.emptyFallbackLength).toBe(0);

    expect(Array.isArray(response.body.classifications)).toBe(true);
    expect(response.body.classifications).toHaveLength(5);

    const docAddressClassification = response.body.classifications.find(
      (entry) => entry.details?.originalAddress === '2001:db8::1'
    );
    expect(docAddressClassification).toBeDefined();
    expect(docAddressClassification.isReserved).toBe(true);
    expect(docAddressClassification.type).toBe('reserved');
    expect(docAddressClassification.range).toContain('Reserved');

    const privateMapped = response.body.safetyMatrix.find(
      (entry) => entry.address === '::ffff:192.168.0.1'
    );
    expect(privateMapped).toMatchObject({
      safeForSsrF: false,
      public: false,
    });

    const publicMapped = response.body.safetyMatrix.find(
      (entry) => entry.address === '::ffff:8.8.8.8'
    );
    expect(publicMapped).toMatchObject({
      safeForSsrF: true,
      public: true,
    });

    const invalidAddress = response.body.safetyMatrix.find(
      (entry) => entry.address === 'not-an-ip'
    );
    expect(invalidAddress).toMatchObject({
      safeForSsrF: false,
      public: false,
    });

    const nullAddress = response.body.safetyMatrix.find(
      (entry) => entry.address === null
    );
    expect(nullAddress).toMatchObject({
      safeForSsrF: false,
      public: false,
    });
  });
});
