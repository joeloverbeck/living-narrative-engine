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
      // Use mods with proper world metadata
      const modsWithWorldMetadata = [
        {
          id: 'core',
          name: 'Core',
          hasWorlds: true,
          worlds: [{ id: 'core:main', name: 'Core World', description: 'Core game world' }],
        },
        {
          id: 'adventure-mod',
          name: 'Adventure Mod',
          hasWorlds: true,
          worlds: [{ id: 'adventure-mod:quest', name: 'Quest World', description: 'Adventure world' }],
        },
      ];
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(modsWithWorldMetadata);

      const result = await service.discoverWorlds(['core', 'adventure-mod']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('core:main');
      expect(result[1].id).toBe('adventure-mod:quest');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldDiscoveryService: Discovering worlds from active mods...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldDiscoveryService: Discovered 2 worlds from 2 mods'
      );
    });

    it('should filter to only active mods', async () => {
      // Use mods with proper world metadata
      const modsWithWorldMetadata = [
        {
          id: 'core',
          name: 'Core',
          hasWorlds: true,
          worlds: [{ id: 'core:main', name: 'Core World', description: 'Core game world' }],
        },
        {
          id: 'adventure-mod',
          name: 'Adventure Mod',
          hasWorlds: true,
          worlds: [{ id: 'adventure-mod:quest', name: 'Quest World', description: 'Adventure world' }],
        },
      ];
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(modsWithWorldMetadata);

      // Only request 'core', not 'adventure-mod'
      const result = await service.discoverWorlds(['core']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:main');
      expect(result[0].modId).toBe('core');
      expect(result[0].worldId).toBe('main');
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
      // Mods must provide explicit worlds array with proper world metadata
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
        {
          id: 'test-mod',
          name: 'Test Mod',
          description: 'A test mod description',
          hasWorlds: true,
          worlds: [
            {
              id: 'test-mod:main-world',
              name: 'Test World',
              description: 'A test world description',
            },
          ],
        },
      ]);

      const result = await service.discoverWorlds(['test-mod']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'test-mod:main-world',
        modId: 'test-mod',
        worldId: 'main-world',
        name: 'Test World',
        description: 'A test world description',
      });
    });

    it('should use world metadata when provided', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
        {
          id: 'p_erotica_kern',
          name: 'p_erotica_kern',
          description: 'Kern mod',
          hasWorlds: true,
          worlds: [
            {
              id: 'p_erotica_kern:kern',
              name: 'Marla Kern Scenario',
              description: 'A scenario description',
            },
          ],
        },
      ]);

      const result = await service.discoverWorlds(['p_erotica_kern']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'p_erotica_kern:kern',
        modId: 'p_erotica_kern',
        worldId: 'kern',
        name: 'Marla Kern Scenario',
        description: 'A scenario description',
      });
    });

    it('should use world description when provided', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
        {
          id: 'minimal-mod',
          name: 'Minimal Mod',
          description: '',
          hasWorlds: true,
          worlds: [
            {
              id: 'minimal-mod:world',
              name: 'Minimal World',
              description: 'The world description',
            },
          ],
        },
      ]);

      const result = await service.discoverWorlds(['minimal-mod']);

      expect(result[0].description).toBe('The world description');
    });

    it('should use mod description as fallback when world description is empty', async () => {
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
        {
          id: 'no-world-desc-mod',
          name: 'No World Desc Mod',
          description: 'Mod level description',
          hasWorlds: true,
          worlds: [
            {
              id: 'no-world-desc-mod:world',
              name: 'World Name',
              description: '',
            },
          ],
        },
      ]);

      const result = await service.discoverWorlds(['no-world-desc-mod']);

      // Falls back to mod description when world description is empty
      expect(result[0].description).toBe('Mod level description');
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

    describe('legacy fallback bug fix', () => {
      it('should return empty array when mod.worlds is undefined (no legacy fallback)', async () => {
        // Bug reproduction: mods without explicit worlds should NOT generate modId:modId
        mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
          {
            id: 'mod-without-worlds',
            name: 'Mod Without Worlds',
            description: 'A mod that has no worlds defined',
            hasWorlds: true,
            // NOTE: No 'worlds' property - this used to trigger legacy fallback
          },
        ]);

        const result = await service.discoverWorlds(['mod-without-worlds']);

        // Should NOT create a world with modId:modId format
        expect(result).toEqual([]);
        expect(result.find((w) => w.id === 'mod-without-worlds:mod-without-worlds')).toBeUndefined();
      });

      it('should return empty array when mod.worlds is empty array', async () => {
        mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
          {
            id: 'empty-worlds-mod',
            name: 'Empty Worlds Mod',
            hasWorlds: true,
            worlds: [], // Empty array
          },
        ]);

        const result = await service.discoverWorlds(['empty-worlds-mod']);

        expect(result).toEqual([]);
      });

      it('should return empty array when all worlds are filtered out due to invalid data', async () => {
        mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
          {
            id: 'invalid-worlds-mod',
            name: 'Invalid Worlds Mod',
            hasWorlds: true,
            worlds: [
              null,
              undefined,
              { id: '' }, // Empty string ID
              { id: 123 }, // Non-string ID
              { name: 'No ID' }, // Missing ID
            ],
          },
        ]);

        const result = await service.discoverWorlds(['invalid-worlds-mod']);

        expect(result).toEqual([]);
      });

      it('should log warning when mod.worlds has entries but all are invalid', async () => {
        mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
          {
            id: 'bad-data-mod',
            name: 'Bad Data Mod',
            hasWorlds: true,
            worlds: [{ id: '' }, { name: 'Missing ID' }],
          },
        ]);

        await service.discoverWorlds(['bad-data-mod']);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "WorldDiscoveryService: Mod 'bad-data-mod' has worlds array but no valid world entries"
        );
      });

      it('should correctly use world ID from metadata (not modId:modId)', async () => {
        // This is the exact scenario from the user's bug report
        mockModDiscoveryService.getModsWithWorlds.mockResolvedValue([
          {
            id: 'p_erotica_kern',
            name: 'p_erotica_kern',
            description: 'Kern mod',
            hasWorlds: true,
            worlds: [
              {
                id: 'p_erotica_kern:kern', // Correct world ID
                name: 'Marla Kern Scenario',
                description: 'A scenario description',
              },
            ],
          },
        ]);

        const result = await service.discoverWorlds(['p_erotica_kern']);

        expect(result).toHaveLength(1);
        // Should use the actual world ID, NOT p_erotica_kern:p_erotica_kern
        expect(result[0].id).toBe('p_erotica_kern:kern');
        expect(result[0].worldId).toBe('kern');
        expect(result[0].modId).toBe('p_erotica_kern');
      });
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
      // Use mods with proper world metadata
      const modsWithWorldMetadata = [
        {
          id: 'core',
          name: 'Core',
          hasWorlds: true,
          worlds: [{ id: 'core:main', name: 'Core World', description: 'Core game world' }],
        },
        {
          id: 'adventure-mod',
          name: 'Adventure Mod',
          hasWorlds: true,
          worlds: [{ id: 'adventure-mod:quest', name: 'Quest World', description: 'Adventure world' }],
        },
      ];
      mockModDiscoveryService.getModsWithWorlds.mockResolvedValue(modsWithWorldMetadata);

      const result = await service.isWorldAvailable('core:main', [
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
