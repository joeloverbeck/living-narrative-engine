/**
 * @file Unit tests for WorldDiscoveryService
 * @see src/modManager/services/WorldDiscoveryService.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import WorldDiscoveryService from '../../../../src/modManager/services/WorldDiscoveryService.js';

describe('WorldDiscoveryService', () => {
  /** @type {jest.Mocked<{debug: Function, info: Function, warn: Function, error: Function}>} */
  let mockLogger;
  /** @type {jest.Mocked<{getModsWithWorlds: Function}>} */
  let mockModDiscoveryService;
  /** @type {WorldDiscoveryService} */
  let service;

  const mockModsWithWorlds = [
    {
      id: 'core',
      name: 'Core',
      version: '1.0.0',
      description: 'Core game content',
      author: 'System',
      dependencies: [],
      conflicts: [],
      hasWorlds: true,
    },
    {
      id: 'adventure-mod',
      name: 'Adventure Mod',
      version: '2.0.0',
      description: 'A fantastic adventure',
      author: 'Creator',
      dependencies: [{ id: 'core', version: '>=1.0.0' }],
      conflicts: [],
      hasWorlds: true,
    },
  ];

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockModDiscoveryService = {
      getModsWithWorlds: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(
        () =>
          new WorldDiscoveryService({
            modDiscoveryService: mockModDiscoveryService,
          })
      ).toThrow('WorldDiscoveryService: logger is required');
    });

    it('should throw error when modDiscoveryService is not provided', () => {
      expect(() => new WorldDiscoveryService({ logger: mockLogger })).toThrow(
        'WorldDiscoveryService: modDiscoveryService is required'
      );
    });

    it('should throw error when both dependencies are missing', () => {
      expect(() => new WorldDiscoveryService({})).toThrow(
        'WorldDiscoveryService: logger is required'
      );
    });

    it('should create instance with valid dependencies', () => {
      service = new WorldDiscoveryService({
        logger: mockLogger,
        modDiscoveryService: mockModDiscoveryService,
      });
      expect(service).toBeInstanceOf(WorldDiscoveryService);
    });
  });

  describe('discoverWorlds', () => {
    beforeEach(() => {
      service = new WorldDiscoveryService({
        logger: mockLogger,
        modDiscoveryService: mockModDiscoveryService,
      });
    });

    it('should return worlds from active mods only', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(
        mockModsWithWorlds
      );

      const result = await service.discoverWorlds(['core', 'adventure-mod']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('core:core');
      expect(result[1].id).toBe('adventure-mod:adventure-mod');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldDiscoveryService: Discovering worlds from active mods...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldDiscoveryService: Discovered 2 worlds from 2 mods'
      );
    });

    it('should filter to only active mods', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(
        mockModsWithWorlds
      );

      // Only request 'core', not 'adventure-mod'
      const result = await service.discoverWorlds(['core']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:core');
      expect(result[0].modId).toBe('core');
      expect(result[0].worldId).toBe('core');
    });

    it('should return empty array when no mods have worlds', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([]);

      const result = await service.discoverWorlds(['core']);

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldDiscoveryService: No active mods contain worlds'
      );
    });

    it('should return empty array when no active mods have worlds', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(
        mockModsWithWorlds
      );

      // Request a mod that doesn't have worlds
      const result = await service.discoverWorlds(['non-existent-mod']);

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldDiscoveryService: No active mods contain worlds'
      );
    });

    it('should create correct world structure with mod name and description', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
        {
          id: 'test-mod',
          name: 'Test Mod',
          description: 'A test mod description',
          hasWorlds: true,
        },
      ]);

      const result = await service.discoverWorlds(['test-mod']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'test-mod:test-mod',
        modId: 'test-mod',
        worldId: 'test-mod',
        name: 'Test Mod World',
        description: 'A test mod description',
      });
    });

    it('should use fallback description when mod description is empty', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
        {
          id: 'minimal-mod',
          name: 'Minimal Mod',
          description: '',
          hasWorlds: true,
        },
      ]);

      const result = await service.discoverWorlds(['minimal-mod']);

      expect(result[0].description).toBe('Main world from Minimal Mod');
    });

    it('should use fallback description when mod description is undefined', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
        {
          id: 'no-desc-mod',
          name: 'No Description Mod',
          hasWorlds: true,
        },
      ]);

      const result = await service.discoverWorlds(['no-desc-mod']);

      expect(result[0].description).toBe('Main world from No Description Mod');
    });

    it('should handle empty activeModIds array', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(
        mockModsWithWorlds
      );

      const result = await service.discoverWorlds([]);

      expect(result).toEqual([]);
    });

    it('should call modDiscoveryService.getModsWithWorlds', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([]);

      await service.discoverWorlds(['core']);

      expect(mockModDiscoveryService.getModsWithWorlds).toHaveBeenCalledTimes(1);
    });
  });

  describe('isWorldAvailable', () => {
    beforeEach(() => {
      service = new WorldDiscoveryService({
        logger: mockLogger,
        modDiscoveryService: mockModDiscoveryService,
      });
    });

    it('should return true for valid world', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(
        mockModsWithWorlds
      );

      const result = await service.isWorldAvailable('core:core', [
        'core',
        'adventure-mod',
      ]);

      expect(result).toBe(true);
    });

    it('should return false for invalid world', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(
        mockModsWithWorlds
      );

      const result = await service.isWorldAvailable('non-existent:world', [
        'core',
      ]);

      expect(result).toBe(false);
    });

    it('should return false when world mod is not in active mods', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(
        mockModsWithWorlds
      );

      // adventure-mod has worlds but is not in active mods
      const result = await service.isWorldAvailable(
        'adventure-mod:adventure-mod',
        ['core']
      );

      expect(result).toBe(false);
    });

    it('should return false when no mods have worlds', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([]);

      const result = await service.isWorldAvailable('core:core', ['core']);

      expect(result).toBe(false);
    });
  });

  describe('parseWorldId', () => {
    beforeEach(() => {
      service = new WorldDiscoveryService({
        logger: mockLogger,
        modDiscoveryService: mockModDiscoveryService,
      });
    });

    it('should correctly split modId:worldId', () => {
      const result = service.parseWorldId('core:main-world');

      expect(result).toEqual({
        modId: 'core',
        worldId: 'main-world',
      });
    });

    it('should handle multiple colons in worldId', () => {
      const result = service.parseWorldId('mod:world:sub:part');

      expect(result).toEqual({
        modId: 'mod',
        worldId: 'world:sub:part',
      });
    });

    it('should return null for null input', () => {
      const result = service.parseWorldId(null);

      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = service.parseWorldId(undefined);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = service.parseWorldId('');

      expect(result).toBeNull();
    });

    it('should return null for string without colon', () => {
      const result = service.parseWorldId('no-colon-here');

      expect(result).toBeNull();
    });

    it('should return null for number input', () => {
      const result = service.parseWorldId(123);

      expect(result).toBeNull();
    });

    it('should return null for object input', () => {
      const result = service.parseWorldId({ id: 'test' });

      expect(result).toBeNull();
    });

    it('should return null for colon at start (empty modId)', () => {
      const result = service.parseWorldId(':world');

      expect(result).toBeNull();
    });

    it('should return null for colon at end (empty worldId)', () => {
      const result = service.parseWorldId('mod:');

      expect(result).toBeNull();
    });

    it('should return null for just a colon', () => {
      const result = service.parseWorldId(':');

      expect(result).toBeNull();
    });
  });
});
