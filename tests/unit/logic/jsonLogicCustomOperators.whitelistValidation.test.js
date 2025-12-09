/**
 * @file Tests for JsonLogicCustomOperators whitelist validation
 * @description Verifies that ALLOWED_OPERATIONS whitelist matches registered operators
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('JsonLogicCustomOperators - Whitelist Validation', () => {
  let customOperators;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
  let jsonLogicService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
      hasWoundedPart: jest.fn(),
      hasPartWithStatusEffect: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
    });

    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
    });
  });

  describe('operator whitelist synchronization', () => {
    test('should have no operators in whitelist but not registered after cleanup', () => {
      // Register operators
      customOperators.registerOperators(jsonLogicService);

      // Get the allowed operations from the service
      const allowedOps = jsonLogicService.getAllowedOperations();

      // Get the registered operators from custom operators
      const registeredOps = customOperators.getRegisteredOperators();

      // Find operators in whitelist but not registered (excluding standard operators and special syntax)
      const standardOperators = new Set([
        'var',
        'missing',
        'missing_some',
        'if',
        '==',
        '===',
        '!=',
        '!==',
        '!',
        '!!',
        'or',
        'and',
        '>',
        '>=',
        '<',
        '<=',
        'max',
        'min',
        '+',
        '-',
        '*',
        '/',
        '%',
        'map',
        'filter',
        'reduce',
        'all',
        'none',
        'some',
        'merge',
        'in',
        'cat',
        'substr',
        'log',
        'not',
        'has',
        'toLowerCase',
        'toUpperCase',
      ]);

      const specialSyntax = new Set([
        'condition_ref',
        // Added by JsonLogicEvaluationService for text matching helpers
        'matchAtEnd',
        'matchWholeWord',
      ]);

      const unregisteredButWhitelisted = [];
      for (const op of allowedOps) {
        if (
          !standardOperators.has(op) &&
          !specialSyntax.has(op) &&
          !registeredOps.has(op)
        ) {
          unregisteredButWhitelisted.push(op);
        }
      }

      // After cleanup, there should be NO operators in the whitelist that aren't registered
      expect(unregisteredButWhitelisted.length).toBe(0);

      // Verify NO warning was logged about unregistered operators
      const warnCalls = mockLogger.warn.mock.calls;
      const unregisteredWarning = warnCalls.find(
        (call) =>
          call[0] &&
          call[0].includes(
            'Operators in ALLOWED_OPERATIONS whitelist but not registered'
          )
      );
      expect(unregisteredWarning).toBeUndefined();
    });

    test('should verify hasBodyPartWithComponentValue has been removed from whitelist', () => {
      // Register operators
      customOperators.registerOperators(jsonLogicService);

      // Get the allowed operations from the service
      const allowedOps = jsonLogicService.getAllowedOperations();

      // Verify hasBodyPartWithComponentValue is NOT in the whitelist (it was removed as a legacy operator)
      expect(allowedOps.has('hasBodyPartWithComponentValue')).toBe(false);

      // Get the registered operators from custom operators
      const registeredOps = customOperators.getRegisteredOperators();

      // Verify it's NOT registered
      expect(registeredOps.has('hasBodyPartWithComponentValue')).toBe(false);

      // Verify NO warning was logged about hasBodyPartWithComponentValue since it's been removed
      const warnCalls = mockLogger.warn.mock.calls;
      const hasBodyPartWarning = warnCalls.some(
        (call) => call[0] && call[0].includes('hasBodyPartWithComponentValue')
      );
      expect(hasBodyPartWarning).toBe(false);
    });

    test('should register core expected operators', () => {
      // Register operators
      customOperators.registerOperators(jsonLogicService);

      const registeredOps = customOperators.getRegisteredOperators();

      // Verify a representative set of core operators are registered
      // (not an exhaustive list - new operators will be added over time)
      const coreOperators = [
        'hasPartWithComponentValue',
        'hasPartOfType',
        'hasPartOfTypeWithComponentValue',
        'hasWoundedPart',
        'hasPartWithStatusEffect',
        'isSlotExposed',
        'isSocketCovered',
        'socketExposure',
        'isBodyPartAccessible',
        'hasOtherActorsAtLocation',
        'isRemovalBlocked',
        'has_component',
      ];

      for (const op of coreOperators) {
        expect(registeredOps.has(op)).toBe(true);
      }

      // Verify we have at least the core operators (but allow more)
      expect(registeredOps.size).toBeGreaterThanOrEqual(coreOperators.length);
    });

    test('should NOT include hasBodyPartWithComponentValue in registered operators', () => {
      // Register operators
      customOperators.registerOperators(jsonLogicService);

      const registeredOps = customOperators.getRegisteredOperators();

      // This should be false because it's a legacy operator
      expect(registeredOps.has('hasBodyPartWithComponentValue')).toBe(false);
    });
  });

  describe('whitelist cleanup validation', () => {
    test('should validate that all registered operators are in the whitelist', () => {
      // Register operators
      customOperators.registerOperators(jsonLogicService);

      const allowedOps = jsonLogicService.getAllowedOperations();
      const registeredOps = customOperators.getRegisteredOperators();

      // Every registered operator should be in the whitelist
      for (const op of registeredOps) {
        expect(allowedOps.has(op)).toBe(true);
      }

      // Should not have thrown an error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
