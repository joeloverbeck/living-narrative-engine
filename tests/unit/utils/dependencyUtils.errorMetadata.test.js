import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as dependencyUtils from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const {
  assertValidId,
  assertNonBlankString,
  validateDependency,
  validateDependencies,
} = dependencyUtils;

describe('dependencyUtils error metadata', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('assertValidId', () => {
    it('throws InvalidArgumentError with diagnostic payload for blank identifiers', () => {
      const logger = { error: jest.fn() };

      expect(() => assertValidId('   ', 'Pipeline', logger)).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        "Pipeline: Invalid ID '   '. Expected non-blank string.",
        expect.objectContaining({
          context: 'Pipeline',
          receivedId: '   ',
          receivedType: 'string',
        })
      );

      try {
        assertValidId('   ', 'Pipeline', logger);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.parameterName).toBe('id');
        expect(error.receivedValue).toBe('   ');
      }
    });

    it('reports type metadata when identifier is not a string', () => {
      const logger = { error: jest.fn() };

      expect(() => assertValidId(42, 'ActorLookup', logger)).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        "ActorLookup: Invalid ID '42'. Expected non-blank string.",
        expect.objectContaining({
          context: 'ActorLookup',
          receivedId: 42,
          receivedType: 'number',
        })
      );
    });
  });

  describe('assertNonBlankString', () => {
    it('provides parameter information when validation fails', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        assertNonBlankString('', 'componentName', 'Formatter', logger)
      ).toThrow(InvalidArgumentError);

      const [message, payload] = logger.error.mock.calls[0];
      expect(message).toBe("Formatter: Invalid componentName ''. Expected non-blank string.");
      expect(payload).toMatchObject({
        context: 'Formatter',
        parameterName: 'componentName',
        receivedValue: '',
        receivedType: 'string',
      });

      try {
        assertNonBlankString('', 'componentName', 'Formatter', logger);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.parameterName).toBe('componentName');
        expect(error.receivedValue).toBe('');
      }
    });
  });

  describe('validateDependency', () => {
    it('logs and throws when a function dependency is required but not provided', () => {
      const logger = { error: jest.fn() };

      expect(() =>
        validateDependency({}, 'CallableFormatter', logger, { isFunction: true })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        "Dependency 'CallableFormatter' must be a function, but got object.",
      );
    });

    it('falls back to console logging when logger cannot report errors', () => {
      const inertLogger = { error: undefined };

      expect(() =>
        validateDependency(
          { bootstrap: jest.fn() },
          'LifecycleService',
          inertLogger,
          { requiredMethods: ['bootstrap', 'shutdown'] }
        )
      ).toThrow(InvalidArgumentError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid or missing method 'shutdown' on dependency 'LifecycleService'.",
      );
    });

    it('accepts dependencies that satisfy both function and method requirements', () => {
      const logger = { error: jest.fn() };
      const dependency = () => {};
      dependency.configure = jest.fn();

      expect(() =>
        validateDependency(dependency, 'ConfigurableFactory', logger, {
          isFunction: true,
          requiredMethods: ['configure'],
        })
      ).not.toThrow();

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('validateDependencies', () => {
    it('validates every array entry and surfaces failures from later specifications', () => {
      const logger = { error: jest.fn() };
      const specs = [
        { dependency: { init: jest.fn() }, name: 'Initializer', methods: ['init'] },
        { dependency: {}, name: 'Callable', isFunction: true },
      ];

      expect(() => validateDependencies(specs, logger)).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenLastCalledWith(
        "Dependency 'Callable' must be a function, but got object.",
      );
    });

    it('stops iteration after the first validation failure for generators', () => {
      const logger = { error: jest.fn() };
      const sequence = [];

      /**
       *
       */
      function* specs() {
        sequence.push('first');
        yield { dependency: { start: jest.fn() }, name: 'Startable', methods: ['start'] };

        sequence.push('second');
        yield { dependency: {}, name: 'Broken', isFunction: true };

        sequence.push('third');
        yield { dependency: jest.fn(), name: 'Skipped', isFunction: true };
      }

      expect(() => validateDependencies(specs(), logger)).toThrow(InvalidArgumentError);

      expect(sequence).toEqual(['first', 'second']);
      expect(logger.error).toHaveBeenLastCalledWith(
        "Dependency 'Broken' must be a function, but got object.",
      );
    });
  });
});
