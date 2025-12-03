/**
 * @file Integration tests to verify FOR_EACH collection parameter type
 *
 * This test validates that the FOR_EACH operation in handle_swing_at_target.rule.json
 * uses string paths for the collection parameter, as required by the schema and handler.
 *
 * Background:
 * - The FOR_EACH handler at forEachHandler.js:48 calls path?.trim() on the collection parameter
 * - This requires the collection parameter to be a string, not an object
 * - The schema at forEach.schema.json specifies "collection": { "type": "string" }
 * - Using JSON Logic objects like { "var": "..." } causes TypeError: path?.trim is not a function
 * @see src/logic/flowHandlers/forEachHandler.js - Handler that requires string path
 * @see data/schemas/operations/forEach.schema.json - Schema requiring string type
 * @see data/mods/weapons/rules/handle_swing_at_target.rule.json - Rule being tested
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { handleForEach } from '../../../../src/logic/flowHandlers/forEachHandler.js';

// Mock logger that tracks calls
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Mock action sequence executor
const createMockExecutor = () => jest.fn();

// Mock interpreter
const mockInterpreter = { execute: jest.fn() };

describe('FOR_EACH collection parameter type validation', () => {
  let logger;
  let executeActionSequence;

  beforeEach(() => {
    logger = createMockLogger();
    executeActionSequence = createMockExecutor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when collection is a string path (correct format)', () => {
    it('should resolve the collection and iterate successfully', async () => {
      const ctx = {
        evaluationContext: {
          context: {
            weaponDamage: {
              entries: [
                { type: 'slashing', amount: 10 },
                { type: 'piercing', amount: 5 },
              ],
            },
          },
        },
        jsonLogic: {},
        scopeLabel: 'Test',
      };

      const node = {
        type: 'FOR_EACH',
        parameters: {
          collection: 'context.weaponDamage.entries', // ✅ Correct: string path
          item_variable: 'dmgEntry',
          actions: [{ type: 'APPLY_DAMAGE' }],
        },
      };

      await handleForEach(
        node,
        ctx,
        logger,
        mockInterpreter,
        executeActionSequence
      );

      // Should have iterated twice (one for each damage entry)
      expect(executeActionSequence).toHaveBeenCalledTimes(2);

      // Should NOT have logged a warning
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should correctly bind the item variable for each iteration', async () => {
      const capturedItems = [];
      executeActionSequence.mockImplementation((actions, context) => {
        capturedItems.push(context.evaluationContext.context.dmgEntry);
      });

      const ctx = {
        evaluationContext: {
          context: {
            damageData: {
              list: ['fire', 'ice', 'lightning'],
            },
          },
        },
        jsonLogic: {},
        scopeLabel: 'Loop',
      };

      const node = {
        type: 'FOR_EACH',
        parameters: {
          collection: 'context.damageData.list',
          item_variable: 'dmgEntry',
          actions: [{ type: 'TEST' }],
        },
      };

      await handleForEach(
        node,
        ctx,
        logger,
        mockInterpreter,
        executeActionSequence
      );

      expect(capturedItems).toEqual(['fire', 'ice', 'lightning']);
    });
  });

  describe('when collection is a JSON Logic object (incorrect format)', () => {
    it('should throw TypeError with helpful message when collection is an object instead of string', async () => {
      const ctx = {
        evaluationContext: {
          context: {
            weaponDamage: {
              entries: [{ type: 'slashing', amount: 10 }],
            },
          },
        },
        jsonLogic: {},
        scopeLabel: 'Test',
      };

      // This is the BUGGY format that was in handle_swing_at_target.rule.json
      // The schema requires collection to be a string, but this uses an object
      const node = {
        type: 'FOR_EACH',
        parameters: {
          collection: { var: 'context.weaponDamage.entries' }, // ❌ Wrong: object
          item_variable: 'dmgEntry',
          actions: [{ type: 'APPLY_DAMAGE' }],
        },
      };

      // The handler throws TypeError with a helpful message explaining the issue
      await expect(
        handleForEach(
          node,
          ctx,
          logger,
          mockInterpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      // Verify the error message is helpful and includes a fix suggestion
      await expect(
        handleForEach(
          node,
          ctx,
          logger,
          mockInterpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*not.*JSON Logic/i);

      await expect(
        handleForEach(
          node,
          ctx,
          logger,
          mockInterpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/Use: "context\.weaponDamage\.entries" instead/);

      // Should NOT have executed any actions
      expect(executeActionSequence).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty collection gracefully', async () => {
      const ctx = {
        evaluationContext: {
          context: {
            weaponDamage: {
              entries: [],
            },
          },
        },
        jsonLogic: {},
        scopeLabel: 'Test',
      };

      const node = {
        type: 'FOR_EACH',
        parameters: {
          collection: 'context.weaponDamage.entries',
          item_variable: 'dmgEntry',
          actions: [{ type: 'APPLY_DAMAGE' }],
        },
      };

      await handleForEach(
        node,
        ctx,
        logger,
        mockInterpreter,
        executeActionSequence
      );

      // Empty collection means no iterations
      expect(executeActionSequence).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log warning when collection path does not resolve to an array', async () => {
      const ctx = {
        evaluationContext: {
          context: {
            weaponDamage: {
              entries: 'not-an-array',
            },
          },
        },
        jsonLogic: {},
        scopeLabel: 'Test',
      };

      const node = {
        type: 'FOR_EACH',
        parameters: {
          collection: 'context.weaponDamage.entries',
          item_variable: 'dmgEntry',
          actions: [{ type: 'APPLY_DAMAGE' }],
        },
      };

      await handleForEach(
        node,
        ctx,
        logger,
        mockInterpreter,
        executeActionSequence
      );

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn.mock.calls[0][0]).toContain('did not resolve to an array');
      expect(executeActionSequence).not.toHaveBeenCalled();
    });

    it('should log warning when collection path points to undefined', async () => {
      const ctx = {
        evaluationContext: {
          context: {
            // weaponDamage is undefined
          },
        },
        jsonLogic: {},
        scopeLabel: 'Test',
      };

      const node = {
        type: 'FOR_EACH',
        parameters: {
          collection: 'context.weaponDamage.entries',
          item_variable: 'dmgEntry',
          actions: [{ type: 'APPLY_DAMAGE' }],
        },
      };

      await handleForEach(
        node,
        ctx,
        logger,
        mockInterpreter,
        executeActionSequence
      );

      expect(logger.warn).toHaveBeenCalled();
      expect(executeActionSequence).not.toHaveBeenCalled();
    });
  });
});

describe('handle_swing_at_target.rule.json FOR_EACH validation', () => {
  // Import the actual rule file to verify it uses correct format
  let swingAtTargetRule;

  beforeEach(async () => {
    // Dynamic import to get fresh copy
    const module = await import(
      '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json',
      { assert: { type: 'json' } }
    );
    swingAtTargetRule = module.default;
  });

  const findOutcomeBranch = (outcome) =>
    swingAtTargetRule.actions.find(
      (op) =>
        op.type === 'IF' &&
        op.parameters?.condition?.['==']?.[1] === outcome
    );

  it('should use string path for collection in SUCCESS branch', () => {
    const successBranch = findOutcomeBranch('SUCCESS');
    expect(successBranch).toBeDefined();

    const forEachOp = successBranch.parameters.then_actions.find(
      (op) => op.type === 'FOR_EACH'
    );

    expect(forEachOp).toBeDefined();

    // The collection MUST be a string, not an object
    expect(typeof forEachOp.parameters.collection).toBe('string');
    expect(forEachOp.parameters.collection).toBe('context.weaponDamage.entries');
  });

  it('should use string path for collection in CRITICAL_SUCCESS branch', () => {
    const critBranch = findOutcomeBranch('CRITICAL_SUCCESS');
    expect(critBranch).toBeDefined();

    const forEachOp = critBranch.parameters.then_actions.find(
      (op) => op.type === 'FOR_EACH'
    );

    expect(forEachOp).toBeDefined();

    // The collection MUST be a string, not an object
    expect(typeof forEachOp.parameters.collection).toBe('string');
    expect(forEachOp.parameters.collection).toBe('context.weaponDamage.entries');
  });
});
