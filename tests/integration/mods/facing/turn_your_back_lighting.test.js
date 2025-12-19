/**
 * @jest-environment node
 * @file Integration tests for facing:turn_your_back action lighting prerequisite
 * @description Tests that the turn_your_back action correctly requires the actor's location to be lit
 *
 * Tests the prerequisite using the isActorLocationLit custom JSON Logic operator.
 * @see data/mods/facing/actions/turn_your_back.action.json
 * @see src/logic/operators/isActorLocationLitOperator.js
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import turnYourBackAction from '../../../../data/mods/facing/actions/turn_your_back.action.json';

describe('facing:turn_your_back lighting prerequisite', () => {
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

    // Set up condition definitions for any condition_ref lookups
    mockGameDataRepository.getConditionDefinition.mockImplementation(
      (conditionId) => {
        if (conditionId === 'core:actor-mouth-available') {
          return {
            id: 'core:actor-mouth-available',
            logic: { '==': [true, true] }, // Always passes for these tests
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
      expect(turnYourBackAction.prerequisites).toBeDefined();
      expect(Array.isArray(turnYourBackAction.prerequisites)).toBe(true);
    });

    test('should have lighting prerequisite using isActorLocationLit operator', () => {
      const lightingPrereq = turnYourBackAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq).toBeDefined();
      expect(lightingPrereq.logic.isActorLocationLit).toEqual(['actor']);
    });

    test('should have failure_message for lighting prerequisite', () => {
      const lightingPrereq = turnYourBackAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq.failure_message).toBeDefined();
      expect(lightingPrereq.failure_message).toBe(
        'It is too dark to see where you are turning.'
      );
    });

    test('should preserve other action properties', () => {
      expect(turnYourBackAction.id).toBe('facing:turn_your_back');
      expect(turnYourBackAction.template).toBe('turn your back to {target}');
    });
  });

  describe('prerequisite evaluation - pass cases', () => {
    test('should pass when location is naturally lit', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'lit_room',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const lightingPrereq = turnYourBackAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        turnYourBackAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).toHaveBeenCalledWith(
        'lit_room'
      );
    });

    test('should pass when location has active light sources', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'dark_room_with_torch',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const lightingPrereq = turnYourBackAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        turnYourBackAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has no position component (fail open)', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null);

      const lightingPrereq = turnYourBackAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        turnYourBackAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });
  });

  describe('prerequisite evaluation - fail cases', () => {
    test('should fail when location is in total darkness', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'dark_cave',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const lightingPrereq = turnYourBackAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        turnYourBackAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when location is naturally dark with no light sources', () => {
      const actor = { id: 'adventurer', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'underground_tunnel',
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const lightingPrereq = turnYourBackAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        turnYourBackAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle position with no locationId (fail open)', () => {
      const actor = { id: 'ghost', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({});

      const lightingPrereq = turnYourBackAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        turnYourBackAction,
        actor
      );

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });
  });

  describe('operator registration', () => {
    test('isActorLocationLit operator should be registered', () => {
      const registeredOperators = customOperators.getRegisteredOperators();
      expect(registeredOperators.has('isActorLocationLit')).toBe(true);
    });
  });
});
