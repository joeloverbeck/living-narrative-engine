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
 * Builds an express application that exercises ipv6 utility helpers
 * through the rate limiting middleware and a diagnostics endpoint.
 * @param {typeof import('../../src/utils/ipv6Utils.js')} ipv6Utils - Module under test.
 * @param {ReturnType<import('../../src/middleware/rateLimiting.js').createApiRateLimiter>} rateLimiter - Active rate limiter.
 * @returns {import('express').Express}
 */
const buildIpv6DiagnosticsApp = (ipv6Utils, rateLimiter) => {
  const app = express();
  app.use(express.json());
  app.use(rateLimiter);

  app.post('/ipv6/fallbacks', (req, res) => {
    const hosts = Array.isArray(req.body?.hosts) ? req.body.hosts : [];
    const extracted = hosts.map((host) =>
      ipv6Utils.extractIPv6FromHostname(host)
    );
    const classifications = ipv6Utils.validateMultipleIPv6Addresses(hosts);
    const summary = ipv6Utils.getIPv6ValidationSummary(classifications);
    const fallbackRange = ipv6Utils.__determineReservedRangeFromType(
      req.body?.fallbackRange || 'reserved'
    );

    res
      .status(200)
      .json({ extracted, classifications, summary, fallbackRange });
  });

  return app;
};

describe('IPv6 utility fallback branch integration', () => {
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

  it('covers IPv4 mapped fallbacks and invalid extractions through the API limiter workflow', async () => {
    const originalToIPv4 = ipaddr.IPv6.prototype.toIPv4Address;
    jest
      .spyOn(ipaddr.IPv6.prototype, 'toIPv4Address')
      .mockImplementation(function proxiedToIPv4(...args) {
        const mapped = originalToIPv4.apply(this, args);
        const clone = Object.create(Object.getPrototypeOf(mapped));
        Object.assign(clone, mapped);
        if (Array.isArray(mapped.octets)) {
          const octetsCopy = [...mapped.octets];
          const manualRangeFallbacks = new Set([
            '10.0.0.1',
            '172.16.5.1',
            '192.168.1.20',
            '169.254.10.10',
            '127.0.0.1',
            '0.0.0.0',
            '255.255.255.255',
            '224.0.0.1',
            '240.0.0.1',
          ]);
          clone.parts = octetsCopy;
          delete clone.octets;
          clone.range = (...rangeArgs) => {
            const normalized = mapped.toString();
            if (manualRangeFallbacks.has(normalized)) {
              return 'unicast';
            }
            return mapped.range(...rangeArgs);
          };
          clone.toString = (...stringArgs) => mapped.toString(...stringArgs);
          clone.kind = (...kindArgs) => mapped.kind(...kindArgs);
        }
        return clone;
      });

    const [ipv6Utils, rateLimiting] = await Promise.all([
      import('../../src/utils/ipv6Utils.js'),
      import('../../src/middleware/rateLimiting.js'),
    ]);

    const app = buildIpv6DiagnosticsApp(
      ipv6Utils,
      rateLimiting.createApiRateLimiter({ trustProxy: true })
    );
    const agent = request(app);

    const hostExpectations = [
      {
        host: '[::ffff:8.8.8.8]',
        extracted: '::ffff:8.8.8.8',
        originalKey: '[::ffff:8.8.8.8]',
        assert: (classification) => {
          expect(classification.isValid).toBe(true);
          expect(classification.isPublic).toBe(true);
          expect(classification.type).toBe('ipv4-mapped-public');
        },
      },
      {
        host: '[::ffff:127.0.0.1]',
        extracted: '::ffff:127.0.0.1',
        originalKey: '[::ffff:127.0.0.1]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
          expect(classification.type).toBe('ipv4-mapped-private');
        },
      },
      {
        host: '[::ffff:10.0.0.1]',
        extracted: '::ffff:10.0.0.1',
        originalKey: '[::ffff:10.0.0.1]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:172.16.5.1]',
        extracted: '::ffff:172.16.5.1',
        originalKey: '[::ffff:172.16.5.1]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:192.168.1.20]',
        extracted: '::ffff:192.168.1.20',
        originalKey: '[::ffff:192.168.1.20]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:169.254.10.10]',
        extracted: '::ffff:169.254.10.10',
        originalKey: '[::ffff:169.254.10.10]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:0.0.0.0]',
        extracted: '::ffff:0.0.0.0',
        originalKey: '[::ffff:0.0.0.0]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:255.255.255.255]',
        extracted: '::ffff:255.255.255.255',
        originalKey: '[::ffff:255.255.255.255]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:224.0.0.1]',
        extracted: '::ffff:224.0.0.1',
        originalKey: '[::ffff:224.0.0.1]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:100.64.0.1]',
        extracted: '::ffff:100.64.0.1',
        originalKey: '[::ffff:100.64.0.1]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
      {
        host: '[::ffff:240.0.0.1]',
        extracted: '::ffff:240.0.0.1',
        originalKey: '[::ffff:240.0.0.1]',
        assert: (classification) => {
          expect(classification.isReserved).toBe(true);
        },
      },
    ];

    const response = await agent
      .post('/ipv6/fallbacks')
      .set('content-type', 'application/json')
      .set('x-forwarded-for', '::ffff:8.8.8.8')
      .set('forwarded', 'for="[::ffff:127.0.0.1]"')
      .send({
        hosts: [...hostExpectations.map((entry) => entry.host), 'invalid-host'],
        fallbackRange: 'unknownRangeType',
      });

    expect(response.status).toBe(200);

    const { extracted, classifications, summary, fallbackRange } =
      response.body;

    expect(extracted).toEqual([
      ...hostExpectations.map((entry) => entry.extracted),
      null,
    ]);

    const classificationMap = new Map(
      classifications.map((classification) => [
        classification.details.originalAddress,
        classification,
      ])
    );

    let reservedCount = 0;
    for (const expectation of hostExpectations) {
      const classification = classificationMap.get(expectation.originalKey);
      expect(classification).toBeDefined();
      expectation.assert(classification);
      if (classification.isReserved) {
        reservedCount += 1;
      }
    }

    const invalidClassification = classifications[classifications.length - 1];
    expect(invalidClassification.isValid).toBe(false);
    expect(invalidClassification.details.reason).toContain(
      'Invalid IPv6 address'
    );

    expect(summary).toEqual(
      expect.objectContaining({
        total: hostExpectations.length + 1,
        valid: hostExpectations.length,
        invalid: 1,
        reserved: reservedCount,
      })
    );

    expect(fallbackRange).toBe('unknownRangeType (Reserved)');
  });
});
