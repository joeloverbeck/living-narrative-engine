/**
 * @jest-environment node
 * @file Integration tests for movement:feel_your_way_to_an_exit action discovery.
 * @description Tests that the action is properly discoverable when actors meet requirements.
 *
 * Tests the prerequisites using the isActorLocationLit and locationHasExits custom JSON Logic operators.
 * @see data/mods/movement/actions/feel_your_way_to_an_exit.action.json
 * @see src/logic/operators/isActorLocationLitOperator.js
 * @see src/logic/operators/locationHasExitsOperator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import feelYourWayAction from '../../../../data/mods/movement/actions/feel_your_way_to_an_exit.action.json';

const ACTION_ID = 'movement:feel_your_way_to_an_exit';

describe('movement:feel_your_way_to_an_exit action discovery', () => {
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
        // The action uses movement:actor-can-move condition_ref
        if (conditionId === 'movement:actor-can-move') {
          return {
            id: 'movement:actor-can-move',
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

    // Register custom operators (includes isActorLocationLit and locationHasExits)
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

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(feelYourWayAction).toBeDefined();
      expect(feelYourWayAction.id).toBe('movement:feel_your_way_to_an_exit');
      expect(feelYourWayAction.name).toBe('Feel Your Way to an Exit');
      expect(feelYourWayAction.description).toContain('navigate in darkness');
      expect(feelYourWayAction.targets).toBe('none');
    });

    it('should require awareness_skill component', () => {
      expect(feelYourWayAction.required_components).toBeDefined();
      expect(feelYourWayAction.required_components.actor).toEqual([
        'skills:awareness_skill',
      ]);
    });

    it('should have correct forbidden components', () => {
      expect(feelYourWayAction.forbidden_components).toBeDefined();
      expect(feelYourWayAction.forbidden_components.actor).toContain(
        'positioning:bending_over'
      );
      expect(feelYourWayAction.forbidden_components.actor).toContain(
        'positioning:fallen'
      );
      expect(feelYourWayAction.forbidden_components.actor).toContain(
        'positioning:being_restrained'
      );
      expect(feelYourWayAction.forbidden_components.actor).toContain(
        'positioning:restraining'
      );
      expect(feelYourWayAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('should have correct visual styling matching movement actions', () => {
      expect(feelYourWayAction.visual).toBeDefined();
      expect(feelYourWayAction.visual.backgroundColor).toBe('#006064');
      expect(feelYourWayAction.visual.textColor).toBe('#e0f7fa');
      expect(feelYourWayAction.visual.hoverBackgroundColor).toBe('#00838f');
      expect(feelYourWayAction.visual.hoverTextColor).toBe('#ffffff');
    });

    it('should have correct template with chance placeholder', () => {
      expect(feelYourWayAction.template).toBe(
        'feel your way to an exit ({chance}% chance)'
      );
    });

    it('should have three prerequisites', () => {
      expect(feelYourWayAction.prerequisites).toBeDefined();
      expect(feelYourWayAction.prerequisites.length).toBe(3);
    });

    it('should require actor can move', () => {
      const movePrereq = feelYourWayAction.prerequisites.find(
        (p) => p.logic.condition_ref === 'movement:actor-can-move'
      );
      expect(movePrereq).toBeDefined();
      expect(movePrereq.failure_message).toContain('cannot move');
    });

    it('should require location to be dark (not lit)', () => {
      const darkPrereq = feelYourWayAction.prerequisites.find((p) => p.logic['!']);
      expect(darkPrereq).toBeDefined();
      expect(darkPrereq.logic['!'][0].isActorLocationLit).toEqual(['actor']);
      expect(darkPrereq.failure_message).toContain('enough light');
    });

    it('should require location to have exits', () => {
      const exitsPrereq = feelYourWayAction.prerequisites.find(
        (p) => p.logic.locationHasExits
      );
      expect(exitsPrereq).toBeDefined();
      expect(exitsPrereq.logic.locationHasExits).toEqual(['actor']);
      expect(exitsPrereq.failure_message).toContain('no exits');
    });
  });

  describe('Chance-based configuration', () => {
    it('should be configured as chance-based action', () => {
      expect(feelYourWayAction.chanceBased).toBeDefined();
      expect(feelYourWayAction.chanceBased.enabled).toBe(true);
    });

    it('should use fixed difficulty contest type', () => {
      expect(feelYourWayAction.chanceBased.contestType).toBe('fixed_difficulty');
      expect(feelYourWayAction.chanceBased.fixedDifficulty).toBe(50);
    });

    it('should use linear formula', () => {
      expect(feelYourWayAction.chanceBased.formula).toBe('linear');
    });

    it('should use awareness skill', () => {
      expect(feelYourWayAction.chanceBased.actorSkill).toBeDefined();
      expect(feelYourWayAction.chanceBased.actorSkill.component).toBe(
        'skills:awareness_skill'
      );
      expect(feelYourWayAction.chanceBased.actorSkill.property).toBe('value');
      expect(feelYourWayAction.chanceBased.actorSkill.default).toBe(0);
    });

    it('should have correct bounds', () => {
      expect(feelYourWayAction.chanceBased.bounds).toBeDefined();
      expect(feelYourWayAction.chanceBased.bounds.min).toBe(5);
      expect(feelYourWayAction.chanceBased.bounds.max).toBe(95);
    });

    it('should have correct outcome thresholds', () => {
      expect(feelYourWayAction.chanceBased.outcomes).toBeDefined();
      expect(feelYourWayAction.chanceBased.outcomes.criticalSuccessThreshold).toBe(
        5
      );
      expect(
        feelYourWayAction.chanceBased.outcomes.criticalFailureThreshold
      ).toBe(95);
    });
  });

  describe('Prerequisite evaluation - dark location with exits (should pass)', () => {
    it('should pass when location is dark and has exits', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      // Set position component
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'dark_room' };
        }
        if (compType === 'movement:exits') {
          return { exits: [{ direction: 'north', destination: 'room2' }] };
        }
        return null;
      });
      // Location is dark
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      // Filter to just the lighting and exits prerequisites
      const lightingPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic['!'] || p.logic.locationHasExits
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(true);
    });

    it('should pass when location has multiple exits', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'intersection' };
        }
        if (compType === 'movement:exits') {
          return {
            exits: [
              { direction: 'north', destination: 'room2' },
              { direction: 'south', destination: 'room3' },
              { direction: 'east', destination: 'room4' },
            ],
          };
        }
        return null;
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const lightingPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic['!'] || p.logic.locationHasExits
      );

      const result = prerequisiteService.evaluate(
        lightingPrereq,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(true);
    });
  });

  describe('Prerequisite evaluation - lit location (should fail)', () => {
    it('should fail when location is lit (not dark)', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'lit_room' };
        }
        if (compType === 'movement:exits') {
          return { exits: [{ direction: 'north', destination: 'room2' }] };
        }
        return null;
      });
      // Location is lit - action should NOT be available
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      // Get only the darkness prerequisite
      const darknessPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic['!']
      );

      const result = prerequisiteService.evaluate(
        darknessPrereq,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });

    it('should fail when location is naturally lit', () => {
      const actor = { id: 'adventurer', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'sunny_meadow' };
        }
        if (compType === 'movement:exits') {
          return { exits: [{ direction: 'west', destination: 'forest' }] };
        }
        return null;
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const darknessPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic['!']
      );

      const result = prerequisiteService.evaluate(
        darknessPrereq,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('Prerequisite evaluation - no exits (should fail)', () => {
    it('should fail when location has no exits', () => {
      const actor = { id: 'person123', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'dead_end' };
        }
        if (compType === 'movement:exits') {
          return { exits: [] }; // Empty exits array
        }
        return null;
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      // Get only the exits prerequisite
      const exitsPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic.locationHasExits
      );

      const result = prerequisiteService.evaluate(
        exitsPrereq,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });

    it('should fail when location has no exits component', () => {
      const actor = { id: 'trapped', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'sealed_chamber' };
        }
        if (compType === 'movement:exits') {
          return null; // No exits component
        }
        return null;
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const exitsPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic.locationHasExits
      );

      const result = prerequisiteService.evaluate(
        exitsPrereq,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('Full prerequisite chain', () => {
    it('should pass all prerequisites when dark, has exits, and can move', () => {
      const actor = { id: 'capable_person', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'dark_cave' };
        }
        if (compType === 'movement:exits') {
          return { exits: [{ direction: 'north', destination: 'exit' }] };
        }
        return null;
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const result = prerequisiteService.evaluate(
        feelYourWayAction.prerequisites,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(true);
    });

    it('should fail if location is lit even if has exits', () => {
      const actor = { id: 'person_in_light', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'lit_room' };
        }
        if (compType === 'movement:exits') {
          return { exits: [{ direction: 'south', destination: 'hallway' }] };
        }
        return null;
      });
      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const result = prerequisiteService.evaluate(
        feelYourWayAction.prerequisites,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });

    it('should fail if dark but no exits', () => {
      const actor = { id: 'trapped_in_dark', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return { locationId: 'dark_pit' };
        }
        if (compType === 'movement:exits') {
          return { exits: [] };
        }
        return null;
      });
      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const result = prerequisiteService.evaluate(
        feelYourWayAction.prerequisites,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle actor with no position (fail open for lighting)', () => {
      const actor = { id: 'ghost', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null);

      // Just the lighting prerequisite
      const darknessPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic['!']
      );

      const result = prerequisiteService.evaluate(
        darknessPrereq,
        feelYourWayAction,
        actor
      );

      // Fail open - isActorLocationLit returns true when no position
      // So !isActorLocationLit returns false -> prerequisite fails
      expect(result).toBe(false);
    });

    it('should handle missing actor gracefully', () => {
      const actor = null;
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = prerequisiteService.evaluate(
        feelYourWayAction.prerequisites,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });

    it('should handle position with no locationId', () => {
      const actor = { id: 'limbo', components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation((entityId, compType) => {
        if (compType === 'core:position') {
          return {}; // No locationId
        }
        return null;
      });

      const exitsPrereq = feelYourWayAction.prerequisites.filter(
        (p) => p.logic.locationHasExits
      );

      const result = prerequisiteService.evaluate(
        exitsPrereq,
        feelYourWayAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('Operator registration', () => {
    it('isActorLocationLit operator should be registered', () => {
      const registeredOperators = customOperators.getRegisteredOperators();
      expect(registeredOperators.has('isActorLocationLit')).toBe(true);
    });

    it('locationHasExits operator should be registered', () => {
      const registeredOperators = customOperators.getRegisteredOperators();
      expect(registeredOperators.has('locationHasExits')).toBe(true);
    });
  });
});
