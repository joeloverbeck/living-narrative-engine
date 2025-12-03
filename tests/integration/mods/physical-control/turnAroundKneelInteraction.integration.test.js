/**
 * @file Integration test for turn around and kneel before interaction
 * @description Tests that kneeling is not available when facing away and becomes available after turning to face
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

describe('Turn around and kneel before interaction', () => {
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
      'data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope',
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

    const customOperators = new JsonLogicCustomOperators({
      entityManager,
      bodyGraphService: mockBodyGraphService,
      logger,
    });
    customOperators.registerOperators(jsonLogicService);
    const actionErrorContextBuilder = createMockActionErrorContextBuilder();

    // Create mock validatedEventDispatcher for SafeEventDispatcher
    const validatedEventDispatcher = {
      dispatch: jest.fn((event) => {
        // Handle turn_around action
        if (
          event.type === ATTEMPT_ACTION_ID &&
          event.payload.actionId === 'physical-control:turn_around'
        ) {
          const target = entityManager.getEntityInstance(
            event.payload.targetId
          );
          const actor = entityManager.getEntityInstance(event.payload.actorId);

          if (target) {
            const facingAwayComponent =
              target.components['positioning:facing_away'];
            if (facingAwayComponent?.facing_away_from?.includes(actor.id)) {
              // Target is already facing away from actor, turn back to face
              const updatedList = facingAwayComponent.facing_away_from.filter(
                (id) => id !== actor.id
              );
              if (updatedList.length === 0) {
                // Remove component if empty
                entityManager.removeComponent(
                  target.id,
                  'positioning:facing_away'
                );
              } else {
                entityManager.addComponent(
                  target.id,
                  'positioning:facing_away',
                  {
                    facing_away_from: updatedList,
                  }
                );
              }
            } else {
              // Turn target around to face away from actor
              const currentList = facingAwayComponent?.facing_away_from || [];
              entityManager.addComponent(target.id, 'positioning:facing_away', {
                facing_away_from: [...currentList, actor.id],
              });
            }
          }
        }
        return Promise.resolve();
      }),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    eventBus = validatedEventDispatcher;

    // Set up target resolution service
    targetResolutionService = createTargetResolutionServiceWithMocks({
      entityManager,
      scopeEngine,
      scopeRegistry,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicService,
      dslParser,
      actionErrorContextBuilder,
    });

    // Create real prerequisiteEvaluationService
    const actionValidationContextBuilder = new ActionValidationContextBuilder({
      entityManager,
      logger,
    });

    const prereqService = new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder,
      gameDataRepository,
    });

    actionIndex = new ActionIndex({ logger, entityManager });

    // Build index with the loaded actions - kneel_before needs to be in the index
    const allActions = [turnAroundAction, kneelBeforeAction];
    actionIndex.buildIndex(allActions);

    const actionCommandFormatter = new ActionCommandFormatter({ logger });

    // Create mock TargetComponentValidator
    const mockTargetComponentValidator = {
      validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
      validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
    };

    // Create mock TargetRequiredComponentsValidator
    const mockTargetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();

    actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex,
      prerequisiteService: prereqService,
      entityManager,
      targetService: targetResolutionService,
      formatter: actionCommandFormatter,
      logger,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: actionErrorContextBuilder,
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        scopeEngine,
        entityManager,
        logger,
        jsonLogicEvaluationService: jsonLogicService,
        gameDataRepository,
        dslParser,
        actionErrorContextBuilder,
      }),
      targetContextBuilder: createMockTargetContextBuilder(),
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
      multiTargetResolutionStage: (() => {
        const mockTargetContextBuilder =
          createMockTargetContextBuilder(entityManager);
        const mockScopeContextBuilder = new ScopeContextBuilder({
          targetContextBuilder: mockTargetContextBuilder,
          entityManager,
          logger,
        });

        return createMultiTargetResolutionStage({
          entityManager,
          targetResolver: targetResolutionService,
          unifiedScopeResolver: createMockUnifiedScopeResolver({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            jsonLogicEvaluationService: jsonLogicService,
            gameDataRepository,
            dslParser,
            actionErrorContextBuilder,
          }),
          logger,
          overrides: {
            targetContextBuilder: mockTargetContextBuilder,
            scopeContextBuilder: mockScopeContextBuilder,
          },
        });
      })(),
    });

    // Create mock traceContextFactory as a function
    const traceContextFactory = jest.fn(() => ({
      addStep: jest.fn(),
      toJSON: jest.fn(() => ({})),
      info: jest.fn(),
      step: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      debug: jest.fn(),
      addLog: jest.fn(),
    }));

    // Create ActionDiscoveryService
    actionDiscoveryService = new ActionDiscoveryService({
      actionPipelineOrchestrator,
      entityManager,
      traceContextFactory,
      logger,
    });

    // Create test location
    const location1 = {
      id: 'test:location1',
      components: {
        [NAME_COMPONENT_ID]: { name: 'Test Location' },
      },
    };

    // Add location to entity manager
    entityManager.addComponent(
      location1.id,
      NAME_COMPONENT_ID,
      location1.components[NAME_COMPONENT_ID]
    );

    // Create test actors
    actor1 = {
      id: 'test:actor1',
      components: {
        [NAME_COMPONENT_ID]: { name: 'Actor 1' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
        'core:actor': {},
        'positioning:closeness': { partners: ['test:actor2', 'test:actor3'] },
      },
    };

    actor2 = {
      id: 'test:actor2',
      components: {
        [NAME_COMPONENT_ID]: { name: 'Actor 2' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
        'core:actor': {},
        'positioning:closeness': { partners: ['test:actor1', 'test:actor3'] },
      },
    };

    entityManager.addComponent(
      actor1.id,
      NAME_COMPONENT_ID,
      actor1.components[NAME_COMPONENT_ID]
    );
    entityManager.addComponent(
      actor1.id,
      POSITION_COMPONENT_ID,
      actor1.components[POSITION_COMPONENT_ID]
    );
    entityManager.addComponent(
      actor1.id,
      'core:actor',
      actor1.components['core:actor']
    );
    entityManager.addComponent(
      actor1.id,
      'positioning:closeness',
      actor1.components['positioning:closeness']
    );

    entityManager.addComponent(
      actor2.id,
      NAME_COMPONENT_ID,
      actor2.components[NAME_COMPONENT_ID]
    );
    entityManager.addComponent(
      actor2.id,
      POSITION_COMPONENT_ID,
      actor2.components[POSITION_COMPONENT_ID]
    );
    entityManager.addComponent(
      actor2.id,
      'core:actor',
      actor2.components['core:actor']
    );
    entityManager.addComponent(
      actor2.id,
      'positioning:closeness',
      actor2.components['positioning:closeness']
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not allow kneeling before an actor when facing away', async () => {
    // 1. Actor1 turns actor2 around (actor2 now facing away from actor1)
    await eventBus.dispatch({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'physical-control:turn_around',
        actorId: 'test:actor1',
        targetId: 'test:actor2',
      },
    });

    // 2. Verify actor2 has facing_away component (actor2 is facing away from actor1)
    const actor2AfterTurn = entityManager.getEntityInstance('test:actor2');
    expect(actor2AfterTurn.components['positioning:facing_away']).toEqual({
      facing_away_from: ['test:actor1'],
    });

    // 3. Discover available actions for actor2 (who is facing away from actor1)
    const actor2Entity = entityManager.getEntityInstance('test:actor2');
    const discoveryResult =
      await actionDiscoveryService.getValidActions(actor2Entity);
    const availableActions = discoveryResult.actions || [];

    // 4. Verify kneel_before is NOT available for actor1 (actor2 is facing away from actor1)
    // The action might exist for other targets, but actor1 should not be a valid target
    const kneelActionsForActor1 = availableActions.filter(
      (a) =>
        a.id === 'deference:kneel_before' &&
        a.params?.targetId === 'test:actor1'
    );

    // Actor2 should NOT be able to kneel before actor1 when facing away
    expect(kneelActionsForActor1).toHaveLength(0);
  });

  it('should allow kneeling after turning back to face', async () => {
    // 1. Actor1 turns actor2 around (actor2 facing away from actor1)
    await eventBus.dispatch({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'physical-control:turn_around',
        actorId: 'test:actor1',
        targetId: 'test:actor2',
      },
    });

    // Verify actor2 is facing away
    let actor2Current = entityManager.getEntityInstance('test:actor2');
    expect(actor2Current.components['positioning:facing_away']).toEqual({
      facing_away_from: ['test:actor1'],
    });

    // 2. Actor1 turns actor2 back to face them (toggle behavior)
    await eventBus.dispatch({
      type: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'physical-control:turn_around',
        actorId: 'test:actor1',
        targetId: 'test:actor2',
      },
    });

    // 3. Verify actor2 no longer has facing_away component (or actor1 not in the list)
    actor2Current = entityManager.getEntityInstance('test:actor2');
    const facingAwayComponent =
      actor2Current.components['positioning:facing_away'];

    expect(
      !facingAwayComponent ||
        !facingAwayComponent.facing_away_from?.includes('test:actor1')
    ).toBe(true);

    // 4. Discover available actions for actor2 (who is now facing actor1)
    const actor2Entity = entityManager.getEntityInstance('test:actor2');

    const discoveryResult =
      await actionDiscoveryService.getValidActions(actor2Entity);

    const availableActions = discoveryResult.actions || [];

    // 5. Verify kneel_before IS available for actor1
    const kneelActionsForActor1 = availableActions.filter(
      (a) =>
        a.id === 'deference:kneel_before' &&
        a.params?.targetId === 'test:actor1'
    );

    // Actor2 should be able to kneel before actor1 when facing them
    expect(kneelActionsForActor1).toHaveLength(1);
    expect(kneelActionsForActor1[0].params.targetId).toBe('test:actor1');
  });
});
