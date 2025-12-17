import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { GameConfigController } from '../../../src/handlers/gameConfigController.js';

describe('GameConfigController', () => {
  let logger;
  let gameConfigService;
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

    gameConfigService = {
      saveConfig: jest.fn(),
      loadConfig: jest.fn(),
    };

    controller = new GameConfigController(logger, gameConfigService);

    req = {
      body: {},
    };

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
      expect(() => new GameConfigController()).toThrow(
        'GameConfigController: logger is required'
      );
    });

    test('requires a gameConfigService', () => {
      expect(() => new GameConfigController(logger)).toThrow(
        'GameConfigController: gameConfigService is required'
      );
    });

    test('logs instance creation', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        'GameConfigController: Instance created'
      );
    });
  });

  describe('handleSave', () => {
    test('returns 200 on valid payload', async () => {
      const validPayload = {
        mods: ['core', 'positioning'],
        startWorld: 'dredgers:dredgers',
      };
      req.body = validPayload;
      gameConfigService.saveConfig.mockResolvedValue(undefined);

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Configuration saved successfully',
        config: validPayload,
      });
      expect(gameConfigService.saveConfig).toHaveBeenCalledWith(validPayload);
      expect(logger.info).toHaveBeenCalledWith(
        'GameConfigController: Game config saved successfully',
        { modCount: 2, startWorld: 'dredgers:dredgers' }
      );
    });

    test('returns 400 when mods is missing', async () => {
      req.body = { startWorld: 'dredgers:dredgers' };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Missing required field: mods',
      });
      expect(gameConfigService.saveConfig).not.toHaveBeenCalled();
    });

    test('returns 400 when mods is not an array', async () => {
      req.body = { mods: 'core', startWorld: 'dredgers:dredgers' };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Field mods must be an array',
      });
    });

    test('returns 400 when mods is empty', async () => {
      req.body = { mods: [], startWorld: 'dredgers:dredgers' };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Field mods cannot be empty',
      });
    });

    test('returns 400 when mods contains non-strings', async () => {
      req.body = { mods: ['core', 123], startWorld: 'dredgers:dredgers' };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'All mods must be non-empty strings',
      });
    });

    test('returns 400 when mods contains empty strings', async () => {
      req.body = { mods: ['core', ''], startWorld: 'dredgers:dredgers' };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'All mods must be non-empty strings',
      });
    });

    test('returns 400 when startWorld is missing', async () => {
      req.body = { mods: ['core'] };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Missing required field: startWorld',
      });
    });

    test('returns 400 when startWorld is empty string', async () => {
      req.body = { mods: ['core'], startWorld: '' };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Missing required field: startWorld',
      });
    });

    test('returns 400 when startWorld is whitespace only', async () => {
      req.body = { mods: ['core'], startWorld: '   ' };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Field startWorld must be a non-empty string',
      });
    });

    test('returns 400 when startWorld is not a string', async () => {
      req.body = { mods: ['core'], startWorld: 123 };

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Field startWorld must be a non-empty string',
      });
    });

    test('returns 500 on service error', async () => {
      const error = new Error('File system error');
      req.body = { mods: ['core'], startWorld: 'dredgers:dredgers' };
      gameConfigService.saveConfig.mockRejectedValue(error);

      await controller.handleSave(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Failed to save configuration',
        details: 'File system error',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'GameConfigController: Failed to save game config',
        error
      );
    });
  });

  describe('handleGetCurrent', () => {
    test('returns 200 with config', async () => {
      const mockConfig = {
        mods: ['core', 'positioning'],
        startWorld: 'dredgers:dredgers',
      };
      gameConfigService.loadConfig.mockResolvedValue(mockConfig);

      await controller.handleGetCurrent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        config: mockConfig,
      });
      expect(gameConfigService.loadConfig).toHaveBeenCalled();
    });

    test('returns 500 on service error', async () => {
      const error = new Error('Read error');
      gameConfigService.loadConfig.mockRejectedValue(error);

      await controller.handleGetCurrent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Failed to load configuration',
        details: 'Read error',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'GameConfigController: Failed to load game config',
        error
      );
    });
  });
});
