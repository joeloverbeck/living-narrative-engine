import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { GameConfigService } from '../../../src/services/gameConfigService.js';
import fs from 'fs/promises';
import path from 'path';

jest.mock('fs/promises');

describe('GameConfigService', () => {
  let logger;
  let service;
  const mockConfigPath = 'data/game.json';

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock process.cwd to return a predictable path
    jest.spyOn(process, 'cwd').mockReturnValue('/mock');

    service = new GameConfigService(logger, mockConfigPath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('requires a logger', () => {
      expect(() => new GameConfigService()).toThrow(
        'GameConfigService: logger is required'
      );
    });

    test('uses default config path when not provided', () => {
      const defaultService = new GameConfigService(logger);
      expect(logger.debug).toHaveBeenCalledWith(
        'GameConfigService: Instance created',
        expect.objectContaining({
          configPath: expect.any(String),
        })
      );
    });

    test('logs instance creation with config path', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        'GameConfigService: Instance created',
        expect.objectContaining({
          configPath: expect.stringContaining('game.json'),
        })
      );
    });
  });

  describe('saveConfig', () => {
    test('writes valid JSON to file', async () => {
      const config = {
        mods: ['core', 'positioning'],
        startWorld: 'dredgers:dredgers',
      };

      fs.writeFile.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(JSON.stringify(config));
      fs.mkdir.mockResolvedValue(undefined);
      fs.rename.mockResolvedValue(undefined);

      await service.saveConfig(config);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('game-'),
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      expect(fs.rename).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'GameConfigService: Config file written',
        expect.objectContaining({
          path: expect.stringContaining('game.json'),
        })
      );
    });

    test('creates directory if not exists', async () => {
      const config = { mods: ['core'], startWorld: 'test:test' };

      fs.writeFile.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(JSON.stringify(config));
      fs.mkdir.mockResolvedValue(undefined);
      fs.rename.mockResolvedValue(undefined);

      await service.saveConfig(config);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    test('uses atomic write (temp then rename)', async () => {
      const config = { mods: ['core'], startWorld: 'test:test' };
      const writeOrder = [];

      fs.writeFile.mockImplementation(() => {
        writeOrder.push('write');
        return Promise.resolve();
      });
      fs.readFile.mockResolvedValue(JSON.stringify(config));
      fs.mkdir.mockImplementation(() => {
        writeOrder.push('mkdir');
        return Promise.resolve();
      });
      fs.rename.mockImplementation(() => {
        writeOrder.push('rename');
        return Promise.resolve();
      });

      await service.saveConfig(config);

      // Write to temp should happen before rename
      expect(writeOrder).toEqual(['write', 'mkdir', 'rename']);
      // Temp file path should be in temp directory
      expect(fs.writeFile.mock.calls[0][0]).toMatch(/game-\d+\.json/);
    });

    test('cleans up temp file on failure', async () => {
      const config = { mods: ['core'], startWorld: 'test:test' };

      fs.writeFile.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(JSON.stringify(config));
      fs.mkdir.mockResolvedValue(undefined);
      fs.rename.mockRejectedValue(new Error('Rename failed'));
      fs.unlink.mockResolvedValue(undefined);

      await expect(service.saveConfig(config)).rejects.toThrow('Rename failed');
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('ignores cleanup errors on failure', async () => {
      const config = { mods: ['core'], startWorld: 'test:test' };

      fs.writeFile.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(JSON.stringify(config));
      fs.mkdir.mockResolvedValue(undefined);
      fs.rename.mockRejectedValue(new Error('Rename failed'));
      fs.unlink.mockRejectedValue(new Error('Cleanup failed'));

      // Should still throw the original error, not the cleanup error
      await expect(service.saveConfig(config)).rejects.toThrow('Rename failed');
    });

    test('verifies written content is valid JSON', async () => {
      const config = { mods: ['core'], startWorld: 'test:test' };

      fs.writeFile.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue('invalid json');
      fs.unlink.mockResolvedValue(undefined);

      await expect(service.saveConfig(config)).rejects.toThrow();
    });
  });

  describe('loadConfig', () => {
    test('returns file contents', async () => {
      const mockConfig = {
        mods: ['core', 'positioning'],
        startWorld: 'dredgers:dredgers',
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await service.loadConfig();

      expect(result).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('game.json'),
        'utf-8'
      );
    });

    test('returns default when file missing', async () => {
      const enoentError = new Error('ENOENT');
      enoentError.code = 'ENOENT';
      fs.readFile.mockRejectedValue(enoentError);

      const result = await service.loadConfig();

      expect(result).toEqual({
        mods: ['core'],
        startWorld: '',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'GameConfigService: Config file not found, returning default'
      );
    });

    test('throws on other errors', async () => {
      const accessError = new Error('Access denied');
      accessError.code = 'EACCES';
      fs.readFile.mockRejectedValue(accessError);

      await expect(service.loadConfig()).rejects.toThrow('Access denied');
    });

    test('throws on invalid JSON', async () => {
      fs.readFile.mockResolvedValue('{ invalid json }');

      await expect(service.loadConfig()).rejects.toThrow();
    });
  });
});
