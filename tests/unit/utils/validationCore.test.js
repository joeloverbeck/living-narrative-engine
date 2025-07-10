/**
 * @file Unit tests for validationCore utilities
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { string, type, logger as loggerValidation } from '../../../src/utils/validationCore.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ensureValidLogger } from '../../../src/utils/loggerUtils.js';

// Mock dependencies
jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(),
}));

describe('validationCore', () => {
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Setup the mock to return the mockLogger
    ensureValidLogger.mockReturnValue(mockLogger);
  });

  describe('string utilities', () => {
    describe('isNonBlank', () => {
      it('should return true for valid non-blank strings', () => {
        expect(string.isNonBlank('hello')).toBe(true);
        expect(string.isNonBlank('  world  ')).toBe(true);
        expect(string.isNonBlank('a')).toBe(true);
      });

      it('should return false for blank or invalid strings', () => {
        expect(string.isNonBlank('')).toBe(false);
        expect(string.isNonBlank('   ')).toBe(false);
        expect(string.isNonBlank(null)).toBe(false);
        expect(string.isNonBlank(undefined)).toBe(false);
        expect(string.isNonBlank(123)).toBe(false);
        expect(string.isNonBlank({})).toBe(false);
      });
    });

    describe('assertNonBlank', () => {
      it('should not throw for valid non-blank strings', () => {
        expect(() => {
          string.assertNonBlank('hello', 'testParam');
        }).not.toThrow();
      });

      it('should throw InvalidArgumentError for invalid strings', () => {
        expect(() => {
          string.assertNonBlank('', 'testParam');
        }).toThrow(InvalidArgumentError);

        expect(() => {
          string.assertNonBlank(null, 'testParam');
        }).toThrow(InvalidArgumentError);

        expect(() => {
          string.assertNonBlank(123, 'testParam');
        }).toThrow(InvalidArgumentError);
      });

      it('should include parameter name in error message', () => {
        expect(() => {
          string.assertNonBlank('', 'myParam');
        }).toThrow("Parameter 'myParam' must be a non-blank string");
      });

      it('should include context in error message when provided', () => {
        expect(() => {
          string.assertNonBlank('', 'myParam', 'MyFunction');
        }).toThrow("Parameter 'myParam' must be a non-blank string in MyFunction");
      });
    });

    describe('validateAndTrim', () => {
      it('should return trimmed string for valid input', () => {
        expect(string.validateAndTrim('  hello  ')).toBe('hello');
        expect(string.validateAndTrim('world')).toBe('world');
      });

      it('should return null for invalid input', () => {
        expect(string.validateAndTrim('')).toBe(null);
        expect(string.validateAndTrim('   ')).toBe(null);
        expect(string.validateAndTrim(null)).toBe(null);
        expect(string.validateAndTrim(undefined)).toBe(null);
        expect(string.validateAndTrim(123)).toBe(null);
      });
    });

    describe('validateParam', () => {
      it('should return trimmed string for valid input', () => {
        const result = string.validateParam('  test  ', 'myParam', mockLogger);
        expect(result).toBe('test');
      });

      it('should return null for invalid input', () => {
        const result = string.validateParam('', 'myParam', mockLogger);
        expect(result).toBe(null);
      });

      it('should work without logger', () => {
        const result = string.validateParam('test', 'myParam');
        expect(result).toBe('test');
      });
    });
  });

  describe('type utilities', () => {
    describe('assertIsMap', () => {
      it('should not throw for Map instances', () => {
        const map = new Map();
        expect(() => {
          type.assertIsMap(map, 'testMap');
        }).not.toThrow();
      });

      it('should throw for non-Map values', () => {
        expect(() => {
          type.assertIsMap({}, 'testMap');
        }).toThrow(InvalidArgumentError);

        expect(() => {
          type.assertIsMap([], 'testMap');
        }).toThrow(InvalidArgumentError);

        expect(() => {
          type.assertIsMap(null, 'testMap');
        }).toThrow(InvalidArgumentError);
      });
    });

    describe('assertHasMethods', () => {
      it('should not throw for objects with required methods', () => {
        const obj = {
          method1: () => {},
          method2: () => {},
        };
        
        expect(() => {
          type.assertHasMethods(obj, ['method1', 'method2'], 'testObj');
        }).not.toThrow();
      });

      it('should throw for objects missing methods', () => {
        const obj = {
          method1: () => {},
        };
        
        expect(() => {
          type.assertHasMethods(obj, ['method1', 'method2'], 'testObj');
        }).toThrow(InvalidArgumentError);
        
        expect(() => {
          type.assertHasMethods(obj, ['method1', 'method2'], 'testObj');
        }).toThrow("missing required methods: method2");
      });

      it('should throw for non-objects', () => {
        expect(() => {
          type.assertHasMethods(null, ['method1'], 'testObj');
        }).toThrow("Parameter 'testObj' must be an object");
      });
    });
  });

  describe('logger utilities', () => {
    describe('isValid', () => {
      it('should return true for valid logger objects', () => {
        expect(loggerValidation.isValid(mockLogger)).toBe(true);
      });

      it('should return false for invalid logger objects', () => {
        expect(loggerValidation.isValid(null)).toBe(false);
        expect(loggerValidation.isValid({})).toBe(false);
        expect(loggerValidation.isValid({ debug: 'not a function' })).toBe(false);
        expect(loggerValidation.isValid({ debug: () => {} })).toBe(false); // Missing other methods
      });
    });

    describe('assertValid', () => {
      it('should not throw for valid loggers', () => {
        expect(() => {
          loggerValidation.assertValid(mockLogger);
        }).not.toThrow();
      });

      it('should throw for invalid loggers', () => {
        expect(() => {
          loggerValidation.assertValid(null);
        }).toThrow(InvalidArgumentError);

        expect(() => {
          loggerValidation.assertValid({});
        }).toThrow("Parameter 'logger' must be a valid logger");
      });

      it('should use custom parameter name in error', () => {
        expect(() => {
          loggerValidation.assertValid(null, 'myLogger');
        }).toThrow("Parameter 'myLogger' must be a valid logger");
      });
    });
  });
});