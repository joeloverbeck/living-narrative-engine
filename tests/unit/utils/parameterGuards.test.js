/**
 * @file Unit tests for parameter validation guard utilities.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  assertValidId,
  assertNonBlankString,
} from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('parameterGuards', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  });

  describe('assertValidId', () => {
    it('should pass validation for valid non-blank string IDs', () => {
      const validIds = ['valid-id', 'another_id', '123', 'id-with-dashes'];

      validIds.forEach((id) => {
        expect(() => {
          assertValidId(id, 'testMethod', mockLogger);
        }).not.toThrow();
      });

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw InvalidArgumentError for null IDs', () => {
      expect(() => {
        assertValidId(null, 'testMethod', mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "testMethod: Invalid ID 'null'. Expected non-blank string.",
        {
          receivedId: null,
          receivedType: 'object',
          context: 'testMethod',
        }
      );
    });

    it('should throw InvalidArgumentError for undefined IDs', () => {
      expect(() => {
        assertValidId(undefined, 'testMethod', mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "testMethod: Invalid ID 'undefined'. Expected non-blank string.",
        {
          receivedId: undefined,
          receivedType: 'undefined',
          context: 'testMethod',
        }
      );
    });

    it('should throw InvalidArgumentError for empty string IDs', () => {
      expect(() => {
        assertValidId('', 'testMethod', mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "testMethod: Invalid ID ''. Expected non-blank string.",
        {
          receivedId: '',
          receivedType: 'string',
          context: 'testMethod',
        }
      );
    });

    it('should throw InvalidArgumentError for whitespace-only string IDs', () => {
      const whitespaceIds = [' ', '  ', '\t', '\n', ' \t \n '];

      whitespaceIds.forEach((id) => {
        expect(() => {
          assertValidId(id, 'testMethod', mockLogger);
        }).toThrow(InvalidArgumentError);
      });

      expect(mockLogger.error).toHaveBeenCalledTimes(whitespaceIds.length);
    });

    it('should throw InvalidArgumentError for non-string IDs', () => {
      const invalidIds = [123, {}, [], true, false, 0, -1];

      invalidIds.forEach((id) => {
        expect(() => {
          assertValidId(id, 'testMethod', mockLogger);
        }).toThrow(InvalidArgumentError);
      });

      expect(mockLogger.error).toHaveBeenCalledTimes(invalidIds.length);
    });

    it('should include correct error details in InvalidArgumentError', () => {
      let error;
      try {
        assertValidId(123, 'testMethod', mockLogger);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(InvalidArgumentError);
      expect(error.name).toBe('InvalidArgumentError');
      expect(error.parameterName).toBe('id');
      expect(error.receivedValue).toBe(123);
      expect(error.message).toBe(
        "testMethod: Invalid ID '123'. Expected non-blank string."
      );
    });
  });

  describe('assertNonBlankString', () => {
    it('should pass validation for valid non-blank strings', () => {
      const validStrings = [
        'valid-string',
        'another_string',
        '123',
        'string-with-dashes',
      ];

      validStrings.forEach((str) => {
        expect(() => {
          assertNonBlankString(str, 'testParam', 'testMethod', mockLogger);
        }).not.toThrow();
      });

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw InvalidArgumentError for null strings', () => {
      expect(() => {
        assertNonBlankString(null, 'testParam', 'testMethod', mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "testMethod: Invalid testParam 'null'. Expected non-blank string.",
        {
          receivedValue: null,
          receivedType: 'object',
          parameterName: 'testParam',
          context: 'testMethod',
        }
      );
    });

    it('should throw InvalidArgumentError for undefined strings', () => {
      expect(() => {
        assertNonBlankString(undefined, 'testParam', 'testMethod', mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "testMethod: Invalid testParam 'undefined'. Expected non-blank string.",
        {
          receivedValue: undefined,
          receivedType: 'undefined',
          parameterName: 'testParam',
          context: 'testMethod',
        }
      );
    });

    it('should throw InvalidArgumentError for empty strings', () => {
      expect(() => {
        assertNonBlankString('', 'testParam', 'testMethod', mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "testMethod: Invalid testParam ''. Expected non-blank string.",
        {
          receivedValue: '',
          receivedType: 'string',
          parameterName: 'testParam',
          context: 'testMethod',
        }
      );
    });

    it('should throw InvalidArgumentError for whitespace-only strings', () => {
      const whitespaceStrings = [' ', '  ', '\t', '\n', ' \t \n '];

      whitespaceStrings.forEach((str) => {
        expect(() => {
          assertNonBlankString(str, 'testParam', 'testMethod', mockLogger);
        }).toThrow(InvalidArgumentError);
      });

      expect(mockLogger.error).toHaveBeenCalledTimes(whitespaceStrings.length);
    });

    it('should throw InvalidArgumentError for non-string values', () => {
      const invalidValues = [123, {}, [], true, false, 0, -1];

      invalidValues.forEach((value) => {
        expect(() => {
          assertNonBlankString(value, 'testParam', 'testMethod', mockLogger);
        }).toThrow(InvalidArgumentError);
      });

      expect(mockLogger.error).toHaveBeenCalledTimes(invalidValues.length);
    });

    it('should include correct error details in InvalidArgumentError', () => {
      let error;
      try {
        assertNonBlankString(123, 'testParam', 'testMethod', mockLogger);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(InvalidArgumentError);
      expect(error.name).toBe('InvalidArgumentError');
      expect(error.parameterName).toBe('testParam');
      expect(error.receivedValue).toBe(123);
      expect(error.message).toBe(
        "testMethod: Invalid testParam '123'. Expected non-blank string."
      );
    });

    it('should use custom parameter name in error message', () => {
      expect(() => {
        assertNonBlankString('', 'customParamName', 'testMethod', mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "testMethod: Invalid customParamName ''. Expected non-blank string.",
        expect.objectContaining({
          parameterName: 'customParamName',
        })
      );
    });
  });
});
