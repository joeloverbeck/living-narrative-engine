import { describe, beforeEach, test, expect, jest } from '@jest/globals';

jest.mock('../../../../src/logic/actionSequence.js', () => ({
  executeActionSequence: jest.fn(),
}));

import { executeActionSequence } from '../../../../src/logic/actionSequence.js';
import { handleForEach } from '../../../../src/logic/flowHandlers/forEachHandler.js';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const interpreter = { execute: jest.fn() };
const jsonLogic = {};
const baseCtx = {
  evaluationContext: {
    context: {
      items: ['item1', 'item2', 'item3'],
    },
  },
};

describe('FOR_EACH collection type validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rejects non-string collection types', () => {
    test('throws TypeError with helpful message when collection is JSON Logic object', async () => {
      const node = {
        parameters: {
          collection: { var: 'context.items' },
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*not.*JSON Logic/i);
    });

    test('provides fix suggestion for JSON Logic objects', async () => {
      const node = {
        parameters: {
          collection: { var: 'context.items' },
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/Use: "context\.items" instead/);
    });

    test('throws TypeError when collection is plain object', async () => {
      const node = {
        parameters: {
          collection: { foo: 'bar' },
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*Received: object/i);
    });

    test('throws TypeError when collection is null', async () => {
      const node = {
        parameters: {
          collection: null,
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*Received: object/i);
    });

    test('throws TypeError when collection is undefined', async () => {
      const node = {
        parameters: {
          collection: undefined,
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*Received: undefined/i);
    });

    test('throws TypeError when collection is a number', async () => {
      const node = {
        parameters: {
          collection: 42,
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*Received: number/i);
    });

    test('throws TypeError when collection is a boolean', async () => {
      const node = {
        parameters: {
          collection: true,
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*Received: boolean/i);
    });

    test('throws TypeError when collection is an array', async () => {
      const node = {
        parameters: {
          collection: ['item1', 'item2'],
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(TypeError);

      await expect(
        handleForEach(
          node,
          { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).rejects.toThrow(/collection.*must be.*string path.*Received: object/i);
    });
  });

  describe('accepts valid string collection paths', () => {
    test('accepts simple string path', async () => {
      const ctx = {
        evaluationContext: {
          items: [1, 2],
          context: {},
        },
      };
      const node = {
        parameters: {
          collection: 'items',
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...ctx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).resolves.not.toThrow();

      expect(executeActionSequence).toHaveBeenCalledTimes(2);
    });

    test('accepts nested string path', async () => {
      const ctx = {
        evaluationContext: {
          context: {
            weaponDamage: {
              entries: [{ type: 'slash', amount: 10 }],
            },
          },
        },
      };
      const node = {
        parameters: {
          collection: 'context.weaponDamage.entries',
          item_variable: 'entry',
          actions: [{ type: 'LOG' }],
        },
      };

      await expect(
        handleForEach(
          node,
          { ...ctx, jsonLogic, scopeLabel: 'Loop' },
          logger,
          interpreter,
          executeActionSequence
        )
      ).resolves.not.toThrow();

      expect(executeActionSequence).toHaveBeenCalledTimes(1);
    });

    test('logs warning for empty string path (existing behavior)', async () => {
      const node = {
        parameters: {
          collection: '',
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      // Empty string is caught by existing validation (not type check)
      await handleForEach(
        node,
        { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
        logger,
        interpreter,
        executeActionSequence
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid parameters')
      );
      expect(executeActionSequence).not.toHaveBeenCalled();
    });

    test('logs warning for whitespace-only string path', async () => {
      const node = {
        parameters: {
          collection: '   ',
          item_variable: 'item',
          actions: [{ type: 'LOG' }],
        },
      };

      // Whitespace string is caught by existing validation (not type check)
      await handleForEach(
        node,
        { ...baseCtx, jsonLogic, scopeLabel: 'Loop' },
        logger,
        interpreter,
        executeActionSequence
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid parameters')
      );
      expect(executeActionSequence).not.toHaveBeenCalled();
    });
  });
});
