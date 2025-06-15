import { expandMacros } from '../../src/utils/macroUtils.js';
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
});
