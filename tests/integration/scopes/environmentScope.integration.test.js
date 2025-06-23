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
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { getEntityIdsForScopes } from '../../../src/entities/entityScopeService.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import {
  POSITION_COMPONENT_ID,
  NAME_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

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

  beforeEach(() => {
    // Restore the mocked logger
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
    const environmentDefs = parseScopeDefinitions(
      environmentScopeContent,
      'environment.scope'
    );

    scopeRegistry.initialize({
      environment: { expr: environmentDefs.get('environment') },
    });

    jsonLogicEval = new JsonLogicEvaluationService({ logger });
    const registry = new InMemoryDataRegistry();
    registry.store('actions', followAction.id, followAction);

    const gameDataRepository = new GameDataRepository(registry, logger);
    const domainContextCompatibilityChecker = { check: () => true };
    const prerequisiteEvaluationService = { evaluate: (a, b, c, d) => true };
    const validatedEventDispatcher = {
      dispatch: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
    };

    const actionValidationService = new ActionValidationService({
      entityManager,
      logger,
      domainContextCompatibilityChecker,
      prerequisiteEvaluationService,
    });

    const safeEventDispatcher = new SafeEventDispatcher({
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

  describe('environment scope', () => {
    it('should resolve entities in same location for follow action', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
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

    it('should return empty set when actor is alone in location', async () => {
      const actorId = 'actor1';
      const roomId = 'room1';

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: roomId },
          },
        },
        { id: roomId, components: { [NAME_COMPONENT_ID]: { text: 'Room 1' } } },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(roomId),
        actingEntity: actorEntity,
      };

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

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: targetId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Target' },
            [POSITION_COMPONENT_ID]: { locationId: room2Id },
          },
        },
        {
          id: room1Id,
          components: { [NAME_COMPONENT_ID]: { text: 'Room 1' } },
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
      const followActions = result.actions.filter(
        (action) => action.id === 'core:follow'
      );
      expect(followActions.length).toBe(0);
    });
  });
});
