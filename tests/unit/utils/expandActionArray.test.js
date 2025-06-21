import {
  expandActionArray,
  expandMacros,
} from '../../../src/utils/macroUtils.js';
import { freeze } from '../../../src/utils/objectUtils.js';
import { describe, it, expect, jest } from '@jest/globals';

const createRegistry = (macros) => ({
  get: (type, id) => (type === 'macros' ? macros[id] : undefined),
});

const logger = { warn: jest.fn() };

describe('expandActionArray', () => {
  it('expands macros the same way as expandMacros', () => {
    const macros = {
      'core:test': { actions: [{ type: 'LOG', parameters: { msg: 'A' } }] },
    };
    const actions = [
      { macro: 'core:test' },
      { type: 'LOG', parameters: { msg: 'B' } },
    ];
    const r1 = expandActionArray(actions, createRegistry(macros), logger);
    const r2 = expandMacros(actions, createRegistry(macros), logger);
    expect(r1).toEqual(r2);
  });

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

    const result = expandActionArray(actions, createRegistry(macros), logger);

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
