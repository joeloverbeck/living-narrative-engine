/**
 * @file Integration test for operator whitelist validation
 * @description Verifies that ALLOWED_OPERATIONS whitelist is synchronized with registered operators
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import { createTestBed } from '../../common/testBed.js';

describe('Operator Whitelist Validation - Integration', () => {
  let testBed;
  let evaluationService;
  let customOperators;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Create mock body graph service
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    // Create mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    // Create evaluation service
    evaluationService = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: null,
    });

    // Create custom operators service
    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
    });
  });

  it('should only warn about operators registered elsewhere or test-only operators', () => {
    // Act - register operators
    customOperators.registerOperators(evaluationService);

    // Assert - check for warning about unregistered operators
    const warnings = mockLogger.warn.mock.calls.filter(
      (call) =>
        call[0] && call[0].includes('Operators in ALLOWED_OPERATIONS whitelist but not registered')
    );

    // After fixing the validator, there should be exactly one warning
    // for operators registered elsewhere or test-only operators
    expect(warnings.length).toBe(1);

    const warningData = warnings[0][1];
    expect(warningData).toHaveProperty('operators');
    // hasBodyPartWithComponentValue is registered by systemLogicInterpreter
    // throw_error_operator is test-only and registered dynamically in tests
    expect(warningData.operators).toContain('hasBodyPartWithComponentValue');
    expect(warningData.operators).toContain('throw_error_operator');
    // condition_ref is now excluded from warnings (it's special syntax, not an operator)
    expect(warningData.operators).not.toContain('condition_ref');
    // Should only have these 2 operators
    expect(warningData.operators).toHaveLength(2);
  });

  it('should identify operators not registered by JsonLogicCustomOperators', () => {
    // Get the allowed operations before registration
    const allowedOps = evaluationService.getAllowedOperations();

    // Register operators
    customOperators.registerOperators(evaluationService);

    // Get registered operators
    const registeredOps = customOperators.getRegisteredOperators();

    // Find operators in whitelist but not registered (excluding standard json-logic-js operators and special syntax)
    const standardOperators = new Set([
      'var', 'missing', 'missing_some', 'if', '==', '===', '!=', '!==', '!', '!!',
      'or', 'and', '>', '>=', '<', '<=', 'max', 'min', '+', '-', '*', '/', '%',
      'map', 'filter', 'reduce', 'all', 'none', 'some', 'merge', 'in', 'cat',
      'substr', 'log', 'not', 'has', 'toLowerCase', 'toUpperCase',
    ]);

    const specialSyntax = new Set(['condition_ref']);

    const unregisteredOps = [];
    for (const op of allowedOps) {
      if (!standardOperators.has(op) && !specialSyntax.has(op) && !registeredOps.has(op)) {
        unregisteredOps.push(op);
      }
    }

    // After cleanup, only these should remain:
    // - hasBodyPartWithComponentValue (registered by systemLogicInterpreter)
    // - throw_error_operator (test-only, registered dynamically in tests)
    expect(unregisteredOps).toContain('hasBodyPartWithComponentValue');
    expect(unregisteredOps).toContain('throw_error_operator');
    // condition_ref is excluded as special syntax
    expect(unregisteredOps).not.toContain('condition_ref');
    // Should only have these 2 operators
    expect(unregisteredOps).toHaveLength(2);
  });

  it('should verify that registered operators are all in whitelist', () => {
    // Register operators
    customOperators.registerOperators(evaluationService);

    // Get registered operators and allowed operations
    const registeredOps = customOperators.getRegisteredOperators();
    const allowedOps = evaluationService.getAllowedOperations();

    // All registered operators should be in the whitelist
    for (const op of registeredOps) {
      expect(allowedOps.has(op)).toBe(true);
    }
  });

  it('should list all currently registered custom operators', () => {
    // Register operators
    customOperators.registerOperators(evaluationService);

    // Get registered operators
    const registeredOps = customOperators.getRegisteredOperators();

    // Verify expected operators are registered
    const expectedOperators = [
      'hasPartWithComponentValue',
      'hasPartOfType',
      'hasPartOfTypeWithComponentValue',
      'hasClothingInSlot',
      'hasClothingInSlotLayer',
      'isSocketCovered',
      'hasSittingSpaceToRight',
      'canScootCloser',
      'isClosestLeftOccupant',
      'isClosestRightOccupant',
      'hasOtherActorsAtLocation',
      'isRemovalBlocked',
    ];

    for (const expectedOp of expectedOperators) {
      expect(registeredOps.has(expectedOp)).toBe(true);
    }
  });
});
