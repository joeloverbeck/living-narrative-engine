/**
 * @jest-environment node
 */

/**
 * @file Unit tests for actor-has-free-grabbing-appendage and actor-has-two-free-grabbing-appendages conditions
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import * as grabbingUtils from '../../../src/utils/grabbingUtils.js';

// Mock the grabbingUtils module
jest.mock('../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

describe('actor-has-free-grabbing-appendage conditions', () => {
  let jsonLogicService;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
  let mockLightingStateService;
  let customOperators;

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
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
    });

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
      lightingStateService: mockLightingStateService,
    });

    customOperators.registerOperators(jsonLogicService);
  });

  // Condition logic as defined in the JSON files
  const singleAppendageConditionLogic = {
    hasFreeGrabbingAppendages: ['actor', 1],
  };

  const twoAppendagesConditionLogic = {
    hasFreeGrabbingAppendages: ['actor', 2],
  };

  describe('anatomy:actor-has-free-grabbing-appendage (single appendage)', () => {
    test('should return true when actor has at least one free grabbing appendage', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = jsonLogicService.evaluate(
        singleAppendageConditionLogic,
        context
      );

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor123'
      );
    });

    test('should return true when actor has multiple free grabbing appendages', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(3);

      const result = jsonLogicService.evaluate(
        singleAppendageConditionLogic,
        context
      );

      expect(result).toBe(true);
    });

    test('should return false when actor has no free grabbing appendages', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = jsonLogicService.evaluate(
        singleAppendageConditionLogic,
        context
      );

      expect(result).toBe(false);
    });

    test('should return false when actor has no grabbing appendages at all', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      // countFreeGrabbingAppendages returns 0 for entities without grabbing capability
      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = jsonLogicService.evaluate(
        singleAppendageConditionLogic,
        context
      );

      expect(result).toBe(false);
    });
  });

  describe('anatomy:actor-has-two-free-grabbing-appendages', () => {
    test('should return true when actor has exactly two free grabbing appendages', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = jsonLogicService.evaluate(
        twoAppendagesConditionLogic,
        context
      );

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor123'
      );
    });

    test('should return true when actor has more than two free grabbing appendages', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(4);

      const result = jsonLogicService.evaluate(
        twoAppendagesConditionLogic,
        context
      );

      expect(result).toBe(true);
    });

    test('should return false when actor has only one free grabbing appendage', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(1);

      const result = jsonLogicService.evaluate(
        twoAppendagesConditionLogic,
        context
      );

      expect(result).toBe(false);
    });

    test('should return false when actor has no free grabbing appendages', () => {
      const context = {
        actor: { id: 'actor123' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(0);

      const result = jsonLogicService.evaluate(
        twoAppendagesConditionLogic,
        context
      );

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing actor in context gracefully', () => {
      const context = {};

      const result = jsonLogicService.evaluate(
        singleAppendageConditionLogic,
        context
      );

      // Operator returns false when actor cannot be resolved
      expect(result).toBe(false);
    });

    test('should handle actor with null id gracefully', () => {
      const context = {
        actor: { id: null },
      };

      const result = jsonLogicService.evaluate(
        singleAppendageConditionLogic,
        context
      );

      expect(result).toBe(false);
    });

    test('should work with typical action validation context', () => {
      const context = {
        actor: { id: 'player_1' },
        target: { id: 'npc_1' },
        location: { id: 'room_1' },
      };

      grabbingUtils.countFreeGrabbingAppendages.mockReturnValue(2);

      const result = jsonLogicService.evaluate(
        singleAppendageConditionLogic,
        context
      );

      expect(result).toBe(true);
      expect(grabbingUtils.countFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'player_1'
      );
    });
  });
});
