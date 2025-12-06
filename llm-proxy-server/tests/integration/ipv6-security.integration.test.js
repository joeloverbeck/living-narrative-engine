/**
 * @file ipv6-security.integration.test.js
 * @description Integration tests covering IPv6 security utilities working
 * together with validation and rate limiting middleware.
 */

import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let createApiRateLimiter;
let validateRequestHeaders;
let validateLlmRequest;
let handleValidationErrors;
let isUrlSafe;
let validateMultipleIPv6Addresses;
let getIPv6ValidationSummary;
let normalizeIPv6Address;
let extractIPv6FromHostname;
let isIPv6Hostname;
let RATE_LIMIT_GENERAL_MAX_REQUESTS;
let originalNodeEnv;

jest.setTimeout(60000);

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(createApiRateLimiter({ trustProxy: true }));

  app.post(
    '/api/llm-request',
    ...validateRequestHeaders(),
    ...validateLlmRequest(),
    handleValidationErrors,
    (req, res) => {
      const targetPayload = req.body?.targetPayload || {};
      const {
        targetUrl,
        ipv6Candidates = [],
        skipExtendedChecks = false,
      } = targetPayload;

      const responsePayload = {
        safe: false,
        containsIPv6: false,
        extracted: null,
        normalized: null,
        normalizedInvalid: null,
        normalizedFromNumber: null,
        summary: null,
        invalidSummary: null,
        validations: [],
        multiValidationFallback: [],
      };

      if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json(responsePayload);
      }

      responsePayload.safe = isUrlSafe(targetUrl);

      let hostname = '';
      try {
        hostname = new URL(targetUrl).hostname;
      } catch (error) {
        return res.status(400).json({
          ...responsePayload,
          error: error.message,
        });
      }

      responsePayload.containsIPv6 = isIPv6Hostname(hostname);
      if (responsePayload.containsIPv6) {
        responsePayload.extracted = extractIPv6FromHostname(hostname);
        if (responsePayload.extracted) {
          responsePayload.normalized = normalizeIPv6Address(
            responsePayload.extracted
          );
        }
      }

      if (!skipExtendedChecks) {
        responsePayload.normalizedInvalid = normalizeIPv6Address('not-an-ipv6');
        responsePayload.normalizedFromNumber = normalizeIPv6Address(42);
      }

      const addressesToCheck = Array.isArray(ipv6Candidates)
        ? [...ipv6Candidates]
        : [];

      if (responsePayload.extracted) {
        addressesToCheck.push(responsePayload.extracted);
      }

      if (!skipExtendedChecks) {
        addressesToCheck.push(
          '::ffff:192.168.0.1',
          '::ffff:8.8.8.8',
          '[2606:4700:4700::1111]',
          '2001:db8::1',
          '2001:30::1',
          'fec0::1',
          'fc0::1',
          'fe8::1',
          '[]',
          '',
          undefined
        );
      }

      const validations = validateMultipleIPv6Addresses(addressesToCheck);
      responsePayload.validations = addressesToCheck.map((input, index) => ({
        input: typeof input === 'string' ? input : String(input),
        classification: validations[index],
      }));

      responsePayload.summary = getIPv6ValidationSummary(validations);

      if (!skipExtendedChecks) {
        responsePayload.invalidSummary =
          getIPv6ValidationSummary('not-an-array');
        responsePayload.multiValidationFallback =
          validateMultipleIPv6Addresses('not-an-array');
      }

      if (!responsePayload.safe) {
        return res.status(400).json(responsePayload);
      }

      return res.status(200).json(responsePayload);
    }
  );

  return app;
};

