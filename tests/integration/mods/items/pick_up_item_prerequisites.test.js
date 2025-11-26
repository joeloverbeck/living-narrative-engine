/**
 * @jest-environment node
 *
 * @file Integration tests for pick_up_item action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/items/actions/pick_up_item.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREFORACT-008-items-mod-tests.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import pickUpItemAction from '../../../../data/mods/items/actions/pick_up_item.action.json';
import actorHasFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json';

// Mock grabbingUtils to control the free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

describe('items:pick_up_item prerequisites', () => {
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
        if (conditionId === 'anatomy:actor-has-free-grabbing-appendage') {
          return actorHasFreeGrabbingCondition;
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
      expect(pickUpItemAction.prerequisites).toBeDefined();
      expect(Array.isArray(pickUpItemAction.prerequisites)).toBe(true);
    });

    test('should reference anatomy:actor-has-free-grabbing-appendage condition', () => {
      expect(pickUpItemAction.prerequisites.length).toBeGreaterThan(0);
      const prerequisite = pickUpItemAction.prerequisites[0];
      expect(prerequisite.logic).toBeDefined();
      expect(prerequisite.logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });

    test('should have failure_message for user feedback', () => {
      const prerequisite = pickUpItemAction.prerequisites[0];
      expect(prerequisite.failure_message).toBeDefined();
      expect(typeof prerequisite.failure_message).toBe('string');
      expect(prerequisite.failure_message.length).toBeGreaterThan(0);
    });

    test('should preserve other action properties', () => {
      expect(pickUpItemAction.id).toBe('items:pick_up_item');
      expect(pickUpItemAction.template).toBe('pick up {item}');
      expect(pickUpItemAction.required_components.actor).toContain(
        'items:inventory'
      );
      expect(pickUpItemAction.forbidden_components.actor).toContain(
        'positioning:bending_over'
      );
      expect(pickUpItemAction.forbidden_components.actor).toContain(
        'positioning:being_fucked_vaginally'
      );
    });
  });

  describe('prerequisite evaluation - free grabbing appendage available', () => {
    test('should pass when actor has exactly one free grabbing appendage', () => {
      const actor = { id: 'gatherer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(1);

      const result = prerequisiteService.evaluate(
        pickUpItemAction.prerequisites,
        pickUpItemAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockCountFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'gatherer123'
      );
    });

    test('should pass when actor has multiple free grabbing appendages', () => {
      const actor = { id: 'octopod456', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(4);

      const result = prerequisiteService.evaluate(
        pickUpItemAction.prerequisites,
        pickUpItemAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass for actor with two hands both free', () => {
      const actor = { id: 'human789', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(2);

      const result = prerequisiteService.evaluate(
        pickUpItemAction.prerequisites,
        pickUpItemAction,
        actor
      );

      expect(result).toBe(true);
    });
  });

  describe('prerequisite evaluation - no free grabbing appendage', () => {
    test('should fail when actor has zero free grabbing appendages', () => {
      const actor = { id: 'gatherer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      const result = prerequisiteService.evaluate(
        pickUpItemAction.prerequisites,
        pickUpItemAction,
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
        pickUpItemAction.prerequisites,
        pickUpItemAction,
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
        pickUpItemAction.prerequisites,
        pickUpItemAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should handle actor with no grabbing appendages', () => {
      // Entity without hands/tentacles (e.g., a ghost or floating object)
      const actor = { id: 'ghost111', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      const result = prerequisiteService.evaluate(
        pickUpItemAction.prerequisites,
        pickUpItemAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('condition definition validation', () => {
    test('should use hasFreeGrabbingAppendages operator with parameter 1', () => {
      expect(actorHasFreeGrabbingCondition.logic).toEqual({
        hasFreeGrabbingAppendages: ['actor', 1],
      });
    });

    test('condition ID should match what the action references', () => {
      expect(actorHasFreeGrabbingCondition.id).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });
  });
});
