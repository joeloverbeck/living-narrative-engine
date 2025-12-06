/**
 * @file Integration tests for scope resolution using actual scope files and actions.
 * @description Tests that each scope file properly resolves entities for actual actions.
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
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import {
  LEADING_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import { extractTargetIds } from '../../common/actions/targetParamTestHelpers.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import {
  createMultiTargetResolutionStage,
  createActionPipelineOrchestrator,
} from '../../common/actions/multiTargetStageTestUtilities.js';

// Import actions
import dismissAction from '../../../data/mods/companionship/actions/dismiss.action.json';
import followAction from '../../../data/mods/companionship/actions/follow.action.json';
import goAction from '../../../data/mods/movement/actions/go.action.json';
import waitAction from '../../../data/mods/core/actions/wait.action.json';

// Unmock the real singleton to ensure the test and SUT use the same instance
jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let gameDataRepository;
  let safeEventDispatcher;
  let actionIndex;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    const followersScopeContent = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../data/mods/companionship/scopes/followers.scope'
      ),
      'utf8'
    );
    const environmentScopeContent = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../data/mods/core/scopes/environment.scope'
      ),
      'utf8'
    );
    const directionsScopeContent = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../data/mods/movement/scopes/clear_directions.scope'
      ),
      'utf8'
    );
    const potentialLeadersScopeContent = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../data/mods/companionship/scopes/potential_leaders.scope'
      ),
      'utf8'
    );

    const followerDefs = parseScopeDefinitions(
      followersScopeContent,
      'followers.scope'
    );
    const environmentDefs = parseScopeDefinitions(
      environmentScopeContent,
      'environment.scope'
    );
    const directionDefs = parseScopeDefinitions(
      directionsScopeContent,
      'clear_directions.scope'
    );
    const potentialLeadersDefs = parseScopeDefinitions(
      potentialLeadersScopeContent,
      'potential_leaders.scope'
    );

    scopeRegistry.initialize({
      'companionship:followers': followerDefs.get('companionship:followers'),
      'core:environment': environmentDefs.get('core:environment'),
      'movement:clear_directions': directionDefs.get(
        'movement:clear_directions'
      ),
      'companionship:potential_leaders': potentialLeadersDefs.get(
        'companionship:potential_leaders'
      ),
    });

    scopeEngine = new ScopeEngine();
    const registry = new InMemoryDataRegistry();
    registry.store('actions', dismissAction.id, dismissAction);
    registry.store('actions', followAction.id, followAction);
    registry.store('actions', goAction.id, goAction);
    registry.store('actions', waitAction.id, waitAction);
    registry.store('conditions', 'core:entity-at-location', {
      id: 'core:entity-at-location',
      logic: {
        '==': [
          { var: 'entity.components.core:position.locationId' },
          { var: 'location.id' },
        ],
      },
    });
    registry.store('conditions', 'core:entity-is-not-current-actor', {
      id: 'core:entity-is-not-current-actor',
      logic: { '!=': [{ var: 'entity.id' }, { var: 'actor.id' }] },
    });
    registry.store('conditions', 'core:entity-has-actor-component', {
      id: 'core:entity-has-actor-component',
      logic: { '!!': { var: 'entity.components.core:actor' } },
    });
    registry.store('conditions', 'companionship:entity-is-following-actor', {
      id: 'companionship:entity-is-following-actor',
      logic: {
        '==': [
          { var: 'entity.components.companionship:following.leaderId' },
          { var: 'actor.id' },
        ],
      },
    });
    registry.store('conditions', 'core:actor-is-not-rooted', {
      id: 'core:actor-is-not-rooted',
      logic: {
        hasBodyPartWithComponentValue: [
          'actor',
          'core:movement',
          'locked',
          false,
        ],
      },
    });
    registry.store('conditions', 'movement:exit-is-unblocked', {
      id: 'movement:exit-is-unblocked',
      logic: { '!': { var: 'entity.blocker' } },
    });

    gameDataRepository = new GameDataRepository(registry, logger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });
    // FIX: Create a valid mock for PrerequisiteEvaluationService
    const prerequisiteEvaluationService = {
      evaluate: jest.fn(() => true),
    };

    const validatedEventDispatcher = {
      dispatch: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
    };

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      entityManager,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
      dslParser: new DefaultDslParser(),
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

    // Create and build ActionIndex
    actionIndex = new ActionIndex({ logger, entityManager });
    const allActions = gameDataRepository.getAllActionDefinitions();
    actionIndex.buildIndex(allActions);

    // Create the ActionPipelineOrchestrator

    // Create mock TargetComponentValidator
    const mockTargetComponentValidator = {
      validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
      validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
    };

    // Create mock TargetRequiredComponentsValidator
    const mockTargetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();

    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex,
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new ActionCommandFormatter(),
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      }),
      targetContextBuilder: createMockTargetContextBuilder(entityManager),
      multiTargetResolutionStage: createMultiTargetResolutionStage({
        entityManager,
        logger,
        unifiedScopeResolver: createMockUnifiedScopeResolver({
          scopeRegistry,
          entityManager,
          logger,
        }),
        targetResolver: targetResolutionService,
      }),
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
    });

    // FIX: Add the new prerequisiteEvaluationService dependency to the constructor
    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('action discovery integration', () => {
    it('should discover dismiss action with followers scope', async () => {
      const actorId = 'actor1';
      const followerId = 'follower1';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [LEADING_COMPONENT_ID]: { followers: [followerId] },
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        { id: followerId, components: {} },
        { id: 'room1', components: {} },
      ];

      entityManager = new SimpleEntityManager(entities);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      // Need to recreate the ActionPipelineOrchestrator with updated dependencies
      // Create mock TargetComponentValidator
      const mockTargetComponentValidator = {
        validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
        validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
      };

      // Create mock TargetRequiredComponentsValidator
      const mockTargetRequiredComponentsValidator =
        createMockTargetRequiredComponentsValidator();

      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex,
        prerequisiteService: { evaluate: jest.fn(() => true) },
        targetService: createTargetResolutionServiceWithMocks({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        formatter: new ActionCommandFormatter(),
        entityManager,
        safeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        errorBuilder: createMockActionErrorContextBuilder(),
        logger,
        unifiedScopeResolver: createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        targetContextBuilder: createMockTargetContextBuilder(entityManager),
        multiTargetResolutionStage: createMultiTargetResolutionStage({
          entityManager,
          logger,
          unifiedScopeResolver: createMockUnifiedScopeResolver({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
          targetResolver: createTargetResolutionServiceWithMocks({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
        }),
        targetComponentValidator: mockTargetComponentValidator,
        targetRequiredComponentsValidator:
          mockTargetRequiredComponentsValidator,
      });

      actionDiscoveryService = new ActionDiscoveryService({
        entityManager,
        logger,
        actionPipelineOrchestrator,
        traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        jsonLogicEval,
        location: {
          id: entityManager
            .getEntityInstance(actorId)
            .getComponentData(POSITION_COMPONENT_ID)?.locationId,
        },
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );
      const dismissActions = result.actions.filter(
        (action) => action.id === 'companionship:dismiss'
      );
      expect(dismissActions.length).toBeGreaterThan(0);
      const targetIds = dismissActions.flatMap((action) =>
        extractTargetIds(action.params)
      );
      expect(targetIds).toContain(followerId);
    });

    it('should discover follow action with potential_leaders scope', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const room1Id = 'room1';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [ACTOR_COMPONENT_ID]: {},
            'anatomy:body': { rootEntityId: 'body-target1' },
          },
        },
        {
          id: 'body-target1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-target1',
          components: {
            'anatomy:part': { parentId: 'body-target1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-target1',
          components: {
            'anatomy:part': { parentId: 'body-target1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        { id: room1Id, components: {} },
      ];

      entityManager = new SimpleEntityManager(entities);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      // Need to recreate the ActionPipelineOrchestrator with updated dependencies
      // Create mock TargetComponentValidator
      const mockTargetComponentValidator = {
        validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
        validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
      };

      // Create mock TargetRequiredComponentsValidator
      const mockTargetRequiredComponentsValidator =
        createMockTargetRequiredComponentsValidator();

      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex,
        prerequisiteService: { evaluate: jest.fn(() => true) },
        targetService: createTargetResolutionServiceWithMocks({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        formatter: new ActionCommandFormatter(),
        entityManager,
        safeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        errorBuilder: createMockActionErrorContextBuilder(),
        logger,
        unifiedScopeResolver: createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        targetContextBuilder: createMockTargetContextBuilder(entityManager),
        multiTargetResolutionStage: createMultiTargetResolutionStage({
          entityManager,
          logger,
          unifiedScopeResolver: createMockUnifiedScopeResolver({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
          targetResolver: createTargetResolutionServiceWithMocks({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
        }),
        targetComponentValidator: mockTargetComponentValidator,
        targetRequiredComponentsValidator:
          mockTargetRequiredComponentsValidator,
      });

      actionDiscoveryService = new ActionDiscoveryService({
        entityManager,
        logger,
        actionPipelineOrchestrator,
        traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        jsonLogicEval,
        location: {
          id: entityManager
            .getEntityInstance(actorId)
            .getComponentData(POSITION_COMPONENT_ID)?.locationId,
        },
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );
      const followActions = result.actions.filter(
        (action) => action.id === 'companionship:follow'
      );
      expect(followActions.length).toBeGreaterThan(0);
      const targetIds = followActions.flatMap((action) =>
        extractTargetIds(action.params)
      );
      expect(targetIds).toContain(targetId);
    });

    it('should discover go action with clear_directions scope', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';
      const room2Id = 'room2';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: room1Id,
          components: {
            [EXITS_COMPONENT_ID]: [{ direction: 'north', target: room2Id }],
          },
        },
        { id: room2Id, components: {} },
      ];

      entityManager = new SimpleEntityManager(entities);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      // Need to recreate the ActionPipelineOrchestrator with updated dependencies
      // Create mock TargetComponentValidator
      const mockTargetComponentValidator = {
        validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
        validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
      };

      // Create mock TargetRequiredComponentsValidator
      const mockTargetRequiredComponentsValidator =
        createMockTargetRequiredComponentsValidator();

      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex,
        prerequisiteService: { evaluate: jest.fn(() => true) },
        targetService: createTargetResolutionServiceWithMocks({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        formatter: new ActionCommandFormatter(),
        entityManager,
        safeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        errorBuilder: createMockActionErrorContextBuilder(),
        logger,
        unifiedScopeResolver: createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        targetContextBuilder: createMockTargetContextBuilder(entityManager),
        multiTargetResolutionStage: createMultiTargetResolutionStage({
          entityManager,
          logger,
          unifiedScopeResolver: createMockUnifiedScopeResolver({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
          targetResolver: createTargetResolutionServiceWithMocks({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
        }),
        targetComponentValidator: mockTargetComponentValidator,
        targetRequiredComponentsValidator:
          mockTargetRequiredComponentsValidator,
      });

      actionDiscoveryService = new ActionDiscoveryService({
        entityManager,
        logger,
        actionPipelineOrchestrator,
        traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        jsonLogicEval,
        location: {
          id: entityManager
            .getEntityInstance(actorId)
            .getComponentData(POSITION_COMPONENT_ID)?.locationId,
        },
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );
      const goActions = result.actions.filter(
        (action) => action.id === 'movement:go'
      );
      expect(goActions.length).toBeGreaterThan(0);
      const targetIds = goActions.flatMap((action) =>
        extractTargetIds(action.params)
      );
      expect(targetIds).toContain(room2Id);
    });

    it('should discover wait action with none scope', async () => {
      const actorId = 'actor1';
      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            'anatomy:body': { rootEntityId: 'body-actor1' },
          },
        },
        {
          id: 'body-actor1',
          components: {
            'anatomy:part': { parentId: null, type: 'body' },
          },
        },
        {
          id: 'leg-left-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
        {
          id: 'leg-right-actor1',
          components: {
            'anatomy:part': { parentId: 'body-actor1', type: 'leg' },
            'core:movement': { locked: false },
          },
        },
      ]);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      // Need to recreate the ActionPipelineOrchestrator with updated dependencies
      // Create mock TargetComponentValidator
      const mockTargetComponentValidator = {
        validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
        validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
      };

      // Create mock TargetRequiredComponentsValidator
      const mockTargetRequiredComponentsValidator =
        createMockTargetRequiredComponentsValidator();

      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex,
        prerequisiteService: { evaluate: jest.fn(() => true) },
        targetService: createTargetResolutionServiceWithMocks({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        formatter: new ActionCommandFormatter(),
        entityManager,
        safeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        errorBuilder: createMockActionErrorContextBuilder(),
        logger,
        unifiedScopeResolver: createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: jsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        targetContextBuilder: createMockTargetContextBuilder(entityManager),
        multiTargetResolutionStage: createMultiTargetResolutionStage({
          entityManager,
          logger,
          unifiedScopeResolver: createMockUnifiedScopeResolver({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
          targetResolver: createTargetResolutionServiceWithMocks({
            scopeRegistry,
            scopeEngine,
            entityManager,
            logger,
            safeEventDispatcher,
            jsonLogicEvaluationService: jsonLogicEval,
            dslParser: new DefaultDslParser(),
            actionErrorContextBuilder: createMockActionErrorContextBuilder(),
          }),
        }),
        targetComponentValidator: mockTargetComponentValidator,
        targetRequiredComponentsValidator:
          mockTargetRequiredComponentsValidator,
      });

      actionDiscoveryService = new ActionDiscoveryService({
        entityManager,
        logger,
        actionPipelineOrchestrator,
        traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        jsonLogicEval,
        location: {
          id: entityManager
            .getEntityInstance(actorId)
            .getComponentData(POSITION_COMPONENT_ID)?.locationId,
        },
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const waitActions = result.actions.filter(
        (action) => action.id === 'core:wait'
      );
      expect(waitActions.length).toBe(1);
      expect(waitActions[0].params?.targetId ?? null).toBeNull();
    });
  });
});
