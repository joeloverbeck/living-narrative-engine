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
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { getEntityIdsForScopes } from '../../../src/entities/entityScopeService.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
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

// Import actions
import dismissAction from '../../../data/mods/core/actions/dismiss.action.json';
import followAction from '../../../data/mods/core/actions/follow.action.json';
import goAction from '../../../data/mods/core/actions/go.action.json';
import waitAction from '../../../data/mods/core/actions/wait.action.json';

// Unmock the real singleton to ensure the test and SUT use the same instance
jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let jsonLogicEval;
  let actionDiscoveryService;
  let gameDataRepository;
  let actionValidationService;
  let safeEventDispatcher;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Use the improved SimpleEntityManager
    entityManager = new SimpleEntityManager([]);

    // scopeRegistry = ScopeRegistry.getInstance(); // Old way
    scopeRegistry = new ScopeRegistry({ logger }); // New way
    scopeRegistry.clear();

    const followersScopeContent = fs.readFileSync(
      path.resolve(__dirname, '../../../data/mods/core/scopes/followers.scope'),
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
        '../../../data/mods/core/scopes/directions.scope'
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
      'directions.scope'
    );

    scopeRegistry.initialize({
      followers: { expr: followerDefs.get('followers') },
      environment: { expr: environmentDefs.get('environment') },
      directions: { expr: directionDefs.get('directions') },
    });

    jsonLogicEval = new JsonLogicEvaluationService({ logger });

    const registry = new InMemoryDataRegistry();
    registry.store('actions', dismissAction.id, dismissAction);
    registry.store('actions', followAction.id, followAction);
    registry.store('actions', goAction.id, goAction);
    registry.store('actions', waitAction.id, waitAction);

    gameDataRepository = new GameDataRepository(registry, logger);

    const domainContextCompatibilityChecker = { check: () => true };

    // FIX: The mock 'evaluate' function must accept 4 arguments to pass constructor validation.
    const prerequisiteEvaluationService = { evaluate: (a, b, c, d) => true };

    const validatedEventDispatcher = {
      dispatch: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
    };

    // Services are created once with the single entityManager instance
    actionValidationService = new ActionValidationService({
      entityManager,
      logger,
      domainContextCompatibilityChecker,
      prerequisiteEvaluationService,
    });

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository,
      entityManager,
      actionValidationService,
      logger,
      formatActionCommandFn: formatActionCommand,
      getEntityIdsForScopesFn: getEntityIdsForScopes,
      safeEventDispatcher,
      scopeRegistry,
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
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [LEADING_COMPONENT_ID]: { followers: [followerId] },
          },
        },
        {
          id: followerId,
          components: { [NAME_COMPONENT_ID]: { text: 'Follower' } },
        },
      ];

      // Use setEntities to configure state for this specific test
      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const dismissActions = result.actions.filter(
        (action) => action.id === 'core:dismiss'
      );
      expect(dismissActions.length).toBeGreaterThan(0);
      const targetIds = dismissActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(followerId);
    });

    it('should discover follow action with environment scope', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const room1Id = 'room1';
      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
        {
          id: targetId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Target' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: room1Id,
          components: { [NAME_COMPONENT_ID]: { text: 'Room 1' } },
        },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(room1Id),
        actingEntity: actorEntity,
      };
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

    it('should discover go action with directions scope', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';
      const room2Id = 'room2';
      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: room1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
            [EXITS_COMPONENT_ID]: [{ direction: 'north', target: room2Id }],
          },
        },
        {
          id: room2Id,
          components: { [NAME_COMPONENT_ID]: { text: 'Room 2' } },
        },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(room1Id),
        actingEntity: actorEntity,
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const goActions = result.actions.filter(
        (action) => action.id === 'core:go'
      );
      expect(goActions.length).toBeGreaterThan(0);
      const targetIds = goActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(room2Id);
    });

    it('should discover wait action with none scope', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';
      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: room1Id,
          components: { [NAME_COMPONENT_ID]: { text: 'Room 1' } },
        },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(room1Id),
        actingEntity: actorEntity,
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const waitActions = result.actions.filter(
        (action) => action.id === 'core:wait'
      );
      expect(waitActions.length).toBe(1);
      expect(waitActions[0].params?.targetId).toBeUndefined();
    });
  });
});
