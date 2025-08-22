/**
 * @file Integration tests for multi-target action examples
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Multi-Target Action Examples - Integration', () => {
  let testBed;
  let formatter;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create mock base formatter
    const mockBaseFormatter = {
      format: jest.fn().mockReturnValue({ ok: true, value: 'formatted' }),
    };

    formatter = new MultiTargetActionFormatter(mockBaseFormatter, mockLogger);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Basic Multi-Target Action Formatting', () => {
    let actionDef;

    beforeEach(() => {
      const actionPath = join(
        process.cwd(),
        'data/mods/examples/actions/basic_multi_target.action.json'
      );
      actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));
    });

    it('should format throw action with single target pair', () => {
      const resolvedTargets = {
        primary: [{ id: 'rock_001', displayName: 'Small Rock' }],
        secondary: [{ id: 'npc_001', displayName: 'Guard' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      if (actionDef.generateCombinations) {
        expect(result.value).toHaveLength(1); // 1x1 combination
        // Extract command from the object structure
        const command =
          typeof result.value[0] === 'string'
            ? result.value[0]
            : result.value[0].command;
        expect(command).toBe('throw Small Rock at Guard');
      } else {
        expect(result.value).toBe('throw Small Rock at Guard');
      }
    });

    it('should format throw action with multiple target combinations', () => {
      const resolvedTargets = {
        primary: [
          { id: 'rock_001', displayName: 'Small Rock' },
          { id: 'apple_001', displayName: 'Red Apple' },
        ],
        secondary: [
          { id: 'npc_001', displayName: 'Guard' },
          { id: 'target_001', displayName: 'Practice Dummy' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      if (actionDef.generateCombinations) {
        expect(result.value).toHaveLength(4); // 2x2 combinations

        // Extract commands from the object structure
        const commands = result.value.map((item) =>
          typeof item === 'string' ? item : item.command
        );

        expect(commands[0]).toMatch(/throw .+ at .+/);

        // Check that all combinations are present
        expect(commands).toContain('throw Small Rock at Guard');
        expect(commands).toContain('throw Small Rock at Practice Dummy');
        expect(commands).toContain('throw Red Apple at Guard');
        expect(commands).toContain('throw Red Apple at Practice Dummy');
      }
    });

    it('should handle empty target lists gracefully', () => {
      const resolvedTargets = {
        primary: [],
        secondary: [],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      // The formatter now enforces strict validation - empty required targets cause an error
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Target \'primary\' could not be resolved');
      expect(result.error).toContain('action not available');
    });
  });

  describe('Context-Dependent Action Formatting', () => {
    let actionDef;

    beforeEach(() => {
      const actionPath = join(
        process.cwd(),
        'data/mods/examples/actions/context_dependent.action.json'
      );
      actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));
    });

    it('should format unlock action with contextual dependencies', () => {
      const resolvedTargets = {
        primary: [{ id: 'chest_001', displayName: 'Wooden Chest' }],
        secondary: [{ id: 'key_001', displayName: 'Brass Key' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'container' },
        secondary: { placeholder: 'key', contextFrom: 'primary' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      // Context-dependent targets now always generate combinations due to automatic detection
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(1);
      // Extract command from the object structure
      const command =
        typeof result.value[0] === 'string'
          ? result.value[0]
          : result.value[0].command;
      expect(command).toBe('unlock Wooden Chest with Brass Key');
    });

    it('should generate combinations for multiple entities even when generateCombinations is not explicitly set', () => {
      expect(actionDef.generateCombinations).toBe(false);

      const resolvedTargets = {
        primary: [
          { id: 'chest_001', displayName: 'Wooden Chest' },
          { id: 'safe_001', displayName: 'Metal Safe' },
        ],
        secondary: [
          { id: 'key_001', displayName: 'Brass Key' },
          { id: 'key_002', displayName: 'Steel Key' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'container' },
        secondary: { placeholder: 'key', contextFrom: 'primary' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      // FIXED: Now generates combinations automatically when multiple entities are resolved
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(4); // 2 chests × 2 keys

      // Extract commands from the object structure
      const commands = result.value.map((item) =>
        typeof item === 'string' ? item : item.command
      );

      expect(commands).toEqual(
        expect.arrayContaining([
          'unlock Wooden Chest with Brass Key',
          'unlock Wooden Chest with Steel Key',
          'unlock Metal Safe with Brass Key',
          'unlock Metal Safe with Steel Key',
        ])
      );
    });
  });

  describe('Multiple Action Files', () => {
    it('should format give_item action', () => {
      const actionPath = join(
        process.cwd(),
        'data/mods/examples/actions/give_item.action.json'
      );
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      const resolvedTargets = {
        primary: [{ id: 'apple_001', displayName: 'Red Apple' }],
        secondary: [{ id: 'npc_001', displayName: 'Merchant' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'recipient' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      if (actionDef.generateCombinations || Array.isArray(result.value)) {
        expect(result.value).toHaveLength(1);
        const command =
          typeof result.value[0] === 'string'
            ? result.value[0]
            : result.value[0].command;
        expect(command).toBe('give Red Apple to Merchant');
      } else {
        expect(result.value).toBe('give Red Apple to Merchant');
      }
    });

    it('should format give_item_with_note action', () => {
      const actionPath = join(
        process.cwd(),
        'data/mods/examples/actions/give_item_with_note.action.json'
      );
      const actionDef = JSON.parse(readFileSync(actionPath, 'utf8'));

      const resolvedTargets = {
        primary: [{ id: 'apple_001', displayName: 'Red Apple' }],
        secondary: [{ id: 'npc_001', displayName: 'Merchant' }],
        tertiary: [{ id: 'note_001', displayName: 'Thank You Note' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'recipient' },
        tertiary: { placeholder: 'note' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      if (actionDef.generateCombinations || Array.isArray(result.value)) {
        expect(result.value).toHaveLength(1);
        const command =
          typeof result.value[0] === 'string'
            ? result.value[0]
            : result.value[0].command;
        expect(command).toBe('give Red Apple to Merchant with Thank You Note');
      } else {
        expect(result.value).toBe('give Red Apple to Merchant with Thank You Note');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed target definitions gracefully', () => {
      const actionDef = {
        id: 'test:invalid',
        name: 'Invalid Action',
        template: 'invalid {missing} template',
        generateCombinations: false,
      };

      const resolvedTargets = {
        primary: [{ id: 'item_001', displayName: 'Test Item' }],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        {} // Empty target definitions
      );

      expect(result.ok).toBe(true);
      // Should use fallback logic to replace {missing} with primary target
      expect(result.value).toBe('invalid Test Item template');
    });

    it('should handle missing template gracefully', () => {
      const actionDef = {
        id: 'test:no_template',
        name: 'No Template Action',
        // Missing template property
        generateCombinations: false,
      };

      const resolvedTargets = {
        primary: [{ id: 'item_001', displayName: 'Test Item' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null,
        {},
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      // Should fall back to using the name property
      expect(result.value).toContain('No Template Action');
    });
  });
});
