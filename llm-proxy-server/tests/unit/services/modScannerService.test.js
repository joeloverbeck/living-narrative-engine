import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModScannerService } from '../../../src/services/modScannerService.js';
import fs from 'fs/promises';
import path from 'path';

jest.mock('fs/promises');

describe('ModScannerService', () => {
  let logger;
  let service;
  const mockModsPath = '/mock/data/mods';

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock process.cwd to return a predictable path
    jest.spyOn(process, 'cwd').mockReturnValue('/mock');

    service = new ModScannerService(logger, 'data/mods');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('requires a logger', () => {
      expect(() => new ModScannerService()).toThrow(
        'ModScannerService: logger is required'
      );
    });

    test('uses default mods path when not provided', () => {
      const defaultService = new ModScannerService(logger);
      expect(logger.debug).toHaveBeenCalledWith(
        'ModScannerService: Instance created',
        expect.objectContaining({
          modsPath: expect.any(String),
        })
      );
    });

    test('logs instance creation with mods path', () => {
      expect(logger.debug).toHaveBeenCalledWith(
        'ModScannerService: Instance created',
        expect.objectContaining({
          modsPath: expect.stringContaining('data/mods'),
        })
      );
    });
  });

  describe('scanMods', () => {
    test('returns array of mod metadata', async () => {
      const mockEntries = [
        { name: 'core', isDirectory: () => true },
        { name: 'positioning', isDirectory: () => true },
      ];

      const coreManifest = {
        id: 'core',
        name: 'Core',
        version: '1.0.0',
        description: 'Core game mechanics',
        author: 'joeloverbeck',
        dependencies: [],
        conflicts: [],
      };

      const positioningManifest = {
        id: 'positioning',
        name: 'Positioning',
        version: '1.0.0',
        description: 'Character positioning system',
        author: 'joeloverbeck',
        dependencies: [{ id: 'core', version: '>=1.0.0' }],
        conflicts: [],
      };

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('core')) {
          return Promise.resolve(JSON.stringify(coreManifest));
        }
        if (filePath.includes('positioning')) {
          return Promise.resolve(JSON.stringify(positioningManifest));
        }
        return Promise.reject(new Error('File not found'));
      });
      fs.stat.mockRejectedValue({ code: 'ENOENT' });

      const mods = await service.scanMods();

      expect(mods).toHaveLength(2);
      expect(mods[0]).toEqual(
        expect.objectContaining({
          id: 'core',
          name: 'Core',
          version: '1.0.0',
          description: 'Core game mechanics',
          author: 'joeloverbeck',
          dependencies: [],
          conflicts: [],
          hasWorlds: false,
        })
      );
      expect(mods[1]).toEqual(
        expect.objectContaining({
          id: 'positioning',
          name: 'Positioning',
          dependencies: [{ id: 'core', version: '>=1.0.0' }],
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'ModScannerService: Scanned 2 mods'
      );
    });

    test('returns empty array when no mods directory exists', async () => {
      const enoentError = new Error('ENOENT');
      enoentError.code = 'ENOENT';
      fs.readdir.mockRejectedValue(enoentError);

      const mods = await service.scanMods();

      expect(mods).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'ModScannerService: Mods directory does not exist',
        expect.objectContaining({
          path: expect.any(String),
        })
      );
    });

    test('skips directories without mod-manifest.json', async () => {
      const mockEntries = [
        { name: 'has-manifest', isDirectory: () => true },
        { name: 'no-manifest', isDirectory: () => true },
      ];

      const validManifest = {
        id: 'has_manifest',
        name: 'Has Manifest',
        version: '1.0.0',
      };

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockImplementation((filePath) => {
        // Match the full directory path with separator to avoid substring matching issues
        if (filePath.includes('/has-manifest/')) {
          return Promise.resolve(JSON.stringify(validManifest));
        }
        return Promise.reject(new Error('File not found'));
      });
      fs.stat.mockRejectedValue({ code: 'ENOENT' });

      const mods = await service.scanMods();

      expect(mods).toHaveLength(1);
      expect(mods[0].id).toBe('has_manifest');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping mod no-manifest')
      );
    });

    test('handles malformed manifest.json gracefully', async () => {
      const mockEntries = [
        { name: 'good-mod', isDirectory: () => true },
        { name: 'bad-mod', isDirectory: () => true },
      ];

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('good-mod')) {
          return Promise.resolve(
            JSON.stringify({ id: 'good_mod', name: 'Good', version: '1.0.0' })
          );
        }
        if (filePath.includes('bad-mod')) {
          return Promise.resolve('{ invalid json }');
        }
        return Promise.reject(new Error('File not found'));
      });
      fs.stat.mockRejectedValue({ code: 'ENOENT' });

      const mods = await service.scanMods();

      expect(mods).toHaveLength(1);
      expect(mods[0].id).toBe('good_mod');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping mod bad-mod')
      );
    });

    test('detects hasWorlds correctly when worlds directory exists', async () => {
      const mockEntries = [{ name: 'world-mod', isDirectory: () => true }];

      const manifest = {
        id: 'world_mod',
        name: 'World Mod',
        version: '1.0.0',
      };

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockResolvedValue(JSON.stringify(manifest));
      fs.stat.mockResolvedValue({ isDirectory: () => true });

      const mods = await service.scanMods();

      expect(mods).toHaveLength(1);
      expect(mods[0].hasWorlds).toBe(true);
    });

    test('parses dependencies array', async () => {
      const mockEntries = [{ name: 'dep-mod', isDirectory: () => true }];

      const manifest = {
        id: 'dep_mod',
        name: 'Dep Mod',
        version: '1.0.0',
        dependencies: [
          { id: 'core', version: '>=1.0.0' },
          { id: 'other', version: '^2.0.0' },
        ],
      };

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockResolvedValue(JSON.stringify(manifest));
      fs.stat.mockRejectedValue({ code: 'ENOENT' });

      const mods = await service.scanMods();

      expect(mods[0].dependencies).toEqual([
        { id: 'core', version: '>=1.0.0' },
        { id: 'other', version: '^2.0.0' },
      ]);
    });

    test('parses conflicts array', async () => {
      const mockEntries = [{ name: 'conflict-mod', isDirectory: () => true }];

      const manifest = {
        id: 'conflict_mod',
        name: 'Conflict Mod',
        version: '1.0.0',
        conflicts: ['incompatible_mod', 'another_bad_mod'],
      };

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockResolvedValue(JSON.stringify(manifest));
      fs.stat.mockRejectedValue({ code: 'ENOENT' });

      const mods = await service.scanMods();

      expect(mods[0].conflicts).toEqual([
        'incompatible_mod',
        'another_bad_mod',
      ]);
    });

    test('skips non-directory entries', async () => {
      const mockEntries = [
        { name: 'valid-mod', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
        { name: '.hidden', isDirectory: () => false },
      ];

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockResolvedValue(
        JSON.stringify({ id: 'valid_mod', name: 'Valid', version: '1.0.0' })
      );
      fs.stat.mockRejectedValue({ code: 'ENOENT' });

      const mods = await service.scanMods();

      expect(mods).toHaveLength(1);
      expect(mods[0].id).toBe('valid_mod');
    });

    test('uses default values for missing optional fields', async () => {
      const mockEntries = [{ name: 'minimal-mod', isDirectory: () => true }];

      const manifest = {
        id: 'minimal_mod',
        name: 'Minimal Mod',
        version: '1.0.0',
        // No description, author, dependencies, or conflicts
      };

      fs.readdir.mockResolvedValue(mockEntries);
      fs.readFile.mockResolvedValue(JSON.stringify(manifest));
      fs.stat.mockRejectedValue({ code: 'ENOENT' });

      const mods = await service.scanMods();

      expect(mods[0]).toEqual({
        id: 'minimal_mod',
        name: 'Minimal Mod',
        version: '1.0.0',
        description: '',
        author: 'Unknown',
        dependencies: [],
        conflicts: [],
        hasWorlds: false,
      });
    });

    test('re-throws non-ENOENT directory errors', async () => {
      const accessError = new Error('Access denied');
      accessError.code = 'EACCES';
      fs.readdir.mockRejectedValue(accessError);

      await expect(service.scanMods()).rejects.toThrow('Access denied');
    });
  });
});
