/**
 * @jest-environment node
 * @file Integration tests for remove_clothing action prerequisites
 * @description Tests that the action correctly requires two free grabbing appendages
 *
 * Tests the prerequisite `anatomy:actor-has-two-free-grabbing-appendages` which uses
 * the hasFreeGrabbingAppendages custom JSON Logic operator.
 * @see data/mods/clothing/actions/remove_clothing.action.json
 * @see data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
 * @see tickets/GRAPREFORACT-001-clothing-mod-prerequisites.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import removeClothingAction from '../../../../data/mods/clothing/actions/remove_clothing.action.json';
import actorHasTwoFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json';

// Mock grabbingUtils to control the free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

describe('clothing:remove_clothing prerequisites', () => {
  let prerequisiteService;
  let jsonLogicService;
  let customOperators;
  let contextBuilder;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
  let mockGameDataRepository;
  let mockComponentAccessService;
  let mockCountFreeGrabbingAppendages;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import mocked function
    const grabbingUtils = await import('../../../../src/utils/grabbingUtils.js');
    mockCountFreeGrabbingAppendages = grabbingUtils.countFreeGrabbingAppendages;

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
      getEntityInstance: jest.fn(),
    };

    mockComponentAccessService = {
      getComponentForEntity: jest.fn(),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Set up the condition definition that the prerequisite references
    mockGameDataRepository.getConditionDefinition.mockImplementation(
      (conditionId) => {
        if (conditionId === 'anatomy:actor-has-two-free-grabbing-appendages') {
          return actorHasTwoFreeGrabbingCondition;
        }
        return null;
      }
    );

    // Create services with custom operators
    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
    });

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
    });

    // Register custom operators (includes hasFreeGrabbingAppendages)
    customOperators.registerOperators(jsonLogicService);

    contextBuilder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      componentAccessService: mockComponentAccessService,
      logger: mockLogger,
    });

    prerequisiteService = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository: mockGameDataRepository,
    });
  });

  describe('action definition structure', () => {
    test('should have prerequisites array defined', () => {
      expect(removeClothingAction.prerequisites).toBeDefined();
      expect(Array.isArray(removeClothingAction.prerequisites)).toBe(true);
    });

    test('should reference anatomy:actor-has-two-free-grabbing-appendages condition', () => {
      expect(removeClothingAction.prerequisites.length).toBeGreaterThan(0);
      const prerequisite = removeClothingAction.prerequisites[0];
      expect(prerequisite.logic).toBeDefined();
      expect(prerequisite.logic.condition_ref).toBe(
        'anatomy:actor-has-two-free-grabbing-appendages'
      );
    });

    test('should have failure_message for user feedback', () => {
      const prerequisite = removeClothingAction.prerequisites[0];
      expect(prerequisite.failure_message).toBeDefined();
      expect(typeof prerequisite.failure_message).toBe('string');
      expect(prerequisite.failure_message.length).toBeGreaterThan(0);
      expect(prerequisite.failure_message).toContain('hands free');
    });

    test('should preserve other action properties', () => {
      expect(removeClothingAction.id).toBe('clothing:remove_clothing');
      expect(removeClothingAction.template).toBe('remove {target}');
      expect(removeClothingAction.targets.primary.scope).toBe(
        'clothing:topmost_clothing'
      );
      expect(removeClothingAction.required_components.actor).toContain(
        'clothing:equipment'
      );
    });
  });

  describe('prerequisite evaluation - two free grabbing appendages available', () => {
    test('should pass when actor has exactly two free grabbing appendages', () => {
      const actor = { id: 'human123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(2);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockCountFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'human123'
      );
    });

    test('should pass when actor has more than two free grabbing appendages', () => {
      const actor = { id: 'octopod456', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(8);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(true);
    });
  });

  describe('prerequisite evaluation - insufficient free grabbing appendages', () => {
    test('should fail when actor has only one free grabbing appendage', () => {
      const actor = { id: 'warrior123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(1);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when actor has zero free grabbing appendages', () => {
      const actor = { id: 'warrior123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when all appendages are locked (holding items)', () => {
      const actor = { id: 'knight999', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      // Both hands holding something
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('prerequisite evaluation - no grabbing appendages at all', () => {
    test('should fail when actor has no grabbing appendages', () => {
      // Entity without hands/tentacles (e.g., a ghost or floating object)
      const actor = { id: 'ghost111', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle missing actor gracefully', () => {
      const actor = null;
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should handle actor with undefined id', () => {
      const actor = { id: undefined, components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);

      const result = prerequisiteService.evaluate(
        removeClothingAction.prerequisites,
        removeClothingAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('condition definition validation', () => {
    test('should use hasFreeGrabbingAppendages operator with correct parameters', () => {
      expect(actorHasTwoFreeGrabbingCondition.logic).toEqual({
        hasFreeGrabbingAppendages: ['actor', 2],
      });
    });

    test('condition ID should match what the action references', () => {
      expect(actorHasTwoFreeGrabbingCondition.id).toBe(
        'anatomy:actor-has-two-free-grabbing-appendages'
      );
    });
  });
});
