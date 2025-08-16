/**
 * @file Integration test to reveal the single target multiple entities bug
 * @description This test uses the actual pipeline to test the suspected bug
 * where single targets that resolve to multiple entities don't generate
 * multiple actions when generateCombinations is not set
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { createTestBed } from '../../common/testBed.js';

describe('Single Target Multiple Entities Bug - Integration', () => {
  let testBed;
  let formatter;
  let mockBaseFormatter;

  beforeEach(() => {
    testBed = createTestBed();

    mockBaseFormatter = {
      format: jest
        .fn()
        .mockReturnValue({ ok: true, value: 'legacy formatted' }),
    };

    formatter = new MultiTargetActionFormatter(
      mockBaseFormatter,
      testBed.mockLogger
    );
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('MultiTargetActionFormatter Bug Reproduction', () => {
    it('FIXED: formatMultiTarget now generates multiple actions when generateCombinations is false', () => {
      // Create action definition WITHOUT generateCombinations (should default to false)
      const actionDef = {
        id: 'test:single_target_bug',
        name: 'Use Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
            description: 'Item to use',
          },
        },
        template: 'use {item}',
        // CRITICAL: No generateCombinations property (defaults to false)
      };

      // Simulate what the pipeline would resolve: multiple entities for primary target
      const resolvedTargets = {
        primary: [
          { id: 'potion_001', displayName: 'Health Potion' },
          { id: 'sword_001', displayName: 'Iron Sword' },
          { id: 'scroll_001', displayName: 'Teleport Scroll' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      // Call the formatter
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);

      // FIXED: Now correctly returns an array of actions
      console.log('Result type:', typeof result.value);
      console.log('Result value:', result.value);

      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(3);
      // Extract commands from the object structure
      const commands = result.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );
      expect(commands).toEqual([
        'use Health Potion',
        'use Iron Sword',
        'use Teleport Scroll',
      ]);
    });

    it('COMPARISON: generateCombinations:true works correctly with multiple targets', () => {
      // Same action but WITH generateCombinations
      const actionDef = {
        id: 'test:combinations_working',
        name: 'Use Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
            description: 'Item to use',
          },
        },
        template: 'use {item}',
        generateCombinations: true, // This works correctly
      };

      const resolvedTargets = {
        primary: [
          { id: 'potion_001', displayName: 'Health Potion' },
          { id: 'sword_001', displayName: 'Iron Sword' },
          { id: 'scroll_001', displayName: 'Teleport Scroll' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);

      // This works correctly - returns array of formatted commands
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(3);
      // Extract commands from the object structure
      const commands = result.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );
      expect(commands).toEqual([
        'use Health Potion',
        'use Iron Sword',
        'use Teleport Scroll',
      ]);
    });

    it('FIXED: Multi-target with secondary now generates cartesian product', () => {
      const actionDef = {
        id: 'test:multi_target_bug',
        name: 'Give Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
          },
          secondary: {
            scope: 'location.core:actors[]',
            placeholder: 'npc',
          },
        },
        template: 'give {item} to {npc}',
        // No generateCombinations
      };

      const resolvedTargets = {
        primary: [
          { id: 'apple_001', displayName: 'Red Apple' },
          { id: 'bread_001', displayName: 'Fresh Bread' },
        ],
        secondary: [
          { id: 'merchant_001', displayName: 'Merchant' },
          { id: 'guard_001', displayName: 'Guard' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'npc' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);

      // FIXED: Now generates cartesian product of all combinations
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(4);
      // Extract commands from the object structure
      const commands = result.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );
      expect(commands).toEqual(
        expect.arrayContaining([
          'give Red Apple to Merchant',
          'give Red Apple to Guard',
          'give Fresh Bread to Merchant',
          'give Fresh Bread to Guard',
        ])
      );
    });

    it('EXPECTED BEHAVIOR: Single entity targets work correctly', () => {
      const actionDef = {
        id: 'test:single_entity',
        name: 'Use Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.special_item',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
        // No generateCombinations
      };

      const resolvedTargets = {
        primary: [{ id: 'special_001', displayName: 'Special Item' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);

      // This works correctly - single entity should return single string
      expect(typeof result.value).toBe('string');
      expect(result.value).toBe('use Special Item');
    });

    it('FIXED: Consistent behavior regardless of generateCombinations flag for multiple entities', () => {
      const baseActionDef = {
        id: 'test:consistency_check',
        name: 'Drop Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
          },
        },
        template: 'drop {item}',
      };

      const resolvedTargets = {
        primary: [
          { id: 'gem_001', displayName: 'Ruby' },
          { id: 'coin_001', displayName: 'Gold Coin' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      // Test without generateCombinations
      const actionWithoutCombinations = { ...baseActionDef };
      const resultWithout = formatter.formatMultiTarget(
        actionWithoutCombinations,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      // Test with generateCombinations
      const actionWithCombinations = {
        ...baseActionDef,
        generateCombinations: true,
      };
      const resultWith = formatter.formatMultiTarget(
        actionWithCombinations,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      // FIXED: Now consistent behavior
      expect(resultWithout.ok).toBe(true);
      expect(resultWith.ok).toBe(true);

      // Both now return arrays with all targets
      expect(Array.isArray(resultWithout.value)).toBe(true);
      expect(Array.isArray(resultWith.value)).toBe(true);

      // Extract commands from the object structure
      const commandsWithout = resultWithout.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );
      const commandsWith = resultWith.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );

      expect(commandsWithout).toEqual(['drop Ruby', 'drop Gold Coin']);
      expect(commandsWith).toEqual(['drop Ruby', 'drop Gold Coin']);

      // Consistent behavior achieved - both generate the same result
    });
  });

  describe('Expected Behavior After Fix', () => {
    // These tests verify the expected behavior after the bug was fixed
    // All tests are enabled and passing, confirming the fix works correctly

    it('VERIFIED: Single target with multiple entities generates multiple actions', () => {
      const actionDef = {
        id: 'test:fixed_behavior',
        name: 'Use Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
        // No generateCombinations needed
      };

      const resolvedTargets = {
        primary: [
          { id: 'potion_001', displayName: 'Health Potion' },
          { id: 'sword_001', displayName: 'Iron Sword' },
          { id: 'scroll_001', displayName: 'Teleport Scroll' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);

      // VERIFIED: Returns array of actions
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(3);
      // Extract commands from the object structure
      const commands = result.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );
      expect(commands).toEqual([
        'use Health Potion',
        'use Iron Sword',
        'use Teleport Scroll',
      ]);
    });

    it('VERIFIED: Mixed targets generate cartesian product', () => {
      const actionDef = {
        id: 'test:fixed_mixed',
        name: 'Give Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
          },
          secondary: {
            scope: 'location.core:actors[]',
            placeholder: 'npc',
          },
        },
        template: 'give {item} to {npc}',
      };

      const resolvedTargets = {
        primary: [
          { id: 'apple_001', displayName: 'Red Apple' },
          { id: 'bread_001', displayName: 'Fresh Bread' },
        ],
        secondary: [
          { id: 'merchant_001', displayName: 'Merchant' },
          { id: 'guard_001', displayName: 'Guard' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'npc' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);

      // VERIFIED: Returns array with cartesian product
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(4);
      // Extract commands from the object structure
      const commands = result.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );
      expect(commands).toEqual(
        expect.arrayContaining([
          'give Red Apple to Merchant',
          'give Red Apple to Guard',
          'give Fresh Bread to Merchant',
          'give Fresh Bread to Guard',
        ])
      );
    });
  });
});
