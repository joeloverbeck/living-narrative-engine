import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createGameConfigRoutes } from '../../src/routes/gameConfigRoutes.js';
import { GameConfigController } from '../../src/handlers/gameConfigController.js';

describe('Game Config Routes Integration', () => {
  let app;
  let mockGameConfigService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockGameConfigService = {
      saveConfig: jest.fn(),
      loadConfig: jest.fn(),
    };

    app = express();
    app.use(express.json());

    const gameConfigController = new GameConfigController(
      mockLogger,
      mockGameConfigService
    );
    app.use('/api/game-config', createGameConfigRoutes(gameConfigController));
  });

  describe('POST /api/game-config/save', () => {
    test('returns 200 on valid payload', async () => {
      const payload = {
        mods: ['core', 'positioning'],
        startWorld: 'dredgers:dredgers',
      };
      mockGameConfigService.saveConfig.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/game-config/save')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Configuration saved successfully');
      expect(response.body.config).toEqual(payload);
    });

    test('returns 400 on invalid payload - missing mods', async () => {
      const response = await request(app)
        .post('/api/game-config/save')
        .send({ startWorld: 'dredgers:dredgers' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Missing required field: mods');
    });

    test('returns 400 on invalid payload - empty mods array', async () => {
      const response = await request(app)
        .post('/api/game-config/save')
        .send({ mods: [], startWorld: 'dredgers:dredgers' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Field mods cannot be empty');
    });

    test('returns 400 on invalid payload - missing startWorld', async () => {
      const response = await request(app)
        .post('/api/game-config/save')
        .send({ mods: ['core'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Missing required field: startWorld');
    });

    test('returns 500 when service throws error', async () => {
      mockGameConfigService.saveConfig.mockRejectedValue(
        new Error('Write failure')
      );

      const response = await request(app)
        .post('/api/game-config/save')
        .send({ mods: ['core'], startWorld: 'test:test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Failed to save configuration');
      expect(response.body.details).toBe('Write failure');
    });

    test('calls service with correct config object', async () => {
      const payload = {
        mods: ['core', 'clothing', 'positioning'],
        startWorld: 'custom:world',
      };
      mockGameConfigService.saveConfig.mockResolvedValue(undefined);

      await request(app).post('/api/game-config/save').send(payload);

      expect(mockGameConfigService.saveConfig).toHaveBeenCalledWith(payload);
    });
  });

  describe('GET /api/game-config/current', () => {
    test('returns 200 with config', async () => {
      const mockConfig = {
        mods: ['core', 'positioning'],
        startWorld: 'dredgers:dredgers',
      };
      mockGameConfigService.loadConfig.mockResolvedValue(mockConfig);

      const response = await request(app).get('/api/game-config/current');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(mockConfig);
    });

    test('returns config with mods array and startWorld', async () => {
      const mockConfig = {
        mods: ['core'],
        startWorld: '',
      };
      mockGameConfigService.loadConfig.mockResolvedValue(mockConfig);

      const response = await request(app).get('/api/game-config/current');

      expect(response.body.config.mods).toBeInstanceOf(Array);
      expect(typeof response.body.config.startWorld).toBe('string');
    });

    test('returns 500 when service throws error', async () => {
      mockGameConfigService.loadConfig.mockRejectedValue(
        new Error('Read failure')
      );

      const response = await request(app).get('/api/game-config/current');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Failed to load configuration');
      expect(response.body.details).toBe('Read failure');
    });
  });
});
