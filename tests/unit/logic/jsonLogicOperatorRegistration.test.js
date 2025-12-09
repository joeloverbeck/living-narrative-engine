import { describe, it, expect, beforeEach } from '@jest/globals';
import { JsonLogicCustomOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import {
  validateOperatorWhitelist,
  generateAllowedOperations,
} from '../../../src/logic/operatorRegistrationValidator.js';

describe('JSON Logic Operator Registration', () => {
  let logger;
  let entityManager;
  let bodyGraphService;
  let gameDataRepository;
  let customOperators;
  let evaluationService;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    entityManager = {
      getEntities: jest.fn(() => []),
      getComponentData: jest.fn(() => null),
      hasComponent: jest.fn(() => false),
    };

    bodyGraphService = {
      hasPartWithComponentValue: jest.fn(() => false),
      findPartsByType: jest.fn(() => []),
      getAllParts: jest.fn(() => []),
      buildAdjacencyCache: jest.fn(),
      hasWoundedPart: jest.fn(),
      hasPartWithStatusEffect: jest.fn(),
    };

    gameDataRepository = {
      getConditionDefinition: jest.fn(() => null),
    };
  });

  describe('Operator Registration', () => {
    it('should register all custom operators', () => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager,
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      customOperators.registerOperators(evaluationService);

      const registered = customOperators.getRegisteredOperators();

      expect(registered.size).toBeGreaterThan(0);
      expect(registered.has('hasPartOfType')).toBe(true);
      expect(registered.has('hasOtherActorsAtLocation')).toBe(true);
    });

    it('should track registered operators', () => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager,
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      customOperators.registerOperators(evaluationService);

      const registered = customOperators.getRegisteredOperators();
      const operatorNames = Array.from(registered).sort();

      expect(operatorNames).toContain('hasPartOfType');
      expect(operatorNames).toContain('hasPartWithComponentValue');
      expect(operatorNames.length).toBeGreaterThan(3);
    });

    it('should register multiple custom operators', () => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager,
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      customOperators.registerOperators(evaluationService);

      const registered = customOperators.getRegisteredOperators();

      // Verify we have a reasonable number of operators registered
      // (exact count intentionally not checked to avoid brittle tests as operators evolve)
      expect(registered.size).toBeGreaterThan(10);
    });

    it('should register expected operator names', () => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager,
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      customOperators.registerOperators(evaluationService);

      const registered = customOperators.getRegisteredOperators();
      const expectedOperators = [
        'hasPartWithComponentValue',
        'hasPartOfType',
        'hasPartOfTypeWithComponentValue',
        'isSlotExposed',
        'isSocketCovered',
        'socketExposure',
        'isBodyPartAccessible',
        'hasSittingSpaceToRight',
        'canScootCloser',
        'isClosestLeftOccupant',
        'isClosestRightOccupant',
        'hasOtherActorsAtLocation',
        'isRemovalBlocked',
        'has_component',
        'is_hungry',
        'predicted_energy',
        'can_consume',
        'hasFreeGrabbingAppendages',
        'canActorGrabItem',
        'isItemBeingGrabbed',
        'hasWoundedPart',
        'hasPartWithStatusEffect',
      ];

      for (const op of expectedOperators) {
        expect(registered.has(op)).toBe(true);
      }
    });
  });

  describe('Whitelist Synchronization', () => {
    beforeEach(() => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager,
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      customOperators.registerOperators(evaluationService);
    });

    it('should have all registered operators in evaluation service whitelist', () => {
      const registered = customOperators.getRegisteredOperators();
      const allowed = evaluationService.getAllowedOperations();

      // All registered operators should be allowed
      for (const operator of registered) {
        expect(allowed.has(operator)).toBe(true);
      }
    });

    it('should include standard json-logic-js operators in whitelist', () => {
      const allowed = evaluationService.getAllowedOperations();

      // Standard operators
      expect(allowed.has('var')).toBe(true);
      expect(allowed.has('if')).toBe(true);
      expect(allowed.has('==')).toBe(true);
      expect(allowed.has('and')).toBe(true);
      expect(allowed.has('or')).toBe(true);
    });

    it('should fail validation when operator is registered but not whitelisted', () => {
      // This test simulates the bug that was fixed
      const mockRegisteredOps = new Set([
        'hasOtherActorsAtLocation',
        'hasPartOfType',
      ]);
      const mockAllowedOps = new Set(['hasPartOfType']); // Missing hasOtherActorsAtLocation

      expect(() => {
        validateOperatorWhitelist(mockRegisteredOps, mockAllowedOps, logger);
      }).toThrow('hasOtherActorsAtLocation');
    });

    it('should warn when operator is whitelisted but not registered', () => {
      const mockRegisteredOps = new Set(['hasPartOfType']);
      const mockAllowedOps = new Set([
        'hasPartOfType',
        'customUnregisteredOp', // Extra operator in whitelist
      ]);

      // Should not throw, but should warn
      expect(() => {
        validateOperatorWhitelist(mockRegisteredOps, mockAllowedOps, logger);
      }).not.toThrow();

      // Should have logged a warning
      expect(logger.warn).toHaveBeenCalledWith(
        'Operators in ALLOWED_OPERATIONS whitelist but not registered',
        expect.objectContaining({
          operators: expect.arrayContaining(['customUnregisteredOp']),
        })
      );
    });

    it('should provide clear error message when validation fails', () => {
      const mockRegisteredOps = new Set(['newOperator']);
      const mockAllowedOps = new Set([]);

      expect(() => {
        validateOperatorWhitelist(mockRegisteredOps, mockAllowedOps, logger);
      }).toThrow();

      // Check that error was logged with details
      expect(logger.error).toHaveBeenCalledWith(
        'Operator whitelist validation failed',
        expect.objectContaining({
          missingOperators: ['newOperator'],
        })
      );
    });
  });

  describe('Operator Registration Validator Utilities', () => {
    let validatorLogger;

    beforeEach(() => {
      validatorLogger = {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
    });

    it('should ignore standard json-logic operators missing from registration', () => {
      const registered = new Set();
      const allowed = new Set(['var', 'if', 'and']);

      expect(() =>
        validateOperatorWhitelist(registered, allowed, validatorLogger)
      ).not.toThrow();

      expect(validatorLogger.warn).not.toHaveBeenCalled();
    });

    it('should ignore special syntax entries missing from registration', () => {
      const registered = new Set();
      const allowed = new Set(['condition_ref']);

      expect(() =>
        validateOperatorWhitelist(registered, allowed, validatorLogger)
      ).not.toThrow();

      expect(validatorLogger.warn).not.toHaveBeenCalled();
    });

    it('should generate allowed operations from registered, standard, and additional operators', () => {
      const registered = new Set(['customA', 'customB']);
      const additional = ['legacyOp'];

      const allowed = generateAllowedOperations(registered, additional);

      expect(allowed).not.toBe(registered);
      expect(allowed.has('customA')).toBe(true);
      expect(allowed.has('customB')).toBe(true);
      expect(allowed.has('legacyOp')).toBe(true);

      // Spot-check a few standard operators to ensure the defaults are present
      expect(allowed.has('var')).toBe(true);
      expect(allowed.has('if')).toBe(true);
      expect(allowed.has('==')).toBe(true);
      expect(allowed.has('and')).toBe(true);
      expect(allowed.has('or')).toBe(true);
    });
  });

  describe('Operator Validation', () => {
    beforeEach(() => {
      customOperators = new JsonLogicCustomOperators({
        logger,
        bodyGraphService,
        entityManager,
      });

      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      customOperators.registerOperators(evaluationService);
    });

    it('should allow registered custom operators in expressions', () => {
      const logic = {
        hasPartOfType: ['actor', 'hand'],
      };

      // Note: evaluate() calls #validateJsonLogic internally
      expect(() => evaluationService.evaluate(logic, {})).not.toThrow();
    });

    it('should reject unregistered operators', () => {
      const logic = {
        unknownOperator: ['actor', 'data'],
      };

      // evaluate() catches validation errors and returns false
      const result = evaluationService.evaluate(logic, {});
      expect(result).toBe(false);

      // Should have logged an error about the unknown operator
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('JSON Logic validation failed:'),
        expect.any(Error)
      );

      // Check the error message contains the operator name
      const errorCall = logger.error.mock.calls[0];
      const errorObject = errorCall[1];
      expect(errorObject.message).toContain('unknownOperator');
    });

    it('should validate nested expressions with custom operators', () => {
      const logic = {
        and: [
          { hasPartOfType: ['actor', 'hand'] },
        ],
      };

      expect(() => evaluationService.evaluate(logic, {})).not.toThrow();
    });

    it('should validate complex nested expressions', () => {
      const logic = {
        or: [
          {
            and: [
              { hasPartOfType: ['actor', 'hand'] },
            ],
          },
          { hasOtherActorsAtLocation: ['actor'] },
        ],
      };

      expect(() => evaluationService.evaluate(logic, {})).not.toThrow();
    });
  });

  describe('getAllowedOperations', () => {
    it('should return a copy of allowed operations', () => {
      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      const allowed1 = evaluationService.getAllowedOperations();
      const allowed2 = evaluationService.getAllowedOperations();

      // Should be different Set instances
      expect(allowed1).not.toBe(allowed2);

      // But should have same contents
      expect(allowed1.size).toBe(allowed2.size);
      for (const op of allowed1) {
        expect(allowed2.has(op)).toBe(true);
      }
    });

    it('should not allow modifications to affect internal whitelist', () => {
      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      const allowed = evaluationService.getAllowedOperations();
      const originalSize = allowed.size;

      // Try to modify the returned Set
      allowed.add('maliciousOperator');

      // Get a fresh copy
      const allowed2 = evaluationService.getAllowedOperations();

      // Original size should be unchanged
      expect(allowed2.size).toBe(originalSize);
      expect(allowed2.has('maliciousOperator')).toBe(false);
    });
  });

  describe('isOperatorAllowed', () => {
    beforeEach(() => {
      evaluationService = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });
    });

    it('should return true for allowed operators', () => {
      expect(evaluationService.isOperatorAllowed('var')).toBe(true);
      expect(evaluationService.isOperatorAllowed('if')).toBe(true);
      expect(evaluationService.isOperatorAllowed('and')).toBe(true);
    });

    it('should return false for disallowed operators', () => {
      expect(evaluationService.isOperatorAllowed('unknownOp')).toBe(false);
      expect(evaluationService.isOperatorAllowed('malicious')).toBe(false);
    });

    it('should return true for custom operators', () => {
      expect(evaluationService.isOperatorAllowed('hasPartOfType')).toBe(true);
      expect(
        evaluationService.isOperatorAllowed('hasOtherActorsAtLocation')
      ).toBe(true);
    });

    it('should return true for weapon hand grabbing operators', () => {
      expect(evaluationService.isOperatorAllowed('canActorGrabItem')).toBe(
        true
      );
      expect(evaluationService.isOperatorAllowed('isItemBeingGrabbed')).toBe(
        true
      );
    });
  });
});
