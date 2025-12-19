/**
 * @jest-environment node
 * @file Integration tests for violence:peck_target action prerequisites
 * @description Tests that the action correctly requires actor to have a beak
 *
 * Tests the prerequisite `violence:actor-has-beak` which uses
 * the hasPartSubTypeContaining custom JSON Logic operator.
 * @see data/mods/violence/actions/peck_target.action.json
 * @see data/mods/violence/conditions/actor-has-beak.condition.json
 * @see tickets/BEAATTCAP-004-create-peck-target-action-and-condition.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import peckTargetAction from '../../../../data/mods/violence/actions/peck_target.action.json';
import actorHasBeakCondition from '../../../../data/mods/violence/conditions/actor-has-beak.condition.json';

describe('violence:peck_target prerequisites', () => {
  let prerequisiteService;
  let jsonLogicService;
  let customOperators;
  let contextBuilder;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
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
      getCacheNode: jest.fn(),
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
        if (conditionId === 'violence:actor-has-beak') {
          return actorHasBeakCondition;
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

    // Register custom operators (includes hasPartSubTypeContaining)
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
      expect(peckTargetAction.prerequisites).toBeDefined();
      expect(Array.isArray(peckTargetAction.prerequisites)).toBe(true);
    });

    test('should reference violence:actor-has-beak condition', () => {
      expect(peckTargetAction.prerequisites.length).toBeGreaterThan(0);
      const prerequisite = peckTargetAction.prerequisites[0];
      expect(prerequisite.logic).toBeDefined();
      expect(prerequisite.logic.condition_ref).toBe('violence:actor-has-beak');
    });

    test('should have failure_message for user feedback', () => {
      const prerequisite = peckTargetAction.prerequisites[0];
      expect(prerequisite.failure_message).toBeDefined();
      expect(typeof prerequisite.failure_message).toBe('string');
      expect(prerequisite.failure_message.length).toBeGreaterThan(0);
      expect(prerequisite.failure_message).toBe('You need a beak to peck.');
    });

    test('should preserve action metadata', () => {
      expect(peckTargetAction.id).toBe('violence:peck_target');
      expect(peckTargetAction.name).toBe('Peck Target');
      expect(peckTargetAction.description).toBe(
        'Peck at a target with your beak'
      );
    });

    test('should have multi-target configuration', () => {
      expect(peckTargetAction.targets).toBeDefined();
      expect(peckTargetAction.targets.primary).toBeDefined();
      expect(peckTargetAction.targets.secondary).toBeDefined();
    });

    test('should use actor_beak_body_parts scope for primary target', () => {
      expect(peckTargetAction.targets.primary.scope).toBe(
        'violence:actor_beak_body_parts'
      );
      expect(peckTargetAction.targets.primary.placeholder).toBe('weapon');
    });

    test('should use actors_in_location scope for secondary target', () => {
      expect(peckTargetAction.targets.secondary.scope).toBe(
        'core:actors_in_location'
      );
      expect(peckTargetAction.targets.secondary.placeholder).toBe('target');
    });

    test('should require damage_capabilities on primary target', () => {
      expect(peckTargetAction.required_components).toBeDefined();
      expect(peckTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    test('should forbid dead secondary targets', () => {
      expect(peckTargetAction.forbidden_components).toBeDefined();
      expect(peckTargetAction.forbidden_components.secondary).toContain(
        'core:dead'
      );
    });

    test('should have forbidden actor states for combat', () => {
      expect(peckTargetAction.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
      expect(peckTargetAction.forbidden_components.actor).toContain(
        'positioning:being_restrained'
      );
      expect(peckTargetAction.forbidden_components.actor).toContain(
        'positioning:fallen'
      );
    });

    test('should use violence mod visual styling', () => {
      expect(peckTargetAction.visual).toBeDefined();
      expect(peckTargetAction.visual.backgroundColor).toBe('#8b0000');
      expect(peckTargetAction.visual.textColor).toBe('#ffffff');
    });

    test('should have chance-based configuration', () => {
      expect(peckTargetAction.chanceBased).toBeDefined();
      expect(peckTargetAction.chanceBased.enabled).toBe(true);
      expect(peckTargetAction.chanceBased.contestType).toBe('opposed');
    });

    test('should generate action combinations', () => {
      expect(peckTargetAction.generateCombinations).toBe(true);
    });
  });

  describe('prerequisite evaluation - pass cases', () => {
    test('should pass when actor has beak body part', () => {
      const actor = { id: 'bird123', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      // getAllParts returns entity IDs as strings
      mockBodyGraphService.getAllParts.mockReturnValue(['bird123_beak']);
      // getCacheNode returns cache node with partType
      mockBodyGraphService.getCacheNode.mockImplementation((partId) => {
        if (partId === 'bird123_beak') {
          return {
            entityId: partId,
            partType: 'beak',
            parentId: 'root123',
            children: [],
          };
        }
        return undefined;
      });

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has chicken_beak body part', () => {
      const actor = { id: 'chicken456', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      mockBodyGraphService.getAllParts.mockReturnValue(['chicken456_beak']);
      mockBodyGraphService.getCacheNode.mockImplementation((partId) => {
        if (partId === 'chicken456_beak') {
          return {
            entityId: partId,
            partType: 'chicken_beak',
            parentId: 'root123',
            children: [],
          };
        }
        return undefined;
      });

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has tortoise_beak body part', () => {
      const actor = { id: 'tortoise789', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      mockBodyGraphService.getAllParts.mockReturnValue(['tortoise789_beak']);
      mockBodyGraphService.getCacheNode.mockImplementation((partId) => {
        if (partId === 'tortoise789_beak') {
          return {
            entityId: partId,
            partType: 'tortoise_beak',
            parentId: 'root123',
            children: [],
          };
        }
        return undefined;
      });

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has multiple beaks', () => {
      const actor = { id: 'hydrabird999', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      mockBodyGraphService.getAllParts.mockReturnValue([
        'hydra_beak1',
        'hydra_beak2',
      ]);
      mockBodyGraphService.getCacheNode.mockImplementation((partId) => {
        if (partId === 'hydra_beak1') {
          return {
            entityId: partId,
            partType: 'beak',
            parentId: 'root123',
            children: [],
          };
        }
        if (partId === 'hydra_beak2') {
          return {
            entityId: partId,
            partType: 'chicken_beak',
            parentId: 'root123',
            children: [],
          };
        }
        return undefined;
      });

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(true);
    });
  });

  describe('prerequisite evaluation - fail cases', () => {
    test('should fail when actor has no beak body part', () => {
      const actor = { id: 'human123', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      mockBodyGraphService.getAllParts.mockReturnValue([
        'human_head',
        'human_torso',
        'human_arm',
      ]);
      mockBodyGraphService.getCacheNode.mockImplementation((partId) => {
        const partTypes = {
          human_head: 'head',
          human_torso: 'torso',
          human_arm: 'arm',
        };
        return partTypes[partId]
          ? {
              entityId: partId,
              partType: partTypes[partId],
              parentId: 'root123',
              children: [],
            }
          : undefined;
      });

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when actor has no body parts at all', () => {
      const actor = { id: 'ghost456', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      mockBodyGraphService.getAllParts.mockReturnValue([]);
      mockBodyGraphService.getCacheNode.mockReturnValue(undefined);

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should fail when actor has snout but not beak', () => {
      const actor = { id: 'dog789', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      mockBodyGraphService.getAllParts.mockReturnValue(['dog_snout']);
      mockBodyGraphService.getCacheNode.mockImplementation((partId) => {
        if (partId === 'dog_snout') {
          return {
            entityId: partId,
            partType: 'snout',
            parentId: 'root123',
            children: [],
          };
        }
        return undefined;
      });

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
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
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should handle actor with no anatomy:body component', () => {
      const actor = { id: 'ethereal111', components: {} };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(false);
    });

    test('should handle body parts with missing subType', () => {
      const actor = { id: 'broken222', components: {} };
      const bodyComponent = { root: 'root123' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(bodyComponent);
      mockBodyGraphService.getAllParts.mockReturnValue([
        { type: 'part' }, // No subType
        { subType: null }, // Null subType
      ]);

      const result = prerequisiteService.evaluate(
        peckTargetAction.prerequisites,
        peckTargetAction,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('condition definition validation', () => {
    test('should use hasPartSubTypeContaining operator with beak parameter', () => {
      expect(actorHasBeakCondition.logic).toEqual({
        hasPartSubTypeContaining: ['actor', 'beak'],
      });
    });

    test('condition ID should match what the action references', () => {
      expect(actorHasBeakCondition.id).toBe('violence:actor-has-beak');
    });

    test('condition should have description', () => {
      expect(actorHasBeakCondition.description).toBeDefined();
      expect(actorHasBeakCondition.description).toContain('beak');
    });
  });
});
