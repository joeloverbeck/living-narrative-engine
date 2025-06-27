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
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
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
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

// Import actual scope file CONTENTS
const followersScopeContent = fs.readFileSync(
  path.resolve(__dirname, '../../../data/mods/core/scopes/followers.scope'),
  'utf8'
);
const environmentScopeContent = fs.readFileSync(
  path.resolve(__dirname, '../../../data/mods/core/scopes/environment.scope'),
  'utf8'
);
const directionsScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/core/scopes/clear_directions.scope'
  ),
  'utf8'
);

// Import actual action files
import dismissAction from '../../../data/mods/core/actions/dismiss.action.json';
import followAction from '../../../data/mods/core/actions/follow.action.json';
import goAction from '../../../data/mods/core/actions/go.action.json';
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
      'core:followers': { expr: followerDefs.get('core:followers') },
      'core:environment': { expr: environmentDefs.get('core:environment') },
      'core:clear_directions': {
        expr: directionDefs.get('core:clear_directions'),
      },
    });

    scopeEngine = new ScopeEngine();
    const registry = new InMemoryDataRegistry();
    registry.store('actions', dismissAction.id, dismissAction);
    registry.store('actions', followAction.id, followAction);
    registry.store('actions', goAction.id, goAction);
    registry.store('actions', waitAction.id, waitAction);
    registry.store('conditions', 'core:exit-is-unblocked', {
      id: 'core:exit-is-unblocked',
      description:
        'Checks if an exit object has the "block" property nullified.',
      logic: {
        '!': { var: 'entity.blocker' },
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

    actionDiscoveryService = createActionDiscoveryService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createActionDiscoveryService = (overrides = {}) => {
    const targetResolutionService = new TargetResolutionService({
      scopeRegistry,
      scopeEngine,
      entityManager,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
    });

    return new ActionDiscoveryService({
      gameDataRepository,
      entityManager,
      prerequisiteEvaluationService,
      logger,
      formatActionCommandFn: formatActionCommand,
      safeEventDispatcher,
      targetResolutionService,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      actionIndex: {
        getCandidateActions: jest
          .fn()
          .mockImplementation(() =>
            gameDataRepository.getAllActionDefinitions()
          ),
      },
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

      actionDiscoveryService = createActionDiscoveryService();

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
      expect(targetIds).toContain(follower1Id);
      expect(targetIds).toContain(follower2Id);
    });

    it('should return empty set when actor has no followers', async () => {
      const actorId = 'actor1';

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
      ]);

      actionDiscoveryService = createActionDiscoveryService();

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
      expect(dismissActions.length).toBe(0);
    });
  });

  describe('clear_directions scope', () => {
    it('should resolve location exits for go action', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';
      const room2Id = 'room2';

      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
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
      ];

      entityManager = new SimpleEntityManager(entities);

      actionDiscoveryService = createActionDiscoveryService();

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        currentLocation: entityManager.getEntityInstance(room1Id),
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
      expect(targetIds).toContain('room3');
    });

    it('should return empty set when location has no exits', async () => {
      const actorId = 'actor1';
      const roomId = 'room1';

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: roomId },
          },
        },
        {
          id: roomId,
          components: {
            [EXITS_COMPONENT_ID]: [],
          },
        },
      ]);

      actionDiscoveryService = createActionDiscoveryService();

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        currentLocation: entityManager.getEntityInstance(roomId),
        jsonLogicEval,
        actingEntity: actorEntity,
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const goActions = result.actions.filter(
        (action) => action.id === 'core:go'
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

      actionDiscoveryService = createActionDiscoveryService();

      const actorEntity = entityManager.getEntityInstance(actorId);
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        {}
      );

      const waitActions = result.actions.filter(
        (action) => action.id === 'core:wait'
      );
      expect(waitActions.length).toBe(1);
      expect(waitActions[0].params?.targetId).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle missing actingEntity gracefully', async () => {
      actionDiscoveryService = createActionDiscoveryService();
      const result = await actionDiscoveryService.getValidActions(null, {});
      expect(result.actions).toEqual([]);
    });
  });
});
