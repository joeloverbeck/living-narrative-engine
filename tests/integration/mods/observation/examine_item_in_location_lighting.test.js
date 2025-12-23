/**
 * @jest-environment node
 * @file Integration tests for observation:examine_item_in_location action lighting prerequisite
 * @description Tests that the examine_item_in_location action correctly requires the actor's location to be lit
 *
 * Tests the prerequisite using the isActorLocationLit custom JSON Logic operator.
 * @see data/mods/observation/actions/examine_item_in_location.action.json
 * @see src/logic/operators/isActorLocationLitOperator.js
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import examineItemInLocationAction from '../../../../data/mods/observation/actions/examine_item_in_location.action.json';

describe('observation:examine_item_in_location lighting prerequisite', () => {
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
      expect(examineItemInLocationAction.prerequisites).toBeDefined();
      expect(Array.isArray(examineItemInLocationAction.prerequisites)).toBe(
        true
      );
    });

    test('should have lighting prerequisite using isActorLocationLit operator', () => {
      const lightingPrereq = examineItemInLocationAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq).toBeDefined();
      expect(lightingPrereq.logic.isActorLocationLit).toEqual(['actor']);
    });

    test('should have failure_message for lighting prerequisite', () => {
      const lightingPrereq = examineItemInLocationAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq.failure_message).toBeDefined();
      expect(lightingPrereq.failure_message).toBe(
        'It is too dark to examine anything.'
      );
    });

    test('should preserve other action properties', () => {
      expect(examineItemInLocationAction.id).toBe(
        'observation:examine_item_in_location'
      );
      expect(examineItemInLocationAction.template).toBe(
        'examine {target} in location'
      );
      expect(examineItemInLocationAction.targets.primary.scope).toBe(
        'items:items_at_actor_location'
      );
    });

    test('should preserve forbidden_components', () => {
      expect(examineItemInLocationAction.forbidden_components).toBeDefined();
      expect(
        examineItemInLocationAction.forbidden_components.actor
      ).toContain('performances-states:doing_complex_performance');
      expect(
        examineItemInLocationAction.forbidden_components.actor
      ).toContain('recovery-states:fallen');
      expect(
        examineItemInLocationAction.forbidden_components.actor
      ).toContain('physical-control-states:being_restrained');
      expect(
        examineItemInLocationAction.forbidden_components.actor
      ).toContain('physical-control-states:restraining');
    });
  });

  describe('prerequisite evaluation - pass cases', () => {
    test('should pass when location is naturally lit', () => {
      const actor = { id: 'observer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'sunlit_courtyard',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const lightingPrereq = examineItemInLocationAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        examineItemInLocationAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).toHaveBeenCalledWith(
        'sunlit_courtyard'
      );
    });

    test('should pass when location has active light sources', () => {
      const actor = { id: 'observer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'cave_with_torches',
      });
      // Location is naturally dark but has light sources
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const lightingPrereq = examineItemInLocationAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        examineItemInLocationAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has no position component (fail open)', () => {
      const actor = { id: 'observer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null);

      const lightingPrereq = examineItemInLocationAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        examineItemInLocationAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });
  });

  describe('prerequisite evaluation - fail cases', () => {
    test('should fail when location is in total darkness', () => {
      const actor = { id: 'observer123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'dark_dungeon',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const lightingPrereq = examineItemInLocationAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        examineItemInLocationAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when location is naturally dark with no light sources', () => {
      const actor = { id: 'explorer', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'abandoned_mine',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const lightingPrereq = examineItemInLocationAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        examineItemInLocationAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle missing actor gracefully', () => {
      const actor = null;
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const lightingPrereq = examineItemInLocationAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        examineItemInLocationAction,
        actor
      );

      // Should fail because actor cannot be resolved
      expect(result).toBe(false);
    });

    test('should handle position with no locationId (fail open)', () => {
      const actor = { id: 'drifter', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({}); // No locationId

      const lightingPrereq = examineItemInLocationAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        examineItemInLocationAction,
        actor
      );

      // Fail open - don't block examination if we can't determine location
      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });
  });

  describe('full prerequisite chain', () => {
    test('should pass all prerequisites when location is lit', () => {
      const actor = { id: 'careful_observer', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'well_lit_plaza',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const result = prerequisiteService.evaluate(
        examineItemInLocationAction.prerequisites,
        examineItemInLocationAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should fail if lighting prerequisite fails', () => {
      const actor = { id: 'person_in_dark', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'moonless_night_forest',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const result = prerequisiteService.evaluate(
        examineItemInLocationAction.prerequisites,
        examineItemInLocationAction,
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
});
