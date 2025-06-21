import { describe, it, expect, jest } from '@jest/globals';
import * as validationUtils from '../../../src/utils/validationUtils.js';
import { assertValidActionIndex } from '../../../src/utils/actionIndexUtils.js';
const { validateDependency, validateDependencies } = validationUtils;
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

// Tests for validateDependency and validateDependencies

describe('validateDependency', () => {
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
      validateDependency(logger, [
        { dependency: depA, name: 'depA', methods: [] },
        { dependency: depB, name: 'depB', methods: ['foo'] },
      ])
    ).not.toThrow();
  });
});

describe('validateDependencies', () => {
  it('validates each dependency and passes for valid specs', () => {
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const depA = { m: jest.fn() };
    const depB = () => {};

    expect(() =>
      validateDependencies(
        [
          { dependency: depA, name: 'A', methods: ['m'] },
          { dependency: depB, name: 'B', isFunction: true },
        ],
        logger
      )
    ).not.toThrow();
  });

  it('does nothing when deps is falsy', () => {
    const logger = { error: jest.fn() };
    expect(() => validateDependencies(null, logger)).not.toThrow();
  });

  it('throws when a dependency fails validation', () => {
    const logger = { error: jest.fn() };
    expect(() =>
      validateDependencies([{ dependency: null, name: 'Bad' }], logger)
    ).toThrow('Missing required dependency: Bad.');
    expect(logger.error).toHaveBeenCalledWith(
      'Missing required dependency: Bad.'
    );
  });
});

describe('assertValidActionIndex', () => {
  it('throws and dispatches when index is not an integer', () => {
    const dispatcher = { dispatch: jest.fn() };
    expect(() =>
      assertValidActionIndex(1.5, 3, 'Prov', 'actor1', dispatcher, {})
    ).toThrow('Could not resolve the chosen action to a valid index.');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
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
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
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
