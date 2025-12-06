import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import { SalvageRequestController } from '../../src/handlers/salvageRequestController.js';
import { createSalvageRoutes } from '../../src/routes/salvageRoutes.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';

describe('SalvageRequestController resilience integration', () => {
  it('requires a logger when collaborating with the real salvage service', () => {
    const salvageService = new ResponseSalvageService(new ConsoleLogger(), {
      defaultTtl: 50,
    });

    expect(
      () => new SalvageRequestController(undefined, salvageService)
    ).toThrow('SalvageRequestController: logger is required');

    salvageService.cleanup();
  });

  it('returns a detailed not-found response when no salvage entry exists', async () => {
    const logger = new ConsoleLogger();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 50,
    });
    const controller = new SalvageRequestController(logger, salvageService);

    const app = express();
    app.use(express.json());
    app.use('/api/llm-request', createSalvageRoutes(controller));

    const response = await request(app).get(
      '/api/llm-request/salvage/missing-request'
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: true,
      message: 'No salvaged response found for the provided request ID',
      stage: 'salvage_not_found',
      details: {
        requestId: 'missing-request',
        reason:
          'Response may have expired, never existed, or was already retrieved',
      },
    });

    const statsResponse = await request(app).get(
      '/api/llm-request/salvage-stats'
    );

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body).toEqual({
      stats: {
        salvaged: 0,
        totalCacheEntries: 0,
        activeTimers: 0,
      },
      message: 'Salvage service statistics',
    });

    salvageService.cleanup();
  });
});
