/**
 * @file Unit tests for jsonLogicVariableEvaluator utility functions
 * @jest-environment node
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import jsonLogic from 'json-logic-js';
import { evaluateValue } from '../../../../src/logic/utils/jsonLogicVariableEvaluator.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */

/**
 * Create a mock logger for testing
 *
 * @returns {ILogger}
 */
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('jsonLogicVariableEvaluator', () => {
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();
  });

  describe('evaluateValue', () => {
    describe('literal values (non-objects)', () => {
      test.each([
        ['string', 'hello', 'hello'],
        ['number', 42, 42],
        ['boolean true', true, true],
        ['boolean false', false, false],
        ['null', null, null],
        ['array', [1, 2, 3], [1, 2, 3]],
      ])('should handle %s values directly', (type, input, expected) => {
        const result = evaluateValue(input, {}, mockLogger);

        expect(result).toEqual({ success: true, value: expected });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('is not a non-empty object. Using directly.')
        );
      });
    });

    describe('empty objects', () => {
      test('should handle empty objects directly', () => {
        const emptyObj = {};
        const result = evaluateValue(emptyObj, {}, mockLogger);

        expect(result).toEqual({ success: true, value: emptyObj });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('is an empty object {}. Using it directly.')
        );
      });
    });

    describe('JsonLogic evaluation', () => {
      test('should evaluate valid JsonLogic rules successfully', () => {
        const rule = { var: 'actor.name' };
        const evaluationContext = { actor: { name: 'TestActor' } };

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'testVar'
        );

        expect(result).toEqual({ success: true, value: 'TestActor' });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Attempting JsonLogic evaluation')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation successful for "testVar". Result: "TestActor"'
          )
        );
      });

      test('should handle JsonLogic evaluation with circular reference result (line 37)', () => {
        // Create a circular reference object
        const circularObj = { name: 'circular' };
        circularObj.self = circularObj;

        const rule = { var: 'data' };
        const evaluationContext = { data: circularObj };

        // Mock jsonLogic.apply to return the circular reference
        const mockApply = jest
          .spyOn(jsonLogic, 'apply')
          .mockReturnValue(circularObj);

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'circularVar'
        );

        expect(result).toEqual({ success: true, value: circularObj });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation successful for "circularVar". Result: [object Object]'
          )
        );

        mockApply.mockRestore();
      });

      test('should handle JsonLogic evaluation errors', () => {
        const rule = { invalidOperator: ['test'] };
        const evaluationContext = {};
        const mockApply = jest
          .spyOn(jsonLogic, 'apply')
          .mockImplementation(() => {
            throw new Error('Unexpected failure');
          });

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'errorVar',
          { value: rule }
        );

        expect(result).toEqual({ success: false });
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Error evaluating JsonLogic value for variable "errorVar"'
          ),
          expect.objectContaining({
            errorMessage: 'Unexpected failure',
          })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation for variable "errorVar" failed with an error'
          )
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Original value: {"invalidOperator":["test"]}'
          )
        );

        mockApply.mockRestore();
      });

      test('should treat unrecognized JsonLogic operators as literal values', () => {
        const rule = { invalidOperator: ['test'] };
        const evaluationContext = {};

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'literalVar'
        );

        expect(result).toEqual({ success: true, value: rule });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'SET_VARIABLE: Value for "literalVar" contains unrecognized JsonLogic operator "invalidOperator". Treating value as a literal.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      test('should handle JsonLogic evaluation resulting in undefined', () => {
        const rule = { var: 'nonExistent.property' };
        const evaluationContext = {};

        // Mock to return undefined explicitly
        const mockApply = jest
          .spyOn(jsonLogic, 'apply')
          .mockReturnValue(undefined);

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'undefinedVar',
          rule
        );

        expect(result).toEqual({ success: false });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation resulted in \'undefined\' for variable "undefinedVar"'
          )
        );

        mockApply.mockRestore();
      });

      test('should handle missing evaluationContext for JsonLogic rules (lines 115-120)', () => {
        const rule = { var: 'actor.name' };
        const evaluationContext = null; // Missing context
        const hasExecutionContext = true;

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'missingCtxVar',
          rule,
          hasExecutionContext
        );

        expect(result).toEqual({ success: false });
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Cannot evaluate JsonLogic value for variable "missingCtxVar" because executionContext.evaluationContext is missing or invalid'
          ),
          { hasExecutionContext: true }
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation attempt for variable "missingCtxVar" failed or could not proceed'
          )
        );
      });

      test('should handle undefined evaluationContext for JsonLogic rules', () => {
        const rule = { var: 'actor.name' };
        const evaluationContext = undefined;

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'undefinedCtxVar',
          rule
        );

        expect(result).toEqual({ success: false });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'SET_VARIABLE: Cannot evaluate JsonLogic value for variable "undefinedCtxVar" because executionContext.evaluationContext is missing or invalid. Storing \'undefined\'. Original value: {"var":"actor.name"}',
          { hasExecutionContext: undefined }
        );
      });
    });

    describe('variable name handling', () => {
      test('should handle evaluation without variable name', () => {
        const rule = { var: 'test' };
        const evaluationContext = { test: 'value' };

        const result = evaluateValue(rule, evaluationContext, mockLogger);

        expect(result).toEqual({ success: true, value: 'value' });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Value is a non-empty object. Attempting JsonLogic evaluation'
          )
        );
      });

      test('should treat unrecognized operators without variable name as literal values', () => {
        const rule = { invalidOp: 'test' };
        const evaluationContext = {};

        const result = evaluateValue(rule, evaluationContext, mockLogger);

        expect(result).toEqual({ success: true, value: rule });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'SET_VARIABLE: Value contains unrecognized JsonLogic operator "invalidOp". Treating value as a literal.'
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      test('should handle complex nested JsonLogic rules', () => {
        const rule = {
          if: [
            { '==': [{ var: 'status' }, 'active'] },
            { var: 'activeValue' },
            { var: 'inactiveValue' },
          ],
        };
        const evaluationContext = {
          status: 'active',
          activeValue: 'success',
          inactiveValue: 'failure',
        };

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'conditionalVar'
        );

        expect(result).toEqual({ success: true, value: 'success' });
      });

      test('should handle JsonLogic rules that return falsy values', () => {
        const rule = { var: 'falsyValue' };
        const evaluationContext = { falsyValue: false };

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'falsyVar'
        );

        expect(result).toEqual({ success: true, value: false });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation successful for "falsyVar". Result: false'
          )
        );
      });

      test('should handle JsonLogic rules that return 0', () => {
        const rule = { var: 'zeroValue' };
        const evaluationContext = { zeroValue: 0 };

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'zeroVar'
        );

        expect(result).toEqual({ success: true, value: 0 });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation successful for "zeroVar". Result: 0'
          )
        );
      });

      test('should handle JsonLogic rules that return null', () => {
        const rule = { var: 'nullValue' };
        const evaluationContext = { nullValue: null };

        const result = evaluateValue(
          rule,
          evaluationContext,
          mockLogger,
          'nullVar'
        );

        expect(result).toEqual({ success: true, value: null });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'JsonLogic evaluation successful for "nullVar". Result: null'
          )
        );
      });
    });
  });

  describe('internal function coverage via evaluateValue', () => {
    test('should trigger contextMissing error handling (line 74)', () => {
      // This test specifically targets the contextMissing branch in handleEvaluationError
      const rule = { var: 'test' };
      const evaluationContext = null;

      const result = evaluateValue(
        rule,
        evaluationContext,
        mockLogger,
        'contextMissingVar',
        { value: rule },
        false
      );

      expect(result).toEqual({ success: false });
      // The second error call should trigger the contextMissing branch (line 74)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'SET_VARIABLE: JsonLogic evaluation attempt for variable "contextMissingVar" failed or could not proceed (see previous log). Assignment skipped. Original value: {"var":"test"}'
      );
    });

    test('should handle BigInt values that cannot be JSON.stringified (line 37)', () => {
      // Create a BigInt that will cause JSON.stringify to throw
      const bigIntValue = BigInt(9007199254740991);

      const rule = { var: 'bigIntData' };
      const evaluationContext = { bigIntData: bigIntValue };

      // Mock jsonLogic.apply to return BigInt
      const mockApply = jest
        .spyOn(jsonLogic, 'apply')
        .mockReturnValue(bigIntValue);

      const result = evaluateValue(
        rule,
        evaluationContext,
        mockLogger,
        'bigIntVar'
      );

      expect(result).toEqual({ success: true, value: bigIntValue });
      // Should trigger the String(result) fallback on line 37
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'JsonLogic evaluation successful for "bigIntVar". Result: 9007199254740991'
        )
      );

      mockApply.mockRestore();
    });

    test('should handle objects with toJSON that throws error (line 37)', () => {
      // Create an object with a toJSON method that throws
      const problematicObj = {
        name: 'test',
        toJSON() {
          throw new Error('toJSON failed');
        },
      };

      const rule = { var: 'problematicData' };
      const evaluationContext = { problematicData: problematicObj };

      // Mock jsonLogic.apply to return the problematic object
      const mockApply = jest
        .spyOn(jsonLogic, 'apply')
        .mockReturnValue(problematicObj);

      const result = evaluateValue(
        rule,
        evaluationContext,
        mockLogger,
        'problematicVar'
      );

      expect(result).toEqual({ success: true, value: problematicObj });
      // Should trigger the String(result) fallback on line 37
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'JsonLogic evaluation successful for "problematicVar". Result: [object Object]'
        )
      );

      mockApply.mockRestore();
    });

    test('should handle warning case when no specific error flags are set', () => {
      // Test the default warning branch in handleEvaluationError (lines 77-81)
      const rule = { var: 'nonExistent' };
      const evaluationContext = { someOtherData: 'value' };

      // Mock to return undefined to trigger the warning case
      const mockApply = jest
        .spyOn(jsonLogic, 'apply')
        .mockReturnValue(undefined);

      const result = evaluateValue(
        rule,
        evaluationContext,
        mockLogger,
        'warningVar',
        { value: rule }
      );

      expect(result).toEqual({ success: false });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SET_VARIABLE: JsonLogic evaluation resulted in \'undefined\' for variable "warningVar". Assignment skipped. Original value: {"var":"nonExistent"}'
      );

      mockApply.mockRestore();
    });

    test('should handle error case without varName parameter', () => {
      // Test handleEvaluationError with evaluationThrewError=true and no varName
      const rule = { invalidOperator: 'test' };
      const evaluationContext = {};
      const mockApply = jest
        .spyOn(jsonLogic, 'apply')
        .mockImplementation(() => {
          throw new Error('Generic failure');
        });

      const result = evaluateValue(
        rule,
        evaluationContext,
        mockLogger,
        undefined,
        { value: rule }
      );

      expect(result).toEqual({ success: false });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'JsonLogic evaluation failed with an error (see previous log)'
        )
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error evaluating JsonLogic value'),
        { errorMessage: 'Generic failure' }
      );

      mockApply.mockRestore();
    });

    test('should handle contextMissing case without varName parameter', () => {
      // Test handleEvaluationError with contextMissing=true and no varName
      const rule = { var: 'test' };
      const evaluationContext = null;

      const result = evaluateValue(
        rule,
        evaluationContext,
        mockLogger,
        undefined,
        { value: rule }
      );

      expect(result).toEqual({ success: false });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'SET_VARIABLE: JsonLogic evaluation attempt failed or could not proceed (see previous log). Assignment skipped. Original value: {"var":"test"}'
      );
    });

    test('should handle warning case without varName parameter', () => {
      // Test handleEvaluationError warning case without varName
      const rule = { var: 'nonExistent' };
      const evaluationContext = { someData: 'value' };

      const mockApply = jest
        .spyOn(jsonLogic, 'apply')
        .mockReturnValue(undefined);

      const result = evaluateValue(
        rule,
        evaluationContext,
        mockLogger,
        undefined,
        { value: rule }
      );

      expect(result).toEqual({ success: false });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SET_VARIABLE: JsonLogic evaluation resulted in \'undefined\'. Assignment skipped. Original value: {"var":"nonExistent"}'
      );

      mockApply.mockRestore();
    });

    test('should handle non-objects that are still truthy', () => {
      // Test the branch for non-objects (arrays, functions, etc.)
      const arrayValue = [1, 2, 3];

      const result = evaluateValue(arrayValue, {}, mockLogger, 'arrayVar');

      expect(result).toEqual({ success: true, value: arrayValue });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SET_VARIABLE: Value for "arrayVar" is not a non-empty object. Using directly.'
      );
    });

    test('should cover all branches in shouldEvaluateAsLogic via different value types', () => {
      // Test null specifically
      const result1 = evaluateValue(null, {}, mockLogger, 'nullVar');
      expect(result1).toEqual({ success: true, value: null });

      // Test array specifically
      const result2 = evaluateValue([1, 2], {}, mockLogger, 'arrayVar');
      expect(result2).toEqual({ success: true, value: [1, 2] });

      // Test primitive string
      const result3 = evaluateValue('string', {}, mockLogger, 'stringVar');
      expect(result3).toEqual({ success: true, value: 'string' });

      // Test primitive number
      const result4 = evaluateValue(42, {}, mockLogger, 'numberVar');
      expect(result4).toEqual({ success: true, value: 42 });
    });
  });
});
