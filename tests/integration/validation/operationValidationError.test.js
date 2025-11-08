/**
 * @file operationValidationError.test.js
 * @description Integration tests for OperationValidationError in real scenarios
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateOperationType } from '../../../src/utils/preValidationUtils.js';
import OperationValidationError from '../../../src/errors/operationValidationError.js';

describe('OperationValidationError - Integration Tests', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };
  });

  describe('Error Message Format', () => {
    it('should provide actionable error message with all required sections', () => {
      expect(() => {
        validateOperationType('UNREGISTERED_OPERATION', mockLogger);
      }).toThrow(OperationValidationError);

      let caughtError;
      try {
        validateOperationType('UNREGISTERED_OPERATION', mockLogger);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(OperationValidationError);

      // Check error has all required sections
      expect(caughtError.message).toContain('❌ Operation validation failed');
      expect(caughtError.message).toContain('📋 Missing registrations detected');
      expect(caughtError.message).toContain('⚠️  STEP 7: NOT IN PRE-VALIDATION WHITELIST');
      expect(caughtError.message).toContain('⚠️  STEP 1: SCHEMA FILE NOT FOUND');
      expect(caughtError.message).toContain('⚠️  STEP 2: SCHEMA NOT REFERENCED');
      expect(caughtError.message).toContain('🔧 Verification commands');
      expect(caughtError.message).toContain('📚 Complete registration guide');
      expect(caughtError.message).toContain('💡 Tip');
    });

    it('should include specific operation type in error message', () => {
      const operationType = 'MY_CUSTOM_OPERATION';
      expect(() => {
        validateOperationType(operationType, mockLogger);
      }).toThrow(OperationValidationError);

      let caughtError;
      try {
        validateOperationType(operationType, mockLogger);
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError.message).toContain(operationType);
      expect(caughtError.operationType).toBe(operationType);
    });

    it('should format schema filename correctly from operation type', () => {
      // Should succeed since DRINK_FROM is registered
      expect(() => {
        validateOperationType('DRINK_FROM', mockLogger);
      }).not.toThrow();

      // Test with unregistered operation
      expect(() => {
        validateOperationType('TEST_MULTIPLE_WORDS', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('TEST_MULTIPLE_WORDS', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      // Should format as testMultipleWords.schema.json
      expect(errorMessage).toContain('testMultipleWords.schema.json');
    });
  });

  describe('Whitelist Validation', () => {
    it('should accept all registered operation types', () => {
      const registeredOperations = [
        'ADD_COMPONENT',
        'REMOVE_COMPONENT',
        'QUERY_COMPONENT',
        'MODIFY_COMPONENT',
        'DISPATCH_EVENT',
        'IF',
        'FOR_EACH',
        'LOG',
        'SET_VARIABLE',
        'OPEN_CONTAINER',
        'DRINK_FROM',
      ];

      registeredOperations.forEach((opType) => {
        expect(() => {
          validateOperationType(opType, mockLogger);
        }).not.toThrow();
      });
    });

    it('should reject unregistered operation types', () => {
      const unregisteredOperations = [
        'NOT_REGISTERED',
        'FAKE_OPERATION',
        'INVALID_OP',
        'TEST_OP',
      ];

      unregisteredOperations.forEach((opType) => {
        expect(() => {
          validateOperationType(opType, mockLogger);
        }).toThrow(OperationValidationError);
      });
    });
  });

  describe('Logger Integration', () => {
    it('should log error with proper context when validation fails', () => {
      expect(() => {
        validateOperationType('INVALID_OP', mockLogger);
      }).toThrow(OperationValidationError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Operation validation error',
        expect.objectContaining({
          operationType: 'INVALID_OP',
          errorMessage: expect.stringContaining('INVALID_OP'),
        })
      );
    });

    it('should log debug message when validation passes', () => {
      validateOperationType('ADD_COMPONENT', mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Operation type validation passed',
        expect.objectContaining({
          operationType: 'ADD_COMPONENT',
        })
      );
    });

    it('should not log error when validation passes', () => {
      validateOperationType('QUERY_COMPONENT', mockLogger);

      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Error Properties', () => {
    it('should set all required error properties', () => {
      expect(() => {
        validateOperationType('TEST_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let caughtError;
      try {
        validateOperationType('TEST_OP', mockLogger);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(OperationValidationError);
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.name).toBe('OperationValidationError');
      expect(caughtError.operationType).toBe('TEST_OP');
      expect(caughtError.missingRegistrations).toEqual([
        'whitelist',
        'schema',
        'reference',
        'token',
        'handler',
        'mapping',
      ]);
      expect(caughtError.message).toBeTruthy();
      expect(caughtError.stack).toBeTruthy();
    });
  });

  describe('Actionable Guidance', () => {
    it('should provide file paths to update', () => {
      expect(() => {
        validateOperationType('NEW_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('NEW_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toContain('src/utils/preValidationUtils.js');
      expect(errorMessage).toContain('data/schemas/operation.schema.json');
      expect(errorMessage).toContain('data/schemas/operations/');
    });

    it('should provide code examples', () => {
      expect(() => {
        validateOperationType('EXAMPLE_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('EXAMPLE_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toContain('```javascript');
      expect(errorMessage).toContain('```json');
      expect(errorMessage).toContain('Example:');
      expect(errorMessage).toContain('Code to add:');
    });

    it('should provide verification commands', () => {
      expect(() => {
        validateOperationType('VERIFY_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('VERIFY_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toContain('npm run validate');
      expect(errorMessage).toContain('npm run validate:strict');
      expect(errorMessage).toContain('npm run test:unit');
    });

    it('should reference documentation', () => {
      expect(() => {
        validateOperationType('DOC_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('DOC_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toContain('CLAUDE.md');
      expect(errorMessage).toContain('8-step checklist');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should help developer debug missing DRINK_ENTIRELY operation', () => {
      // DRINK_ENTIRELY is actually registered, but let's test the format
      // by using a similar unregistered name
      expect(() => {
        validateOperationType('DRINK_FULLY', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('DRINK_FULLY', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toContain('drinkFully.schema.json');
      expect(errorMessage).toContain('KNOWN_OPERATION_TYPES');
      expect(errorMessage).toContain('anyOf array');
    });

    it('should handle complex operation names', () => {
      expect(() => {
        validateOperationType('COMPLEX_MULTI_WORD_OPERATION', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('COMPLEX_MULTI_WORD_OPERATION', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toContain('complexMultiWordOperation.schema.json');
    });

    it('should handle single word operations', () => {
      expect(() => {
        validateOperationType('SINGLE', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('SINGLE', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toContain('single.schema.json');
    });
  });
});
