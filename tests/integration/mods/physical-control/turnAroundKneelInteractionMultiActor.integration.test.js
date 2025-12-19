/**
 * @file Integration test for turn around and kneel before interaction with multiple actors
 *
 * This test is separated from the main test suite because it needs to run in isolation
 * due to dynamic entity creation affecting scope resolution when run with other tests.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { ActionDiscoveryService } from '../../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';
import ActionCommandFormatter from '../../../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../../../src/utils/entityUtils.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../../common/mocks/mockTargetContextBuilder.js';
import { createMultiTargetResolutionStage } from '../../../common/actions/multiTargetStageTestUtilities.js';
import { ScopeContextBuilder } from '../../../../src/actions/pipeline/services/implementations/ScopeContextBuilder.js';
import turnAroundAction from '../../../../data/mods/physical-control/actions/turn_around.action.json';
import kneelBeforeAction from '../../../../data/mods/deference/actions/kneel_before.action.json';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../../common/mocks/mockUnifiedScopeResolver.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import DefaultDslParser from '../../../../src/scopeDsl/parser/defaultDslParser.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';

describe('Turn Around and Kneel Before Interaction - Multiple Actors', () => {
  let entityManager;
  let actionDiscoveryService;
  let actionPipelineOrchestrator;
  let eventBus;
  let actor1;
  let actor2;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let targetResolutionService;
  let gameDataRepository;
  let actionIndex;
  let safeEventDispatcher;

  beforeEach(async () => {
    // Set up logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Set up entity manager
    entityManager = new SimpleEntityManager([], logger);

    // Set up scope registry and engine
    scopeRegistry = new ScopeRegistry();

    // Load necessary scope files
    const scopePaths = [
      'data/mods/core/scopes/actors_in_location.scope',
      'data/mods/positioning/scopes/actors_in_location_facing.scope',
      'data/mods/personal-space/scopes/close_actors_facing_each_other_or_behind_target.scope',
    ];

    const parsedScopes = [];
    for (const scopePath of scopePaths) {
      const fullPath = path.join(process.cwd(), scopePath);
      if (fs.existsSync(fullPath)) {
        const scopeContent = fs.readFileSync(fullPath, 'utf-8');
        const scopes = parseScopeDefinitions(scopeContent, fullPath);
        parsedScopes.push(...scopes);
      }
    }

    // Register scopes
    scopeRegistry.initialize(Object.fromEntries(parsedScopes));

    scopeEngine = new ScopeEngine({ scopeRegistry });

    // Set up action discovery dependencies
    const dataRegistry = new InMemoryDataRegistry();

    // Store the action definitions in the data registry
    dataRegistry.store('actions', turnAroundAction.id, turnAroundAction);
    dataRegistry.store('actions', kneelBeforeAction.id, kneelBeforeAction);

    // Load necessary condition files
    const conditionPaths = [
      'data/mods/core/conditions/entity-at-location.condition.json',
      'data/mods/core/conditions/entity-is-not-current-actor.condition.json',
      'data/mods/core/conditions/entity-has-actor-component.condition.json',
      'data/mods/core/conditions/actor-mouth-available.condition.json',
      'data/mods/positioning/conditions/entity-in-facing-away.condition.json',
      'data/mods/positioning/conditions/both-actors-facing-each-other.condition.json',
      'data/mods/positioning/conditions/actor-is-behind-entity.condition.json',
    ];

    for (const conditionPath of conditionPaths) {
      const fullPath = path.join(process.cwd(), conditionPath);
      if (fs.existsSync(fullPath)) {
        const conditionContent = fs.readFileSync(fullPath, 'utf-8');
        const condition = JSON.parse(conditionContent);
        dataRegistry.store('conditions', condition.id, condition);
      }
    }

    gameDataRepository = new GameDataRepository(dataRegistry, logger);

    // Set up dslParser and other dependencies
    const dslParser = new DefaultDslParser();
    const jsonLogicService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    // Register custom operators for anatomy-related conditions
    // Create a mock bodyGraphService (required dependency)
    const mockBodyGraphService = {
      getPartsOfType: jest.fn().mockReturnValue([]),
      getBodyPart: jest.fn().mockReturnValue(null),
      hasPartWithComponentValue: jest.fn().mockReturnValue(false),
      findPartsByType: jest.fn().mockReturnValue([]),
      buildAdjacencyCache: jest.fn(),
      clearCache: jest.fn(),
      getAllParts: jest.fn().mockReturnValue([]),
    };

    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    const customOperators = new JsonLogicCustomOperators({
      entityManager,
      bodyGraphService: mockBodyGraphService,
      logger,
      lightingStateService: mockLightingStateService,
    });
    customOperators.registerOperators(jsonLogicService);
    const actionErrorContextBuilder = createMockActionErrorContextBuilder();

    // Create mock validatedEventDispatcher for SafeEventDispatcher
    const validatedEventDispatcher = {
      dispatch: jest.fn().mockImplementation((event) => {
        logger.info(`Event dispatched: ${event.type}`);
        return Promise.resolve();
      }),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    safeEventDispatcher = new SafeEventDispatcher({
      logger,
      validatedEventDispatcher,
    });

    // Create mock UnifiedScopeResolver with needed dependencies
    const unifiedScopeResolver = createMockUnifiedScopeResolver({
      scopeRegistry,
      scopeEngine,
      entityManager,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicService,
      dslParser,
      actionErrorContextBuilder,
    });

    // Create real TargetResolutionService with mock UnifiedScopeResolver
    targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      entityManager,
      logger,
      serviceSetup: null,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicService,
      dslParser,
      actionErrorContextBuilder,
    });

    // Create ActionValidationContextBuilder with all required parameters
    const actionValidationContextBuilder = new ActionValidationContextBuilder({
      actionErrorContextBuilder,
      logger,
      entityManager,
    });

    // Create prerequisite evaluation service
    const prerequisiteEvaluationService = new PrerequisiteEvaluationService({
      conditionEvaluator: jsonLogicService,
      jsonLogicEvaluationService: jsonLogicService,
      gameDataRepository,
      logger,
      entityManager,
      actionValidationContextBuilder,
    });

    // Create target context builder (required dependency)
    const targetContextBuilder = createMockTargetContextBuilder();

    // Create scope context builder
    const scopeContextBuilder = new ScopeContextBuilder({
      entityManager,
      logger,
      targetContextBuilder,
    });

    // Create multi-target resolution stage with all dependencies
    const multiTargetResolutionStage = createMultiTargetResolutionStage({
      logger,
      dataRegistry,
      entityManager,
      scopeRegistry,
      scopeEngine,
      jsonLogicService,
      dslParser,
      scopeContextBuilder,
      unifiedScopeResolver,
    });

    // Create action index and build it first
    actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex([turnAroundAction, kneelBeforeAction]);

    // Create action command formatter
    const actionFormatter = new ActionCommandFormatter({
      getEntityDisplayName,
    });

    // Create mock TargetComponentValidator
    const mockTargetComponentValidator = {
      validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
      validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
    };

    // Create mock TargetRequiredComponentsValidator
    const mockTargetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();

    // Create the action pipeline orchestrator
    actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex,
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: actionFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: actionErrorContextBuilder,
      logger,
      unifiedScopeResolver,
      targetContextBuilder: targetContextBuilder,
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
      multiTargetResolutionStage,
    });

    // Create mock traceContextFactory
    const traceContextFactory = jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    });

    // Create action discovery service
    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      actionIndex,
      traceContextFactory,
    });

    // Create location entity
    const location = entityManager.createEntity('test:location1');
    entityManager.addComponent('test:location1', NAME_COMPONENT_ID, {
      name: 'Test Location',
    });
    entityManager.addComponent('test:location1', 'core:location', {});

    // Set up entities
    actor1 = entityManager.createEntity('test:actor1');
    entityManager.addComponent('test:actor1', NAME_COMPONENT_ID, {
      name: 'Actor 1',
    });
    entityManager.addComponent('test:actor1', POSITION_COMPONENT_ID, {
      locationId: 'test:location1',
    });
    entityManager.addComponent('test:actor1', 'core:actor', {});
    entityManager.addComponent('test:actor1', 'personal-space-states:closeness', {
      partners: ['test:actor2'],
    });

    actor2 = entityManager.createEntity('test:actor2');
    entityManager.addComponent('test:actor2', NAME_COMPONENT_ID, {
      name: 'Actor 2',
    });
    entityManager.addComponent('test:actor2', POSITION_COMPONENT_ID, {
      locationId: 'test:location1',
    });
    entityManager.addComponent('test:actor2', 'core:actor', {});
    entityManager.addComponent('test:actor2', 'personal-space-states:closeness', {
      partners: ['test:actor1'],
    });

    // Set up event bus
    eventBus = {
      dispatch: jest.fn().mockImplementation(async (event) => {
        if (event.type === ATTEMPT_ACTION_ID) {
          const { actionId, actorId, targetId } = event.payload;
          logger.info(
            `Attempting action: ${actionId} from ${actorId} to ${targetId}`
          );

          // Simulate the turn_around action
          if (actionId === 'physical-control:turn_around') {
            const targetEntity = entityManager.getEntityInstance(targetId);
            const facingAwayComponent =
              targetEntity.components['positioning:facing_away'];

            if (
              !facingAwayComponent ||
              !facingAwayComponent.facing_away_from?.includes(actorId)
            ) {
              // Not currently facing away, so turn them around (add component)
              entityManager.addComponent(
                targetEntity.id,
                'positioning:facing_away',
                {
                  facing_away_from: [actorId],
                }
              );
            } else {
              // Currently facing away, toggle to face (remove from list)
              const updatedList = facingAwayComponent.facing_away_from.filter(
                (id) => id !== actorId
              );
              if (updatedList.length > 0) {
                entityManager.addComponent(
                  targetEntity.id,
                  'positioning:facing_away',
                  {
                    facing_away_from: updatedList,
                  }
                );
              } else {
                entityManager.removeComponent(
                  targetEntity.id,
                  'positioning:facing_away'
                );
              }
            }
          }
        }
        return Promise.resolve();
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should correctly handle multiple actors with mixed facing states', async () => {
    // Add a third actor
    const actor3 = entityManager.createEntity('test:actor3');
    entityManager.addComponent('test:actor3', NAME_COMPONENT_ID, {
      name: 'Actor 3',
    });
    entityManager.addComponent('test:actor3', POSITION_COMPONENT_ID, {
      locationId: 'test:location1',
    });
    entityManager.addComponent('test:actor3', 'core:actor', {});
    entityManager.addComponent('test:actor3', 'personal-space-states:closeness', {
      partners: ['test:actor1', 'test:actor2'],
    });

    // Actor1 turns actor2 around (actor2 facing away from actor1)
    await eventBus.dispatch({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'physical-control:turn_around',
        actorId: 'test:actor1',
        targetId: 'test:actor2',
      },
    });

    // Verify actor2 is facing away from actor1
    const actor2AfterTurn = entityManager.getEntityInstance('test:actor2');
    expect(actor2AfterTurn.components['positioning:facing_away']).toEqual({
      facing_away_from: ['test:actor1'],
    });

    // Discover available actions for actor2 (who is facing away from actor1 but not actor3)
    const actor2Entity = entityManager.getEntityInstance('test:actor2');
    const discoveryResult =
      await actionDiscoveryService.getValidActions(actor2Entity);
    const availableActions = discoveryResult.actions || [];

    // Find all kneel_before actions
    const kneelActions = availableActions.filter(
      (a) => a.id === 'deference:kneel_before'
    );

    // Actor2 should be able to kneel before actor3 but NOT actor1
    const kneelToActor1 = kneelActions.find(
      (a) => a.params?.targetId === 'test:actor1'
    );
    const kneelToActor3 = kneelActions.find(
      (a) => a.params?.targetId === 'test:actor3'
    );

    // Should NOT be able to kneel before actor1 (facing away)
    expect(kneelToActor1).toBeUndefined();

    // Should be able to kneel before actor3 (not facing away)
    expect(kneelToActor3).toBeDefined();
    if (kneelToActor3) {
      expect(kneelToActor3.params.targetId).toBe('test:actor3');
    }
  });
});
