/**
 * @jest-environment node
 * @file Integration tests for seduction:brush_hair_back_coyly action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage,
 *              hair, and other actors at location (multiple prerequisites)
 * @see data/mods/seduction/actions/brush_hair_back_coyly.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREEXP-003-brush-hair-prerequisite.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import brushHairAction from '../../../../data/mods/seduction/actions/brush_hair_back_coyly.action.json';
import actorHasFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json';

// Mock grabbingUtils to control the free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

describe('seduction:brush_hair_back_coyly prerequisites', () => {
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
    const grabbingUtils = await import(
      '../../../../src/utils/grabbingUtils.js'
    );
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
      expect(brushHairAction.prerequisites).toBeDefined();
      expect(Array.isArray(brushHairAction.prerequisites)).toBe(true);
    });

    test('should have exactly three prerequisites', () => {
      expect(brushHairAction.prerequisites.length).toBe(3);
    });

    test('should have grabbing prerequisite at index 0', () => {
      const prerequisite = brushHairAction.prerequisites[0];
      expect(prerequisite.logic).toBeDefined();
      expect(prerequisite.logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });

    test('should reference anatomy:actor-has-free-grabbing-appendage condition', () => {
      const prerequisite = brushHairAction.prerequisites[0];
      expect(prerequisite.logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });

    test('should have failure_message for user feedback', () => {
      const prerequisite = brushHairAction.prerequisites[0];
      expect(prerequisite.failure_message).toBeDefined();
      expect(typeof prerequisite.failure_message).toBe('string');
      expect(prerequisite.failure_message.length).toBeGreaterThan(0);
      expect(prerequisite.failure_message).toBe(
        'You need a free hand to brush your hair.'
      );
    });

    test('should preserve other action properties', () => {
      expect(brushHairAction.id).toBe('seduction:brush_hair_back_coyly');
      expect(brushHairAction.template).toBe('brush your hair back coyly');
      expect(brushHairAction.targets).toBe('none');
      expect(brushHairAction.forbidden_components).toEqual({
        actor: [
          'positioning:hugging',
          'positioning:doing_complex_performance',
          'positioning:restraining',
        ],
      });
      expect(brushHairAction.visual).toBeDefined();
      expect(brushHairAction.visual.backgroundColor).toBe('#f57f17');
    });
  });

  describe('multiple prerequisites validation', () => {
    test('grabbing prerequisite should be first in array (index 0)', () => {
      expect(brushHairAction.prerequisites[0].logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });

    test('should preserve existing hasPartOfType prerequisite at index 1', () => {
      expect(brushHairAction.prerequisites[1].logic.hasPartOfType).toEqual([
        'actor',
        'hair',
      ]);
      expect(brushHairAction.prerequisites[1].failure_message).toBe(
        'You need hair to perform this action.'
      );
    });

    test('should preserve existing hasOtherActorsAtLocation prerequisite at index 2', () => {
      expect(
        brushHairAction.prerequisites[2].logic.hasOtherActorsAtLocation
      ).toBeDefined();
      expect(
        brushHairAction.prerequisites[2].logic.hasOtherActorsAtLocation
      ).toEqual(['actor']);
      expect(brushHairAction.prerequisites[2].failure_message).toBe(
        'There is nobody here to draw attention from.'
      );
    });
  });

  describe('prerequisite evaluation - pass cases (grabbing prerequisite only)', () => {
    // NOTE: These tests evaluate only the grabbing prerequisite in isolation
    // Full action evaluation requires all 3 prerequisites to pass (grabbing, hair, other actors)
    // The existing brush_hair_back_coyly_action_discovery.test.js handles full action execution

    test('should pass grabbing check when actor has exactly one free grabbing appendage', () => {
      const actor = { id: 'seducer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(1);

      // Evaluate only the grabbing prerequisite (index 0)
      const grabbingPrereq = [brushHairAction.prerequisites[0]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        brushHairAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockCountFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'seducer123'
      );
    });

    test('should pass grabbing check when actor has multiple free grabbing appendages', () => {
      const actor = { id: 'charmer456', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(4);

      // Evaluate only the grabbing prerequisite (index 0)
      const grabbingPrereq = [brushHairAction.prerequisites[0]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        brushHairAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass grabbing check for actor with two hands both free', () => {
      const actor = { id: 'flirt789', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(2);

      // Evaluate only the grabbing prerequisite (index 0)
      const grabbingPrereq = [brushHairAction.prerequisites[0]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        brushHairAction,
        actor
      );

      expect(result).toBe(true);
    });
  });

  describe('prerequisite evaluation - fail cases (grabbing prerequisite only)', () => {
    test('should fail grabbing check when actor has zero free grabbing appendages', () => {
      const actor = { id: 'seducer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      // Evaluate only the grabbing prerequisite (index 0)
      const grabbingPrereq = [brushHairAction.prerequisites[0]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        brushHairAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail grabbing check when all appendages are locked (holding items)', () => {
      const actor = { id: 'busyhands999', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      // Both hands holding something
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      // Evaluate only the grabbing prerequisite (index 0)
      const grabbingPrereq = [brushHairAction.prerequisites[0]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        brushHairAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('edge cases (grabbing prerequisite only)', () => {
    test('should handle missing actor gracefully', () => {
      const actor = null;
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      // Evaluate only the grabbing prerequisite (index 0)
      const grabbingPrereq = [brushHairAction.prerequisites[0]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        brushHairAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should handle actor with no grabbing appendages', () => {
      // Entity without hands/tentacles (e.g., a ghost or floating object)
      const actor = { id: 'ghost111', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      // Evaluate only the grabbing prerequisite (index 0)
      const grabbingPrereq = [brushHairAction.prerequisites[0]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        brushHairAction,
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
