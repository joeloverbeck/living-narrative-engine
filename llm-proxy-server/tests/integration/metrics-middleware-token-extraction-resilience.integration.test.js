import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';

describe('LLM metrics middleware token extraction resilience', () => {
  class RecordingMetricsService {
    constructor() {
      this.entries = [];
    }

    recordLlmRequest(payload) {
      this.entries.push(payload);
    }
  }

  const createTrackingLogger = () => {
    const entries = [];
    return {
      entries,
      logger: {
        debug: (...args) => entries.push({ level: 'debug', args }),
        info: (...args) => entries.push({ level: 'info', args }),
        warn: (...args) => entries.push({ level: 'warn', args }),
        error: (...args) => entries.push({ level: 'error', args }),
      },
    };
  };

  const createProblematicResponse = () => {
    const payload = {};

    Object.defineProperty(payload, 'usage', {
      enumerable: false,
      get() {
        throw new Error('usage metrics unavailable');
      },
    });

    Object.defineProperty(payload, 'toJSON', {
      enumerable: false,
      value() {
        return { status: 'ok', payload: 'sanitized' };
      },
    });

    return payload;
  };

  let app;
  let metricsService;
  let loggerBundle;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    loggerBundle = createTrackingLogger();

    app = express();
    app.use(express.json());

    app.post(
      '/llm/problematic-tokens',
      (req, _res, next) => {
        req.correlationId = 'token-extraction-correlation';
        next();
      },
      createLlmMetricsMiddleware({
        metricsService,
        logger: loggerBundle.logger,
      }),
      (_req, res) => {
        const problematicResponse = createProblematicResponse();
        res.status(200).json(problematicResponse);
      }
    );
  });

  afterEach(() => {
    app = null;
    metricsService = null;
    loggerBundle = null;
  });

  it('records metrics even when token extraction encounters accessor errors', async () => {
    await request(app)
      .post('/llm/problematic-tokens')
      .send({ llmId: 'custom-model' })
      .expect(200, { status: 'ok', payload: 'sanitized' });

    expect(metricsService.entries).toHaveLength(1);
    const [entry] = metricsService.entries;

    expect(entry.provider).toBe('unknown');
    expect(entry.model).toBe('custom-model');
    expect(entry.status).toBe('success');
    expect(entry.tokens).toBeNull();
    expect(entry.duration).toBeGreaterThan(0);

    const errorLogs = loggerBundle.entries.filter(
      (event) => event.level === 'error'
    );
    expect(errorLogs).toHaveLength(0);

    const debugLogs = loggerBundle.entries.filter(
      (event) => event.level === 'debug'
    );
    expect(debugLogs.length).toBeGreaterThanOrEqual(1);
    expect(String(debugLogs[0].args[0])).toContain(
      'LLM request metrics recorded'
    );
  });
});
