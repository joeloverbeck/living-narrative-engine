/**
 * @file Integration tests for scope resolution for the kissing:suck_on_neck_to_leave_hickey action.
 * @description Tests that the action is properly discovered via scope resolution and
 * validates component requirements and positioning constraints.
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
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
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

// Import the new action
import suckOnNeckToLeaveHickeyAction from '../../../data/mods/kissing/actions/suck_on_neck_to_leave_hickey.action.json';

// Import required conditions
import bothActorsFacingEachOther from '../../../data/mods/positioning/conditions/both-actors-facing-each-other.condition.json';
import actorIsBehindEntity from '../../../data/mods/positioning/conditions/actor-is-behind-entity.condition.json';

// Unmock the real singleton to ensure the test and SUT use the same instance
jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Suck On Neck To Leave Hickey Action Discovery Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let gameDataRepository;
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

    // Load the required scope
    const closeActorsFacingEachOtherOrBehindTargetScopeContent =
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../data/mods/kissing/scopes/close_actors_facing_each_other_or_behind_target.scope'
        ),
        'utf8'
      );

    const scopeDefs = parseScopeDefinitions(
      closeActorsFacingEachOtherOrBehindTargetScopeContent,
      'close_actors_facing_each_other_or_behind_target.scope'
    );

    scopeRegistry.initialize({
      'kissing:close_actors_facing_each_other_or_behind_target': scopeDefs.get(
        'kissing:close_actors_facing_each_other_or_behind_target'
      ),
    });

    scopeEngine = new ScopeEngine();
    const registry = new InMemoryDataRegistry();
    registry.store(
      'actions',
      suckOnNeckToLeaveHickeyAction.id,
      suckOnNeckToLeaveHickeyAction
    );

    // Store required conditions
    registry.store(
      'conditions',
      bothActorsFacingEachOther.id,
      bothActorsFacingEachOther
    );
    registry.store('conditions', actorIsBehindEntity.id, actorIsBehindEntity);

    gameDataRepository = new GameDataRepository(registry, logger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

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

    // Create a proper ActionIndex that handles forbidden components
    const actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex(gameDataRepository.getAllActionDefinitions());

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
      targetContextBuilder: createMockTargetContextBuilder(),
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

  describe('suck on neck to leave hickey action discovery', () => {
    it('should discover action when actors are close and facing each other', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [targetId] },
          },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [actorId] },
          },
        },
        { id: 'room1', components: {} },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const suckOnNeckActions = result.actions.filter(
        (action) => action.id === 'kissing:suck_on_neck_to_leave_hickey'
      );
      expect(suckOnNeckActions.length).toBeGreaterThan(0);

      const targetIds = suckOnNeckActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(targetId);
    });

    it('should discover action when actor is behind target', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [targetId] },
          },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [actorId] },
            'positioning:facing_away': { facing_away_from: [actorId] },
          },
        },
        { id: 'room1', components: {} },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const suckOnNeckActions = result.actions.filter(
        (action) => action.id === 'kissing:suck_on_neck_to_leave_hickey'
      );
      expect(suckOnNeckActions.length).toBeGreaterThan(0);

      const targetIds = suckOnNeckActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(targetId);
    });

    it('should not discover action when actors are not close', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            // No closeness component
          },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            // No closeness component
          },
        },
        { id: 'room1', components: {} },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const suckOnNeckActions = result.actions.filter(
        (action) => action.id === 'kissing:suck_on_neck_to_leave_hickey'
      );
      expect(suckOnNeckActions).toHaveLength(0);
    });

    it('should not discover action when actor is kissing', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [targetId] },
            'kissing:kissing': { partner: targetId, initiator: true },
          },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [actorId] },
            'kissing:kissing': { partner: actorId, initiator: false },
          },
        },
        { id: 'room1', components: {} },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const suckOnNeckActions = result.actions.filter(
        (action) => action.id === 'kissing:suck_on_neck_to_leave_hickey'
      );
      expect(suckOnNeckActions).toHaveLength(0);
    });

    it('should discover action with multiple close partners', async () => {
      const actorId = 'actor1';
      const target1Id = 'target1';
      const target2Id = 'target2';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [target1Id, target2Id] },
          },
        },
        {
          id: target1Id,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [actorId, target2Id] },
          },
        },
        {
          id: target2Id,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [actorId, target1Id] },
          },
        },
        { id: 'room1', components: {} },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const suckOnNeckActions = result.actions.filter(
        (action) => action.id === 'kissing:suck_on_neck_to_leave_hickey'
      );
      expect(suckOnNeckActions.length).toBeGreaterThan(0);

      const targetIds = suckOnNeckActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(target1Id);
      expect(targetIds).toContain(target2Id);
    });

    it('should handle mixed positioning scenarios correctly', async () => {
      const actorId = 'actor1';
      const facingTargetId = 'facing_target';
      const behindTargetId = 'behind_target';
      const entities = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': {
              partners: [facingTargetId, behindTargetId],
            },
          },
        },
        {
          id: facingTargetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [actorId, behindTargetId] },
            // No facing_away component = facing each other
          },
        },
        {
          id: behindTargetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            'personal-space-states:closeness': { partners: [actorId, facingTargetId] },
            'positioning:facing_away': { facing_away_from: [actorId] },
          },
        },
        { id: 'room1', components: {} },
      ];

      entityManager.setEntities(entities);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const suckOnNeckActions = result.actions.filter(
        (action) => action.id === 'kissing:suck_on_neck_to_leave_hickey'
      );
      expect(suckOnNeckActions.length).toBeGreaterThan(0);

      const targetIds = suckOnNeckActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);

      // Should be available for both positioning scenarios
      expect(targetIds).toContain(facingTargetId);
      expect(targetIds).toContain(behindTargetId);
    });

    it('should validate proper component requirements', async () => {
      const actorId = 'actor1';
      const targetId = 'target1';

      // Test that closeness is required
      const entitiesWithoutCloseness = [
        {
          id: actorId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            // Missing personal-space-states:closeness
          },
        },
        {
          id: targetId,
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          },
        },
        { id: 'room1', components: {} },
      ];

      entityManager.setEntities(entitiesWithoutCloseness);

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = { jsonLogicEval };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      const suckOnNeckActions = result.actions.filter(
        (action) => action.id === 'kissing:suck_on_neck_to_leave_hickey'
      );
      expect(suckOnNeckActions).toHaveLength(0);
    });
  });
});
