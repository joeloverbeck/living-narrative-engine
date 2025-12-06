import { describe, it, expect, jest, afterEach } from '@jest/globals';
import * as dependencyUtils from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const { assertFunction, assertMethods, validateDependencies } = dependencyUtils;

describe('dependencyUtils generator and type edge cases', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('assertFunction rejects properties that are not callable', () => {
    const logger = { error: jest.fn() };
    const dependency = { initialize: 'not-a-function' };

    expect(() =>
      assertFunction(
        dependency,
        'initialize',
        'initialize must be callable',
        InvalidArgumentError,
        logger
      )
    ).toThrow(InvalidArgumentError);

    expect(logger.error).toHaveBeenCalledWith('initialize must be callable');
  });

  it('assertMethods reports when an exposed method is not a function', () => {
    const logger = { error: jest.fn() };
    const dependency = {
      start: jest.fn(),
      stop: 'halt',
    };

    expect(() =>
      assertMethods(
        dependency,
        ['start', 'stop'],
        'dependency methods must be functions',
        InvalidArgumentError,
        logger
      )
    ).toThrow(InvalidArgumentError);

    expect(logger.error).toHaveBeenCalledWith(
      'dependency methods must be functions'
    );
    expect(dependency.start).not.toHaveBeenCalled();
  });

  it('validateDependencies consumes generator specs and stops after the first failure', () => {
    const logger = { error: jest.fn() };
    const iterationOrder = [];

    /**
     *
     */
    function* dependencySpecs() {
      iterationOrder.push('first');
      yield {
        dependency: { init: jest.fn() },
        name: 'ValidDependency',
        methods: ['init'],
      };

      iterationOrder.push('second');
      yield {
        dependency: { run: jest.fn() },
        name: 'InvalidDependency',
        methods: ['run', 'stop'],
      };

      iterationOrder.push('third');
      yield {
        dependency: { finalize: jest.fn() },
        name: 'UnreachedDependency',
        methods: ['finalize'],
      };
    }

    expect(() => validateDependencies(dependencySpecs(), logger)).toThrow(
      InvalidArgumentError
    );

    expect(iterationOrder).toEqual(['first', 'second']);
    expect(logger.error).toHaveBeenLastCalledWith(
      "Invalid or missing method 'stop' on dependency 'InvalidDependency'."
    );
  });
});
