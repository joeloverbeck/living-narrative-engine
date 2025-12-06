/**
 * @file health-check-readiness-llm-config-failure.integration.test.js
 * @description Exercises the readiness middleware when the LLM configuration
 *              service reports an initialization failure to increase coverage
 *              for error reporting branches in healthCheck.js.
 */

import { describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createReadinessCheck } from '../../src/middleware/healthCheck.js';

/**
 * Creates a deterministic logger compatible with ILogger.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger & { isDebugEnabled: boolean }}
 */
const createTestLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

describe('Readiness health check when LLM configuration service is unavailable', () => {
  it('surfaces initialization error details and returns DOWN status', async () => {
    const logger = createTestLogger();

    const failingLlmConfigService = {
      isOperational: () => false,
      getInitializationErrorDetails: () => ({
        message: 'Configuration bootstrap failed',
        stage: 'load-config',
      }),
      getLlmConfigs: () => null,
    };

    const app = express();
    app.get(
      '/health/ready',
      createReadinessCheck({
        logger,
        llmConfigService: failingLlmConfigService,
      })
    );

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');

    const llmCheck = response.body.details.dependencies.find(
      (dependency) => dependency.name === 'llmConfigService'
    );

    expect(llmCheck).toEqual({
      name: 'llmConfigService',
      status: 'DOWN',
      details: {
        operational: false,
        error: 'Configuration bootstrap failed',
        stage: 'load-config',
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Health check (readiness) completed',
      expect.objectContaining({
        status: 'DOWN',
        dependenciesChecked: expect.any(Number),
        downDependencies: expect.any(Number),
      })
    );
  });
});
