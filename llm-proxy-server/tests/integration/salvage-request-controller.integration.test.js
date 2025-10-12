import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { SalvageRequestController } from '../../src/handlers/salvageRequestController.js';
import { createSalvageRoutes } from '../../src/routes/salvageRoutes.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';

function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

describe('SalvageRequestController integration', () => {
  it('throws a descriptive error when constructed without a salvage service', () => {
    const logger = createLogger();
    expect(() => new SalvageRequestController(logger, undefined)).toThrow(
      'SalvageRequestController: salvageService is required'
    );
  });

  it('responds with validation error metadata when requestId is missing', async () => {
    const logger = createLogger();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 50,
    });
    const controller = new SalvageRequestController(logger, salvageService);

    const app = express();
    app.use(express.json());

    app.get('/api/llm-request/salvage', (req, res, next) =>
      controller.handleSalvageByRequestId(req, res, next)
    );
    app.get('/api/llm-request/salvage/:requestId', (req, res, next) =>
      controller.handleSalvageByRequestId(req, res, next)
    );

    const response = await request(app).get('/api/llm-request/salvage/');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: true,
      message: 'Invalid request ID',
      stage: 'salvage_validation_failed',
      details: {
        reason: 'requestId parameter is required and must be a string',
      },
    });

    salvageService.cleanup();
  });

  it('recovers cached responses through the salvage route integration', async () => {
    const logger = createLogger();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 200,
    });
    const controller = new SalvageRequestController(logger, salvageService);

    const app = express();
    app.use(express.json());
    app.use('/api/llm-request', createSalvageRoutes(controller));

    const salvagedPayload = {
      requestId: 'req-123',
      llmId: 'test-llm',
      targetPayload: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.5,
      },
      responseData: { reply: 'cached-response' },
      statusCode: 202,
    };

    salvageService.salvageResponse(
      salvagedPayload.requestId,
      salvagedPayload.llmId,
      salvagedPayload.targetPayload,
      salvagedPayload.responseData,
      salvagedPayload.statusCode,
      200
    );

    const retrieval = await request(app).get(
      `/api/llm-request/salvage/${salvagedPayload.requestId}`
    );

    expect(retrieval.status).toBe(salvagedPayload.statusCode);
    expect(retrieval.body).toMatchObject({
      ...salvagedPayload.responseData,
      _salvageMetadata: {
        originalRequestId: salvagedPayload.requestId,
        llmId: salvagedPayload.llmId,
        recovered: true,
      },
    });

    const stats = await request(app).get('/api/llm-request/salvage-stats');
    expect(stats.status).toBe(200);
    expect(stats.body).toHaveProperty('stats');
    expect(stats.body.message).toBe('Salvage service statistics');

    salvageService.cleanup();
  });
});
