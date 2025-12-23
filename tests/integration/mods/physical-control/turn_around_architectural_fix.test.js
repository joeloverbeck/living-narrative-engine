/**
 * @file Integration test for turn_around action architectural fix
 * @description Verifies that the turn_around action no longer violates dependency hierarchy
 * by referencing intimacy components, and that it still prevents turning during kissing
 * through the proper mouth availability prerequisite.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';

// Import the action definition directly to test its structure
import turnAroundAction from '../../../../data/mods/physical-control/actions/turn_around.action.json';

// Import the mouth and movement availability conditions
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json';
import actorCanMoveCondition from '../../../../data/mods/anatomy/conditions/actor-can-move.condition.json';

describe('Turn Around Action - Architectural Fix Validation', () => {
  let prereqService;
  let mockLogger;
  let mockEntityManager;
  let mockGameDataRepository;
  let mockBodyGraphService;
  let jsonLogicService;
  let customOperators;
  let contextBuilder;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getAllComponentTypesForEntity: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
      getPartsByType: jest.fn(),
    };

    mockBodyGraphService = {
      findPartsByType: jest.fn(),
      buildAdjacencyCache: jest.fn(),
      hasPartWithComponentValue: jest.fn(),
      getAllParts: jest.fn(),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Create real services for integration testing
    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
    });

    // Create mock lighting state service
    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    // Create and register custom operators
    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
      lightingStateService: mockLightingStateService,
    });
    customOperators.registerOperators(jsonLogicService);

    contextBuilder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    prereqService = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository: mockGameDataRepository,
    });

    // Setup the condition definitions
    mockGameDataRepository.getConditionDefinition.mockImplementation(
      (conditionId) => {
        if (conditionId === 'core:actor-mouth-available') {
          return mouthAvailableCondition;
        }
        if (conditionId === 'anatomy:actor-can-move') {
          return actorCanMoveCondition;
        }
        return undefined;
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Architecture Compliance', () => {
    it('should not reference any intimacy components', () => {
      // Convert action definition to string to search for violations
      const actionJson = JSON.stringify(turnAroundAction);

      // Should not contain any reference to intimacy mod
      expect(actionJson).not.toContain('intimacy:');
      expect(actionJson).not.toContain('kissing:kissing');

      // Can have forbidden_components for positioning mod components
      // (biting-states:biting_neck and lying-states:lying_on are valid as they're from positioning mod)
      if (turnAroundAction.forbidden_components) {
        expect(turnAroundAction.forbidden_components.actor).toEqual([
          'biting-states:biting_neck',
          'lying-states:lying_on',
          'physical-control-states:being_restrained',
        ]);
      }
    });

    it('should only reference core and positioning components', () => {
      const actionJson = JSON.stringify(turnAroundAction);

      // Extract all component references (format: "modId:componentId")
      const componentReferences = actionJson.match(/"\w+:\w+"/g) || [];

      componentReferences.forEach((ref) => {
        const cleanRef = ref.replace(/"/g, '');
        if (cleanRef.includes(':')) {
          const [modId] = cleanRef.split(':');

          // Should only reference core or positioning mods (or schema for $schema)
          expect(['core', 'positioning', 'schema']).toContain(modId);

          // Should NOT reference intimacy or anatomy mods
          expect(modId).not.toBe('intimacy');
          expect(modId).not.toBe('anatomy');
        }
      });
    });

    it('should have mouth availability prerequisite', () => {
      expect(turnAroundAction.prerequisites).toBeDefined();
      expect(Array.isArray(turnAroundAction.prerequisites)).toBe(true);

      // Find the mouth availability prerequisite
      const mouthPrereq = turnAroundAction.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'core:actor-mouth-available'
      );

      expect(mouthPrereq).toBeDefined();
      expect(mouthPrereq.failure_message).toBe(
        'You cannot do that while your mouth is engaged.'
      );
    });

    it('should have movement availability prerequisite', () => {
      expect(turnAroundAction.prerequisites).toBeDefined();

      // Find the movement prerequisite
      const movePrereq = turnAroundAction.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'anatomy:actor-can-move'
      );

      expect(movePrereq).toBeDefined();
      expect(movePrereq.failure_message).toBe('You cannot move right now.');
    });
  });

  describe('Functional Behavior with Mouth Engagement', () => {
    it('should allow action when actor has available mouth', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };

      // Setup entity with available mouth (mouth engagement component with locked: false)
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === actorId && componentId === 'anatomy:body') {
            return { root: 'test:body_root' };
          }
          if (
            entityId === 'test:mouth_part' &&
            componentId === 'core:mouth_engagement'
          ) {
            return { locked: false }; // Mouth is not locked
          }
          // Movement component should be on a body part (e.g., legs), not the actor directly
          if (
            entityId === 'test:legs_part' &&
            componentId === 'core:movement'
          ) {
            return { locked: false }; // Movement is not locked
          }
          return undefined;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:name',
        'anatomy:body',
      ]);

      // Setup bodyGraphService for custom operators
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'test:body_root' && partType === 'mouth') {
            return ['test:mouth_part'];
          }
          return [];
        }
      );
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {});

      // Mock hasPartWithComponentValue for movement check
      mockBodyGraphService.hasPartWithComponentValue.mockImplementation(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          if (
            componentId === 'core:movement' &&
            propertyPath === 'locked' &&
            expectedValue === false
          ) {
            // Movement is available
            return { found: true, partId: 'test:legs_part' };
          }
          return { found: false };
        }
      );

      // Mock getAllParts to return all body parts for movement check
      mockBodyGraphService.getAllParts.mockImplementation((rootId) => {
        if (rootId === 'test:body_root') {
          return ['test:body_root', 'test:mouth_part', 'test:legs_part'];
        }
        return [];
      });

      const result = prereqService.evaluate(
        turnAroundAction.prerequisites,
        turnAroundAction,
        actor
      );

      expect(result).toBe(true);
    });

    it('should block action when mouth is engaged', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };

      // Setup entity with locked mouth (as would happen during kissing)
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === actorId && componentId === 'anatomy:body') {
            return { root: 'test:body_root' };
          }
          if (
            entityId === 'test:mouth_part' &&
            componentId === 'core:mouth_engagement'
          ) {
            return { locked: true }; // Mouth IS locked (simulating kissing)
          }
          if (
            entityId === 'test:legs_part' &&
            componentId === 'core:movement'
          ) {
            return { locked: false }; // Movement is not locked
          }
          return undefined;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:name',
        'anatomy:body',
      ]);

      // Setup bodyGraphService for custom operators
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'test:body_root' && partType === 'mouth') {
            return ['test:mouth_part'];
          }
          return [];
        }
      );
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {});

      // Mock hasPartWithComponentValue for movement check
      mockBodyGraphService.hasPartWithComponentValue.mockImplementation(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          if (
            componentId === 'core:movement' &&
            propertyPath === 'locked' &&
            expectedValue === false
          ) {
            // Movement is available
            return { found: true, partId: 'test:legs_part' };
          }
          return { found: false };
        }
      );

      const result = prereqService.evaluate(
        turnAroundAction.prerequisites,
        turnAroundAction,
        actor
      );

      // Should fail because mouth is engaged
      expect(result).toBe(false);
    });

    it('should block action when movement is locked', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };

      // Setup entity with locked movement
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === actorId && componentId === 'anatomy:body') {
            return { root: 'test:body_root' };
          }
          if (
            entityId === 'test:mouth_part' &&
            componentId === 'core:mouth_engagement'
          ) {
            return { locked: false }; // Mouth is not locked
          }
          if (
            entityId === 'test:legs_part' &&
            componentId === 'core:movement'
          ) {
            return { locked: true }; // Movement IS locked
          }
          return undefined;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:name',
        'anatomy:body',
      ]);

      // Setup bodyGraphService for custom operators
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'test:body_root' && partType === 'mouth') {
            return ['test:mouth_part'];
          }
          return [];
        }
      );
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {});

      // Mock hasPartWithComponentValue for movement check - this time movement is locked
      mockBodyGraphService.hasPartWithComponentValue.mockImplementation(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          if (
            componentId === 'core:movement' &&
            propertyPath === 'locked' &&
            expectedValue === false
          ) {
            // Movement is NOT available (locked)
            return { found: false };
          }
          if (
            componentId === 'core:movement' &&
            propertyPath === 'locked' &&
            expectedValue === true
          ) {
            // Movement is locked
            return { found: true, partId: 'test:legs_part' };
          }
          return { found: false };
        }
      );

      const result = prereqService.evaluate(
        turnAroundAction.prerequisites,
        turnAroundAction,
        actor
      );

      // Should fail because movement is locked
      expect(result).toBe(false);
    });

    it('should allow action for entities without mouth parts', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };

      // Setup entity without mouth parts (non-humanoid entity)
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === actorId && componentId === 'anatomy:body') {
            return { root: 'test:body_root' };
          }
          // Movement component on body part
          if (
            entityId === 'test:legs_part' &&
            componentId === 'core:movement'
          ) {
            return { locked: false }; // Movement is not locked
          }
          return undefined;
        }
      );
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:name',
        'anatomy:body',
      ]);

      // Setup bodyGraphService - no mouth parts
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === 'test:body_root' && partType === 'mouth') {
            return []; // No mouth parts
          }
          return [];
        }
      );
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {});

      // Mock hasPartWithComponentValue for movement check
      mockBodyGraphService.hasPartWithComponentValue.mockImplementation(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          if (
            componentId === 'core:movement' &&
            propertyPath === 'locked' &&
            expectedValue === false
          ) {
            // Movement is available
            return { found: true, partId: 'test:legs_part' };
          }
          return { found: false };
        }
      );

      // Mock getAllParts to return body parts (no mouth)
      mockBodyGraphService.getAllParts.mockImplementation((rootId) => {
        if (rootId === 'test:body_root') {
          return ['test:body_root', 'test:legs_part'];
        }
        return [];
      });

      const result = prereqService.evaluate(
        turnAroundAction.prerequisites,
        turnAroundAction,
        actor
      );

      // Should pass because entities without mouths can always turn
      expect(result).toBe(true);
    });
  });

  describe('Dependency Hierarchy Validation', () => {
    it('should load without dependency resolution errors', () => {
      // The fact that we can import and use the action definition
      // without errors proves there are no dependency violations
      expect(turnAroundAction).toBeDefined();
      expect(turnAroundAction.id).toBe('physical-control:turn_around');

      // Prerequisites should reference only core, anatomy, or movement conditions (no intimacy)
      turnAroundAction.prerequisites.forEach((prereq) => {
        if (prereq.logic?.condition_ref) {
          expect(prereq.logic.condition_ref).toMatch(/^(core:|anatomy:|movement:)/);
        }
      });
    });

    it('should have valid JSON structure', () => {
      // Verify the action has all required fields
      expect(turnAroundAction.$schema).toBeDefined();
      expect(turnAroundAction.id).toBe('physical-control:turn_around');
      expect(turnAroundAction.name).toBeDefined();
      expect(turnAroundAction.description).toBeDefined();
      expect(turnAroundAction.targets).toBeDefined();
      expect(turnAroundAction.prerequisites).toEqual([
        {
          logic: {
            condition_ref: 'anatomy:actor-can-move',
          },
          failure_message: 'You cannot move right now.',
        },
        {
          logic: {
            condition_ref: 'core:actor-mouth-available',
          },
          failure_message: 'You cannot do that while your mouth is engaged.',
        },
      ]);

      // Can have forbidden_components for positioning mod components
      if (turnAroundAction.forbidden_components) {
        expect(turnAroundAction.forbidden_components.actor).toEqual([
          'biting-states:biting_neck',
          'lying-states:lying_on',
          'physical-control-states:being_restrained',
        ]);
      }
    });
  });
});
