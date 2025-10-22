import { describe, it, expect } from '@jest/globals';
import request from 'supertest';

import {
  buildHealthRoutesApp,
  createOperationalLlmConfigService,
} from '../common/healthRoutesTestUtils.js';

describe('healthRoutes readiness error integration coverage', () => {
  it('marks cache service as down when cache operations throw during readiness evaluation', async () => {
    const flakyCacheService = {
      set: () => {
        throw new Error('cache write failure');
      },
      get: () => undefined,
      invalidate: () => undefined,
      getSize: () => 0,
      getMemoryInfo: () => null,
    };

    const { app } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
      cacheService: flakyCacheService,
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    const cacheCheck = response.body.details.dependencies.find(
      (dep) => dep.name === 'cacheService'
    );
    expect(cacheCheck).toBeDefined();
    expect(cacheCheck.status).toBe('DOWN');
    expect(cacheCheck.details.error).toBe('cache write failure');
  });

  it('reports httpAgentService as down when required methods are missing', async () => {
    const incompleteHttpAgentService = {
      cleanup: () => undefined,
    };

    const { app } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
      httpAgentService: incompleteHttpAgentService,
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    const httpAgentCheck = response.body.details.dependencies.find(
      (dep) => dep.name === 'httpAgentService'
    );
    expect(httpAgentCheck).toBeDefined();
    expect(httpAgentCheck.status).toBe('DOWN');
    expect(httpAgentCheck.details.error).toBe('Missing required methods');
  });
});
