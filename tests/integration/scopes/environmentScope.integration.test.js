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
import { clearEntityCache } from '../../../src/scopeDsl/core/entityHelpers.js';
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
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import {
  createMultiTargetResolutionStage,
  createActionPipelineOrchestrator,
} from '../../common/actions/multiTargetStageTestUtilities.js';

// Import actions
import followAction from '../../../data/mods/companionship/actions/follow.action.json';

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
    // Comprehensive state cleanup to prevent test pollution
    clearEntityCache(); // Clear entity cache from entityHelpers.js
    jest.clearAllMocks(); // Clear all Jest mocks

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
        '../../../data/mods/companionship/scopes/potential_leaders.scope'
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
      'companionship:potential_leaders': potentialLeadersDefs.get(
        'companionship:potential_leaders'
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
    registry.store('conditions', 'companionship:entity-is-following-actor', {
      id: 'companionship:entity-is-following-actor',
      logic: {
        '==': [
          { var: 'entity.components.core:following.leaderId' },
          { var: 'actor.id' },
        ],
      },
    });
    registry.store('conditions', 'anatomy:actor-can-move', {
      id: 'anatomy:actor-can-move',
      logic: {
        '!!': { var: 'actor.components.core:movement' },
      },
    });
    registry.store('conditions', 'core:actor-is-following', {
      id: 'core:actor-is-following',
      logic: {
        '!!': { var: 'actor.components.core:following' },
      },
    });

    gameDataRepository = new GameDataRepository(registry, logger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });
    // FIX: Ensure the mock has a function with the correct arity and returns proper result
    const prerequisiteEvaluationService = {
      evaluate: (prerequisites, actionDef, actor, trace) => {
        // Return ActionResult.success for successful prerequisite evaluation
        return { success: true, value: true };
      },
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
      unifiedScopeResolver: createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      }),
      targetContextBuilder: createMockTargetContextBuilder(),
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
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
        targetResolver: targetResolutionService,
      }),
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

  describe('potential_leaders scope (used by follow action)', () => {
    it('should resolve entities in same location for follow action', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const room1Id = 'room1';

      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            'core:movement': {},
          },
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
        (action) => action.id === 'companionship:follow'
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
          components: {
            [POSITION_COMPONENT_ID]: { locationId: roomId },
            'core:movement': {},
          },
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
        (action) => action.id === 'companionship:follow'
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
          components: {
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            'core:movement': {},
          },
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
        (action) => action.id === 'companionship:follow'
      );

      // Debug logging for troubleshooting
      if (followActions.length !== 0) {
        console.log('DEBUG - Unexpected follow actions found:');
        console.log(
          'Available actions:',
          result.actions.map((a) => ({
            id: a.id,
            targetId: a.params?.targetId,
            target: a.target,
          }))
        );
        console.log(
          'Actor location:',
          actorEntity.components[POSITION_COMPONENT_ID]
        );
        console.log(
          'Target location:',
          entityManager.getEntityInstance(targetId)?.components[
            POSITION_COMPONENT_ID
          ]
        );
        console.log(
          'Follow actions:',
          followActions.map((a) => ({
            id: a.id,
            targetId: a.params?.targetId,
            target: a.target,
          }))
        );
      }

      expect(followActions.length).toBe(0);
    });
  });
});
