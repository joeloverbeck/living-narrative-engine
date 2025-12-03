/**
 * @file Integration tests for mouth engagement prerequisites in positioning actions
 * @description Tests that positioning actions correctly integrate with mouth engagement conditions
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';

// Import the actual action definitions
import kneelBeforeAction from '../../../../data/mods/deference/actions/kneel_before.action.json';
import placeYourselfBehindAction from '../../../../data/mods/positioning/actions/place_yourself_behind.action.json';
import turnYourBackAction from '../../../../data/mods/positioning/actions/turn_your_back.action.json';
import stepBackAction from '../../../../data/mods/positioning/actions/step_back.action.json';

// Import the mouth availability condition
import mouthAvailableCondition from '../../../../data/mods/core/conditions/actor-mouth-available.condition.json';

describe('Positioning Actions - Mouth Engagement Integration', () => {
  let prereqService;
  let mockLogger;
  let mockEntityManager;
  let mockGameDataRepository;
  let mockBodyGraphService;
  let jsonLogicService;
  let customOperators;
  let contextBuilder;

  const positioningActions = [
    { name: 'kneel_before', action: kneelBeforeAction },
    { name: 'place_yourself_behind', action: placeYourselfBehindAction },
    { name: 'turn_your_back', action: turnYourBackAction },
    { name: 'step_back', action: stepBackAction },
  ];

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

    // Create and register custom operators
    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
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

    // Setup the mouth availability condition
    mockGameDataRepository.getConditionDefinition.mockImplementation(
      (conditionId) => {
        if (conditionId === 'core:actor-mouth-available') {
          return mouthAvailableCondition;
        }
        return undefined;
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Mouth Available Scenarios', () => {
    positioningActions.forEach(({ name, action }) => {
      it(`should allow ${name} when actor has available mouth`, () => {
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

        const result = prereqService.evaluate(
          action.prerequisites,
          action,
          actor
        );

        expect(result).toBe(true);
      });

      it(`should allow ${name} when actor has mouth without engagement component`, () => {
        const actorId = 'test:actor';
        const actor = { id: actorId };

        // Setup entity with mouth but no engagement component (defaults to available)
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
              return null; // No engagement component
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

        const result = prereqService.evaluate(
          action.prerequisites,
          action,
          actor
        );

        expect(result).toBe(true);
      });

      it(`should allow ${name} when actor has no mouth parts`, () => {
        const actorId = 'test:actor_no_mouth';
        const actor = { id: actorId };

        // Setup entity with no mouth parts (condition should pass - no mouth means available)
        mockEntityManager.getEntityInstance.mockReturnValue(actor);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === actorId && componentId === 'anatomy:body') {
              return { root: 'test:body_root' };
            }
            return undefined;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'core:name',
          'anatomy:body',
        ]);

        // Setup bodyGraphService for custom operators - no mouth parts
        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            return []; // No mouth parts
          }
        );
        mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {});

        const result = prereqService.evaluate(
          action.prerequisites,
          action,
          actor
        );

        expect(result).toBe(true);
      });
    });
  });

  describe('Mouth Engaged Scenarios', () => {
    positioningActions.forEach(({ name, action }) => {
      it(`should prevent ${name} when actor's mouth is engaged`, () => {
        const actorId = 'test:actor';
        const actor = { id: actorId };

        // Setup entity with engaged mouth (mouth engagement component with locked: true)
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
              return { locked: true }; // Mouth is locked/engaged
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

        const result = prereqService.evaluate(
          action.prerequisites,
          action,
          actor
        );

        expect(result).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('FAILED')
        );
      });
    });
  });

  describe('Prerequisite Integration', () => {
    positioningActions.forEach(({ name, action }) => {
      it(`should properly resolve condition_ref for ${name} action`, () => {
        const actorId = 'test:actor';
        const actor = { id: actorId };

        // Setup basic entity
        mockEntityManager.getEntityInstance.mockReturnValue(actor);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === actorId && componentId === 'anatomy:body') {
              return { root: 'test:body_root' };
            }
            return undefined;
          }
        );
        mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
          'core:name',
          'anatomy:body',
        ]);

        // Setup bodyGraphService for custom operators - no mouth parts
        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            return []; // No mouth parts
          }
        );
        mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {});

        // Find the mouth availability prerequisite
        const mouthPrerequisite = action.prerequisites.find(
          (prereq) =>
            prereq.logic &&
            prereq.logic.condition_ref === 'core:actor-mouth-available'
        );

        expect(mouthPrerequisite).toBeDefined();

        const result = prereqService.evaluate(
          [mouthPrerequisite],
          action,
          actor
        );

        expect(result).toBe(true);
        expect(
          mockGameDataRepository.getConditionDefinition
        ).toHaveBeenCalledWith('core:actor-mouth-available');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle condition definition not found gracefully', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };

      // Setup basic entity
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      // Mock condition not found
      mockGameDataRepository.getConditionDefinition.mockReturnValue(undefined);

      const prerequisites = [
        {
          logic: {
            condition_ref: 'core:actor-mouth-available',
          },
          failure_message: 'You cannot do that while your mouth is engaged.',
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        { id: 'test:action' },
        actor
      );

      // Should handle gracefully - this depends on implementation
      expect(
        mockGameDataRepository.getConditionDefinition
      ).toHaveBeenCalledWith('core:actor-mouth-available');
    });
  });

  describe('Action Structure Validation', () => {
    positioningActions.forEach(({ name, action }) => {
      it(`should have valid prerequisite structure in ${name} action`, () => {
        const mouthPrerequisite = action.prerequisites.find(
          (prereq) =>
            prereq.logic &&
            prereq.logic.condition_ref === 'core:actor-mouth-available'
        );

        expect(mouthPrerequisite).toBeDefined();
        expect(mouthPrerequisite.logic.condition_ref).toBe(
          'core:actor-mouth-available'
        );
        expect(mouthPrerequisite.failure_message).toBe(
          'You cannot do that while your mouth is engaged.'
        );
      });
    });
  });
});
