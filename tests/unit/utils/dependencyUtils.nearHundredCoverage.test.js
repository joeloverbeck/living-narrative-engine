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

describe('dependencyUtils – near 100% coverage', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('assertPresent', () => {
    it('allows any defined value without throwing', () => {
      expect(() => dependencyUtils.assertPresent(0, 'zero ok')).not.toThrow();
      expect(() =>
        dependencyUtils.assertPresent(false, 'false ok')
      ).not.toThrow();
      expect(() =>
        dependencyUtils.assertPresent('', 'empty string ok')
      ).not.toThrow();
    });

    it('logs and throws using provided error type when missing', () => {
      const logger = { error: jest.fn() };
      class CustomError extends Error {}

      expect(() =>
        dependencyUtils.assertPresent(undefined, 'missing', CustomError, logger)
      ).toThrow(CustomError);
      expect(logger.error).toHaveBeenCalledWith('missing');
    });

    it('throws without attempting to log when logger has no error function', () => {
      const logger = {};
      class CustomError extends Error {}

      expect(() =>
        dependencyUtils.assertPresent(
          null,
          'still missing',
          CustomError,
          logger
        )
      ).toThrow(CustomError);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('assertFunction', () => {
    it('accepts objects that expose the function', () => {
      const dependency = { init: () => true };
      expect(() =>
        dependencyUtils.assertFunction(dependency, 'init', 'ready')
      ).not.toThrow();
    });

    it('logs and throws when property is not a function', () => {
      const logger = { error: jest.fn() };
      class CustomError extends Error {}

      expect(() =>
        dependencyUtils.assertFunction(
          { init: 123 },
          'init',
          'bad fn',
          CustomError,
          logger
        )
      ).toThrow(CustomError);
      expect(logger.error).toHaveBeenCalledWith('bad fn');
    });

    it('skips logging when the provided logger lacks a callable error method', () => {
      const logger = { error: 'not-a-function' };

      expect(() =>
        dependencyUtils.assertFunction(
          { init: 42 },
          'init',
          'non-callable method',
          InvalidArgumentError,
          logger
        )
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('assertMethods', () => {
    it('validates each requested method when they exist', () => {
      const dependency = { start: jest.fn(), stop: jest.fn() };

      expect(() =>
        dependencyUtils.assertMethods(
          dependency,
          ['start', 'stop'],
          'methods ok'
        )
      ).not.toThrow();
    });

    it('propagates errors when a method is missing', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        dependencyUtils.assertMethods(
          {},
          ['run'],
          'missing run',
          InvalidArgumentError,
          logger
        )
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith('missing run');
    });
  });

  describe('assertValidId', () => {
    it('passes through for non-blank ids', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        dependencyUtils.assertValidId('entity-1', 'Context', logger)
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('reports details and throws for invalid ids', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        dependencyUtils.assertValidId('   ', 'Context', logger)
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Context: Invalid ID '   '. Expected non-blank string.",
        expect.objectContaining({
          receivedId: '   ',
          receivedType: 'string',
          context: 'Context',
        })
      );
    });
  });

  describe('assertNonBlankString', () => {
    it('accepts valid strings', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        dependencyUtils.assertNonBlankString(
          'value',
          'param',
          'Context',
          logger
        )
      ).not.toThrow();
    });

    it('reports context when the string is invalid', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        dependencyUtils.assertNonBlankString('', 'param', 'Context', logger)
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
    it('uses console error when logger is missing or lacks error', () => {
      expect(() => dependencyUtils.validateDependency(null, 'Service')).toThrow(
        InvalidArgumentError
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Missing required dependency: Service.'
      );

      consoleErrorSpy.mockClear();
      expect(() =>
        dependencyUtils.validateDependency(undefined, 'OtherService', {
          error: undefined,
        })
      ).toThrow(InvalidArgumentError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Missing required dependency: OtherService.'
      );
    });

    it('rejects dependencies that must be functions', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        dependencyUtils.validateDependency({}, 'Callable', logger, {
          isFunction: true,
        })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Dependency 'Callable' must be a function, but got object."
      );
    });

    it('rejects dependencies when required methods are missing', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        dependencyUtils.validateDependency({}, 'Service', logger, {
          requiredMethods: ['run'],
        })
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        "Invalid or missing method 'run' on dependency 'Service'."
      );
    });

    it('accepts dependencies that satisfy all requirements', () => {
      const logger = { error: jest.fn() };
      const dependency = { run: jest.fn(), stop: jest.fn() };

      expect(() =>
        dependencyUtils.validateDependency(dependency, 'Service', logger, {
          requiredMethods: ['run', 'stop'],
        })
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('validateDependencies', () => {
    it('returns immediately when no iterable is provided', () => {
      const logger = { error: jest.fn() };
      expect(() =>
        dependencyUtils.validateDependencies(null, logger)
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('validates every dependency specification', () => {
      const logger = { error: jest.fn() };
      const entries = [
        { dependency: { init: jest.fn() }, name: 'First', methods: ['init'] },
        { dependency: jest.fn(), name: 'Second', isFunction: true },
      ];

      expect(() =>
        dependencyUtils.validateDependencies(entries, logger)
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('propagates validation errors from validateDependency', () => {
      const logger = { error: jest.fn() };
      const specs = [{ dependency: {}, name: 'Broken', isFunction: true }];

      expect(() => dependencyUtils.validateDependencies(specs, logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Dependency 'Broken' must be a function, but got object."
      );
    });
  });
});
