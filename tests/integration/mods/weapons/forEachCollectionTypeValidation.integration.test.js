/**
 * @file Integration tests to verify FOR_EACH collection parameter type
 * @description This test validates that the FOR_EACH operations in the weapons melee macros
 * use string paths for the collection parameter, as required by the schema and handler.
 *
 * Background:
 * - The FOR_EACH handler at forEachHandler.js:48 calls path?.trim() on the collection parameter
 * - This requires the collection parameter to be a string, not an object
 * - The schema at forEach.schema.json specifies "collection": { "type": "string" }
 * - Using JSON Logic objects like { "var": "..." } causes TypeError: path?.trim is not a function
 *
 * Architecture:
 * - handle_swing_at_target.rule.json delegates to shared macros for each outcome
 * - FOR_EACH operations are now in handleMeleeHit.macro.json and handleMeleeCritical.macro.json
 * - Rules set context variables, macros contain the damage iteration logic
 * @see src/logic/flowHandlers/forEachHandler.js - Handler that requires string path
 * @see data/schemas/operations/forEach.schema.json - Schema requiring string type
 * @see data/mods/weapons/macros/handleMeleeHit.macro.json - Macro with FOR_EACH for SUCCESS
 * @see data/mods/weapons/macros/handleMeleeCritical.macro.json - Macro with FOR_EACH for CRITICAL_SUCCESS
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

describe('Weapons melee macros FOR_EACH validation', () => {
  // Import the macro files that now contain the FOR_EACH operations
  // With macro-based architecture, damage iteration is in shared macros, not rules
  let handleMeleeHit;
  let handleMeleeCritical;
  let swingAtTargetRule;

  beforeEach(async () => {
    // Dynamic imports to get fresh copies
    const hitModule = await import(
      '../../../../data/mods/weapons/macros/handleMeleeHit.macro.json',
      { assert: { type: 'json' } }
    );
    handleMeleeHit = hitModule.default;

    const critModule = await import(
      '../../../../data/mods/weapons/macros/handleMeleeCritical.macro.json',
      { assert: { type: 'json' } }
    );
    handleMeleeCritical = critModule.default;

    const ruleModule = await import(
      '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json',
      { assert: { type: 'json' } }
    );
    swingAtTargetRule = ruleModule.default;
  });

  const findOutcomeBranch = (outcome) =>
    swingAtTargetRule.actions.find(
      (op) =>
        op.type === 'IF' &&
        op.parameters?.condition?.['==']?.[1] === outcome
    );

  describe('Rule delegates to macros', () => {
    it('should delegate SUCCESS to handleMeleeHit macro', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      expect(successBranch).toBeDefined();

      const macroRef = successBranch.parameters.then_actions.find(
        (op) => op.macro === 'weapons:handleMeleeHit'
      );
      expect(macroRef).toBeDefined();
    });

    it('should delegate CRITICAL_SUCCESS to handleMeleeCritical macro', () => {
      const critBranch = findOutcomeBranch('CRITICAL_SUCCESS');
      expect(critBranch).toBeDefined();

      const macroRef = critBranch.parameters.then_actions.find(
        (op) => op.macro === 'weapons:handleMeleeCritical'
      );
      expect(macroRef).toBeDefined();
    });
  });

  describe('Macro FOR_EACH collection validation', () => {
    it('should use string path for collection in handleMeleeHit macro (SUCCESS)', () => {
      const forEachOp = handleMeleeHit.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      expect(forEachOp).toBeDefined();

      // The collection MUST be a string, not an object
      expect(typeof forEachOp.parameters.collection).toBe('string');
      expect(forEachOp.parameters.collection).toBe(
        'context.weaponDamage.entries'
      );
    });

    it('should use string path for collection in handleMeleeCritical macro (CRITICAL_SUCCESS)', () => {
      const forEachOp = handleMeleeCritical.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      expect(forEachOp).toBeDefined();

      // The collection MUST be a string, not an object
      expect(typeof forEachOp.parameters.collection).toBe('string');
      expect(forEachOp.parameters.collection).toBe(
        'context.weaponDamage.entries'
      );
    });

    it('should use correct item_variable in handleMeleeHit macro', () => {
      const forEachOp = handleMeleeHit.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      expect(forEachOp.parameters.item_variable).toBe('dmgEntry');
    });

    it('should use correct item_variable in handleMeleeCritical macro', () => {
      const forEachOp = handleMeleeCritical.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      expect(forEachOp.parameters.item_variable).toBe('dmgEntry');
    });
  });
});
