/**
 * @file Unit tests for WorldSelectionValidator
 * @see src/modManager/logic/WorldSelectionValidator.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { WorldSelectionValidator } from '../../../../src/modManager/logic/WorldSelectionValidator.js';

describe('WorldSelectionValidator', () => {
  /** @type {jest.Mocked<{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}>} */
  let mockLogger;
  /** @type {jest.Mocked<{discoverWorlds: jest.Mock, parseWorldId: jest.Mock, isWorldAvailable: jest.Mock}>} */
  let mockWorldDiscoveryService;
  /** @type {WorldSelectionValidator} */
  let validator;

  const createMockWorlds = () => [
    { id: 'core:core', modId: 'core', worldId: 'core', name: 'Core World', description: 'Core world' },
    { id: 'adventure:adventure', modId: 'adventure', worldId: 'adventure', name: 'Adventure World', description: 'Adventure world' },
    { id: 'adventure:extra', modId: 'adventure', worldId: 'extra', name: 'Extra World', description: 'Extra world from adventure mod' },
  ];

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockWorldDiscoveryService = {
      discoverWorlds: jest.fn().mockResolvedValue(createMockWorlds()),
      parseWorldId: jest.fn().mockImplementation((worldId) => {
        if (!worldId || typeof worldId !== 'string' || !worldId.includes(':')) {
          return null;
        }
        const [modId, ...rest] = worldId.split(':');
        const parsedWorldId = rest.join(':');
        if (!modId || !parsedWorldId) return null;
        return { modId, worldId: parsedWorldId };
      }),
      isWorldAvailable: jest.fn().mockResolvedValue(true),
    };

    validator = new WorldSelectionValidator({
      logger: mockLogger,
      worldDiscoveryService: mockWorldDiscoveryService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(
        () =>
          new WorldSelectionValidator({
            worldDiscoveryService: mockWorldDiscoveryService,
          })
      ).toThrow('WorldSelectionValidator: logger is required');
    });

    it('should throw error when worldDiscoveryService is not provided', () => {
      expect(
        () =>
          new WorldSelectionValidator({
            logger: mockLogger,
          })
      ).toThrow('WorldSelectionValidator: worldDiscoveryService is required');
    });

    it('should create instance with all dependencies', () => {
      expect(validator).toBeInstanceOf(WorldSelectionValidator);
    });
  });

  describe('validateAfterModChange', () => {
    it('should return unchanged when world still valid', async () => {
      const result = await validator.validateAfterModChange('core:core', ['core', 'adventure']);

      expect(result).toEqual({
        valid: true,
        selectedWorld: 'core:core',
        previousWorld: null,
        action: 'unchanged',
        message: null,
      });
    });

    it('should auto-select when world becomes invalid', async () => {
      // adventure:adventure is no longer available
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([
        { id: 'core:core', modId: 'core', worldId: 'core', name: 'Core World', description: 'Core world' },
      ]);

      const result = await validator.validateAfterModChange('adventure:adventure', ['core']);

      expect(result.valid).toBe(true);
      expect(result.selectedWorld).toBe('core:core');
      expect(result.previousWorld).toBe('adventure:adventure');
      expect(result.action).toBe('auto-selected');
      expect(result.message).toContain('adventure');
      expect(result.message).toContain('Core World');
    });

    it('should clear selection when no worlds available', async () => {
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([]);

      const result = await validator.validateAfterModChange('adventure:adventure', []);

      expect(result).toEqual({
        valid: false,
        selectedWorld: null,
        previousWorld: 'adventure:adventure',
        action: 'cleared',
        message: 'No worlds available. Enable mods that contain worlds.',
      });
    });

    it('should return appropriate message for auto-selection', async () => {
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([
        { id: 'core:core', modId: 'core', worldId: 'core', name: 'Core World', description: 'Core world' },
      ]);

      const result = await validator.validateAfterModChange('adventure:adventure', ['core']);

      expect(result.message).toBe('World "adventure" is no longer available. Selected "Core World" instead.');
    });

    it('should log validation attempt', async () => {
      await validator.validateAfterModChange('core:core', ['core', 'adventure']);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Validating world selection after mod change',
        expect.objectContaining({
          currentWorld: 'core:core',
          modCount: 2,
        })
      );
    });
  });

  describe('validateWorldSelection', () => {
    it('should return valid for existing world', async () => {
      const result = await validator.validateWorldSelection('core:core', ['core']);

      expect(result).toEqual({ valid: true, error: null });
    });

    it('should return error for missing world', async () => {
      mockWorldDiscoveryService.isWorldAvailable.mockResolvedValue(false);

      const result = await validator.validateWorldSelection('nonexistent:world', ['nonexistent']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('World not found in active mods');
    });

    it('should return error for inactive mod', async () => {
      const result = await validator.validateWorldSelection('adventure:adventure', ['core']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('World requires mod "adventure" to be active');
    });

    it('should return error for invalid format', async () => {
      const result = await validator.validateWorldSelection('invalid-world', ['core']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid world ID format (expected modId:worldId)');
    });

    it('should return error for empty world ID', async () => {
      const result = await validator.validateWorldSelection('', ['core']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No world selected');
    });
  });

  describe('wouldInvalidateWorld', () => {
    it('should return true when mod provides world', () => {
      const result = validator.wouldInvalidateWorld('adventure:adventure', 'adventure');

      expect(result).toBe(true);
    });

    it('should return false for unrelated mod', () => {
      const result = validator.wouldInvalidateWorld('core:core', 'adventure');

      expect(result).toBe(false);
    });

    it('should return false for empty world ID', () => {
      const result = validator.wouldInvalidateWorld('', 'adventure');

      expect(result).toBe(false);
    });

    it('should return false for invalid world ID format', () => {
      const result = validator.wouldInvalidateWorld('invalid-world', 'invalid-world');

      expect(result).toBe(false);
    });
  });

  describe('selectBestAlternative (via validateAfterModChange)', () => {
    it('should prefer same mod', async () => {
      // Adventure mod has two worlds, select adventure:extra if adventure:adventure becomes invalid
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([
        { id: 'core:core', modId: 'core', worldId: 'core', name: 'Core World', description: 'Core world' },
        { id: 'adventure:extra', modId: 'adventure', worldId: 'extra', name: 'Extra World', description: 'Extra world' },
      ]);

      const result = await validator.validateAfterModChange('adventure:adventure', ['core', 'adventure']);

      expect(result.selectedWorld).toBe('adventure:extra');
      expect(mockLogger.debug).toHaveBeenCalledWith('Selected alternative world from same mod');
    });

    it('should fall back to core mod', async () => {
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([
        { id: 'core:core', modId: 'core', worldId: 'core', name: 'Core World', description: 'Core world' },
        { id: 'other:other', modId: 'other', worldId: 'other', name: 'Other World', description: 'Other world' },
      ]);

      const result = await validator.validateAfterModChange('adventure:adventure', ['core', 'other']);

      expect(result.selectedWorld).toBe('core:core');
      expect(mockLogger.debug).toHaveBeenCalledWith('Selected core mod world as alternative');
    });

    it('should fall back to first available when no core', async () => {
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([
        { id: 'other:other', modId: 'other', worldId: 'other', name: 'Other World', description: 'Other world' },
        { id: 'another:another', modId: 'another', worldId: 'another', name: 'Another World', description: 'Another world' },
      ]);

      const result = await validator.validateAfterModChange('adventure:adventure', ['other', 'another']);

      expect(result.selectedWorld).toBe('other:other');
      expect(mockLogger.debug).toHaveBeenCalledWith('Selected first available world as alternative');
    });
  });

  describe('getDeactivationWarning', () => {
    it('should return warning for world-providing mod', async () => {
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([
        { id: 'core:core', modId: 'core', worldId: 'core', name: 'Core World', description: 'Core world' },
      ]);

      const warning = await validator.getDeactivationWarning(
        'adventure:adventure',
        'adventure',
        ['core']
      );

      expect(warning).toBe('Deactivating "adventure" will change the starting world to "Core World".');
    });

    it('should return null for unrelated mod', async () => {
      const warning = await validator.getDeactivationWarning(
        'core:core',
        'adventure',
        ['core']
      );

      expect(warning).toBeNull();
    });

    it('should warn about no worlds when all would be removed', async () => {
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([]);

      const warning = await validator.getDeactivationWarning(
        'adventure:adventure',
        'adventure',
        []
      );

      expect(warning).toBe('Deactivating "adventure" will remove all available worlds.');
    });

    it('should return null when world ID is empty', async () => {
      const warning = await validator.getDeactivationWarning(
        '',
        'adventure',
        ['core']
      );

      expect(warning).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle world ID with multiple colons', async () => {
      // e.g., "mod:world:subworld"
      mockWorldDiscoveryService.parseWorldId.mockReturnValue({
        modId: 'mod',
        worldId: 'world:subworld',
      });
      mockWorldDiscoveryService.isWorldAvailable.mockResolvedValue(true);

      const result = await validator.validateWorldSelection('mod:world:subworld', ['mod']);

      expect(result.valid).toBe(true);
    });

    it('should handle null world ID gracefully', async () => {
      const result = await validator.validateWorldSelection(null, ['core']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No world selected');
    });

    it('should handle undefined world ID gracefully', async () => {
      const result = await validator.validateWorldSelection(undefined, ['core']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No world selected');
    });
  });
});
