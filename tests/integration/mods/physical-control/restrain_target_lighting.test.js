/**
 * @jest-environment node
 * @file Integration tests for physical-control:restrain_target action lighting prerequisite
 * @description Tests that the restrain_target action correctly requires the actor's location to be lit
 *
 * Tests the prerequisite using the isActorLocationLit custom JSON Logic operator.
 * @see data/mods/physical-control/actions/restrain_target.action.json
 * @see src/logic/operators/isActorLocationLitOperator.js
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import restrainTargetAction from '../../../../data/mods/physical-control/actions/restrain_target.action.json';

describe('physical-control:restrain_target lighting prerequisite', () => {
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
        if (conditionId === 'anatomy:actor-has-two-free-grabbing-appendages') {
          return {
            id: 'anatomy:actor-has-two-free-grabbing-appendages',
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
      expect(restrainTargetAction.prerequisites).toBeDefined();
      expect(Array.isArray(restrainTargetAction.prerequisites)).toBe(true);
    });

    test('should have lighting prerequisite using isActorLocationLit operator', () => {
      const lightingPrereq = restrainTargetAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq).toBeDefined();
      expect(lightingPrereq.logic.isActorLocationLit).toEqual(['actor']);
    });

    test('should have failure_message for lighting prerequisite', () => {
      const lightingPrereq = restrainTargetAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );
      expect(lightingPrereq.failure_message).toBeDefined();
      expect(lightingPrereq.failure_message).toBe(
        'It is too dark to restrain anyone.'
      );
    });

    test('should preserve other action properties', () => {
      expect(restrainTargetAction.id).toBe('physical-control:restrain_target');
      expect(restrainTargetAction.template).toBe(
        'restrain {target} ({chance}% chance)'
      );
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

      const lightingPrereq = restrainTargetAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        restrainTargetAction,
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

      const lightingPrereq = restrainTargetAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        restrainTargetAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has no position component (fail open)', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null);

      const lightingPrereq = restrainTargetAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        restrainTargetAction,
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

      const lightingPrereq = restrainTargetAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        restrainTargetAction,
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

      const lightingPrereq = restrainTargetAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        restrainTargetAction,
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

      const lightingPrereq = restrainTargetAction.prerequisites.filter(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        restrainTargetAction,
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
