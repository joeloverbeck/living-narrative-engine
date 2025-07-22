/**
 * @file Integration tests for clothing-specific scope resolution
 * @description Tests that the close_actors_facing_forward_with_torso_clothing scope
 * properly filters actors based on closeness, facing direction, and clothing requirements
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const clothingScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/intimacy/scopes/close_actors_facing_forward_with_torso_clothing.scope'
  ),
  'utf8'
);

// Import actual action files
import adjustClothingAction from '../../../data/mods/intimacy/actions/adjust_clothing.action.json';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Clothing-Specific Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);

    // Mock body graph service for custom operators
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the clothing-specific scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      clothingScopeContent,
      'close_actors_facing_forward_with_torso_clothing.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'intimacy:close_actors_facing_forward_with_torso_clothing':
        scopeDefinitions.get(
          'intimacy:close_actors_facing_forward_with_torso_clothing'
        ),
    });

    scopeEngine = new ScopeEngine({
      logger,
      scopeRegistry,
      entityManager,
      jsonLogicEvaluationService: jsonLogicEval,
    });

    const validatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      logger,
      scopeEngine,
      entityManager,
      scopeRegistry,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
      dslParser: new DefaultDslParser({ logger }),
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

    // Create prerequisite service mock
    const prerequisiteEvaluationService = {
      evaluate: jest.fn((_p1, _p2, _p3, _p4) => true),
    };

    // Create the ActionPipelineOrchestrator
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest
          .fn()
          .mockImplementation(() => [adjustClothingAction]),
      },
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new ActionCommandFormatter(),
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
    });

    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });

    // Register the adjust_clothing action
    dataRegistry.store(
      'actions',
      adjustClothingAction.id,
      adjustClothingAction
    );

    // Register the condition used by the scope
    dataRegistry.store('conditions', 'intimacy:both-actors-facing-each-other', {
      id: 'intimacy:both-actors-facing-each-other',
      description: 'Checks if both actors are facing each other (neither is facing away from the other).',
      logic: {
        and: [
          {
            not: {
              in: [
                { var: 'entity.id' },
                { var: 'actor.components.intimacy:closeness.facing_away_from' },
              ],
            },
          },
          {
            not: {
              in: [
                { var: 'actor.id' },
                { var: 'entity.components.intimacy:closeness.facing_away_from' },
              ],
            },
          },
        ],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to create actor with closeness relationship
   *
   * @param actorId
   * @param partnerId
   * @param facingAway
   */
  function createActorWithCloseness(actorId, partnerId, facingAway = false) {
    const closenessData = {
      partners: [partnerId],
      facing_away_from: facingAway ? [partnerId] : [],
    };

    entityManager.addComponent(actorId, 'intimacy:closeness', closenessData);

    return actorId;
  }

  /**
   * Helper function to create target with or without clothing
   *
   * @param targetId
   * @param hasClothing
   * @param hasEquipmentComponent
   */
  function createTargetWithClothing(
    targetId,
    hasClothing = true,
    hasEquipmentComponent = true
  ) {
    if (hasEquipmentComponent) {
      const equipmentData = hasClothing
        ? {
            equipped: {
              torso_upper: {
                base: ['shirt123'],
              },
            },
          }
        : {
            equipped: {
              torso_lower: {
                base: ['pants456'],
              },
            },
          };

      entityManager.addComponent(targetId, 'clothing:equipment', equipmentData);
    }

    return targetId;
  }

  describe('adjust_clothing action scope resolution', () => {
    it('should include actors with torso_upper clothing who are facing forward', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing('target1', true, true);

      // Mock condition evaluation for facing direction
      const originalEvaluate = jsonLogicEval.evaluate;
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return true; // Both actors are facing each other
        }
        return originalEvaluate.call(jsonLogicEval, logic, context);
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(1);
      expect(adjustClothingActions[0].params.targetId).toBe(targetId);
    });

    it('should exclude actors without clothing:equipment component', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing('target1', true, false); // No equipment component

      // Mock condition evaluation for facing direction
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return false; // Not both facing each other
        }
        return false;
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors with clothing in other slots but not torso_upper', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', false);
      const targetId = createTargetWithClothing('target1', false, true); // Has equipment but not torso_upper

      // Mock condition evaluation for facing direction
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return false; // Not both facing each other
        }
        return false;
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors facing away even with torso_upper clothing', async () => {
      // Arrange
      const actorId = createActorWithCloseness('actor1', 'target1', true); // Target is facing away
      const targetId = createTargetWithClothing('target1', true, true);

      // Mock condition evaluation for facing direction
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return false; // Target is facing away
        }
        return false;
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should exclude actors not in closeness relationship', async () => {
      // Arrange
      entityManager.addComponent('actor1', 'intimacy:closeness', {
        partners: [], // No partners
        facing_away_from: [],
      });

      const targetId = createTargetWithClothing('target1', true, true);

      // Act
      const actorEntity = entityManager.getEntityInstance('actor1');
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should include multiple valid targets when conditions are met', async () => {
      // Arrange
      entityManager.addComponent('actor1', 'intimacy:closeness', {
        partners: ['target1', 'target2'],
        facing_away_from: [],
      });
      const actorId = 'actor1';

      const target1Id = createTargetWithClothing('target1', true, true);
      const target2Id = createTargetWithClothing('target2', true, true);

      // Mock condition evaluation for facing direction
      const originalEvaluate = jsonLogicEval.evaluate;
      jsonLogicEval.evaluate = jest.fn((logic, context) => {
        if (logic?.condition_ref === 'intimacy:both-actors-facing-each-other') {
          return true; // Both targets are facing forward
        }
        // For other logic (like hasClothingInSlot), use the original evaluator
        return originalEvaluate.call(jsonLogicEval, logic, context);
      });

      // Act
      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      // Assert
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'intimacy:adjust_clothing'
      );

      expect(adjustClothingActions).toHaveLength(2);
      const targetIds = adjustClothingActions.map(
        (action) => action.params.targetId
      );
      expect(targetIds).toContain(target1Id);
      expect(targetIds).toContain(target2Id);
    });
  });
});
