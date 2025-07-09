import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { loadModsFromGameConfig } from '../../../../src/utils/initialization/modLoadingUtils.js';

// Mock the global fetch
global.fetch = jest.fn();

const mockLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
});

describe('modLoadingUtils', () => {
  describe('loadModsFromGameConfig', () => {
    let mockModsLoader;
    let logger;

    beforeEach(() => {
      jest.clearAllMocks();

      mockModsLoader = {
        loadMods: jest.fn(),
      };
      logger = mockLogger();
    });

    it('should load mods from game configuration successfully', async () => {
      const mockGameConfig = {
        mods: ['mod1', 'mod2', 'mod3'],
      };
      const mockLoadReport = {
        finalModOrder: ['mod1', 'mod2', 'mod3'],
        errors: [],
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGameConfig),
      });
      mockModsLoader.loadMods.mockResolvedValue(mockLoadReport);

      const result = await loadModsFromGameConfig(mockModsLoader, logger);

      expect(global.fetch).toHaveBeenCalledWith('./data/game.json');
      expect(logger.info).toHaveBeenCalledWith(
        "Loading 3 mods for world 'default': mod1, mod2, mod3"
      );
      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', [
        'mod1',
        'mod2',
        'mod3',
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        "Successfully loaded 3 mods for world 'default'"
      );
      expect(result).toEqual(mockLoadReport);
    });

    it('should use custom world name when provided', async () => {
      const mockGameConfig = { mods: ['mod1'] };
      const mockLoadReport = { finalModOrder: ['mod1'] };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGameConfig),
      });
      mockModsLoader.loadMods.mockResolvedValue(mockLoadReport);

      await loadModsFromGameConfig(mockModsLoader, logger, 'custom-world');

      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('custom-world', [
        'mod1',
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("for world 'custom-world'")
      );
    });

    it('should handle empty mods list', async () => {
      const mockGameConfig = {};
      const mockLoadReport = { finalModOrder: [] };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGameConfig),
      });
      mockModsLoader.loadMods.mockResolvedValue(mockLoadReport);

      const result = await loadModsFromGameConfig(mockModsLoader, logger);

      expect(mockModsLoader.loadMods).toHaveBeenCalledWith('default', []);
      expect(logger.info).toHaveBeenCalledWith(
        "Loading 0 mods for world 'default': "
      );
      expect(result).toEqual(mockLoadReport);
    });

    it('should throw error when game configuration fails to load', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        loadModsFromGameConfig(mockModsLoader, logger)
      ).rejects.toThrow('Failed to load game configuration: 404 Not Found');

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to load mods for world 'default':",
        expect.any(Error)
      );
    });

    it('should throw error when mod loading fails', async () => {
      const mockGameConfig = { mods: ['mod1'] };
      const loadError = new Error('Mod not found');

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGameConfig),
      });
      mockModsLoader.loadMods.mockRejectedValue(loadError);

      await expect(
        loadModsFromGameConfig(mockModsLoader, logger)
      ).rejects.toThrow('Mod not found');

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to load mods for world 'default':",
        loadError
      );
    });

    it('should handle fetch errors', async () => {
      const fetchError = new Error('Network error');
      global.fetch.mockRejectedValue(fetchError);

      await expect(
        loadModsFromGameConfig(mockModsLoader, logger)
      ).rejects.toThrow('Network error');

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to load mods for world 'default':",
        fetchError
      );
    });
  });
});
