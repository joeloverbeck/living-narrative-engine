/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';

describe('actor-can-move condition', () => {
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

  describe('evaluating actor-can-move condition', () => {
    const actorCanMoveCondition = {
      logic: {
        hasPartWithComponentValue: ['actor', 'core:movement', 'locked', false],
      },
    };

    test('should return true when actor has legs with unlocked movement', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg123',
      });

      const result = jsonLogicService.evaluate(
        actorCanMoveCondition.logic,
        context
      );

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'player123',
        'anatomy:body'
      );
      expect(
        mockBodyGraphService.hasPartWithComponentValue
      ).toHaveBeenCalledWith(
        { root: 'body123' },
        'core:movement',
        'locked',
        false
      );
    });

    test('should return false when movement is locked', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      // Simulating that the body part has movement locked
      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: false,
      });

      const result = jsonLogicService.evaluate(
        actorCanMoveCondition.logic,
        context
      );

      expect(result).toBe(false);
      expect(
        mockBodyGraphService.hasPartWithComponentValue
      ).toHaveBeenCalledWith(
        { root: 'body123' },
        'core:movement',
        'locked',
        false
      );
    });

    test('should return false when no legs have movement component', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {
            'anatomy:body': { root: 'body123' },
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      // Simulating that no body parts have the movement component
      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: false,
      });

      const result = jsonLogicService.evaluate(
        actorCanMoveCondition.logic,
        context
      );

      expect(result).toBe(false);
    });

    test('should return false when actor has no anatomy:body component', () => {
      const context = {
        actor: {
          id: 'player123',
          components: {},
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = jsonLogicService.evaluate(
        actorCanMoveCondition.logic,
        context
      );

      expect(result).toBe(false);
      expect(
        mockBodyGraphService.hasPartWithComponentValue
      ).not.toHaveBeenCalled();
    });

    test('should return false when actor is missing', () => {
      const context = {};

      const result = jsonLogicService.evaluate(
        actorCanMoveCondition.logic,
        context
      );

      expect(result).toBe(false);
    });

    test('should handle multiple legs where only one has unlocked movement', () => {
      const context = {
        actor: {
          id: 'player123',
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123',
      });

      // At least one leg has unlocked movement
      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg_left',
      });

      const result = jsonLogicService.evaluate(
        actorCanMoveCondition.logic,
        context
      );

      expect(result).toBe(true);
    });

    test('should work with nested entity paths', () => {
      const conditionWithNestedPath = {
        logic: {
          hasPartWithComponentValue: [
            'event.target',
            'core:movement',
            'locked',
            false,
          ],
        },
      };

      const context = {
        event: {
          target: {
            id: 'npc456',
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body456',
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg456',
      });

      const result = jsonLogicService.evaluate(
        conditionWithNestedPath.logic,
        context
      );

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'npc456',
        'anatomy:body'
      );
    });
  });
});
