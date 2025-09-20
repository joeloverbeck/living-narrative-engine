import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as dependencyUtils from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const {
  assertPresent,
  assertFunction,
  assertMethods,
  assertValidId,
  assertNonBlankString,
  validateDependency,
  validateDependencies,
} = dependencyUtils;

describe('dependencyUtils integration', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn() };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('assertPresent', () => {
    it('does not throw when value is present', () => {
      expect(() => assertPresent('value', 'should not throw')).not.toThrow();
    });

    it('throws provided error type and logs when value is missing', () => {
      class CustomError extends Error {}

      expect(() =>
        assertPresent(null, 'Missing dependency', CustomError, logger),
      ).toThrow(CustomError);
      expect(logger.error).toHaveBeenCalledWith('Missing dependency');
    });

    it('throws the default error type without attempting to log when no logger is given', () => {
      expect(() => assertPresent(undefined, 'Missing dependency')).toThrow(Error);
    });
  });

  describe('assertFunction', () => {
    it('accepts objects with the required function', () => {
      const dependency = {
        initialize: () => {},
      };

      expect(() =>
        assertFunction(dependency, 'initialize', 'should not throw'),
      ).not.toThrow();
    });

    it('logs and throws when the required function is missing', () => {
      expect(() =>
        assertFunction({}, 'initialize', 'Missing initialize', Error, logger),
      ).toThrow(Error);
      expect(logger.error).toHaveBeenCalledWith('Missing initialize');
    });

    it('throws the default error type when the logger is absent', () => {
      expect(() =>
        assertFunction({}, 'initialize', 'Missing initialize'),
      ).toThrow(Error);
    });
  });

  describe('assertMethods', () => {
    it('validates all listed methods on the dependency object', () => {
      const dependency = {
        start: () => {},
        stop: () => {},
      };

      expect(() =>
        assertMethods(dependency, ['start', 'stop'], 'all good'),
      ).not.toThrow();
    });

    it('throws when any required method is missing', () => {
      const dependency = {
        start: () => {},
      };

      expect(() =>
        assertMethods(
          dependency,
          ['start', 'stop'],
          'Missing required methods',
          Error,
          logger,
        ),
      ).toThrow(Error);
      expect(logger.error).toHaveBeenCalledWith('Missing required methods');
    });
  });

  describe('assertValidId', () => {
    it('accepts non-blank string identifiers', () => {
      assertValidId('abc-123', 'Character', logger);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs structured context and throws when the id is invalid', () => {
      expect(() => assertValidId('   ', 'Character', logger)).toThrow(
        InvalidArgumentError,
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Character: Invalid ID '   '. Expected non-blank string.",
        {
          receivedId: '   ',
          receivedType: 'string',
          context: 'Character',
        },
      );
    });
  });

  describe('assertNonBlankString', () => {
    it('accepts non-blank strings', () => {
      assertNonBlankString('Valid', 'name', 'TestContext', logger);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs the failure details and throws when the value is blank', () => {
      expect(() =>
        assertNonBlankString('', 'name', 'TestContext', logger),
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "TestContext: Invalid name ''. Expected non-blank string.",
        {
          receivedValue: '',
          receivedType: 'string',
          parameterName: 'name',
          context: 'TestContext',
        },
      );
    });
  });

  describe('validateDependency', () => {
    it('passes when the dependency and methods satisfy the requirements', () => {
      const dependency = {
        initialize: () => {},
        teardown: () => {},
      };

      expect(() =>
        validateDependency(dependency, 'LifecycleService', logger, {
          requiredMethods: ['initialize', 'teardown'],
        }),
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('accepts function dependencies when isFunction is true', () => {
      const fn = () => {};

      expect(() =>
        validateDependency(fn, 'CallableDependency', logger, {
          isFunction: true,
        }),
      ).not.toThrow();
    });

    it('throws when the dependency is missing', () => {
      expect(() =>
        validateDependency(null, 'MissingService', logger),
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        'Missing required dependency: MissingService.',
      );
    });

    it('enforces function type when isFunction is requested', () => {
      expect(() =>
        validateDependency({}, 'CallableDependency', logger, {
          isFunction: true,
        }),
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Dependency 'CallableDependency' must be a function, but got object.",
      );
    });

    it('throws when a required method is missing', () => {
      const dependency = {
        initialize: () => {},
      };

      expect(() =>
        validateDependency(dependency, 'LifecycleService', logger, {
          requiredMethods: ['initialize', 'teardown'],
        }),
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'teardown' on dependency 'LifecycleService'.",
      );
    });

    it('falls back to console.error when the logger lacks an error function', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() =>
        validateDependency(undefined, 'ConsoleLoggerService', {
          warn: () => {},
        }),
      ).toThrow(InvalidArgumentError);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Missing required dependency: ConsoleLoggerService.',
      );
    });
  });

  describe('validateDependencies', () => {
    it('returns early when provided dependencies iterable is falsy', () => {
      expect(() => validateDependencies(null, logger)).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('validates each dependency specification with shared logger', () => {
      const dependency = {
        init: () => {},
      };
      const callable = () => {};

      expect(() =>
        dependencyUtils.validateDependencies(
          [
            { dependency, name: 'InitService', methods: ['init'] },
            { dependency: callable, name: 'Callable', isFunction: true },
          ],
          logger,
        ),
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('propagates validation errors for invalid dependency entries', () => {
      const validDependency = {
        init: () => {},
      };

      expect(() =>
        dependencyUtils.validateDependencies(
          [
            { dependency: validDependency, name: 'InitService', methods: ['init'] },
            { dependency: {}, name: 'BrokenService', methods: ['init'] },
          ],
          logger,
        ),
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'init' on dependency 'BrokenService'.",
      );
    });
  });
});
