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

  it('should only warn about operators registered elsewhere', () => {
    // Act - register operators
    customOperators.registerOperators(evaluationService);

    // Assert - check for warning about unregistered operators
    const warnings = mockLogger.warn.mock.calls.filter(
      (call) =>
        call[0] && call[0].includes('Operators in ALLOWED_OPERATIONS whitelist but not registered')
    );

    // After cleanup of throw_error_operator, should only warn about hasBodyPartWithComponentValue
    // hasBodyPartWithComponentValue is registered by systemLogicInterpreter
    expect(warnings.length).toBe(1);
    const warningData = warnings[0][1];
    expect(warningData.operators).toContain('hasBodyPartWithComponentValue');
    expect(warningData.operators).not.toContain('throw_error_operator');
    expect(warningData.operators).toHaveLength(1);
  });

  it('should only have hasBodyPartWithComponentValue unregistered (registered by systemLogicInterpreter)', () => {
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

    // After cleanup, only hasBodyPartWithComponentValue should be unregistered
    // (it's registered by systemLogicInterpreter, not JsonLogicCustomOperators)
    expect(unregisteredOps).toContain('hasBodyPartWithComponentValue');
    expect(unregisteredOps).not.toContain('throw_error_operator');
    expect(unregisteredOps).toHaveLength(1);
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
