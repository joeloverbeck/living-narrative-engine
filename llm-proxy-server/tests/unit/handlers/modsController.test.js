import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModsController } from '../../../src/handlers/modsController.js';

describe('ModsController', () => {
  let logger;
  let modScannerService;
  let controller;
  let req;
  let res;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    modScannerService = {
      scanMods: jest.fn(),
    };

    controller = new ModsController(logger, modScannerService);

    req = {};

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('requires a logger', () => {
      expect(() => new ModsController()).toThrow(
        'ModsController: logger is required'
      );
    });

    test('requires a modScannerService', () => {
      expect(() => new ModsController(logger)).toThrow(
        'ModsController: modScannerService is required'
      );
    });

    test('logs instance creation', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        'ModsController: Instance created'
      );
    });
  });

  describe('handleGetMods', () => {
    test('returns 200 with mod array on success', async () => {
      const mockMods = [
        {
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: 'Core game mechanics',
          author: 'joeloverbeck',
          dependencies: [],
          conflicts: [],
          hasWorlds: false,
        },
        {
          id: 'positioning',
          name: 'Positioning',
          version: '1.0.0',
          description: 'Character positioning system',
          author: 'joeloverbeck',
          dependencies: [{ id: 'core', version: '>=1.0.0' }],
          conflicts: [],
          hasWorlds: false,
        },
      ];

      modScannerService.scanMods.mockResolvedValue(mockMods);

      await controller.handleGetMods(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          mods: mockMods,
          count: 2,
          scannedAt: expect.any(String),
        })
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'ModsController: Returning mod list',
        { count: 2 }
      );
    });

    test('returns 200 with empty array when no mods found', async () => {
      modScannerService.scanMods.mockResolvedValue([]);

      await controller.handleGetMods(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          mods: [],
          count: 0,
          scannedAt: expect.any(String),
        })
      );
    });

    test('returns scannedAt as ISO timestamp', async () => {
      modScannerService.scanMods.mockResolvedValue([]);

      await controller.handleGetMods(req, res);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.scannedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    test('returns 500 on scanner service error', async () => {
      const error = new Error('Failed to read mods directory');
      modScannerService.scanMods.mockRejectedValue(error);

      await controller.handleGetMods(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Failed to scan mods directory',
          details: 'Failed to read mods directory',
        })
      );
    });

    test('logs errors appropriately', async () => {
      const error = new Error('Unexpected error');
      modScannerService.scanMods.mockRejectedValue(error);

      await controller.handleGetMods(req, res);

      expect(logger.error).toHaveBeenCalledWith(
        'ModsController: Failed to scan mods',
        error
      );
    });

    test('includes core mod in results when present', async () => {
      const mockMods = [
        {
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: '',
          author: 'joeloverbeck',
          dependencies: [],
          conflicts: [],
          hasWorlds: false,
        },
      ];

      modScannerService.scanMods.mockResolvedValue(mockMods);

      await controller.handleGetMods(req, res);

      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.mods.some((m) => m.id === 'core')).toBe(true);
    });
  });
});
