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

const noopLogger = Object.freeze({
  error: undefined,
});

/**
 * Utility for building a logger mock that records error payloads.
 *
 * @returns {{ error: jest.Mock }}
 */
function createLoggerMock() {
  return {
    error: jest.fn(),
  };
}

describe('dependencyUtils additional coverage', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('assertPresent', () => {
    it('accepts falsy but defined values without logging', () => {
      expect(() => assertPresent(false, 'ok')).not.toThrow();
      expect(() => assertPresent(0, 'ok')).not.toThrow();
      expect(() => assertPresent('', 'ok')).not.toThrow();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('throws with provided error type and logs when value is nullish', () => {
      const logger = createLoggerMock();

      class CustomError extends Error {}

      expect(() =>
        assertPresent(null, 'missing value', CustomError, logger)
      ).toThrow(CustomError);
      expect(logger.error).toHaveBeenCalledWith('missing value');
    });

    it('falls back to throwing without logging when logger lacks error method', () => {
      expect(() =>
        assertPresent(undefined, 'missing value', Error, noopLogger)
      ).toThrow(Error);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('assertFunction', () => {
    it('accepts existing functions', () => {
      const dependency = { init: () => true };
      expect(() =>
        assertFunction(dependency, 'init', 'should not throw')
      ).not.toThrow();
    });

    it('throws and logs when function is missing', () => {
      const logger = createLoggerMock();

      expect(() =>
        assertFunction(
          { init: 42 },
          'init',
          'missing function',
          InvalidArgumentError,
          logger
        )
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith('missing function');
    });

    it('throws without logging when logger lacks an error method', () => {
      expect(() =>
        assertFunction({}, 'init', 'missing function', Error, noopLogger)
      ).toThrow(Error);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('assertMethods', () => {
    it('validates each supplied method', () => {
      const dependency = { start: jest.fn(), stop: jest.fn() };

      const spy = jest.spyOn(dependency, 'start');

      expect(() =>
        assertMethods(dependency, ['start', 'stop'], 'ok')
      ).not.toThrow();
      expect(spy).not.toHaveBeenCalled();
    });

    it('throws for the first missing method and logs the failure', () => {
      const logger = createLoggerMock();

      expect(() =>
        assertMethods(
          { start: () => {} },
          ['start', 'stop'],
          'missing method',
          InvalidArgumentError,
          logger
        )
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('missing method');
    });
  });

  describe('assertValidId', () => {
    it('passes through valid identifiers without logging', () => {
      const logger = createLoggerMock();
      expect(() => assertValidId('entity-42', 'Context', logger)).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs diagnostic payload and throws when identifier is blank', () => {
      const logger = createLoggerMock();

      expect(() => assertValidId('   ', 'Ctx', logger)).toThrow(
        InvalidArgumentError
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Ctx: Invalid ID '   '. Expected non-blank string.",
        expect.objectContaining({
          receivedId: '   ',
          receivedType: 'string',
          context: 'Ctx',
        })
      );
    });

    it('includes type information when identifier is not a string', () => {
      const logger = createLoggerMock();

      expect(() => assertValidId(42, 'Ctx', logger)).toThrow(
        InvalidArgumentError
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Ctx: Invalid ID '42'. Expected non-blank string.",
        expect.objectContaining({
          receivedId: 42,
          receivedType: 'number',
          context: 'Ctx',
        })
      );
    });
  });

  describe('assertNonBlankString', () => {
    it('accepts populated strings', () => {
      const logger = createLoggerMock();
      expect(() =>
        assertNonBlankString('value', 'param', 'Context', logger)
      ).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws with detailed diagnostics for blank strings', () => {
      const logger = createLoggerMock();

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

    it('reports the original type when provided with non-string values', () => {
      const logger = createLoggerMock();

      expect(() =>
        assertNonBlankString(99, 'param', 'Context', logger)
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        "Context: Invalid param '99'. Expected non-blank string.",
        expect.objectContaining({
          receivedValue: 99,
          receivedType: 'number',
          parameterName: 'param',
          context: 'Context',
        })
      );
    });
  });

  describe('validateDependency', () => {
    it('logs and throws when the dependency is missing using a provided logger', () => {
      const logger = createLoggerMock();

      expect(() =>
        validateDependency(undefined, 'MissingService', logger)
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Missing required dependency: MissingService.'
      );
    });

    it('defaults to console logging when no logger is supplied', () => {
      expect(() => validateDependency(undefined, 'ConsoleOnly')).toThrow(
        InvalidArgumentError
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Missing required dependency: ConsoleOnly.'
      );
    });

    it('falls back to console error when the logger cannot report errors', () => {
      expect(() =>
        validateDependency(null, 'ConsoleService', noopLogger)
      ).toThrow(InvalidArgumentError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Missing required dependency: ConsoleService.'
      );
    });

    it('enforces function dependencies when isFunction is true', () => {
      const logger = createLoggerMock();

      expect(() =>
        validateDependency({}, 'Callable', logger, { isFunction: true })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        "Dependency 'Callable' must be a function, but got object."
      );
    });

    it('accepts callable dependencies when the isFunction flag is true', () => {
      const logger = createLoggerMock();
      const dependency = () => true;

      expect(() =>
        validateDependency(dependency, 'Callable', logger, { isFunction: true })
      ).not.toThrow();

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('validates required methods and falls back to console when logging fails', () => {
      const dependency = { run: jest.fn(), stop: 'not-a-function' };

      expect(() =>
        validateDependency(dependency, 'Service', noopLogger, {
          requiredMethods: ['run', 'stop'],
        })
      ).toThrow(InvalidArgumentError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid or missing method 'stop' on dependency 'Service'."
      );
    });

    it('passes when dependency meets all requirements', () => {
      const logger = createLoggerMock();
      const dependency = {
        run: jest.fn(),
        stop: jest.fn(),
      };

      expect(() =>
        validateDependency(dependency, 'Service', logger, {
          requiredMethods: ['run', 'stop'],
        })
      ).not.toThrow();

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('validateDependencies', () => {
    it('returns immediately when no iterable is provided', () => {
      validateDependencies(null, createLoggerMock());
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('validates array specifications and surfaces configuration failures', () => {
      const logger = createLoggerMock();
      const specs = [
        { dependency: { start: jest.fn() }, name: 'First', methods: ['start'] },
        { dependency: {}, name: 'Second', isFunction: true },
      ];

      expect(() => validateDependencies(specs, logger)).toThrow(
        InvalidArgumentError
      );

      expect(logger.error).toHaveBeenLastCalledWith(
        "Dependency 'Second' must be a function, but got object."
      );
    });

    it('processes iterable specifications and propagates method validation errors', () => {
      const logger = createLoggerMock();
      const specs = new Set([
        { dependency: { start: jest.fn() }, name: 'Valid', methods: ['start'] },
        { dependency: { run: 'nope' }, name: 'Broken', methods: ['run'] },
      ]);

      expect(() => validateDependencies(specs, logger)).toThrow(
        InvalidArgumentError
      );

      expect(logger.error).toHaveBeenLastCalledWith(
        "Invalid or missing method 'run' on dependency 'Broken'."
      );
    });

    it('passes when every specification is satisfied', () => {
      const logger = createLoggerMock();
      const specs = [
        { dependency: { init: jest.fn() }, name: 'Alpha', methods: ['init'] },
        { dependency: jest.fn(), name: 'Beta', isFunction: true },
      ];

      expect(() => validateDependencies(specs, logger)).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
