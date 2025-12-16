/**
 * @jest-environment node
 * @file Integration tests for show_off_biceps action grabbing prerequisites
 * @description Tests that the action correctly requires two free grabbing appendages
 * in addition to its existing muscular/hulking arm requirement.
 *
 * This is a SPECIAL CASE: The action has COMBINED prerequisites - both the original
 * muscular arms check AND the new grabbing prerequisite must pass.
 *
 * Tests the prerequisite `anatomy:actor-has-two-free-grabbing-appendages` which uses
 * the hasFreeGrabbingAppendages custom JSON Logic operator.
 * @see data/mods/exercise/actions/show_off_biceps.action.json
 * @see data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
 * @see tickets/GRAPREFORACT-003-exercise-mod-prerequisites.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import showOffBicepsAction from '../../../../data/mods/exercise/actions/show_off_biceps.action.json';
import actorHasTwoFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json';

// Mock grabbingUtils to control the free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

describe('exercise:show_off_biceps prerequisites', () => {
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
      hasPartOfTypeWithComponentValue: jest.fn(),
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

    // Set up the condition definition that the second prerequisite references
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

    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
      lightingStateService: mockLightingStateService,
    });

    // Register custom operators
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

  describe('action definition structure - combined prerequisites', () => {
    test('should have prerequisites array defined', () => {
      expect(showOffBicepsAction.prerequisites).toBeDefined();
      expect(Array.isArray(showOffBicepsAction.prerequisites)).toBe(true);
    });

    test('should have exactly 2 prerequisites (combined requirements)', () => {
      expect(showOffBicepsAction.prerequisites.length).toBe(2);
    });

    test('first prerequisite should be muscular/hulking build check (unchanged)', () => {
      const firstPrereq = showOffBicepsAction.prerequisites[0];
      expect(firstPrereq.logic).toBeDefined();
      expect(firstPrereq.logic.or).toBeDefined();
      expect(Array.isArray(firstPrereq.logic.or)).toBe(true);
      expect(firstPrereq.logic.or.length).toBe(2);

      // Verify muscular check
      const muscularCheck = firstPrereq.logic.or[0];
      expect(muscularCheck.hasPartOfTypeWithComponentValue).toBeDefined();
      expect(muscularCheck.hasPartOfTypeWithComponentValue).toEqual([
        'actor',
        'arm',
        'descriptors:build',
        'build',
        'muscular',
      ]);

      // Verify hulking check
      const hulkingCheck = firstPrereq.logic.or[1];
      expect(hulkingCheck.hasPartOfTypeWithComponentValue).toBeDefined();
      expect(hulkingCheck.hasPartOfTypeWithComponentValue).toEqual([
        'actor',
        'arm',
        'descriptors:build',
        'build',
        'hulking',
      ]);
    });

    test('first prerequisite should have failure_message about muscular arms', () => {
      const firstPrereq = showOffBicepsAction.prerequisites[0];
      expect(firstPrereq.failure_message).toBeDefined();
      expect(firstPrereq.failure_message).toBe(
        "You don't have the muscular arms needed to show off."
      );
    });

    test('second prerequisite should reference anatomy:actor-has-two-free-grabbing-appendages condition', () => {
      const secondPrereq = showOffBicepsAction.prerequisites[1];
      expect(secondPrereq.logic).toBeDefined();
      expect(secondPrereq.logic.condition_ref).toBe(
        'anatomy:actor-has-two-free-grabbing-appendages'
      );
    });

    test('second prerequisite should have failure_message about arms free', () => {
      const secondPrereq = showOffBicepsAction.prerequisites[1];
      expect(secondPrereq.failure_message).toBeDefined();
      expect(secondPrereq.failure_message).toBe(
        'You need both arms free to show off your biceps.'
      );
    });

    test('should preserve other action properties', () => {
      expect(showOffBicepsAction.id).toBe('exercise:show_off_biceps');
      expect(showOffBicepsAction.targets).toBe('none');
      expect(showOffBicepsAction.template).toBe('show off your muscular arms');
      expect(showOffBicepsAction.visual.backgroundColor).toBe('#e65100');
    });
  });

  describe('grabbing prerequisite evaluation - two free appendages', () => {
    test('should pass grabbing check when actor has exactly two free appendages', () => {
      const actor = { id: 'bodybuilder123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(2);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockCountFreeGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'bodybuilder123'
      );
    });

    test('should pass grabbing check when actor has more than two free appendages', () => {
      const actor = { id: 'octopod456', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(8);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(true);
    });
  });

  describe('grabbing prerequisite evaluation - insufficient free appendages', () => {
    test('should fail grabbing check when actor has only one free appendage', () => {
      const actor = { id: 'busy_person', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(1);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail grabbing check when actor has zero free appendages', () => {
      const actor = { id: 'armed_warrior', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail grabbing check when all appendages are locked (wielding weapon)', () => {
      const actor = { id: 'swordsman999', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      // Both hands holding a two-handed weapon
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('grabbing prerequisite evaluation - no grabbing appendages', () => {
    test('should fail grabbing check when actor has no grabbing appendages at all', () => {
      const actor = { id: 'ghost111', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockCountFreeGrabbingAppendages.mockReturnValue(0);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle missing actor gracefully', () => {
      const actor = null;
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should handle actor with undefined id', () => {
      const actor = { id: undefined, components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);

      // Evaluate ONLY the grabbing prerequisite (second one)
      const grabbingPrereq = [showOffBicepsAction.prerequisites[1]];
      const result = prerequisiteService.evaluate(
        grabbingPrereq,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('condition definition validation', () => {
    test('should use hasFreeGrabbingAppendages operator with 2 appendages required', () => {
      expect(actorHasTwoFreeGrabbingCondition.logic).toEqual({
        hasFreeGrabbingAppendages: ['actor', 2],
      });
    });

    test('condition ID should match what the second prerequisite references', () => {
      expect(actorHasTwoFreeGrabbingCondition.id).toBe(
        'anatomy:actor-has-two-free-grabbing-appendages'
      );
    });
  });

  describe('combined prerequisites evaluation', () => {
    /**
     * Helper to set up mocks for combined prerequisite testing.
     * The hasPartOfTypeWithComponentValue operator uses:
     * - entityManager.getComponentData() to get the body component (anatomy:body)
     * - bodyGraphService.findPartsByType() to find arm parts
     * - entityManager.getComponentData() again to get component data from each arm part
     *
     * @param {string} actorId - The actor ID
     * @param {string} buildValue - The build value ('muscular', 'hulking', 'thin', etc.)
     * @param {number} freeAppendages - Number of free grabbing appendages
     */
    const setupCombinedMocks = (actorId, buildValue, freeAppendages) => {
      // Set up grabbing prerequisite
      mockCountFreeGrabbingAppendages.mockReturnValue(freeAppendages);

      // Set up body graph service for arm detection
      mockBodyGraphService.buildAdjacencyCache.mockReturnValue(undefined);
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (partType === 'arm') {
            return ['left_arm_part', 'right_arm_part'];
          }
          return [];
        }
      );

      // Set up entity manager for component data
      // First call: get body component (anatomy:body) → returns root
      // Subsequent calls: get arm component (descriptors:build) → returns build value
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return { root: `${actorId}_body_root` };
          }
          if (componentId === 'descriptors:build') {
            return { build: buildValue };
          }
          return null;
        }
      );
    };

    test('should pass when actor has muscular build AND 2 free appendages', () => {
      const actor = { id: 'muscular_flexer', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      setupCombinedMocks('muscular_flexer', 'muscular', 2);

      const result = prerequisiteService.evaluate(
        showOffBicepsAction.prerequisites,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has hulking build AND 2 free appendages', () => {
      const actor = { id: 'hulking_brute', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      setupCombinedMocks('hulking_brute', 'hulking', 2);

      const result = prerequisiteService.evaluate(
        showOffBicepsAction.prerequisites,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should fail when actor has muscular build BUT 0 free appendages', () => {
      const actor = { id: 'busy_bodybuilder', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      setupCombinedMocks('busy_bodybuilder', 'muscular', 0);

      const result = prerequisiteService.evaluate(
        showOffBicepsAction.prerequisites,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when actor has muscular build BUT only 1 free appendage', () => {
      const actor = { id: 'one_handed_muscle', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      setupCombinedMocks('one_handed_muscle', 'muscular', 1);

      const result = prerequisiteService.evaluate(
        showOffBicepsAction.prerequisites,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when actor has 2 free appendages BUT NOT muscular/hulking build', () => {
      const actor = { id: 'skinny_free_hands', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      setupCombinedMocks('skinny_free_hands', 'thin', 2);

      const result = prerequisiteService.evaluate(
        showOffBicepsAction.prerequisites,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when both conditions fail (no muscles AND no free appendages)', () => {
      const actor = { id: 'skinny_busy_person', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      setupCombinedMocks('skinny_busy_person', 'thin', 0);

      const result = prerequisiteService.evaluate(
        showOffBicepsAction.prerequisites,
        showOffBicepsAction,
        actor
      );

      expect(result).toBe(false);
    });
  });
});
