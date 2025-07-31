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
      expect(
        () => new MultiTargetActionFormatter(mockBaseFormatter, null)
      ).toThrow();
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

      const result = formatter.format(
        actionDef,
        targetContext,
        mockEntityManager,
        options,
        deps
      );

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
      // New behavior: multiple entities generate array of combinations
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(4); // 2 items × 2 targets
      expect(result.value).toEqual(
        expect.arrayContaining([
          'throw Small Rock at Goblin',
          'throw Small Rock at Orc',
          'throw Knife at Goblin',
          'throw Knife at Orc',
        ])
      );
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
      // New behavior: multiple entities generate array of combinations
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(4); // 2 items × 2 targets
      expect(result.value).toEqual(
        expect.arrayContaining([
          'throw Small Rock at Goblin',
          'throw Small Rock at Orc',
          'throw Knife at Goblin',
          'throw Knife at Orc',
        ])
      );
    });

    it('should reject actions with empty target arrays (strict validation)', () => {
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

      // With strict validation, actions with missing required targets should fail
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Required target 'primary' could not be resolved");
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
      // Single entity per target still returns string (legacy behavior)
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

      if (!result.ok) {
        console.log('Format error:', result.error);
      }
      expect(result.ok).toBe(true);
      // New behavior: multiple entities generate array of combinations
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(4); // 2 items × 2 targets
      expect(result.value).toEqual(
        expect.arrayContaining([
          'use Small Rock on Goblin',
          'use Small Rock on Orc',
          'use Knife on Goblin',
          'use Knife on Orc',
        ])
      );
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
      secondary: [{ id: 'enemy1', displayName: 'Goblin' }],
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

      expect(result.ok).toBe(false);
      expect(result.error).toContain('No valid target combinations could be generated for required targets');
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

  describe('Branch Coverage Edge Cases', () => {
    it('should handle null deps parameter', () => {
      const actionDef = {
        id: 'test:null_deps',
        template: 'use {item}',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Sword' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        null // null deps to cover line 56 branch
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('use Sword');
    });

    it('should handle undefined deps parameter', () => {
      const actionDef = {
        id: 'test:undefined_deps',
        template: 'use {item}',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Sword' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true }
        // undefined deps to cover line 56 branch
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('use Sword');
    });

    it('should handle templates with no standard placeholders for primary targets', () => {
      const actionDef = {
        id: 'test:unusual_placeholders',
        template: 'activate {weapon} with {magic}',
      };

      const resolvedTargets = {
        primary: [{ id: 'sword1', displayName: 'Magic Sword' }],
        secondary: [{ id: 'spell1', displayName: 'Fire Spell' }],
      };

      const targetDefinitions = {
        primary: {}, // no placeholder defined
        secondary: {}, // no placeholder defined
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      // Should use 'weapon' (first placeholder) for primary, 'magic' (second placeholder) for secondary
      expect(result.value).toBe('activate Magic Sword with Fire Spell');
    });

    it('should handle templates with no placeholders at all', () => {
      const actionDef = {
        id: 'test:no_placeholders',
        template: 'perform action',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Sword' }],
      };

      const targetDefinitions = {
        primary: {}, // no placeholder defined
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      // Should remain unchanged as no placeholders to replace
      expect(result.value).toBe('perform action');
    });

    it('should handle combination generation with maximum limit enforcement', () => {
      const combinationActionDef = {
        id: 'test:max_combinations',
        template: 'use {item} on {target}',
        generateCombinations: true,
      };

      // Create exactly enough targets to trigger maxCombinations limit
      const largeTargetSet = {
        primary: Array.from({ length: 60 }, (_, i) => ({
          id: `item${i}`,
          displayName: `Item ${i}`,
        })),
        secondary: [{ id: 'target1', displayName: 'Target' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        combinationActionDef,
        largeTargetSet,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Should respect the 50 combination limit (maxCombinations)
      expect(result.value.length).toBeLessThanOrEqual(50);
    });

    it('should handle combination generation with mixed empty target arrays', () => {
      const combinationActionDef = {
        id: 'test:mixed_empty',
        template: 'use {item} on {target} at {location}',
        generateCombinations: true,
      };

      const mixedTargets = {
        primary: [{ id: 'item1', displayName: 'Sword' }],
        secondary: [], // empty array to cover line 198 branch
        tertiary: [{ id: 'location1', displayName: 'Forest' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
        tertiary: { placeholder: 'location' },
      };

      const result = formatter.formatMultiTarget(
        combinationActionDef,
        mixedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Required target 'secondary' could not be resolved");
    });

    it('should handle combination generation when some combinations have invalid data', () => {
      // This test is designed to potentially trigger the line 94 branch
      // by using data that might cause formatting to fail naturally
      const combinationActionDef = {
        id: 'test:invalid_combinations',
        template: 'use {item} on {target}',
        generateCombinations: true,
      };

      // Create targets with some potentially problematic data
      const resolvedTargets = {
        primary: [
          { id: 'item1', displayName: 'Valid Item' },
          { id: null }, // Invalid target that might cause issues
          { id: 'item3', displayName: 'Another Valid Item' },
        ],
        secondary: [{ id: 'target1', displayName: 'Valid Target' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        combinationActionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Should handle invalid data gracefully and include valid combinations
      expect(result.value.length).toBeGreaterThan(0);
      // Check that at least one valid combination exists
      const validCombinations = result.value.filter(
        (cmd) =>
          cmd.includes('Valid Item') || cmd.includes('Another Valid Item')
      );
      expect(validCombinations.length).toBeGreaterThan(0);
    });

    it('should handle edge cases in placeholder fallback for secondary targets', () => {
      const actionDef = {
        id: 'test:secondary_fallback',
        template: 'activate {unusual} for {nonstandard}',
      };

      const resolvedTargets = {
        primary: [{ id: 'item1', displayName: 'Primary Item' }],
        secondary: [{ id: 'item2', displayName: 'Secondary Item' }],
      };

      // Empty target definitions to force fallback logic
      const targetDefinitions = {
        primary: {}, // no placeholder - should use 'unusual' (first available)
        secondary: {}, // no placeholder - should use 'nonstandard' (second available)
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('activate Primary Item for Secondary Item');
    });

    it('should handle extreme combination generation with exactly 51 targets', () => {
      // This should test the exact boundary for the maxCombinations limit
      const combinationActionDef = {
        id: 'test:exact_limit',
        template: 'use {item}',
        generateCombinations: true,
      };

      // Create exactly 51 targets to trigger the break condition
      const largeTargets = {
        primary: Array.from({ length: 51 }, (_, i) => ({
          id: `item${i}`,
          displayName: `Item ${i}`,
        })),
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
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
      // Should hit the 50 combination limit exactly
      expect(result.value.length).toBe(50);
    });
  });
});
