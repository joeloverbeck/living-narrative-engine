/**
 * @file Unit tests for MultiTargetActionFormatter
 * @see src/actions/formatters/MultiTargetActionFormatter.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

describe('MultiTargetActionFormatter', () => {
  let formatter;
  let mockBaseFormatter;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    mockBaseFormatter = {
      format: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    formatter = new MultiTargetActionFormatter(mockBaseFormatter, mockLogger);
  });

  describe('Constructor', () => {
    it('should create formatter with base formatter and logger', () => {
      expect(formatter).toBeInstanceOf(MultiTargetActionFormatter);
    });

    it('should validate dependencies', () => {
      expect(() => new MultiTargetActionFormatter(null, mockLogger)).toThrow();
      expect(() => new MultiTargetActionFormatter(mockBaseFormatter, null)).toThrow();
    });
  });

  describe('Legacy Format Support', () => {
    it('should delegate to base formatter for legacy format calls', () => {
      const actionDef = { id: 'test:action', template: 'test {target}' };
      const targetContext = { entityId: 'target1', displayName: 'Target' };
      const options = { debug: true };
      const deps = { displayNameFn: jest.fn() };

      mockBaseFormatter.format.mockReturnValue({
        ok: true,
        value: 'formatted command',
      });

      const result = formatter.format(actionDef, targetContext, mockEntityManager, options, deps);

      expect(mockBaseFormatter.format).toHaveBeenCalledWith(
        actionDef,
        targetContext,
        mockEntityManager,
        options,
        deps
      );
      expect(result).toEqual({ ok: true, value: 'formatted command' });
    });
  });

  describe('Multi-Target Formatting', () => {
    const actionDef = {
      id: 'combat:throw',
      name: 'Throw',
      template: 'throw {item} at {target}',
    };

    const resolvedTargets = {
      primary: [
        { id: 'rock1', displayName: 'Small Rock' },
        { id: 'knife1', displayName: 'Knife' },
      ],
      secondary: [
        { id: 'enemy1', displayName: 'Goblin' },
        { id: 'enemy2', displayName: 'Orc' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'item' },
      secondary: { placeholder: 'target' },
    };

    const options = { debug: true };
    const deps = { targetDefinitions };

    it('should format single multi-target action correctly', () => {
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        options,
        deps
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('throw Small Rock at Goblin');
    });

    it('should handle missing placeholder in target definitions', () => {
      const depsWithoutPlaceholder = {
        targetDefinitions: {
          primary: {},
          secondary: {},
        },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        options,
        depsWithoutPlaceholder
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('throw Small Rock at Goblin');
    });

    it('should handle empty target arrays', () => {
      const emptyTargets = {
        primary: [],
        secondary: [{ id: 'enemy1', displayName: 'Goblin' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        emptyTargets,
        mockEntityManager,
        options,
        deps
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('throw {item} at Goblin');
    });

    it('should use entity ID as fallback for display name', () => {
      const targetsWithoutDisplayName = {
        primary: [{ id: 'rock1' }],
        secondary: [{ id: 'enemy1' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        targetsWithoutDisplayName,
        mockEntityManager,
        options,
        deps
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('throw rock1 at enemy1');
    });

    it('should handle action without template falling back to name', () => {
      const actionWithoutTemplate = {
        id: 'test:action',
        name: 'use {item} on {target}',
      };

      const result = formatter.formatMultiTarget(
        actionWithoutTemplate,
        resolvedTargets,
        mockEntityManager,
        options,
        deps
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('use Small Rock on Goblin');
    });
  });

  describe('Combination Generation', () => {
    const combinationActionDef = {
      id: 'combat:multi_throw',
      name: 'Multi Throw',
      template: 'throw {item} at {target}',
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        { id: 'rock1', displayName: 'Small Rock' },
        { id: 'knife1', displayName: 'Knife' },
      ],
      secondary: [
        { id: 'enemy1', displayName: 'Goblin' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'item' },
      secondary: { placeholder: 'target' },
    };

    it('should generate combinations when enabled', () => {
      const result = formatter.formatMultiTarget(
        combinationActionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value).toContain('throw Small Rock at Goblin');
      expect(result.value).toContain('throw Knife at Goblin');
    });

    it('should handle single target type combinations', () => {
      const singleTypeTargets = {
        primary: [
          { id: 'rock1', displayName: 'Small Rock' },
          { id: 'knife1', displayName: 'Knife' },
        ],
      };

      const singleTypeDefs = {
        primary: { placeholder: 'item' },
      };

      const actionDefSingleType = {
        ...combinationActionDef,
        template: 'throw {item}',
      };

      const result = formatter.formatMultiTarget(
        actionDefSingleType,
        singleTypeTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions: singleTypeDefs }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toContain('throw Small Rock');
      expect(result.value).toContain('throw Knife');
    });

    it('should respect combination limits', () => {
      // Create large target sets to test limits
      const largeTargets = {
        primary: Array.from({ length: 20 }, (_, i) => ({
          id: `item${i}`,
          displayName: `Item ${i}`,
        })),
        secondary: Array.from({ length: 20 }, (_, i) => ({
          id: `enemy${i}`,
          displayName: `Enemy ${i}`,
        })),
      };

      const result = formatter.formatMultiTarget(
        combinationActionDef,
        largeTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Should respect the 50 combination limit and 10 first dimension limit
      expect(result.value.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty targets for combinations', () => {
      const result = formatter.formatMultiTarget(
        combinationActionDef,
        {},
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle exceptions during formatting', () => {
      const actionDef = {
        id: 'test:error',
        template: 'error {item}',
      };

      // Create a scenario that might cause an error
      const resolvedTargets = {
        primary: null, // This might cause an error
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Multi-target formatting failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle missing target definitions', () => {
      const actionDef = {
        id: 'test:missing_defs',
        template: 'test {item}',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Item' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        {} // No targetDefinitions
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('test Item');
    });

    it('should handle null or undefined inputs gracefully', () => {
      const result = formatter.formatMultiTarget(
        null,
        null,
        mockEntityManager,
        {},
        {}
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Multi-target formatting failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle targets with special characters in display names', () => {
      const actionDef = {
        id: 'test:special',
        template: 'use {item}',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Item with "quotes" & symbols' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('use Item with "quotes" & symbols');
    });

    it('should handle multiple placeholders of the same type', () => {
      const actionDef = {
        id: 'test:multiple',
        template: 'move {item} from {item} to {target}',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Sword' }],
        secondary: [{ id: 'location1', displayName: 'Chest' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('move Sword from Sword to Chest');
    });

    it('should handle case sensitivity in placeholders', () => {
      const actionDef = {
        id: 'test:case',
        template: 'use {Item} with {TARGET}',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Sword' }],
        secondary: [{ id: 'target1', displayName: 'Shield' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'Item' },
        secondary: { placeholder: 'TARGET' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('use Sword with Shield');
    });
  });
});