import {
  expandMacros,
  findUnexpandedMacros,
  validateMacroExpansion,
  MacroExpansionError,
} from '../../../src/utils/macroUtils.js';
import { freeze } from '../../../src/utils/cloneUtils.js';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const createRegistry = (macros) => ({
  get: (type, id) => (type === 'macros' ? macros[id] : undefined),
});

describe('macroUtils', () => {
  let logger;

  beforeEach(() => {
    logger = { warn: jest.fn(), error: jest.fn() };
  });

  describe('expandMacros', () => {
    it('expands a single macro reference', () => {
      const macros = {
        'core:test': { actions: [{ type: 'LOG', parameters: { msg: 'A' } }] },
      };
      const actions = [
        { macro: 'core:test' },
        { type: 'LOG', parameters: { msg: 'B' } },
      ];
      const result = expandMacros(actions, createRegistry(macros), logger);
      expect(result).toEqual([
        { type: 'LOG', parameters: { msg: 'A' } },
        { type: 'LOG', parameters: { msg: 'B' } },
      ]);
    });

    it('handles nested macros', () => {
      const macros = {
        'core:inner': {
          actions: [{ type: 'LOG', parameters: { msg: 'inner' } }],
        },
        'core:outer': {
          actions: [
            { macro: 'core:inner' },
            { type: 'END_TURN', parameters: {} },
          ],
        },
      };
      const actions = [{ macro: 'core:outer' }];
      const result = expandMacros(actions, createRegistry(macros), logger);
      expect(result).toEqual([
        { type: 'LOG', parameters: { msg: 'inner' } },
        { type: 'END_TURN', parameters: {} },
      ]);
    });

    it('expands macros inside IF parameters', () => {
      const macros = {
        'core:log': { actions: [{ type: 'LOG', parameters: { msg: 'X' } }] },
      };
      const actions = [
        {
          type: 'IF',
          parameters: {
            condition: { '==': [1, 1] },
            then_actions: [{ macro: 'core:log' }],
            else_actions: [],
          },
        },
      ];
      const result = expandMacros(actions, createRegistry(macros), logger);
      expect(result[0].parameters.then_actions).toEqual([
        { type: 'LOG', parameters: { msg: 'X' } },
      ]);
    });

    it('expands macros inside FOR_EACH actions', () => {
      const macros = {
        'core:log': { actions: [{ type: 'LOG', parameters: { msg: 'item' } }] },
      };
      const actions = [
        {
          type: 'FOR_EACH',
          parameters: {
            collection: 'context.items',
            item_variable: 'i',
            actions: [{ macro: 'core:log' }],
          },
        },
      ];
      const result = expandMacros(actions, createRegistry(macros), logger);
      expect(result[0].parameters.actions).toEqual([
        { type: 'LOG', parameters: { msg: 'item' } },
      ]);
    });

    describe('function purity', () => {
      it('does not mutate the original actions array', () => {
        const macros = {
          'core:log': { actions: [{ type: 'LOG', parameters: { msg: 'X' } }] },
        };
        const actions = [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [1, 1] },
              then_actions: [{ macro: 'core:log' }],
              else_actions: [],
            },
          },
        ];

        freeze(actions);
        freeze(actions[0]);
        freeze(actions[0].parameters);
        freeze(actions[0].parameters.then_actions);
        freeze(actions[0].parameters.else_actions);

        const result = expandMacros(actions, createRegistry(macros), logger);

        expect(result[0].parameters.then_actions).toEqual([
          { type: 'LOG', parameters: { msg: 'X' } },
        ]);
        expect(actions).toEqual([
          {
            type: 'IF',
            parameters: {
              condition: { '==': [1, 1] },
              then_actions: [{ macro: 'core:log' }],
              else_actions: [],
            },
          },
        ]);
      });
    });

    it('throws MacroExpansionError when macro is not found', () => {
      const actions = [
        { macro: 'core:nonexistent' },
        { type: 'LOG', parameters: { msg: 'B' } },
      ];
      expect(() => expandMacros(actions, createRegistry({}), logger)).toThrow(
        MacroExpansionError
      );
      expect(() => expandMacros(actions, createRegistry({}), logger)).toThrow(
        "macro 'core:nonexistent' not found"
      );
    });

    it('handles non-array input', () => {
      const result = expandMacros(null, createRegistry({}), logger);
      expect(result).toEqual([]);
    });

    it('handles actions without macro or parameters', () => {
      const actions = [
        { type: 'SIMPLE_ACTION' },
        null,
        undefined,
        { someOtherProp: 'value' },
      ];
      const result = expandMacros(actions, createRegistry({}), logger);
      expect(result).toEqual([
        { type: 'SIMPLE_ACTION' },
        null,
        undefined,
        { someOtherProp: 'value' },
      ]);
    });

    it('throws MacroExpansionError when macro has non-array actions', () => {
      const macros = {
        'core:invalid': { actions: 'not-an-array' },
      };
      const actions = [{ macro: 'core:invalid' }];
      expect(() =>
        expandMacros(actions, createRegistry(macros), logger)
      ).toThrow(MacroExpansionError);
      expect(() =>
        expandMacros(actions, createRegistry(macros), logger)
      ).toThrow("macro 'core:invalid' not found");
    });

    it('throws MacroExpansionError even without logger', () => {
      const actions = [{ macro: 'core:nonexistent' }];
      expect(() => expandMacros(actions, createRegistry({}))).toThrow(
        MacroExpansionError
      );
    });

    it('includes diagnostic details in MacroExpansionError', () => {
      const actions = [{ macro: 'core:missingMacro' }];
      let caughtError;
      try {
        expandMacros(actions, createRegistry({}), logger);
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError).toBeInstanceOf(MacroExpansionError);
      expect(caughtError.details.macroId).toBe('core:missingMacro');
      expect(caughtError.details.macroFound).toBe(false);
      expect(caughtError.details.macroHasActions).toBe(false);
    });

    it('logs error before throwing MacroExpansionError', () => {
      const actions = [{ macro: 'missing:macro' }];
      expect(() => expandMacros(actions, createRegistry({}), logger)).toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("macro 'missing:macro' not found"),
        expect.any(Object)
      );
    });

    it('expands macros in else_actions', () => {
      const macros = {
        'core:log': { actions: [{ type: 'LOG', parameters: { msg: 'else' } }] },
      };
      const actions = [
        {
          type: 'IF',
          parameters: {
            condition: { '==': [1, 2] },
            then_actions: [],
            else_actions: [{ macro: 'core:log' }],
          },
        },
      ];
      const result = expandMacros(actions, createRegistry(macros), logger);
      expect(result[0].parameters.else_actions).toEqual([
        { type: 'LOG', parameters: { msg: 'else' } },
      ]);
    });
  });

  describe('findUnexpandedMacros', () => {
    it('finds macro references at root level', () => {
      const actions = [
        { type: 'LOG', parameters: { msg: 'A' } },
        { macro: 'core:test' },
        { type: 'END_TURN' },
      ];
      const result = findUnexpandedMacros(actions);
      expect(result).toEqual([
        {
          path: 'actions[1]',
          macro: 'core:test',
          action: { macro: 'core:test' },
        },
      ]);
    });

    it('finds macro references in nested actions', () => {
      const actions = [
        {
          type: 'IF',
          parameters: {
            condition: { '==': [1, 1] },
            then_actions: [{ macro: 'core:then' }],
            else_actions: [{ macro: 'core:else' }],
          },
        },
      ];
      const result = findUnexpandedMacros(actions);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: 'actions[0].parameters.then_actions[0]',
        macro: 'core:then',
        action: { macro: 'core:then' },
      });
      expect(result[1]).toEqual({
        path: 'actions[0].parameters.else_actions[0]',
        macro: 'core:else',
        action: { macro: 'core:else' },
      });
    });

    it('handles non-array input', () => {
      const result = findUnexpandedMacros(null);
      expect(result).toEqual([]);
    });

    it('handles actions without parameters', () => {
      const actions = [
        { type: 'SIMPLE' },
        { macro: 'core:test' },
        null,
        undefined,
      ];
      const result = findUnexpandedMacros(actions);
      expect(result).toHaveLength(1);
      expect(result[0].macro).toBe('core:test');
    });

    it('uses custom path parameter', () => {
      const actions = [{ macro: 'core:test' }];
      const result = findUnexpandedMacros(actions, 'custom.path');
      expect(result[0].path).toBe('custom.path[0]');
    });

    it('finds macros in actions parameter', () => {
      const actions = [
        {
          type: 'FOR_EACH',
          parameters: {
            collection: 'items',
            actions: [{ macro: 'core:process' }],
          },
        },
      ];
      const result = findUnexpandedMacros(actions);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'actions[0].parameters.actions[0]',
        macro: 'core:process',
        action: { macro: 'core:process' },
      });
    });

    it('ignores non-array parameters', () => {
      const actions = [
        {
          type: 'CUSTOM',
          parameters: {
            stringParam: 'value',
            numberParam: 42,
            objectParam: { key: 'value' },
            arrayParam: [{ type: 'LOG' }], // not a macro
          },
        },
      ];
      const result = findUnexpandedMacros(actions);
      expect(result).toEqual([]);
    });
  });

  describe('validateMacroExpansion', () => {
    it('returns true when no unexpanded macros', () => {
      const actions = [
        { type: 'LOG', parameters: { msg: 'A' } },
        { type: 'END_TURN' },
      ];
      const result = validateMacroExpansion(
        actions,
        createRegistry({}),
        logger
      );
      expect(result).toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns false and logs warning when unexpanded macros found', () => {
      const actions = [
        { macro: 'core:test' },
        { type: 'LOG', parameters: { msg: 'A' } },
      ];
      const result = validateMacroExpansion(
        actions,
        createRegistry({}),
        logger
      );
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Found 1 unexpanded macro references:',
        [
          {
            path: 'actions[0]',
            macro: 'core:test',
            action: { macro: 'core:test' },
          },
        ]
      );
    });

    it('works without logger', () => {
      const actions = [{ macro: 'core:test' }];
      const result = validateMacroExpansion(actions, createRegistry({}));
      expect(result).toBe(false);
    });

    it('finds multiple unexpanded macros', () => {
      const actions = [
        { macro: 'core:test1' },
        {
          type: 'IF',
          parameters: {
            condition: { '==': [1, 1] },
            then_actions: [{ macro: 'core:test2' }],
            else_actions: [{ macro: 'core:test3' }],
          },
        },
      ];
      const result = validateMacroExpansion(
        actions,
        createRegistry({}),
        logger
      );
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Found 3 unexpanded macro references:',
        expect.any(Array)
      );
    });
  });
});
