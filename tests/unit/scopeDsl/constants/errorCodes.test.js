/**
 * @file Unit tests for ErrorCodes constant
 */

import { describe, it, expect } from '@jest/globals';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('ErrorCodes', () => {
  describe('Constant Structure', () => {
    it('should be defined and exported', () => {
      expect(ErrorCodes).toBeDefined();
      expect(typeof ErrorCodes).toBe('object');
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(ErrorCodes)).toBe(true);

      // Attempt to modify should throw in strict mode
      expect(() => {
        ErrorCodes.MISSING_CONTEXT_GENERIC = 'MODIFIED_CODE';
      }).toThrow();

      // Attempt to add new property should throw in strict mode
      expect(() => {
        ErrorCodes.NEW_ERROR_CODE = 'SCOPE_9998';
      }).toThrow();
    });

    it('should have expected number of error codes', () => {
      const codes = Object.keys(ErrorCodes);
      // Should have substantial number of codes covering all categories
      expect(codes.length).toBeGreaterThan(30);
      expect(codes.length).toBeLessThan(60);
    });
  });

  describe('Code Format', () => {
    it('should use SCOPE_ prefix for all codes', () => {
      Object.values(ErrorCodes).forEach((code) => {
        expect(code).toMatch(/^SCOPE_\d{4}$/);
      });
    });

    it('should have unique error codes', () => {
      const codes = Object.values(ErrorCodes);
      const uniqueCodes = [...new Set(codes)];
      expect(uniqueCodes).toHaveLength(codes.length);
    });

    it('should use 4-digit numbering scheme', () => {
      Object.values(ErrorCodes).forEach((code) => {
        const number = code.replace('SCOPE_', '');
        expect(number).toMatch(/^\d{4}$/);
        expect(number.length).toBe(4);
      });
    });
  });

  describe('Category-Based Numbering', () => {
    describe('Context Errors (1xxx)', () => {
      const contextCodes = [
        'MISSING_CONTEXT_GENERIC',
        'MISSING_ACTOR',
        'INVALID_ACTOR_ID',
        'MISSING_DISPATCHER',
        'MISSING_REGISTRY',
        'MISSING_RUNTIME_CONTEXT',
        'MISSING_LOCATION',
        'MISSING_TARGET',
      ];

      contextCodes.forEach((codeName) => {
        it(`should have ${codeName} in 1xxx range`, () => {
          expect(ErrorCodes[codeName]).toMatch(/^SCOPE_1\d{3}$/);
        });
      });
    });

    describe('Data Validation Errors (2xxx)', () => {
      const dataCodes = [
        'INVALID_DATA_GENERIC',
        'INVALID_NODE_TYPE',
        'MISSING_NODE_PARENT',
        'INVALID_NODE_STRUCTURE',
        'MALFORMED_EXPRESSION',
        'INVALID_COMPONENT_ID',
        'INVALID_ENTITY_ID',
        'INVALID_FILTER_EXPRESSION',
        'DATA_TYPE_MISMATCH',
      ];

      dataCodes.forEach((codeName) => {
        it(`should have ${codeName} in 2xxx range`, () => {
          expect(ErrorCodes[codeName]).toMatch(/^SCOPE_2\d{3}$/);
        });
      });
    });

    describe('Resolution Errors (3xxx)', () => {
      const resolutionCodes = [
        'RESOLUTION_FAILED_GENERIC',
        'SCOPE_NOT_FOUND',
        'FILTER_EVAL_FAILED',
        'ENTITY_RESOLUTION_FAILED',
        'COMPONENT_RESOLUTION_FAILED',
        'STEP_RESOLUTION_FAILED',
        'UNION_RESOLUTION_FAILED',
        'ARRAY_ITERATION_FAILED',
        'SLOT_ACCESS_FAILED',
        'CLOTHING_STEP_FAILED',
      ];

      resolutionCodes.forEach((codeName) => {
        it(`should have ${codeName} in 3xxx range`, () => {
          expect(ErrorCodes[codeName]).toMatch(/^SCOPE_3\d{3}$/);
        });
      });
    });

    describe('System Errors (4xxx)', () => {
      const systemCodes = [
        'CYCLE_DETECTED',
        'MAX_DEPTH_EXCEEDED',
        'MEMORY_LIMIT',
        'RESOURCE_EXHAUSTION',
        'EXECUTION_TIMEOUT',
        'STACK_OVERFLOW',
      ];

      systemCodes.forEach((codeName) => {
        it(`should have ${codeName} in 4xxx range`, () => {
          expect(ErrorCodes[codeName]).toMatch(/^SCOPE_4\d{3}$/);
        });
      });
    });

    describe('Parse Errors (5xxx)', () => {
      const parseCodes = [
        'PARSE_ERROR_GENERIC',
        'SYNTAX_ERROR',
        'UNEXPECTED_TOKEN',
        'UNCLOSED_DELIMITER',
        'INVALID_OPERATOR',
        'MISSING_EXPRESSION_PART',
        'INVALID_SCOPE_REFERENCE',
      ];

      parseCodes.forEach((codeName) => {
        it(`should have ${codeName} in 5xxx range`, () => {
          expect(ErrorCodes[codeName]).toMatch(/^SCOPE_5\d{3}$/);
        });
      });
    });

    describe('Configuration Errors (6xxx)', () => {
      const configCodes = [
        'CONFIGURATION_GENERIC',
        'INVALID_RESOLVER_CONFIG',
        'MISSING_CONFIG',
        'CONFIG_VALIDATION_FAILED',
        'INVALID_PARSER_CONFIG',
        'REGISTRY_CONFIG_ERROR',
        'ENGINE_CONFIG_INVALID',
      ];

      configCodes.forEach((codeName) => {
        it(`should have ${codeName} in 6xxx range`, () => {
          expect(ErrorCodes[codeName]).toMatch(/^SCOPE_6\d{3}$/);
        });
      });
    });

    describe('Unknown Errors (9xxx)', () => {
      const unknownCodes = [
        'UNKNOWN_GENERIC',
        'UNHANDLED_EXCEPTION',
        'INTERNAL_ERROR',
        'UNEXPECTED_STATE',
        'OPERATION_NOT_SUPPORTED',
        'UNKNOWN_ERROR',
      ];

      unknownCodes.forEach((codeName) => {
        it(`should have ${codeName} in 9xxx range`, () => {
          expect(ErrorCodes[codeName]).toMatch(/^SCOPE_9\d{3}$/);
        });
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve existing error codes from original implementation', () => {
      // These codes must match the existing implementation
      expect(ErrorCodes.CYCLE_DETECTED).toBe('SCOPE_4001');
      expect(ErrorCodes.MAX_DEPTH_EXCEEDED).toBe('SCOPE_4002');
      expect(ErrorCodes.UNKNOWN_ERROR).toBe('SCOPE_9999');
    });

    it('should provide generic codes matching original base codes', () => {
      expect(ErrorCodes.MISSING_CONTEXT_GENERIC).toBe('SCOPE_1000');
      expect(ErrorCodes.INVALID_DATA_GENERIC).toBe('SCOPE_2000');
      expect(ErrorCodes.RESOLUTION_FAILED_GENERIC).toBe('SCOPE_3000');
      expect(ErrorCodes.PARSE_ERROR_GENERIC).toBe('SCOPE_5000');
      expect(ErrorCodes.CONFIGURATION_GENERIC).toBe('SCOPE_6000');
      expect(ErrorCodes.UNKNOWN_GENERIC).toBe('SCOPE_9000');
    });
  });

  describe('Code Validation', () => {
    it('should not have gaps in base sequences', () => {
      // Check that we have the expected base codes for each category
      const baseCodes = ['1000', '2000', '3000', '5000', '6000', '9000'];
      baseCodes.forEach((baseCode) => {
        const fullCode = `SCOPE_${baseCode}`;
        expect(Object.values(ErrorCodes)).toContain(fullCode);
      });
    });

    it('should have proper subcodes within categories', () => {
      // Context codes should start at 1000 and increment
      expect(ErrorCodes.MISSING_CONTEXT_GENERIC).toBe('SCOPE_1000');
      expect(ErrorCodes.MISSING_ACTOR).toBe('SCOPE_1001');
      expect(ErrorCodes.INVALID_ACTOR_ID).toBe('SCOPE_1002');

      // Data codes should start at 2000 and increment
      expect(ErrorCodes.INVALID_DATA_GENERIC).toBe('SCOPE_2000');
      expect(ErrorCodes.INVALID_NODE_TYPE).toBe('SCOPE_2001');
      expect(ErrorCodes.MISSING_NODE_PARENT).toBe('SCOPE_2002');
    });

    it('should not have null or undefined codes', () => {
      Object.values(ErrorCodes).forEach((code) => {
        expect(code).not.toBeNull();
        expect(code).not.toBeUndefined();
        expect(code).not.toBe('');
        expect(typeof code).toBe('string');
      });
    });
  });

  describe('Error Code Lookups', () => {
    it('should allow reverse lookup by code value', () => {
      const reverseMap = {};
      Object.entries(ErrorCodes).forEach(([key, value]) => {
        reverseMap[value] = key;
      });

      expect(reverseMap['SCOPE_1000']).toBe('MISSING_CONTEXT_GENERIC');
      expect(reverseMap['SCOPE_4001']).toBe('CYCLE_DETECTED');
      expect(reverseMap['SCOPE_9999']).toBe('UNKNOWN_ERROR');
    });

    it('should support iteration over all codes', () => {
      let count = 0;
      for (const codeName in ErrorCodes) {
        count++;
        expect(typeof ErrorCodes[codeName]).toBe('string');
        expect(ErrorCodes[codeName]).toMatch(/^SCOPE_\d{4}$/);
      }
      expect(count).toBeGreaterThan(30);
    });
  });
});
