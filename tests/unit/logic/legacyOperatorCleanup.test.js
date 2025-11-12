/**
 * @file Test for legacy operator cleanup
 * @description Verifies that legacy operators are removed from ALLOWED_OPERATIONS whitelist
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';

describe('Legacy Operator Cleanup', () => {
  let evaluationService;
  let customOperators;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    evaluationService = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: null,
    });

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
    });
  });

  describe('Operator hasBodyPartWithComponentValue', () => {
    it('should be in ALLOWED_OPERATIONS whitelist', () => {
      const allowedOps = evaluationService.getAllowedOperations();

      // hasBodyPartWithComponentValue is registered by systemLogicInterpreter
      expect(allowedOps.has('hasBodyPartWithComponentValue')).toBe(true);
    });

    it('should produce warning about hasBodyPartWithComponentValue after registration', () => {
      // Register operators
      customOperators.registerOperators(evaluationService);

      // Check warnings
      const warnings = mockLogger.warn.mock.calls.filter(
        (call) =>
          call[0] &&
          call[0].includes(
            'Operators in ALLOWED_OPERATIONS whitelist but not registered'
          )
      );

      // Should have warning about hasBodyPartWithComponentValue (registered by systemLogicInterpreter, not JsonLogicCustomOperators)
      expect(warnings.length).toBe(1);
      const warningData = warnings[0][1];
      expect(warningData.operators).toContain('hasBodyPartWithComponentValue');
    });
  });

  describe('Test-only operator throw_error_operator', () => {
    it('should not be in ALLOWED_OPERATIONS whitelist', () => {
      const allowedOps = evaluationService.getAllowedOperations();

      // throw_error_operator is only used in tests and should not be in production whitelist
      expect(allowedOps.has('throw_error_operator')).toBe(false);
    });

    it('should not produce warning about throw_error_operator after registration', () => {
      // Register operators
      customOperators.registerOperators(evaluationService);

      // Check warnings
      const warnings = mockLogger.warn.mock.calls.filter(
        (call) =>
          call[0] &&
          call[0].includes(
            'Operators in ALLOWED_OPERATIONS whitelist but not registered'
          )
      );

      // Should have exactly one warning
      expect(warnings.length).toBe(1);

      // Verify throw_error_operator is not in the warning
      const warningData = warnings[0][1];
      expect(warningData.operators).not.toContain('throw_error_operator');
    });
  });

  describe('Whitelist should have minimal warnings', () => {
    it('should only warn about operators registered elsewhere', () => {
      // Register operators
      customOperators.registerOperators(evaluationService);

      // Check warnings
      const warnings = mockLogger.warn.mock.calls.filter(
        (call) =>
          call[0] &&
          call[0].includes(
            'Operators in ALLOWED_OPERATIONS whitelist but not registered'
          )
      );

      // After cleanup, should only warn about hasBodyPartWithComponentValue (registered by systemLogicInterpreter)
      expect(warnings.length).toBe(1);
      const warningData = warnings[0][1];
      expect(warningData.operators).toContain('hasBodyPartWithComponentValue');
      expect(warningData.operators).not.toContain('throw_error_operator');
      expect(warningData.operators).toHaveLength(1);
    });

    it('should have the correct operator hasPartWithComponentValue (not hasBodyPartWithComponentValue)', () => {
      const allowedOps = evaluationService.getAllowedOperations();

      // The correct operator name should be in whitelist
      expect(allowedOps.has('hasPartWithComponentValue')).toBe(true);

      customOperators.registerOperators(evaluationService);
      const registeredOpsAfter = customOperators.getRegisteredOperators();
      expect(registeredOpsAfter.has('hasPartWithComponentValue')).toBe(true);
    });
  });

  describe('All registered operators should be in whitelist', () => {
    it('should not throw errors when validating registered operators', () => {
      // This should complete without throwing
      expect(() => {
        customOperators.registerOperators(evaluationService);
      }).not.toThrow();

      // Verify no errors were logged
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'Operator whitelist validation failed',
        expect.anything()
      );
    });

    it('should have all custom operators properly registered', () => {
      customOperators.registerOperators(evaluationService);

      const registeredOps = customOperators.getRegisteredOperators();
      const allowedOps = evaluationService.getAllowedOperations();

      // Every registered operator should be in the allowed list
      for (const op of registeredOps) {
        expect(allowedOps.has(op)).toBe(true);
      }
    });
  });
});
