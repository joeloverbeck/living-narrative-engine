/**
 * @jest-environment node
 * @file Integration tests for liquids:enter_liquid_body action prerequisites
 * @description Tests that the enter_liquid_body action correctly requires:
 * 1. Actor's legs to be functioning (anatomy:actor-can-move condition)
 * 2. Actor's location to be lit (isActorLocationLit operator)
 *
 * Tests follow the pattern established in go_action_lighting.test.js
 * @see data/mods/liquids/actions/enter_liquid_body.action.json
 * @see data/mods/movement/actions/go.action.json
 * @see tests/integration/mods/movement/go_action_lighting.test.js
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import enterLiquidBodyAction from '../../../../data/mods/liquids/actions/enter_liquid_body.action.json';

describe('liquids:enter_liquid_body prerequisites', () => {
  let prerequisiteService;
  let jsonLogicService;
  let customOperators;
  let contextBuilder;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
  let mockLightingStateService;
  let mockGameDataRepository;
  let mockComponentAccessService;

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
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockLightingStateService = {
      isLocationLit: jest.fn(),
      getLocationLightingState: jest.fn(),
    };

    mockComponentAccessService = {
      getComponentForEntity: jest.fn(),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Set up condition definitions for condition_ref lookups
    mockGameDataRepository.getConditionDefinition.mockImplementation(
      (conditionId) => {
        if (conditionId === 'anatomy:actor-can-move') {
          // Default: actor can move (passes)
          return {
            id: 'anatomy:actor-can-move',
            logic: { '==': [true, true] },
          };
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
      lightingStateService: mockLightingStateService,
    });

    // Register custom operators (includes isActorLocationLit)
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
      expect(enterLiquidBodyAction.prerequisites).toBeDefined();
      expect(Array.isArray(enterLiquidBodyAction.prerequisites)).toBe(true);
    });

    test('should have exactly two prerequisites', () => {
      expect(enterLiquidBodyAction.prerequisites.length).toBe(2);
    });

    test('should have movement prerequisite using condition_ref', () => {
      const movementPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'anatomy:actor-can-move'
      );
      expect(movementPrereq).toBeDefined();
    });

    test('should have failure_message for movement prerequisite', () => {
      const movementPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'anatomy:actor-can-move'
      );
      expect(movementPrereq.failure_message).toBeDefined();
      expect(movementPrereq.failure_message).toBe(
        'You cannot enter the liquid body without functioning legs.'
      );
    });

    test('should have lighting prerequisite using isActorLocationLit operator', () => {
      const lightingPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq).toBeDefined();
      expect(lightingPrereq.logic.isActorLocationLit).toEqual(['actor']);
    });

    test('should have failure_message for lighting prerequisite', () => {
      const lightingPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq.failure_message).toBeDefined();
      expect(lightingPrereq.failure_message).toBe(
        'It is too dark to see where you are going.'
      );
    });

    test('should preserve other action properties', () => {
      expect(enterLiquidBodyAction.id).toBe('liquids:enter_liquid_body');
      expect(enterLiquidBodyAction.template).toBe('enter the {liquidBody}');
      expect(enterLiquidBodyAction.targets.primary.scope).toBe(
        'liquids:liquid_bodies_at_location'
      );
    });
  });

  describe('lighting prerequisite evaluation - pass cases', () => {
    test('should pass when location is naturally lit', () => {
      const actor = { id: 'swimmer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'lit_pool_area',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const lightingPrereq = enterLiquidBodyAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).toHaveBeenCalledWith(
        'lit_pool_area'
      );
    });

    test('should pass when location has active light sources', () => {
      const actor = { id: 'swimmer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'cave_pool_with_torch',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const lightingPrereq = enterLiquidBodyAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has no position component (fail open)', () => {
      const actor = { id: 'swimmer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null);

      const lightingPrereq = enterLiquidBodyAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });
  });

  describe('lighting prerequisite evaluation - fail cases', () => {
    test('should fail when location is in total darkness', () => {
      const actor = { id: 'swimmer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'dark_underground_pool',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const lightingPrereq = enterLiquidBodyAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when location is naturally dark with no light sources', () => {
      const actor = { id: 'diver', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'pitch_black_lake',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const lightingPrereq = enterLiquidBodyAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle missing actor gracefully', () => {
      const actor = null;
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const lightingPrereq = enterLiquidBodyAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        enterLiquidBodyAction,
        actor
      );

      // Should fail because actor cannot be resolved
      expect(result).toBe(false);
    });

    test('should handle position with no locationId (fail open)', () => {
      const actor = { id: 'spirit', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({}); // No locationId

      const lightingPrereq = enterLiquidBodyAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        enterLiquidBodyAction,
        actor
      );

      // Fail open - don't block action if we can't determine location
      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });
  });

  describe('full prerequisite chain', () => {
    test('should pass all prerequisites when location is lit and actor can move', () => {
      const actor = { id: 'healthy_swimmer', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'sunlit_pond',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const result = prerequisiteService.evaluate(
        enterLiquidBodyAction.prerequisites,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should fail if lighting prerequisite fails', () => {
      const actor = { id: 'person_in_dark', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'dark_cave_pool',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const result = prerequisiteService.evaluate(
        enterLiquidBodyAction.prerequisites,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail if movement prerequisite fails', () => {
      const actor = { id: 'immobile_person', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'lit_pool',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      // Override: actor cannot move
      mockGameDataRepository.getConditionDefinition.mockImplementation(
        (conditionId) => {
          if (conditionId === 'anatomy:actor-can-move') {
            return {
              id: 'anatomy:actor-can-move',
              logic: { '==': [false, true] }, // Fails
            };
          }
          return null;
        }
      );

      const result = prerequisiteService.evaluate(
        enterLiquidBodyAction.prerequisites,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail if both prerequisites fail', () => {
      const actor = { id: 'immobile_person_in_dark', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'dark_pool',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      // Override: actor cannot move
      mockGameDataRepository.getConditionDefinition.mockImplementation(
        (conditionId) => {
          if (conditionId === 'anatomy:actor-can-move') {
            return {
              id: 'anatomy:actor-can-move',
              logic: { '==': [false, true] }, // Fails
            };
          }
          return null;
        }
      );

      const result = prerequisiteService.evaluate(
        enterLiquidBodyAction.prerequisites,
        enterLiquidBodyAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('operator registration', () => {
    test('isActorLocationLit operator should be registered', () => {
      const registeredOperators = customOperators.getRegisteredOperators();
      expect(registeredOperators.has('isActorLocationLit')).toBe(true);
    });
  });

  describe('comparison with go action prerequisites', () => {
    // Verify that enter_liquid_body has the same prerequisite types as go action
    test('should have same prerequisite types as movement:go action', async () => {
      const goAction = await import(
        '../../../../data/mods/movement/actions/go.action.json'
      );

      const goMovementPrereq = goAction.default.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'anatomy:actor-can-move'
      );
      const goLightingPrereq = goAction.default.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const enterMovementPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'anatomy:actor-can-move'
      );
      const enterLightingPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      // Both actions should have both prerequisite types
      expect(goMovementPrereq).toBeDefined();
      expect(goLightingPrereq).toBeDefined();
      expect(enterMovementPrereq).toBeDefined();
      expect(enterLightingPrereq).toBeDefined();

      // Lighting prerequisite should use same operator configuration
      expect(enterLightingPrereq.logic.isActorLocationLit).toEqual(
        goLightingPrereq.logic.isActorLocationLit
      );
    });
  });
});
