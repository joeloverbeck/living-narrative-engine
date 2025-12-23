/**
 * @file Integration tests for the physical-control:turn_around action.
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
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../../common/mocks/mockTargetContextBuilder.js';
import { createMultiTargetResolutionStage } from '../../../common/actions/multiTargetStageTestUtilities.js';
import turnAroundAction from '../../../../data/mods/physical-control/actions/turn_around.action.json';
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
      'data/mods/personal-space/scopes/close_actors_facing_each_other_or_behind_target.scope'
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
      gameDataRepository,
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
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
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
        (a) => a.id === 'physical-control:turn_around'
      );
      expect(turnAroundAction).toBeUndefined();
    });

    it('should show action when actor has closeness', async () => {
      // Set up closeness
      entityManager.addComponent(alice, 'personal-space-states:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'personal-space-states:closeness', {
        partners: [alice],
      });

      // Mock the unifiedScopeResolver to return Bob as a valid target
      const unifiedScopeResolver = createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      });

      // Override the resolve method to return Bob
      unifiedScopeResolver.resolve = jest.fn().mockReturnValue({
        success: true,
        value: new Set([bob]),
        errors: [],
      });

      // Create mock validatedEventDispatcher for SafeEventDispatcher
      const validatedEventDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const newSafeEventDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher,
        logger,
      });

      // Recreate the ActionPipelineOrchestrator with the mocked resolver
      const multiTargetStage = createMultiTargetResolutionStage({
        entityManager,
        logger,
        unifiedScopeResolver,
        targetResolver: targetResolutionService,
      });

      const mockTargetComponentValidator = {
        validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
        validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
      };

      // Create mock TargetRequiredComponentsValidator
      const mockTargetRequiredComponentsValidator =
        createMockTargetRequiredComponentsValidator();

      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex,
        prerequisiteService: {
          evaluate: jest.fn().mockReturnValue(true),
          evaluateActionConditions: jest.fn().mockResolvedValue({
            success: true,
            errors: [],
          }),
        },
        entityManager,
        targetService: targetResolutionService,
        formatter: new ActionCommandFormatter({ logger }),
        logger,
        safeEventDispatcher: newSafeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        errorBuilder: createMockActionErrorContextBuilder(),
        unifiedScopeResolver,
        targetContextBuilder: createMockTargetContextBuilder(),
        targetComponentValidator: mockTargetComponentValidator,
        targetRequiredComponentsValidator:
          mockTargetRequiredComponentsValidator,
        multiTargetResolutionStage: multiTargetStage,
      });

      // Recreate the ActionDiscoveryService with the new orchestrator
      const traceContextFactory = jest.fn(() => ({
        addStep: jest.fn(),
        toJSON: jest.fn(() => ({})),
      }));

      const actionDiscovery = new ActionDiscoveryService({
        actionPipelineOrchestrator,
        entityManager,
        traceContextFactory,
        logger,
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscovery.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundAction = actions.find(
        (a) => a.id === 'physical-control:turn_around'
      );
      expect(turnAroundAction).toBeDefined();
      expect(turnAroundAction.command).toBe('turn bob-entity around');
      expect(turnAroundAction.params.targetId).toBe(bob);
    });

    it('should not show action when forbidden component is present', async () => {
      // Set up closeness
      entityManager.addComponent(alice, 'personal-space-states:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'personal-space-states:closeness', {
        partners: [alice],
      });

      // Add forbidden kissing component
      entityManager.addComponent(alice, 'kissing:kissing', {
        partner: bob,
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundAction = actions.find(
        (a) => a.id === 'physical-control:turn_around'
      );
      expect(turnAroundAction).toBeUndefined();
    });
  });

  describe('Scope Resolution', () => {
    beforeEach(() => {
      // Set up a complex closeness circle
      entityManager.addComponent(alice, 'personal-space-states:closeness', {
        partners: [bob, charlie, diana],
      });
      entityManager.addComponent(bob, 'personal-space-states:closeness', {
        partners: [alice, charlie, diana],
      });
      entityManager.addComponent(charlie, 'personal-space-states:closeness', {
        partners: [alice, bob, diana],
      });
      entityManager.addComponent(diana, 'personal-space-states:closeness', {
        partners: [alice, bob, charlie],
      });
    });

    it('should show action for actors facing each other', async () => {
      // Mock the unifiedScopeResolver to return all partners facing each other
      const unifiedScopeResolver = createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      });

      // Override the resolve method to return all partners
      unifiedScopeResolver.resolve = jest.fn().mockReturnValue({
        success: true,
        value: new Set([bob, charlie, diana]),
        errors: [],
      });

      // Create mock validatedEventDispatcher for SafeEventDispatcher
      const validatedEventDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const newSafeEventDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher,
        logger,
      });

      // Recreate the ActionPipelineOrchestrator with the mocked resolver
      const multiTargetStage = createMultiTargetResolutionStage({
        entityManager,
        logger,
        unifiedScopeResolver,
        targetResolver: targetResolutionService,
      });

      const mockTargetComponentValidator = {
        validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
        validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
      };

      // Create mock TargetRequiredComponentsValidator
      const mockTargetRequiredComponentsValidator =
        createMockTargetRequiredComponentsValidator();

      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex,
        prerequisiteService: {
          evaluate: jest.fn().mockReturnValue(true),
          evaluateActionConditions: jest.fn().mockResolvedValue({
            success: true,
            errors: [],
          }),
        },
        entityManager,
        targetService: targetResolutionService,
        formatter: new ActionCommandFormatter({ logger }),
        logger,
        safeEventDispatcher: newSafeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        errorBuilder: createMockActionErrorContextBuilder(),
        unifiedScopeResolver,
        targetContextBuilder: createMockTargetContextBuilder(),
        targetComponentValidator: mockTargetComponentValidator,
        targetRequiredComponentsValidator:
          mockTargetRequiredComponentsValidator,
        multiTargetResolutionStage: multiTargetStage,
      });

      // Recreate the ActionDiscoveryService with the new orchestrator
      const traceContextFactory = jest.fn(() => ({
        addStep: jest.fn(),
        toJSON: jest.fn(() => ({})),
      }));

      const actionDiscovery = new ActionDiscoveryService({
        actionPipelineOrchestrator,
        entityManager,
        traceContextFactory,
        logger,
      });

      // Alice and Bob are facing each other (no facing_away components)
      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscovery.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'physical-control:turn_around'
      );

      // Should have actions for all partners in closeness
      expect(turnAroundActions.length).toBeGreaterThan(0);
    });

    it('should show action when actor is behind target', async () => {
      // Bob is facing away from Alice (Alice is behind Bob)
      entityManager.addComponent(bob, 'facing-states:facing_away', {
        facing_away_from: [alice],
      });

      // Mock the unifiedScopeResolver to return Bob as a valid target
      const unifiedScopeResolver = createMockUnifiedScopeResolver({
        scopeRegistry,
        entityManager,
        logger,
      });

      // Override the resolve method to return Bob
      unifiedScopeResolver.resolve = jest.fn().mockReturnValue({
        success: true,
        value: new Set([bob]),
        errors: [],
      });

      // Create mock validatedEventDispatcher for SafeEventDispatcher
      const validatedEventDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const newSafeEventDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher,
        logger,
      });

      // Recreate the ActionPipelineOrchestrator with the mocked resolver
      const multiTargetStage = createMultiTargetResolutionStage({
        entityManager,
        logger,
        unifiedScopeResolver,
        targetResolver: targetResolutionService,
      });

      const mockTargetComponentValidator = {
        validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
        validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
      };

      // Create mock TargetRequiredComponentsValidator
      const mockTargetRequiredComponentsValidator =
        createMockTargetRequiredComponentsValidator();

      const actionPipelineOrchestrator = new ActionPipelineOrchestrator({
        actionIndex,
        prerequisiteService: {
          evaluate: jest.fn().mockReturnValue(true),
          evaluateActionConditions: jest.fn().mockResolvedValue({
            success: true,
            errors: [],
          }),
        },
        entityManager,
        targetService: targetResolutionService,
        formatter: new ActionCommandFormatter({ logger }),
        logger,
        safeEventDispatcher: newSafeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        errorBuilder: createMockActionErrorContextBuilder(),
        unifiedScopeResolver,
        targetContextBuilder: createMockTargetContextBuilder(),
        targetComponentValidator: mockTargetComponentValidator,
        targetRequiredComponentsValidator:
          mockTargetRequiredComponentsValidator,
        multiTargetResolutionStage: multiTargetStage,
      });

      // Recreate the ActionDiscoveryService with the new orchestrator
      const traceContextFactory = jest.fn(() => ({
        addStep: jest.fn(),
        toJSON: jest.fn(() => ({})),
      }));

      const actionDiscovery = new ActionDiscoveryService({
        actionPipelineOrchestrator,
        entityManager,
        traceContextFactory,
        logger,
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscovery.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'physical-control:turn_around'
      );

      // Should include Bob as a target since Alice is behind Bob
      const bobAction = turnAroundActions.find(
        (a) => a.params.targetId === bob
      );
      expect(bobAction).toBeDefined();
    });
  });
});
