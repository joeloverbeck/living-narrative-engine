import { describe, it, expect, jest } from '@jest/globals';
import * as validationUtils from '../../src/utils/validationUtils.js';
const { validateLoaderDeps, assertValidActionIndex } = validationUtils;
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

// Tests for validateLoaderDeps and assertValidActionIndex

describe('validateLoaderDeps', () => {
  it('does not throw for valid dependencies', () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const depA = {};
    const depB = { foo: jest.fn() };
    expect(() =>
      validateLoaderDeps(logger, [
        { dependency: depA, name: 'depA', methods: [] },
        { dependency: depB, name: 'depB', methods: ['foo'] },
      ])
    ).not.toThrow();
  });
});

describe('assertValidActionIndex', () => {
  it('throws and dispatches when index is not an integer', () => {
    const dispatcher = { dispatch: jest.fn() };
    expect(() =>
      assertValidActionIndex(1.5, 3, 'Prov', 'actor1', dispatcher, {})
    ).toThrow('Could not resolve the chosen action to a valid index.');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_ERROR_ID, {
      message:
        "Prov: Did not receive a valid integer 'chosenIndex' for actor actor1.",
      details: {},
    });
  });

  it('throws and dispatches when index is out of range', () => {
    const dispatcher = { dispatch: jest.fn() };
    expect(() =>
      assertValidActionIndex(
        5,
        3,
        'Prov',
        'actor2',
        dispatcher,
        {},
        { extra: 'data' }
      )
    ).toThrow('Player chose an index that does not exist for this turn.');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_ERROR_ID, {
      message: 'Prov: invalid chosenIndex (5) for actor actor2.',
      details: { extra: 'data', actionsCount: 3 },
    });
  });

  it('passes silently for valid index', () => {
    const dispatcher = { dispatch: jest.fn() };
    expect(() =>
      assertValidActionIndex(2, 3, 'Prov', 'actor3', dispatcher, {})
    ).not.toThrow();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});
