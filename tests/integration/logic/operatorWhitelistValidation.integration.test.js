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

  it('should not warn about unregistered operators when whitelist matches registrations', () => {
    // Act - register operators
    customOperators.registerOperators(evaluationService);

    // Assert - check that no warning about unregistered operators was emitted
    const warnings = mockLogger.warn.mock.calls.filter(
      (call) =>
        call[0] && call[0].includes('Operators in ALLOWED_OPERATIONS whitelist but not registered')
    );

    expect(warnings.length).toBe(0);
  });

  it('should not have any unregistered operators after registration', () => {
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

    // These are helper syntax operators registered at service startup but not part of the custom operator set
    const specialSyntax = new Set(['condition_ref', 'matchAtEnd', 'matchWholeWord']);

    const unregisteredOps = [];
    for (const op of allowedOps) {
      if (!standardOperators.has(op) && !specialSyntax.has(op) && !registeredOps.has(op)) {
        unregisteredOps.push(op);
      }
    }

    // After cleanup, there should be no unregistered operators remaining
    expect(unregisteredOps).toHaveLength(0);
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
