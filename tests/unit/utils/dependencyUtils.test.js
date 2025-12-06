import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
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

describe('dependencyUtils', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  describe('assertPresent', () => {
    it('does nothing when value is present', () => {
      expect(() => assertPresent(0, 'should not throw')).not.toThrow();
      expect(() => assertPresent(false, 'should not throw')).not.toThrow();
    });

    it('throws the provided error type and logs when missing', () => {
      class CustomError extends Error {}
      const logger = { error: jest.fn() };
      expect(() =>
        assertPresent(null, 'missing dependency', CustomError, logger)
      ).toThrow(CustomError);
      expect(logger.error).toHaveBeenCalledWith('missing dependency');
    });

    it('throws without attempting to log when logger lacks an error method', () => {
      const logger = { error: 'not-a-function' };
      expect(() =>
        assertPresent(undefined, 'missing dependency', Error, logger)
      ).toThrow(Error);
    });

    it('throws with direct invocation so coverage sees the branch', () => {
      class CustomError extends Error {}
      const logger = { error: jest.fn() };

      try {
        assertPresent(undefined, 'direct missing', CustomError, logger);
        throw new Error('expected assertPresent to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(CustomError);
        expect(error.message).toBe('direct missing');
      }

      expect(logger.error).toHaveBeenCalledWith('direct missing');
    });
  });

  describe('assertFunction', () => {
    it('accepts an object containing the function', () => {
      const dependency = { init: () => 'ready' };
      expect(() =>
        assertFunction(dependency, 'init', 'should not throw')
      ).not.toThrow();
    });

    it('throws when function is missing and logs with custom error', () => {
      class CustomError extends Error {}
      const logger = { error: jest.fn() };
      expect(() =>
        assertFunction({}, 'init', 'missing fn', CustomError, logger)
      ).toThrow(CustomError);
      expect(logger.error).toHaveBeenCalledWith('missing fn');
    });

    it('throws without logging when logger.error is not a function', () => {
      const logger = { error: false };
      expect(() =>
        assertFunction(null, 'init', 'missing fn', Error, logger)
      ).toThrow(Error);
    });

    it('throws with direct invocation for missing functions', () => {
      const logger = { error: jest.fn() };

      try {
        assertFunction({}, 'init', 'missing fn', InvalidArgumentError, logger);
        throw new Error('expected assertFunction to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toBe('missing fn');
      }

      expect(logger.error).toHaveBeenCalledWith('missing fn');
    });
  });

  describe('assertMethods', () => {
    it('validates every listed method', () => {
      const dependency = { start: jest.fn(), stop: jest.fn() };
      expect(() =>
        assertMethods(dependency, ['start', 'stop'], 'all good')
      ).not.toThrow();
    });

    it('throws and logs when any method is missing', () => {
      class CustomError extends Error {}
      const logger = { error: jest.fn() };
      expect(() =>
        assertMethods({}, ['start'], 'missing method', CustomError, logger)
      ).toThrow(CustomError);
      expect(logger.error).toHaveBeenCalledWith('missing method');
    });

    it('stops validation on the first missing method and reports through logger', () => {
      class CustomError extends Error {}
      const logger = { error: jest.fn() };
      const dependency = {
        start: jest.fn(),
        // `stop` intentionally missing
      };

      expect(() =>
        assertMethods(
          dependency,
          ['start', 'stop'],
          'missing method',
          CustomError,
          logger
        )
      ).toThrow(CustomError);

      expect(dependency.start).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('missing method');
    });

    it('directly reports the failing method name', () => {
      const logger = { error: jest.fn() };

      try {
        assertMethods(
          {},
          ['execute'],
          'missing execute',
          InvalidArgumentError,
          logger
        );
        throw new Error('expected assertMethods to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toBe('missing execute');
      }

      expect(logger.error).toHaveBeenCalledWith('missing execute');
    });
  });

  describe('assertValidId', () => {
    it('passes for a non-blank string id', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        assertValidId('entity-123', 'TestContext', logger)
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws InvalidArgumentError and logs context when id is invalid', () => {
      const logger = { error: jest.fn() };
      expect(() => assertValidId('  ', 'Ctx', logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Ctx: Invalid ID '  '. Expected non-blank string.",
        expect.objectContaining({
          receivedId: '  ',
          receivedType: 'string',
          context: 'Ctx',
        })
      );
    });

    it('logs type information when a non-string id is supplied', () => {
      const logger = { error: jest.fn() };

      expect(() => assertValidId(null, 'Ctx', logger)).toThrow(
        InvalidArgumentError
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Ctx: Invalid ID 'null'. Expected non-blank string.",
        expect.objectContaining({
          receivedId: null,
          receivedType: 'object',
          context: 'Ctx',
        })
      );
    });

    it('throws with direct invocation to exercise coverage counters', () => {
      const logger = { error: jest.fn() };

      try {
        assertValidId('', 'DirectCtx', logger);
        throw new Error('expected assertValidId to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toBe(
          "DirectCtx: Invalid ID ''. Expected non-blank string."
        );
      }

      expect(logger.error).toHaveBeenCalledWith(
        "DirectCtx: Invalid ID ''. Expected non-blank string.",
        expect.objectContaining({
          receivedId: '',
          receivedType: 'string',
          context: 'DirectCtx',
        })
      );
    });
  });

  describe('assertNonBlankString', () => {
    it('accepts a valid non-blank string', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        assertNonBlankString('value', 'param', 'Context', logger)
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs details and throws InvalidArgumentError for invalid string', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        assertNonBlankString('', 'param', 'Context', logger)
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Context: Invalid param ''. Expected non-blank string.",
        expect.objectContaining({
          receivedValue: '',
          receivedType: 'string',
          parameterName: 'param',
          context: 'Context',
        })
      );
    });

    it('handles non-string inputs by reporting the received type', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        assertNonBlankString(42, 'param', 'Context', logger)
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        "Context: Invalid param '42'. Expected non-blank string.",
        expect.objectContaining({
          receivedValue: 42,
          receivedType: 'number',
          parameterName: 'param',
          context: 'Context',
        })
      );
    });

    it('performs direct invocation coverage for invalid strings', () => {
      const logger = { error: jest.fn() };

      try {
        assertNonBlankString('   ', 'param', 'Direct', logger);
        throw new Error('expected assertNonBlankString to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toBe(
          "Direct: Invalid param '   '. Expected non-blank string."
        );
      }

      expect(logger.error).toHaveBeenCalledWith(
        "Direct: Invalid param '   '. Expected non-blank string.",
        expect.objectContaining({
          receivedValue: '   ',
          receivedType: 'string',
          parameterName: 'param',
          context: 'Direct',
        })
      );
    });

    it('falls back to console.error when logger is not provided', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => assertNonBlankString('', 'param')).toThrow(
        InvalidArgumentError
      );

      expect(errorSpy).toHaveBeenCalledWith(
        "Invalid param ''. Expected non-blank string.",
        expect.objectContaining({
          receivedValue: '',
          receivedType: 'string',
          parameterName: 'param',
        })
      );

      errorSpy.mockRestore();
    });

    it('omits context metadata when context is empty or whitespace', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        assertNonBlankString('   ', 'param', '  ');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toBe(
          "Invalid param '   '. Expected non-blank string."
        );
      }

      expect(errorSpy).toHaveBeenCalledWith(
        "Invalid param '   '. Expected non-blank string.",
        expect.not.objectContaining({ context: expect.any(String) })
      );

      errorSpy.mockRestore();
    });
  });

  describe('validateDependency', () => {
    it('throws when dependency is missing and falls back to console error', () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() => validateDependency(null, 'MissingService')).toThrow(
        InvalidArgumentError
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Missing required dependency: MissingService.'
      );
    });

    it('uses console error when provided logger lacks an error function', () => {
      const logger = {};
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() =>
        validateDependency(undefined, 'ConsoleFallback', logger)
      ).toThrow(InvalidArgumentError);

      expect(errorSpy).toHaveBeenCalledWith(
        'Missing required dependency: ConsoleFallback.'
      );
    });

    it('uses the provided logger when dependency is missing', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        validateDependency(undefined, 'LoggerService', logger)
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Missing required dependency: LoggerService.'
      );
    });

    it('throws when dependency must be a function but is not', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        validateDependency({}, 'Callable', logger, { isFunction: true })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Dependency 'Callable' must be a function, but got object."
      );
    });

    it('falls back to console when a function dependency fails validation but logger is unusable', () => {
      const logger = { error: 'nope' };
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() =>
        validateDependency({}, 'Callable', logger, { isFunction: true })
      ).toThrow(InvalidArgumentError);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Dependency 'Callable' must be a function, but got object."
      );

      consoleSpy.mockRestore();
    });

    it('accepts a callable dependency when the isFunction flag is set', () => {
      const logger = { error: jest.fn() };
      const dependency = () => true;

      expect(() =>
        validateDependency(dependency, 'Callable', logger, { isFunction: true })
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws when a required method is missing', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        validateDependency({}, 'Service', logger, { requiredMethods: ['run'] })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'run' on dependency 'Service'."
      );
    });

    it('falls back to console when required method validation cannot log through the provided logger', () => {
      const logger = {};
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() =>
        validateDependency({}, 'Service', logger, { requiredMethods: ['run'] })
      ).toThrow(InvalidArgumentError);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Invalid or missing method 'run' on dependency 'Service'."
      );

      consoleSpy.mockRestore();
    });

    it('passes when dependency satisfies all requirements', () => {
      const logger = { error: jest.fn() };
      const dependency = { run: jest.fn(), stop: jest.fn() };
      expect(() =>
        validateDependency(dependency, 'Service', logger, {
          requiredMethods: ['run', 'stop'],
        })
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('skips method validation when no required methods are provided', () => {
      const logger = { error: jest.fn() };
      const dependency = { optional: jest.fn() };

      expect(() =>
        validateDependency(dependency, 'Optional', logger)
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('rejects dependencies where required methods exist but are not functions', () => {
      const logger = { error: jest.fn() };
      const dependency = { run: 'not a function' };

      expect(() =>
        validateDependency(dependency, 'Service', logger, {
          requiredMethods: ['run'],
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'run' on dependency 'Service'."
      );
    });

    it('directly reports dependency errors for missing methods', () => {
      const logger = { error: jest.fn() };
      const dependency = { run: undefined };

      try {
        validateDependency(dependency, 'Service', logger, {
          requiredMethods: ['run'],
        });
        throw new Error('expected validateDependency to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toBe(
          "Invalid or missing method 'run' on dependency 'Service'."
        );
      }

      expect(logger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'run' on dependency 'Service'."
      );
    });
  });

  describe('validateDependencies', () => {
    it('returns early when no dependencies are provided', () => {
      const logger = { error: jest.fn() };
      expect(() => validateDependencies(null, logger)).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('validates each dependency specification', () => {
      const logger = { error: jest.fn() };
      const specs = [
        { dependency: { init: jest.fn() }, name: 'First', methods: ['init'] },
        { dependency: {}, name: 'Second', isFunction: true },
      ];

      expect(() => validateDependencies(specs, logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.error).toHaveBeenLastCalledWith(
        "Dependency 'Second' must be a function, but got object."
      );
    });

    it('supports iterable dependency specifications and validates each entry', () => {
      const logger = { error: jest.fn() };

      const specs = new Set([
        { dependency: { init: jest.fn() }, name: 'First', methods: ['init'] },
        { dependency: {}, name: 'Second', isFunction: true },
      ]);

      expect(() => validateDependencies(specs, logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.error).toHaveBeenLastCalledWith(
        "Dependency 'Second' must be a function, but got object."
      );
    });

    it('passes when every dependency specification is satisfied', () => {
      const logger = { error: jest.fn() };
      const dependencyA = { init: jest.fn() };
      const dependencyB = jest.fn();

      expect(() =>
        validateDependencies(
          [
            { dependency: dependencyA, name: 'Alpha', methods: ['init'] },
            { dependency: dependencyB, name: 'Beta', isFunction: true },
          ],
          logger
        )
      ).not.toThrow();

      expect(logger.error).not.toHaveBeenCalled();
      expect(dependencyA.init).not.toHaveBeenCalled();
      expect(typeof dependencyB).toBe('function');
    });
  });
});
