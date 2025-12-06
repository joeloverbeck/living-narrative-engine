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
  NAME_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import {
  createMultiTargetResolutionStage,
  createActionPipelineOrchestrator,
} from '../../common/actions/multiTargetStageTestUtilities.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

// Import actual scope file CONTENTS
const followersScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/companionship/scopes/followers.scope'
  ),
  'utf8'
);
const environmentScopeContent = fs.readFileSync(
  path.resolve(__dirname, '../../../data/mods/core/scopes/environment.scope'),
  'utf8'
);
const directionsScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/movement/scopes/clear_directions.scope'
  ),
  'utf8'
);

// Import actual action files
import dismissAction from '../../../data/mods/companionship/actions/dismiss.action.json';
import followAction from '../../../data/mods/companionship/actions/follow.action.json';
import goAction from '../../../data/mods/movement/actions/go.action.json';
import waitAction from '../../../data/mods/core/actions/wait.action.json';

describe('Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let gameDataRepository;
  let prerequisiteEvaluationService;
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

    scopeRegistry.initialize({
      'companionship:followers': followerDefs.get('companionship:followers'),
      'core:environment': environmentDefs.get('core:environment'),
      'movement:clear_directions': directionDefs.get(
        'movement:clear_directions'
      ),
    });

    scopeEngine = new ScopeEngine();
    const registry = new InMemoryDataRegistry();
    registry.store('actions', dismissAction.id, dismissAction);
    registry.store('actions', followAction.id, followAction);
    registry.store('actions', goAction.id, goAction);
    registry.store('actions', waitAction.id, waitAction);
    registry.store('conditions', 'movement:exit-is-unblocked', {
      id: 'movement:exit-is-unblocked',
      description:
        'Checks if an exit object has the "block" property nullified.',
      logic: {
        '!': { var: 'entity.blocker' },
      },
    });
    registry.store('conditions', 'movement:actor-can-move', {
      id: 'movement:actor-can-move',
      description:
        'Checks if the actor has functioning legs capable of movement',
      logic: {
        hasPartWithComponentValue: ['actor', 'core:movement', 'locked', false],
      },
    });

    gameDataRepository = new GameDataRepository(registry, logger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });
    const domainContextCompatibilityChecker = { check: () => true };

    // FIX: Create a mock whose 'evaluate' function has a .length of 4.
    prerequisiteEvaluationService = {
      evaluate: jest.fn((_p1, _p2, _p3, _p4) => true),
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

    // Create and build ActionIndex
    actionIndex = new ActionIndex({ logger, entityManager });
    const allActions = gameDataRepository.getAllActionDefinitions();
    actionIndex.buildIndex(allActions);

    actionDiscoveryService = createActionDiscoveryService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createActionDiscoveryService = (overrides = {}) => {
    const currentEntityManager = overrides.entityManager || entityManager;
    const currentActionIndex = overrides.actionIndex || actionIndex;
    const currentJsonLogicEval = overrides.jsonLogicEval || jsonLogicEval;

    const targetResolutionService = createTargetResolutionServiceWithMocks({
      scopeRegistry,
      scopeEngine,
      entityManager: currentEntityManager,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: currentJsonLogicEval,
      dslParser: new DefaultDslParser(),
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

    // Create the ActionPipelineOrchestrator using the utility factory

    // Create mock TargetComponentValidator
    const mockTargetComponentValidator = {
      validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
      validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
    };

    // Create mock TargetRequiredComponentsValidator
    const mockTargetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: currentActionIndex,
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new ActionCommandFormatter(),
      entityManager: currentEntityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        scopeEngine,
        entityManager: currentEntityManager,
        logger,
        safeEventDispatcher,
        jsonLogicEvaluationService: currentJsonLogicEval,
        dslParser: new DefaultDslParser(),
        actionErrorContextBuilder: createMockActionErrorContextBuilder(),
      }),
      targetContextBuilder:
        createMockTargetContextBuilder(currentEntityManager),
      multiTargetResolutionStage: createMultiTargetResolutionStage({
        entityManager: currentEntityManager,
        logger,
        unifiedScopeResolver: createMockUnifiedScopeResolver({
          scopeRegistry,
          scopeEngine,
          entityManager: currentEntityManager,
          logger,
          safeEventDispatcher,
          jsonLogicEvaluationService: currentJsonLogicEval,
          dslParser: new DefaultDslParser(),
          actionErrorContextBuilder: createMockActionErrorContextBuilder(),
        }),
        targetResolver: targetResolutionService,
      }),
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
    });

    return new ActionDiscoveryService({
      entityManager: currentEntityManager,
      logger,
      actionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      ...overrides,
    });
  };

  describe('followers scope', () => {
    it('should resolve followers for dismiss action', async () => {
      const actorId = 'actor1';
      const follower1Id = 'follower1';
      const follower2Id = 'follower2';
      const room1Id = 'room1';

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [LEADING_COMPONENT_ID]: { followers: [follower1Id, follower2Id] },
          },
        },
        {
          id: follower1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Follower 1' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: follower2Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Follower 2' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: room1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
          },
        },
      ];

      entityManager = new SimpleEntityManager(entities);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      actionDiscoveryService = createActionDiscoveryService({
        entityManager,
        actionIndex,
        jsonLogicEval,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
        location: { id: room1Id },
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const dismissActions = result.actions.filter(
        (action) => action.id === 'companionship:dismiss'
      );
      expect(dismissActions.length).toBeGreaterThan(0);

      const primaryTargetIds = dismissActions.flatMap((action) => {
        return action.params?.targetIds?.primary ?? [];
      });

      expect(primaryTargetIds.length).toBeGreaterThan(0);
      expect(primaryTargetIds).toContain(follower1Id);
      expect(primaryTargetIds).toContain(follower2Id);
    });

    it('should return empty set when actor has no followers', async () => {
      const actorId = 'actor1';
      const roomId = 'room1';

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: roomId },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
        {
          id: roomId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room' },
          },
        },
      ]);

      actionDiscoveryService = createActionDiscoveryService({ entityManager });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
        location: { id: roomId },
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const dismissActions = result.actions.filter(
        (action) => action.id === 'companionship:dismiss'
      );
      expect(dismissActions.length).toBe(0);
    });
  });

  describe('clear_directions scope', () => {
    it('should resolve location exits for go action', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';
      const room2Id = 'room2';

      // Create a new registry for this test
      const registry = new InMemoryDataRegistry();
      registry.store('actions', dismissAction.id, dismissAction);
      registry.store('actions', followAction.id, followAction);
      registry.store('actions', goAction.id, goAction); // Use the original go action
      registry.store('actions', waitAction.id, waitAction);
      registry.store('conditions', 'movement:exit-is-unblocked', {
        id: 'movement:exit-is-unblocked',
        logic: { '!': { var: 'entity.blocker' } },
      });
      registry.store('conditions', 'movement:actor-can-move', {
        id: 'movement:actor-can-move',
        logic: {
          hasPartWithComponentValue: [
            'actor',
            'core:movement',
            'locked',
            false,
          ],
        },
      });

      gameDataRepository = new GameDataRepository(registry, logger);
      jsonLogicEval = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

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
            [EXITS_COMPONENT_ID]: [
              { direction: 'north', target: room2Id },
              { direction: 'east', target: 'room3' },
            ],
          },
        },
        {
          id: room2Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 2' },
          },
        },
        {
          id: 'room3',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 3' },
          },
        },
        {
          id: 'npc1',
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
      ];

      entityManager = new SimpleEntityManager(entities);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      actionDiscoveryService = createActionDiscoveryService({
        entityManager,
        actionIndex,
        jsonLogicEval,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
        location: { id: room1Id },
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const goActions = result.actions.filter(
        (action) => action.id === 'movement:go'
      );

      expect(goActions.length).toBeGreaterThan(0);

      const primaryTargetIds = goActions.flatMap((action) => {
        return action.params?.targetIds?.primary ?? [];
      });

      expect(primaryTargetIds.length).toBeGreaterThan(0);
      expect(primaryTargetIds).toContain(room2Id);
      // Could also contain 'room3' since there are two exits
    });

    it('should return empty set when location has no exits', async () => {
      const actorId = 'actor1';
      const roomId = 'room1';

      // Create a new registry for this test
      const registry = new InMemoryDataRegistry();
      registry.store('actions', dismissAction.id, dismissAction);
      registry.store('actions', followAction.id, followAction);
      registry.store('actions', goAction.id, goAction); // Use original go action
      registry.store('actions', waitAction.id, waitAction);
      registry.store('conditions', 'movement:exit-is-unblocked', {
        id: 'movement:exit-is-unblocked',
        logic: { '!': { var: 'entity.blocker' } },
      });
      registry.store('conditions', 'movement:actor-can-move', {
        id: 'movement:actor-can-move',
        logic: {
          hasPartWithComponentValue: [
            'actor',
            'core:movement',
            'locked',
            false,
          ],
        },
      });

      gameDataRepository = new GameDataRepository(registry, logger);
      jsonLogicEval = new JsonLogicEvaluationService({
        logger,
        gameDataRepository,
      });

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: roomId },
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
          id: roomId,
          components: {
            [EXITS_COMPONENT_ID]: [], // Empty array - no exits
          },
        },
      ]);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      actionDiscoveryService = createActionDiscoveryService({
        entityManager,
        actionIndex,
        jsonLogicEval,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
        location: { id: roomId },
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const goActions = result.actions.filter(
        (action) => action.id === 'movement:go'
      );
      expect(goActions.length).toBe(0);
    });
  });

  describe('special scopes', () => {
    it('should handle "none" scope for wait action', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';

      const entities = [
        { id: actorId, components: {} },
        { id: room1Id, components: {} },
      ];

      entityManager = new SimpleEntityManager(entities);

      // Need to recreate ActionIndex with new entityManager
      actionIndex = new ActionIndex({ logger, entityManager });
      const allActions = gameDataRepository.getAllActionDefinitions();
      actionIndex.buildIndex(allActions);

      actionDiscoveryService = createActionDiscoveryService({
        entityManager,
        actionIndex,
        jsonLogicEval,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(actorEntity, {
        location: { id: room1Id },
      });

      const waitActions = result.actions.filter(
        (action) => action.id === 'core:wait'
      );
      expect(waitActions.length).toBe(1);
      expect(waitActions[0].params?.targetId ?? null).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw InvalidActorEntityError for missing actingEntity', async () => {
      actionDiscoveryService = createActionDiscoveryService({ entityManager });
      await expect(
        actionDiscoveryService.getValidActions(null, {})
      ).rejects.toThrow(
        'ActionDiscoveryService.getValidActions: actorEntity parameter must be an object with a non-empty id'
      );
      await expect(
        actionDiscoveryService.getValidActions({}, {})
      ).rejects.toThrow(
        'ActionDiscoveryService.getValidActions: actorEntity parameter must be an object with a non-empty id'
      );
    });
  });
});
