import { expandMacros } from '../../../src/utils/macroUtils.js';
import { freeze } from '../../../src/utils/cloneUtils.js';
import { describe, it, expect, jest } from '@jest/globals';

const createRegistry = (macros) => ({
  get: (type, id) => (type === 'macros' ? macros[id] : undefined),
});

const logger = { warn: jest.fn() };

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
});
