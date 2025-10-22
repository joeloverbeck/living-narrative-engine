import { describe, it, expect } from '@jest/globals';
import request from 'supertest';

import {
  buildHealthRoutesApp,
  createCacheService,
  createDegradedLlmConfigService,
  createExceptionalLlmConfigService,
  createHttpAgentService,
  createOperationalLlmConfigService,
} from '../common/healthRoutesTestUtils.js';

describe('health routes readiness integration behaviours', () => {
  it('surfaces a degraded readiness state when the llmConfigService is not operational', async () => {
    const llmConfigService = createDegradedLlmConfigService({
      message: 'config missing',
      stage: 'initialization_missing_config',
    });
    const { app } = buildHealthRoutesApp({
      llmConfigService,
      cacheService: createCacheService(),
      httpAgentService: createHttpAgentService(),
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');
    const llmCheck = response.body.details.dependencies.find(
      (dep) => dep.name === 'llmConfigService'
    );
    expect(llmCheck).toBeDefined();
    expect(llmCheck.status).toBe('DOWN');
    expect(llmCheck.details.error).toBe('config missing');
  });

  it('reports full readiness when configuration and optional services are healthy', async () => {
    const { app } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
      cacheService: createCacheService(),
      httpAgentService: createHttpAgentService(),
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
    expect(response.body.details.summary).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        down: 0,
      })
    );
    const dependencyNames = response.body.details.dependencies.map(
      (dep) => dep.name
    );
    expect(dependencyNames).toEqual(
      expect.arrayContaining([
        'llmConfigService',
        'cacheService',
        'httpAgentService',
        'nodeProcess',
      ])
    );
  });

  it('falls back to an error response when the llmConfigService throws during readiness evaluation', async () => {
    const failure = new Error('bootstrap failure');
    const llmConfigService = createExceptionalLlmConfigService(failure);
    const { app } = buildHealthRoutesApp({
      llmConfigService,
      cacheService: createCacheService(),
      httpAgentService: createHttpAgentService(),
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');
    const llmCheck = response.body.details.dependencies.find(
      (dep) => dep.name === 'llmConfigService'
    );
    expect(llmCheck).toBeDefined();
    expect(llmCheck.status).toBe('DOWN');
    expect(llmCheck.details.error).toBe('bootstrap failure');
  });
});
