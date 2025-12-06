/**
 * @file preValidationUtils.helperFunctions.test.js
 * @description Unit tests for helper functions in preValidationUtils
 * Tests for Option B (browser-safe) implementation of OPEHANIMP-010
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import {
  toSchemaFileName,
  toTokenName,
  toHandlerClassName,
  validateOperationType,
  KNOWN_OPERATION_TYPES,
} from '../../../src/utils/preValidationUtils.js';
import OperationValidationError from '../../../src/errors/operationValidationError.js';

describe('preValidationUtils - Helper Functions (Option B)', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('toSchemaFileName', () => {
    it('should convert ADD_COMPONENT to addComponent.schema.json', () => {
      expect(toSchemaFileName('ADD_COMPONENT')).toBe(
        'addComponent.schema.json'
      );
    });

    it('should convert VALIDATE_INVENTORY_CAPACITY to validateInventoryCapacity.schema.json', () => {
      expect(toSchemaFileName('VALIDATE_INVENTORY_CAPACITY')).toBe(
        'validateInventoryCapacity.schema.json'
      );
    });

    it('should convert single word operation types', () => {
      expect(toSchemaFileName('SEQUENCE')).toBe('sequence.schema.json');
    });

    it('should handle all known operation types', () => {
      // Test a few representative examples
      expect(toSchemaFileName('QUERY_COMPONENT')).toBe(
        'queryComponent.schema.json'
      );
      expect(toSchemaFileName('DISPATCH_EVENT')).toBe(
        'dispatchEvent.schema.json'
      );
      expect(toSchemaFileName('SET_VARIABLE')).toBe('setVariable.schema.json');
    });

    it('should produce camelCase with .schema.json extension', () => {
      const result = toSchemaFileName('OPEN_CONTAINER');
      expect(result).toBe('openContainer.schema.json');
      expect(result).toMatch(/^[a-z][a-zA-Z]*\.schema\.json$/);
    });
  });

  describe('toTokenName', () => {
    it('should convert ADD_COMPONENT to AddComponentHandler', () => {
      expect(toTokenName('ADD_COMPONENT')).toBe('AddComponentHandler');
    });

    it('should convert VALIDATE_INVENTORY_CAPACITY to ValidateInventoryCapacityHandler', () => {
      expect(toTokenName('VALIDATE_INVENTORY_CAPACITY')).toBe(
        'ValidateInventoryCapacityHandler'
      );
    });

    it('should not include "I" prefix (operation handler convention)', () => {
      const result = toTokenName('ADD_COMPONENT');
      expect(result).toBe('AddComponentHandler');
      expect(result).not.toMatch(/^I[A-Z]/); // Should NOT start with "I" prefix
    });

    it('should handle single word operation types', () => {
      expect(toTokenName('SEQUENCE')).toBe('SequenceHandler');
    });

    it('should produce PascalCase with Handler suffix', () => {
      const result = toTokenName('OPEN_CONTAINER');
      expect(result).toBe('OpenContainerHandler');
      expect(result).toMatch(/^[A-Z][a-zA-Z]*Handler$/);
    });

    it('should match tokens-core.js naming convention', () => {
      // Operation handlers use PascalCase + Handler (no "I" prefix)
      // Unlike service interfaces which use "I" prefix
      const result = toTokenName('ADD_COMPONENT');
      expect(result).toBe('AddComponentHandler');
      expect(result).not.toBe('IAddComponentHandler');
    });
  });

  describe('toHandlerClassName', () => {
    it('should match toTokenName for operation handlers', () => {
      expect(toHandlerClassName('ADD_COMPONENT')).toBe(
        toTokenName('ADD_COMPONENT')
      );
      expect(toHandlerClassName('VALIDATE_INVENTORY_CAPACITY')).toBe(
        toTokenName('VALIDATE_INVENTORY_CAPACITY')
      );
    });

    it('should produce correct handler class names', () => {
      expect(toHandlerClassName('OPEN_CONTAINER')).toBe('OpenContainerHandler');
      expect(toHandlerClassName('TAKE_FROM_CONTAINER')).toBe(
        'TakeFromContainerHandler'
      );
    });

    it('should not include "I" prefix', () => {
      const result = toHandlerClassName('ADD_COMPONENT');
      expect(result).not.toMatch(/^I[A-Z]/);
    });
  });

  describe('validateOperationType - Enhanced with Options', () => {
    describe('valid operation types', () => {
      it('should return ValidationResult with isValid=true for known operation', () => {
        const result = validateOperationType('ADD_COMPONENT', mockLogger, {
          throwOnError: false,
        });

        expect(result).toMatchObject({
          isValid: true,
          operationType: 'ADD_COMPONENT',
          missingRegistrations: [],
        });
        expect(result.checks.inWhitelist).toBe(true);
        expect(result.expectedPaths).toBeDefined();
      });

      it('should include expected paths in result', () => {
        const result = validateOperationType('ADD_COMPONENT', mockLogger, {
          throwOnError: false,
        });

        expect(result.expectedPaths).toEqual({
          schemaFile: 'data/schemas/operations/addComponent.schema.json',
          tokenName: 'AddComponentHandler',
          handlerClass: 'AddComponentHandler',
        });
      });

      it('should log debug message for valid operation', () => {
        validateOperationType('ADD_COMPONENT', mockLogger, {
          throwOnError: false,
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Operation type validation passed',
          expect.objectContaining({
            operationType: 'ADD_COMPONENT',
          })
        );
      });

      it('should validate all KNOWN_OPERATION_TYPES successfully', () => {
        KNOWN_OPERATION_TYPES.forEach((operationType) => {
          const result = validateOperationType(operationType, mockLogger, {
            throwOnError: false,
          });

          expect(result.isValid).toBe(true);
          expect(result.missingRegistrations).toHaveLength(0);
        });
      });

      it('should throw by default when throwOnError is not specified', () => {
        // Should not throw for valid operation
        expect(() => {
          validateOperationType('ADD_COMPONENT', mockLogger);
        }).not.toThrow();
      });
    });

    describe('invalid operation types', () => {
      it('should return ValidationResult with isValid=false for unknown operation', () => {
        const result = validateOperationType('UNKNOWN_OPERATION', mockLogger, {
          throwOnError: false,
        });

        expect(result).toMatchObject({
          isValid: false,
          operationType: 'UNKNOWN_OPERATION',
        });
        expect(result.checks.inWhitelist).toBe(false);
        expect(result.missingRegistrations.length).toBeGreaterThan(0);
      });

      it('should include all potential missing registrations for unknown operation', () => {
        const result = validateOperationType('UNKNOWN_OPERATION', mockLogger, {
          throwOnError: false,
        });

        // Since we can't check filesystem, assume all might be missing
        expect(result.missingRegistrations).toContain('whitelist');
        expect(result.missingRegistrations).toContain('schema');
        expect(result.missingRegistrations).toContain('reference');
        expect(result.missingRegistrations).toContain('token');
        expect(result.missingRegistrations).toContain('handler');
        expect(result.missingRegistrations).toContain('mapping');
      });

      it('should log warning for invalid operation', () => {
        validateOperationType('UNKNOWN_OPERATION', mockLogger, {
          throwOnError: false,
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Operation validation failed',
          expect.objectContaining({
            operationType: 'UNKNOWN_OPERATION',
            missingRegistrations: expect.arrayContaining(['whitelist']),
          })
        );
      });

      it('should throw OperationValidationError by default (throwOnError=true)', () => {
        expect(() => {
          validateOperationType('UNKNOWN_OPERATION', mockLogger);
        }).toThrow(OperationValidationError);

        expect(() => {
          validateOperationType('UNKNOWN_OPERATION', mockLogger, {
            throwOnError: true,
          });
        }).toThrow(OperationValidationError);
      });

      it('should not throw when throwOnError=false', () => {
        expect(() => {
          validateOperationType('UNKNOWN_OPERATION', mockLogger, {
            throwOnError: false,
          });
        }).not.toThrow();
      });

      it('should include expected paths even for invalid operations', () => {
        const result = validateOperationType('UNKNOWN_OPERATION', mockLogger, {
          throwOnError: false,
        });

        expect(result.expectedPaths).toEqual({
          schemaFile: 'data/schemas/operations/unknownOperation.schema.json',
          tokenName: 'UnknownOperationHandler',
          handlerClass: 'UnknownOperationHandler',
        });
      });

      it('should log error when throwing', () => {
        try {
          validateOperationType('UNKNOWN_OPERATION', mockLogger);
          // eslint-disable-next-line no-empty
        } catch {}

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Operation validation error',
          expect.objectContaining({
            operationType: 'UNKNOWN_OPERATION',
            errorMessage: expect.stringContaining('UNKNOWN_OPERATION'),
          })
        );
      });
    });

    describe('options parameter', () => {
      it('should respect throwOnError option', () => {
        // Should not throw with throwOnError: false
        const result = validateOperationType('INVALID_OP', mockLogger, {
          throwOnError: false,
        });
        expect(result.isValid).toBe(false);

        // Should throw with throwOnError: true
        expect(() => {
          validateOperationType('INVALID_OP', mockLogger, {
            throwOnError: true,
          });
        }).toThrow(OperationValidationError);
      });

      it('should default to throwOnError=true when not specified', () => {
        expect(() => {
          validateOperationType('INVALID_OP', mockLogger);
        }).toThrow();
      });

      it('should handle empty options object', () => {
        expect(() => {
          validateOperationType('INVALID_OP', mockLogger, {});
        }).toThrow();
      });
    });

    describe('backward compatibility', () => {
      it('should maintain backward compatibility with old signature', () => {
        // Old signature: validateOperationType(operationType, logger)
        // Should still throw for invalid operations
        expect(() => {
          validateOperationType('INVALID_OP', mockLogger);
        }).toThrow(OperationValidationError);
      });

      it('should not throw for valid operations with old signature', () => {
        expect(() => {
          validateOperationType('ADD_COMPONENT', mockLogger);
        }).not.toThrow();
      });
    });

    describe('browser-safe implementation', () => {
      it('should not require filesystem access', () => {
        // This test verifies that the function runs without fs module
        // by checking it returns expected structure
        const result = validateOperationType('ADD_COMPONENT', mockLogger, {
          throwOnError: false,
        });

        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('checks');
        expect(result).toHaveProperty('expectedPaths');
        expect(result).toHaveProperty('missingRegistrations');
      });

      it('should calculate expected paths without checking file existence', () => {
        const result = validateOperationType('NEW_OPERATION', mockLogger, {
          throwOnError: false,
        });

        // Should calculate paths even though files don't exist
        expect(result.expectedPaths).toBeDefined();
        expect(result.expectedPaths.schemaFile).toBeTruthy();
        expect(result.expectedPaths.tokenName).toBeTruthy();
        expect(result.expectedPaths.handlerClass).toBeTruthy();
      });
    });
  });

  describe('ValidationResult structure', () => {
    it('should include all required properties', () => {
      const result = validateOperationType('ADD_COMPONENT', mockLogger, {
        throwOnError: false,
      });

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('missingRegistrations');
      expect(result).toHaveProperty('operationType');
      expect(result).toHaveProperty('expectedPaths');
    });

    it('should have checks object with expected properties', () => {
      const result = validateOperationType('ADD_COMPONENT', mockLogger, {
        throwOnError: false,
      });

      expect(result.checks).toHaveProperty('inWhitelist');
      expect(result.checks).toHaveProperty('expectedSchemaPath');
      expect(result.checks).toHaveProperty('expectedTokenName');
      expect(result.checks).toHaveProperty('expectedHandlerClass');
    });

    it('should have expectedPaths object with all paths', () => {
      const result = validateOperationType('ADD_COMPONENT', mockLogger, {
        throwOnError: false,
      });

      expect(result.expectedPaths).toHaveProperty('schemaFile');
      expect(result.expectedPaths).toHaveProperty('tokenName');
      expect(result.expectedPaths).toHaveProperty('handlerClass');
    });
  });
});