describe('IPv6 security integration', () => {
  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    ({ createApiRateLimiter } = await import(
      '../../src/middleware/rateLimiting.js'
    ));

    ({
      validateRequestHeaders,
      validateLlmRequest,
      handleValidationErrors,
      isUrlSafe,
    } = await import('../../src/middleware/validation.js'));

    ({
      validateMultipleIPv6Addresses,
      getIPv6ValidationSummary,
      normalizeIPv6Address,
      extractIPv6FromHostname,
      isIPv6Hostname,
    } = await import('../../src/utils/ipv6Utils.js'));

    const constantsModule = await import('../../src/config/constants.js');
    RATE_LIMIT_GENERAL_MAX_REQUESTS =
      constantsModule.RATE_LIMIT_GENERAL_MAX_REQUESTS;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('classifies IPv6 addresses and allows safe public hosts', async () => {
    const app = buildApp();
    const agent = request(app);

    const response = await agent
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: {
          targetUrl: 'https://[2606:4700:4700::1111]/chat',
          ipv6Candidates: [
            '::1',
            'fc00::1',
            'fe80::1',
            'ff02::1',
            '2001:4860:4860::8888',
            '::ffff:192.168.0.1',
            '::ffff:8.8.8.8',
            '[2606:4700:4700::1111]',
            'invalid::address',
            '2001:db8::1',
            '2001:30::1',
          ],
        },
        targetHeaders: {
          'X-Test-Header': 'value',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.safe).toBe(true);
    expect(response.body.containsIPv6).toBe(true);
    expect(response.body.normalized).toBe('2606:4700:4700::1111');
    expect(response.body.normalizedInvalid).toBeNull();
    expect(response.body.normalizedFromNumber).toBeNull();
    expect(response.body.invalidSummary).toEqual({
      error: 'Invalid input - classifications must be an array',
    });
    expect(Array.isArray(response.body.multiValidationFallback)).toBe(true);
    expect(response.body.multiValidationFallback.length).toBe(0);

    const lookup = Object.fromEntries(
      response.body.validations.map(({ input, classification }) => [
        input,
        classification,
      ])
    );

    expect(lookup['::1'].type).toBe('loopback');
    expect(lookup['fc00::1'].type).toBe('private');
    expect(lookup['fe80::1'].type).toBe('link-local');
    expect(lookup['ff02::1'].type).toBe('multicast');
    expect(lookup['::ffff:8.8.8.8'].type).toBe('ipv4-mapped-public');
    expect(lookup['::ffff:192.168.0.1'].type).toBe('ipv4-mapped-private');
    expect(lookup['2001:db8::1'].type).toBe('reserved');
    expect(lookup['2001:30::1'].range).toContain('Drone Remote ID');
    expect(lookup['fec0::1'].type).toBe('site-local');
    expect(lookup['fc0::1'].type).toBe('private');
    expect(lookup['fe8::1'].type).toBe('link-local');
    expect(lookup['[]'].isValid).toBe(false);
    expect(lookup['2606:4700:4700::1111'].isPublic).toBe(true);
    expect(lookup['invalid::address'].isValid).toBe(false);

    expect(response.body.summary.total).toBe(response.body.validations.length);
    expect(response.body.summary.public).toBeGreaterThanOrEqual(2);
    expect(response.body.summary.private).toBeGreaterThanOrEqual(1);
    expect(response.body.summary.loopback).toBeGreaterThanOrEqual(1);
    expect(response.body.summary.multicast).toBeGreaterThanOrEqual(1);
  });

  it('rejects loopback IPv6 targets as unsafe', async () => {
    const app = buildApp();
    const agent = request(app);

    const response = await agent
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: {
          targetUrl: 'https://[::1]/admin',
          ipv6Candidates: ['::1'],
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.safe).toBe(false);
    expect(response.body.containsIPv6).toBe(true);
    expect(response.body.summary.loopback).toBeGreaterThanOrEqual(1);
  });

  it('handles non-IPv6 target hosts without invoking IPv6 extraction', async () => {
    const app = buildApp();
    const agent = request(app);

    const response = await agent
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: {
          targetUrl: 'https://api.example.com/v1',
          ipv6Candidates: [],
          skipExtendedChecks: true,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.containsIPv6).toBe(false);
    expect(response.body.extracted).toBeNull();
    expect(response.body.validations.length).toBe(0);
  });

  it('tracks private IPv6 clients while marking them as non-public for rate limiting decisions', async () => {
    const app = buildApp();
    const agent = request(app);

    const firstResponse = await agent
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .set('x-forwarded-for', 'fc00::1')
      .set('x-real-ip', 'fc00::1')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: {
          targetUrl: 'https://[2606:4700:4700::1111]/chat',
          ipv6Candidates: ['fc00::1'],
          skipExtendedChecks: true,
        },
      });

    expect(firstResponse.status).toBe(200);
    const privateLookup = Object.fromEntries(
      firstResponse.body.validations.map(({ input, classification }) => [
        input,
        classification,
      ])
    );
    expect(privateLookup['fc00::1'].isPublic).toBe(false);
    expect(firstResponse.body.summary.private).toBeGreaterThanOrEqual(1);

    for (let i = 1; i < RATE_LIMIT_GENERAL_MAX_REQUESTS; i += 1) {
      const allowed = await agent
        .post('/api/llm-request')
        .set('content-type', 'application/json')
        .set('x-forwarded-for', 'fc00::1')
        .set('x-real-ip', 'fc00::1')
        .send({
          llmId: 'openai-gpt-4o',
          targetPayload: {
            targetUrl: 'https://[2606:4700:4700::1111]/chat',
            ipv6Candidates: ['fc00::1'],
            skipExtendedChecks: true,
          },
        });

      expect(allowed.status).toBe(200);
    }

    const blocked = await agent
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .set('x-forwarded-for', 'fc00::1')
      .set('x-real-ip', 'fc00::1')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: {
          targetUrl: 'https://[2606:4700:4700::1111]/chat',
          ipv6Candidates: ['fc00::1'],
          skipExtendedChecks: true,
        },
      });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.details.clientId).toBe('ip');
  });

  it('retains IPv6 client identification for public IPv6 addresses under rate limiting', async () => {
    const app = buildApp();
    const agent = request(app);

    const firstResponse = await agent
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .set('x-forwarded-for', '2606:4700:4700::1111')
      .set('x-real-ip', '2606:4700:4700::1111')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: {
          targetUrl: 'https://[2606:4700:4700::1111]/chat',
          ipv6Candidates: ['2606:4700:4700::1111'],
          skipExtendedChecks: true,
        },
      });

    expect(firstResponse.status).toBe(200);
    const publicLookup = Object.fromEntries(
      firstResponse.body.validations.map(({ input, classification }) => [
        input,
        classification,
      ])
    );
    expect(publicLookup['2606:4700:4700::1111'].isPublic).toBe(true);
    expect(firstResponse.body.summary.public).toBeGreaterThanOrEqual(1);

    for (let i = 1; i < RATE_LIMIT_GENERAL_MAX_REQUESTS; i += 1) {
      const allowed = await agent
        .post('/api/llm-request')
        .set('content-type', 'application/json')
        .set('x-forwarded-for', '2606:4700:4700::1111')
        .set('x-real-ip', '2606:4700:4700::1111')
        .send({
          llmId: 'openai-gpt-4o',
          targetPayload: {
            targetUrl: 'https://[2606:4700:4700::1111]/chat',
            ipv6Candidates: ['2606:4700:4700::1111'],
            skipExtendedChecks: true,
          },
        });

      expect(allowed.status).toBe(200);
    }

    const blocked = await agent
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .set('x-forwarded-for', '2606:4700:4700::1111')
      .set('x-real-ip', '2606:4700:4700::1111')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: {
          targetUrl: 'https://[2606:4700:4700::1111]/chat',
          ipv6Candidates: ['2606:4700:4700::1111'],
          skipExtendedChecks: true,
        },
      });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.details.clientId).toBe('ip');
  });
});
