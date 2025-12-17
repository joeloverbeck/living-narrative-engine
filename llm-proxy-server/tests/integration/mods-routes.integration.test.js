import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createModsRoutes } from '../../src/routes/modsRoutes.js';
import { ModsController } from '../../src/handlers/modsController.js';

describe('Mods Routes Integration', () => {
  let app;
  let mockModScannerService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockModScannerService = {
      scanMods: jest.fn(),
    };

    app = express();
    app.use(express.json());

    const modsController = new ModsController(mockLogger, mockModScannerService);
    app.use('/api/mods', createModsRoutes(modsController));
  });

  describe('GET /api/mods', () => {
    test('returns 200 with Content-Type application/json', async () => {
      mockModScannerService.scanMods.mockResolvedValue([]);

      const response = await request(app).get('/api/mods');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('returns success: true in response body', async () => {
      mockModScannerService.scanMods.mockResolvedValue([]);

      const response = await request(app).get('/api/mods');

      expect(response.body.success).toBe(true);
    });

    test('returns mods array in response body', async () => {
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
      ];
      mockModScannerService.scanMods.mockResolvedValue(mockMods);

      const response = await request(app).get('/api/mods');

      expect(response.body.mods).toEqual(mockMods);
    });

    test('returns count field matching mods array length', async () => {
      const mockMods = [
        { id: 'mod1', name: 'Mod 1', version: '1.0.0' },
        { id: 'mod2', name: 'Mod 2', version: '1.0.0' },
        { id: 'mod3', name: 'Mod 3', version: '1.0.0' },
      ];
      mockModScannerService.scanMods.mockResolvedValue(mockMods);

      const response = await request(app).get('/api/mods');

      expect(response.body.count).toBe(3);
    });

    test('returns scannedAt as ISO timestamp', async () => {
      mockModScannerService.scanMods.mockResolvedValue([]);

      const response = await request(app).get('/api/mods');

      expect(response.body.scannedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    test('returns empty mods array when no mods found', async () => {
      mockModScannerService.scanMods.mockResolvedValue([]);

      const response = await request(app).get('/api/mods');

      expect(response.body.mods).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    test('returns 500 when scanner service throws error', async () => {
      mockModScannerService.scanMods.mockRejectedValue(
        new Error('Scanner failure')
      );

      const response = await request(app).get('/api/mods');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Failed to scan mods directory');
    });

    test('returns mod with dependencies correctly', async () => {
      const mockMods = [
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
      mockModScannerService.scanMods.mockResolvedValue(mockMods);

      const response = await request(app).get('/api/mods');

      expect(response.body.mods[0].dependencies).toEqual([
        { id: 'core', version: '>=1.0.0' },
      ]);
    });

    test('returns mod with hasWorlds flag correctly', async () => {
      const mockMods = [
        {
          id: 'world_mod',
          name: 'World Mod',
          version: '1.0.0',
          description: '',
          author: 'joeloverbeck',
          dependencies: [],
          conflicts: [],
          hasWorlds: true,
        },
      ];
      mockModScannerService.scanMods.mockResolvedValue(mockMods);

      const response = await request(app).get('/api/mods');

      expect(response.body.mods[0].hasWorlds).toBe(true);
    });
  });
});
