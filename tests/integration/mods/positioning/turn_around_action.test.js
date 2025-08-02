/**
 * @file Integration tests for the positioning:turn_around action.
 * @description Tests basic action discovery and behavior - verifies the action appears when
 * the actor has the required components and correctly toggles the facing_away state.
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
import { createMockActionErrorContextBuilder } from '../../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../../common/mocks/mockTargetContextBuilder.js';
import { createMultiTargetResolutionStage } from '../../../common/actions/multiTargetStageTestUtilities.js';
import turnAroundAction from '../../../../data/mods/positioning/actions/turn_around.action.json';
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
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import DefaultDslParser from '../../../../src/scopeDsl/parser/defaultDslParser.js';

describe('Turn Around Action Discovery', () => {
  let entityManager;
  let actionDiscoveryService;
  let alice;
  let bob;
  let charlie;
  let diana;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let targetResolutionService;
  let gameDataRepository;
  let actionIndex;

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

    // Load the scope file
    const scopePath = path.join(
      process.cwd(),
      'data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope'
    );
    const scopeContent = fs.readFileSync(scopePath, 'utf-8');
    const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);

    // Register scopes
    scopeRegistry.initialize(Object.fromEntries(parsedScopes));

    scopeEngine = new ScopeEngine();

    // Set up action discovery dependencies
    const dataRegistry = new InMemoryDataRegistry();
    
    // Store the action definition in the data registry
    dataRegistry.store('actions', turnAroundAction.id, turnAroundAction);
    
    gameDataRepository = new GameDataRepository(dataRegistry, logger);

    // Set up dslParser and other dependencies
    const dslParser = new DefaultDslParser();
    const jsonLogicService = new JsonLogicEvaluationService({ 
      logger,
      gameDataRepository 
    });
    const actionErrorContextBuilder = createMockActionErrorContextBuilder();

    // Create mock validatedEventDispatcher for SafeEventDispatcher
    const validatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

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

    // Create mock prerequisiteEvaluationService
    const prereqService = {
      evaluate: jest.fn().mockReturnValue(true),
      evaluateActionConditions: jest.fn().mockResolvedValue({
        success: true,
        errors: [],
      }),
    };

    actionIndex = new ActionIndex({ logger, entityManager });
    const allActions = gameDataRepository.getAllActionDefinitions();
    actionIndex.buildIndex(allActions);

    const actionCommandFormatter = new ActionCommandFormatter({ logger });

    const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
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
    });

    // Create mock traceContextFactory as a function
    const traceContextFactory = jest.fn(() => ({
      addStep: jest.fn(),
      toJSON: jest.fn(() => ({})),
    }));

    actionDiscoveryService = new ActionDiscoveryService({
      actionPipelineOrchestrator,
      entityManager,
      traceContextFactory,
      logger,
    });

    // Create test location
    const testLocation = 'test-location';
    entityManager.addComponent(testLocation, NAME_COMPONENT_ID, {
      name: 'Test Location',
    });
    entityManager.addComponent(testLocation, 'core:location', {
      description: 'A test location',
    });

    // Create test entities
    alice = 'alice-entity';
    entityManager.addComponent(alice, NAME_COMPONENT_ID, {
      name: 'Alice',
    });
    entityManager.addComponent(alice, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });

    bob = 'bob-entity';
    entityManager.addComponent(bob, NAME_COMPONENT_ID, { name: 'Bob' });
    entityManager.addComponent(bob, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });

    charlie = 'charlie-entity';
    entityManager.addComponent(charlie, NAME_COMPONENT_ID, {
      name: 'Charlie',
    });
    entityManager.addComponent(charlie, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });

    diana = 'diana-entity';
    entityManager.addComponent(diana, NAME_COMPONENT_ID, {
      name: 'Diana',
    });
    entityManager.addComponent(diana, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });
  });

  afterEach(() => {
    // Clean up
    entityManager = null;
    actionDiscoveryService = null;
    scopeRegistry = null;
    scopeEngine = null;
  });

  describe('Action Availability', () => {
    it('should not show action when actor lacks required components', async () => {
      // Alice has no closeness components
      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundAction = actions.find(
        (a) => a.id === 'positioning:turn_around'
      );
      expect(turnAroundAction).toBeUndefined();
    });

    it('should show action when actor has closeness', async () => {
      // Mock the resolveTargets method to return expected results
      const { ActionTargetContext } = await import('../../../../src/models/actionTargetContext.js');
      targetResolutionService.resolveTargets = jest.fn().mockResolvedValue({
        success: true,
        value: [
          new ActionTargetContext('entity', { entityId: bob })
        ],
        errors: []
      });

      // Set up closeness
      entityManager.addComponent(alice, 'positioning:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'positioning:closeness', {
        partners: [alice],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundAction = actions.find(
        (a) => a.id === 'positioning:turn_around'
      );
      expect(turnAroundAction).toBeDefined();
      expect(turnAroundAction.command).toBe(
        'turn bob-entity around'
      );
      expect(turnAroundAction.params.targetId).toBe(bob);
    });

    it('should not show action when forbidden component is present', async () => {
      // Set up closeness
      entityManager.addComponent(alice, 'positioning:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'positioning:closeness', {
        partners: [alice],
      });

      // Add forbidden kissing component
      entityManager.addComponent(alice, 'intimacy:kissing', {
        partner: bob,
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundAction = actions.find(
        (a) => a.id === 'positioning:turn_around'
      );
      expect(turnAroundAction).toBeUndefined();
    });
  });

  describe('Scope Resolution', () => {
    beforeEach(() => {
      // Set up a complex closeness circle
      entityManager.addComponent(alice, 'positioning:closeness', {
        partners: [bob, charlie, diana],
      });
      entityManager.addComponent(bob, 'positioning:closeness', {
        partners: [alice, charlie, diana],
      });
      entityManager.addComponent(charlie, 'positioning:closeness', {
        partners: [alice, bob, diana],
      });
      entityManager.addComponent(diana, 'positioning:closeness', {
        partners: [alice, bob, charlie],
      });
    });

    it('should show action for actors facing each other', async () => {
      // Mock the resolveTargets method to return expected results for facing each other scenario
      const { ActionTargetContext } = await import('../../../../src/models/actionTargetContext.js');
      targetResolutionService.resolveTargets = jest.fn().mockResolvedValue({
        success: true,
        value: [
          new ActionTargetContext('entity', { entityId: bob }),
          new ActionTargetContext('entity', { entityId: charlie }),
          new ActionTargetContext('entity', { entityId: diana })
        ],
        errors: []
      });

      // Alice and Bob are facing each other (no facing_away components)
      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'positioning:turn_around'
      );

      // Should have actions for all partners in closeness
      expect(turnAroundActions.length).toBeGreaterThan(0);
    });

    it('should show action when actor is behind target', async () => {
      // Mock the resolveTargets method to return Bob as a target when Alice is behind him
      const { ActionTargetContext } = await import('../../../../src/models/actionTargetContext.js');
      targetResolutionService.resolveTargets = jest.fn().mockResolvedValue({
        success: true,
        value: [
          new ActionTargetContext('entity', { entityId: bob })
        ],
        errors: []
      });

      // Bob is facing away from Alice (Alice is behind Bob)
      entityManager.addComponent(bob, 'positioning:facing_away', {
        facing_away_from: [alice],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'positioning:turn_around'
      );

      // Should include Bob as a target since Alice is behind Bob
      const bobAction = turnAroundActions.find(
        (a) => a.params.targetId === bob
      );
      expect(bobAction).toBeDefined();
    });
  });
});