import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SalvageRequestController } from '../../../src/handlers/salvageRequestController.js';

describe('SalvageRequestController', () => {
  let logger;
  let salvageService;
  let controller;
  let res;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    salvageService = {
      retrieveByRequestId: jest.fn(),
      getStats: jest.fn(() => ({ salvaged: 0 })),
    };

    controller = new SalvageRequestController(logger, salvageService);

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('constructor enforces required dependencies', () => {
    expect(() => new SalvageRequestController()).toThrow(
      'SalvageRequestController: logger is required'
    );
    expect(() => new SalvageRequestController(logger)).toThrow(
      'SalvageRequestController: salvageService is required'
    );
  });

  test('handleSalvageByRequestId validates requestId parameter', async () => {
    const req = { params: { requestId: 123 } };

    await controller.handleSalvageByRequestId(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: true,
        message: 'Invalid request ID',
        details: expect.objectContaining({
          reason: 'requestId parameter is required and must be a string',
        }),
      })
    );
    expect(salvageService.retrieveByRequestId).not.toHaveBeenCalled();
  });

  test('handleSalvageByRequestId responds with 404 when no salvage found', async () => {
    salvageService.retrieveByRequestId.mockReturnValue(null);

    const req = { params: { requestId: 'missing-id' } };

    await controller.handleSalvageByRequestId(req, res);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to retrieve salvaged response'),
      { requestId: 'missing-id' }
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No salvaged response found'),
      { requestId: 'missing-id' }
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: true,
        stage: 'salvage_not_found',
        details: expect.objectContaining({ requestId: 'missing-id' }),
      })
    );
  });

  test('handleSalvageByRequestId returns salvaged payload with metadata', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(3_000)
      .mockReturnValueOnce(3_000);

    const salvaged = {
      responseData: { data: 'value' },
      statusCode: 202,
      salvageTimestamp: 1_000,
      requestId: 'abc',
      llmId: 'llm-1',
    };
    salvageService.retrieveByRequestId.mockReturnValue(salvaged);

    const req = { params: { requestId: 'abc' } };

    await controller.handleSalvageByRequestId(req, res);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Salvaged response retrieved successfully'),
      expect.objectContaining({
        requestId: 'abc',
        llmId: 'llm-1',
        ageMs: 2_000,
      })
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: 'value',
        _salvageMetadata: expect.objectContaining({
          originalRequestId: 'abc',
          llmId: 'llm-1',
          recovered: true,
          ageMs: 2_000,
        }),
      })
    );
  });

  test('handleSalvageStats returns service statistics', async () => {
    salvageService.getStats.mockReturnValue({ salvaged: 5, total: 10 });

    await controller.handleSalvageStats({}, res);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Salvage stats requested'),
      { salvaged: 5, total: 10 }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: { salvaged: 5, total: 10 },
        message: 'Salvage service statistics',
      })
    );
  });
});
