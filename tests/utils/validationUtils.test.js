// src/utils/validationUtils.test.js
// --- FILE START ---
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { validateDependency } from '../../src/utils/validationUtils.js';

describe('validateDependency', () => {
  let mockLogger;
  let consoleErrorSpy;
  // Add spies for other console methods if they become relevant (e.g., console.info)

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    // Suppress console.error output during tests unless specifically testing for it
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Missing Dependency', () => {
    it('should throw and log error if dependency is null (using default console)', () => {
      const dependencyName = 'TestDepNull';
      expect(() => validateDependency(null, dependencyName)).toThrow(
        `Missing required dependency: ${dependencyName}.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
    });

    it('should throw and log error if dependency is undefined (using default console)', () => {
      const dependencyName = 'TestDepUndefined';
      expect(() => validateDependency(undefined, dependencyName)).toThrow(
        `Missing required dependency: ${dependencyName}.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
    });

    it('should throw and log error with provided logger if dependency is null', () => {
      const dependencyName = 'TestDepWithLogger';
      expect(() =>
        validateDependency(null, dependencyName, mockLogger)
      ).toThrow(`Missing required dependency: ${dependencyName}.`);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.error if provided logger is null and dependency is missing', () => {
      const dependencyName = 'MissingDepNullLogger';
      expect(() => validateDependency(null, dependencyName, null)).toThrow(
        `Missing required dependency: ${dependencyName}.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
    });

    it('should use console.error if provided logger is invalid (no error method) and dependency is missing', () => {
      const dependencyName = 'MissingDepInvalidLogger';
      const invalidLogger = { info: jest.fn() }; // No 'error' method
      expect(() =>
        validateDependency(null, dependencyName, invalidLogger)
      ).toThrow(`Missing required dependency: ${dependencyName}.`);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
    });

    it('should use console.error if the logger itself is the missing dependency (passed as null)', () => {
      const dependencyName = 'logger';
      // Pass the logger (which is null) as the dependency to be validated
      // and also as the logger instance. The function should detect this.
      expect(() => validateDependency(null, dependencyName, null)).toThrow(
        `Missing required dependency: ${dependencyName}.`
      );
      // The effectiveLogger defaults to console, so console.error should be called.
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
    });

    it('should use console.error if the logger itself is the missing dependency (passed as undefined)', () => {
      const dependencyName = 'loggerAsUndefined';
      expect(() =>
        validateDependency(undefined, dependencyName, undefined)
      ).toThrow(`Missing required dependency: ${dependencyName}.`);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
    });
  });

  describe('isFunction Validation', () => {
    it('should throw and log error if dependency is not a function when isFunction is true (using default console)', () => {
      const dependencyName = 'NonFuncDep';
      const dependency = {};
      expect(() =>
        validateDependency(dependency, dependencyName, undefined, {
          // Use undefined for logger to force default
          isFunction: true,
        })
      ).toThrow(
        `Dependency '${dependencyName}' must be a function, but got ${typeof dependency}.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Dependency '${dependencyName}' must be a function, but got ${typeof dependency}.`
      );
    });

    it('should throw and log error with provided logger if dependency is not a function when isFunction is true', () => {
      const dependencyName = 'NonFuncDepWithLogger';
      const dependency = 'not-a-function';
      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger, {
          isFunction: true,
        })
      ).toThrow(
        `Dependency '${dependencyName}' must be a function, but got ${typeof dependency}.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Dependency '${dependencyName}' must be a function, but got ${typeof dependency}.`
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should not throw if dependency is a function when isFunction is true', () => {
      const dependencyName = 'FuncDep';
      const dependency = () => {};
      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger, {
          isFunction: true,
        })
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not throw if isFunction is false (default) and dependency is not a function (e.g. an object)', () => {
      const dependencyName = 'ObjectDep';
      const dependency = {};
      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger)
      ).not.toThrow(); // isFunction defaults to false
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not throw if isFunction is false (default) and dependency is a primitive', () => {
      const dependencyName = 'StringDep';
      const dependency = 'a string';
      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger)
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Required Methods Validation', () => {
    const depWithName = 'DepWithMethods';
    it('should throw and log error if a required method is missing (using default console)', () => {
      const dependency = { existingMethod: () => {} };
      const requiredMethods = ['existingMethod', 'missingMethod'];
      expect(
        () =>
          validateDependency(dependency, depWithName, undefined, {
            requiredMethods,
          }) // Default console
      ).toThrow(
        `Invalid or missing method 'missingMethod' on dependency '${depWithName}'.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Invalid or missing method 'missingMethod' on dependency '${depWithName}'.`
      );
    });

    it('should throw and log error with provided logger if a required method is missing', () => {
      const dependency = { methodA: () => {} };
      const requiredMethods = ['methodA', 'methodB'];
      expect(() =>
        validateDependency(dependency, depWithName, mockLogger, {
          requiredMethods,
        })
      ).toThrow(
        `Invalid or missing method 'methodB' on dependency '${depWithName}'.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Invalid or missing method 'methodB' on dependency '${depWithName}'.`
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw and log error if a required method is not a function (using default console)', () => {
      const dependency = { methodA: () => {}, methodB: 'not-a-function' };
      const requiredMethods = ['methodA', 'methodB'];
      expect(
        () =>
          validateDependency(dependency, depWithName, undefined, {
            requiredMethods,
          }) // Default console
      ).toThrow(
        `Invalid or missing method 'methodB' on dependency '${depWithName}'.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Invalid or missing method 'methodB' on dependency '${depWithName}'.`
      );
    });

    it('should throw and log error with provided logger if a required method is not a function', () => {
      const dependency = { methodA: () => {}, methodB: null }; // null is not a function
      const requiredMethods = ['methodA', 'methodB'];
      expect(() =>
        validateDependency(dependency, depWithName, mockLogger, {
          requiredMethods,
        })
      ).toThrow(
        `Invalid or missing method 'methodB' on dependency '${depWithName}'.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Invalid or missing method 'methodB' on dependency '${depWithName}'.`
      );
    });

    it('should not throw if all required methods are present and are functions', () => {
      const dependency = { methodA: () => {}, methodB: () => {} };
      const requiredMethods = ['methodA', 'methodB'];
      expect(() =>
        validateDependency(dependency, depWithName, mockLogger, {
          requiredMethods,
        })
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not throw if requiredMethods array is empty', () => {
      const dependency = { anyProperty: 123 };
      expect(() =>
        validateDependency(dependency, depWithName, mockLogger, {
          requiredMethods: [],
        })
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not throw if requiredMethods option is not provided (defaults to empty array)', () => {
      const dependency = { anyProperty: 123 };
      expect(() =>
        validateDependency(dependency, depWithName, mockLogger)
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw for missing method if dependency is a primitive type (e.g. string)', () => {
      const dependency = 'a string';
      const requiredMethods = ['toString', 'nonExistentMethod']; // toString exists, nonExistentMethod does not
      const depName = 'StringDep';
      expect(() =>
        validateDependency(dependency, depName, mockLogger, { requiredMethods })
      ).toThrow(
        `Invalid or missing method 'nonExistentMethod' on dependency '${depName}'.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Invalid or missing method 'nonExistentMethod' on dependency '${depName}'.`
      );
    });
  });

  describe('Combined Validations', () => {
    it('should not throw for a valid dependency object with required methods and isFunction false', () => {
      const dependencyName = 'ValidObject';
      const dependency = { method1: () => {}, method2: () => {} };
      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger, {
          requiredMethods: ['method1'],
          isFunction: false, // Explicitly false, or default
        })
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not throw for a valid function dependency when isFunction is true and no methods required', () => {
      const dependencyName = 'ValidFunction';
      const dependency = () => {};
      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger, {
          isFunction: true,
        })
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw for missing method even if isFunction is true and dependency is a function but missing methods', () => {
      const dependencyName = 'FunctionMissingMethods';
      const dependency = () => {};
      // Functions can have properties in JS
      dependency.presentMethod = () => {};

      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger, {
          isFunction: true,
          requiredMethods: ['presentMethod', 'missingMethod'],
        })
      ).toThrow(
        `Invalid or missing method 'missingMethod' on dependency '${dependencyName}'.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Invalid or missing method 'missingMethod' on dependency '${dependencyName}'.`
      );
    });

    it('should prioritize missing dependency error over other checks', () => {
      const dependencyName = 'NullDepWithAllOptions';
      expect(() =>
        validateDependency(null, dependencyName, mockLogger, {
          isFunction: true,
          requiredMethods: ['someMethod'],
        })
      ).toThrow(`Missing required dependency: ${dependencyName}.`);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Missing required dependency: ${dependencyName}.`
      );
      // Ensure other error messages are not logged
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('must be a function')
      );
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid or missing method')
      );
    });

    it('should prioritize isFunction error over requiredMethods if dependency is not null but wrong type', () => {
      const dependencyName = 'WrongTypeDepWithOptions';
      const dependency = {}; // Not a function
      expect(() =>
        validateDependency(dependency, dependencyName, mockLogger, {
          isFunction: true,
          requiredMethods: ['someMethod'],
        })
      ).toThrow(
        `Dependency '${dependencyName}' must be a function, but got object.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Dependency '${dependencyName}' must be a function, but got object.`
      );
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid or missing method')
      );
    });
  });
});
// --- FILE END ---
