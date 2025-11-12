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

  describe('Operator hasBodyPartWithComponentValue (legacy - now removed)', () => {
    it('should NOT be in ALLOWED_OPERATIONS whitelist after cleanup', () => {
      const allowedOps = evaluationService.getAllowedOperations();

      // hasBodyPartWithComponentValue was a legacy operator that has been removed
      expect(allowedOps.has('hasBodyPartWithComponentValue')).toBe(false);
    });

    it('should NOT produce warning about hasBodyPartWithComponentValue after registration', () => {
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

      // Should have NO warnings now that the legacy operator has been removed
      expect(warnings.length).toBe(0);
    });
  });

  describe('Test-only operator throw_error_operator', () => {
    it('should not be in ALLOWED_OPERATIONS whitelist', () => {
      const allowedOps = evaluationService.getAllowedOperations();

      // throw_error_operator is only used in tests and should not be in production whitelist
      expect(allowedOps.has('throw_error_operator')).toBe(false);
    });

    it('should not produce any warnings after cleanup', () => {
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

      // Should have no warnings after cleanup
      expect(warnings.length).toBe(0);
    });
  });

  describe('Whitelist should have no warnings after cleanup', () => {
    it('should not warn about any operators after cleanup', () => {
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

      // After cleanup, there should be no warnings about unregistered operators
      expect(warnings.length).toBe(0);
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
