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
  });

  describe('assertValidId', () => {
    it('passes for a non-blank string id', () => {
      const logger = { error: jest.fn() };
      expect(() => assertValidId('entity-123', 'TestContext', logger)).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws InvalidArgumentError and logs context when id is invalid', () => {
      const logger = { error: jest.fn() };
      expect(() => assertValidId('  ', 'Ctx', logger)).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Ctx: Invalid ID '  '. Expected non-blank string.",
        expect.objectContaining({
          receivedId: '  ',
          receivedType: 'string',
          context: 'Ctx',
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
  });

  describe('validateDependency', () => {
    it('throws when dependency is missing and falls back to console error', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => validateDependency(null, 'MissingService')).toThrow(
        InvalidArgumentError
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Missing required dependency: MissingService.'
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

    it('throws when a required method is missing', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        validateDependency({}, 'Service', logger, { requiredMethods: ['run'] })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'run' on dependency 'Service'."
      );
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
  });
});
