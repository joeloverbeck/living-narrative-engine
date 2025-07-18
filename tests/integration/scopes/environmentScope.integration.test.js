/**
 * @file Integration tests for the environment scope.
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
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import {
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

// Import actions
import followAction from '../../../data/mods/core/actions/follow.action.json';

// Unmock the real singleton to ensure the test and SUT use the same instance
jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let actionDiscoveryService;
  let jsonLogicEval;
  let scopeRegistry;
  let scopeEngine;
  let gameDataRepository;

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

    const environmentScopeContent = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../data/mods/core/scopes/environment.scope'
      ),
      'utf8'
    );
    const potentialLeadersScopeContent = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../data/mods/core/scopes/potential_leaders.scope'
      ),
      'utf8'
    );
    const environmentDefs = parseScopeDefinitions(
      environmentScopeContent,
      'environment.scope'
    );
    const potentialLeadersDefs = parseScopeDefinitions(
      potentialLeadersScopeContent,
      'potential_leaders.scope'
    );

    scopeRegistry.initialize({
      'core:environment': environmentDefs.get('core:environment'),
      'core:potential_leaders': potentialLeadersDefs.get(
        'core:potential_leaders'
      ),
    });

    scopeEngine = new ScopeEngine();

    const registry = new InMemoryDataRegistry();
    registry.store('actions', followAction.id, followAction);
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
    registry.store('conditions', 'core:entity-is-following-actor', {
      id: 'core:entity-is-following-actor',
      logic: {
        '==': [
          { var: 'entity.components.core:following.leaderId' },
          { var: 'actor.id' },
        ],
      },
    });

    gameDataRepository = new GameDataRepository(registry, logger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });
    // FIX: Ensure the mock has a function with the correct arity
    const prerequisiteEvaluationService = {
      evaluate: () => true,
    };
    const validatedEventDispatcher = {
      dispatch: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
    };

    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    const targetResolutionService = new TargetResolutionService({
      scopeRegistry,
      scopeEngine,
      entityManager,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
      dslParser: new DefaultDslParser(),
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

    // Create the ActionPipelineOrchestrator
    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex: {
        getCandidateActions: jest
          .fn()
          .mockImplementation(() =>
            gameDataRepository.getAllActionDefinitions()
          ),
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

    // FIX: Add the missing dependency to the constructor call
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

  describe('environment scope', () => {
    it('should resolve entities in same location for follow action', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const room1Id = 'room1';

      const entities = [
        {
          id: actorId,
          components: { [POSITION_COMPONENT_ID]: { locationId: room1Id } },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [ACTOR_COMPONENT_ID]: {},
          },
        },
        { id: room1Id, components: {} },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const followActions = result.actions.filter(
        (action) => action.id === 'core:follow'
      );
      expect(followActions.length).toBeGreaterThan(0);
      const targetIds = followActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(targetId);
    });

    it('should return empty set when actor is alone in location', async () => {
      const actorId = 'actor1';
      const roomId = 'room1';

      entityManager.setEntities([
        {
          id: actorId,
          components: { [POSITION_COMPONENT_ID]: { locationId: roomId } },
        },
        { id: roomId, components: {} },
      ]);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );
      const followActions = result.actions.filter(
        (action) => action.id === 'core:follow'
      );
      expect(followActions.length).toBe(0);
    });

    it('should exclude entities in different locations', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const room1Id = 'room1';
      const room2Id = 'room2';

      entityManager.setEntities([
        {
          id: actorId,
          components: { [POSITION_COMPONENT_ID]: { locationId: room1Id } },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room2Id },
            [ACTOR_COMPONENT_ID]: {},
          },
        },
        { id: room1Id, components: {} },
        { id: room2Id, components: {} },
      ]);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );
      const followActions = result.actions.filter(
        (action) => action.id === 'core:follow'
      );
      expect(followActions.length).toBe(0);
    });
  });
});
