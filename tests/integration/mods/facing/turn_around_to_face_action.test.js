/**
 * @file Integration tests for the facing:turn_around_to_face action.
 * @description Tests basic action discovery - verifies the action appears when
 * the actor has the required components (closeness and facing_away).
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
import turnAroundToFaceAction from '../../../../data/mods/facing/actions/turn_around_to_face.action.json';
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
import { extractTargetIds } from '../../../common/actions/targetParamTestHelpers.js';

describe('Turn Around to Face Action Discovery', () => {
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
  let mockUnifiedScopeResolver;

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
      'data/mods/facing-states/scopes/actors_im_facing_away_from.scope'
    );
    const scopeContent = fs.readFileSync(scopePath, 'utf-8');
    const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);

    // Register scopes
    scopeRegistry.initialize(Object.fromEntries(parsedScopes));

    scopeEngine = new ScopeEngine();

    // Set up action discovery dependencies
    const dataRegistry = new InMemoryDataRegistry();

    // Store the action definition in the data registry
    dataRegistry.store(
      'actions',
      turnAroundToFaceAction.id,
      turnAroundToFaceAction
    );

    // Store the condition definition in the data registry
    const entityNotInFacingAwayCondition = {
      id: 'facing-states:entity-not-in-facing-away',
      description:
        "Checks if the entity is not in the actor's facing_away_from array",
      logic: {
        not: {
          in: [
            { var: 'entity.id' },
            {
              var: 'actor.components.facing-states:facing_away.facing_away_from',
            },
          ],
        },
      },
    };
    dataRegistry.store(
      'conditions',
      entityNotInFacingAwayCondition.id,
      entityNotInFacingAwayCondition
    );

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

    // Create mock UnifiedScopeResolver that will be properly mocked for each test
    mockUnifiedScopeResolver = createMockUnifiedScopeResolver({
      scopeRegistry,
      entityManager,
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
      unifiedScopeResolver: mockUnifiedScopeResolver,
      targetContextBuilder: createMockTargetContextBuilder(),
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator: mockTargetRequiredComponentsValidator,
      multiTargetResolutionStage: createMultiTargetResolutionStage({
        entityManager,
        logger,
        unifiedScopeResolver: mockUnifiedScopeResolver,
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
      // Alice has no intimacy components
      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundToFaceAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );
      expect(turnAroundToFaceAction).toBeUndefined();
    });

    it('should not show action when actor has closeness but no facing_away', async () => {
      // Alice is in closeness with Bob but not facing away
      entityManager.addComponent(alice, 'personal-space-states:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'personal-space-states:closeness', {
        partners: [alice],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundToFaceAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );
      expect(turnAroundToFaceAction).toBeUndefined();
    });

    it('should show action when actor has both required components', async () => {
      // Mock the unifiedScopeResolver to return Bob as a valid target
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_im_facing_away_from') {
            return { success: true, value: new Set([bob]) };
          }
          return { success: true, value: new Set() };
        });

      // Set up closeness
      entityManager.addComponent(alice, 'personal-space-states:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'personal-space-states:closeness', {
        partners: [alice],
      });

      // Alice is facing away from Bob
      entityManager.addComponent(alice, 'facing-states:facing_away', {
        facing_away_from: [bob],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundToFaceAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );
      expect(turnAroundToFaceAction).toBeDefined();
      expect(turnAroundToFaceAction.command).toBe(
        'turn around to face bob-entity'
      );
      expect(extractTargetIds(turnAroundToFaceAction.params)).toContain(bob);
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

    it('should only show entities that actor is facing away from', async () => {
      // Mock the unifiedScopeResolver to return Bob and Charlie as valid targets
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_im_facing_away_from') {
            return { success: true, value: new Set([bob, charlie]) };
          }
          return { success: true, value: new Set() };
        });

      // Alice is facing away from Bob and Charlie, but not Diana
      entityManager.addComponent(alice, 'facing-states:facing_away', {
        facing_away_from: [bob, charlie],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      // With the current multi-target implementation, there should be one action
      // that can target multiple entities
      const turnAroundActions = actions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(1);

      const action = turnAroundActions[0];
      const primaryTargets = action.params?.targetIds?.primary ?? [];

      expect(primaryTargets.length).toBeGreaterThan(0);
      expect(primaryTargets).toContain(bob);
      expect(primaryTargets).toContain(charlie);
    });

    it('should handle empty facing_away_from array', async () => {
      // Alice has facing_away component but empty array
      entityManager.addComponent(alice, 'facing-states:facing_away', {
        facing_away_from: [],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      // Should have no turn around actions since facing_away_from is empty
      const turnAroundActions = actions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(0);
    });

    it('should filter out entities not in closeness', async () => {
      // Mock the unifiedScopeResolver to return only Bob (outsider filtered out)
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_im_facing_away_from') {
            return { success: true, value: new Set([bob]) };
          }
          return { success: true, value: new Set() };
        });

      // Create an entity outside closeness
      const outsider = 'outsider-entity';
      entityManager.addComponent(outsider, NAME_COMPONENT_ID, {
        name: 'Outsider',
      });
      entityManager.addComponent(outsider, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });

      // Alice is facing away from Bob and the outsider
      entityManager.addComponent(alice, 'facing-states:facing_away', {
        facing_away_from: [bob, outsider],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      // Only Bob should have an action (outsider not in closeness)
      const turnAroundActions = actions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(1);
      expect(extractTargetIds(turnAroundActions[0].params)).toContain(bob);
    });

    it('should handle single target in facing_away_from', async () => {
      // Mock the unifiedScopeResolver to return only Bob
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_im_facing_away_from') {
            return { success: true, value: new Set([bob]) };
          }
          return { success: true, value: new Set() };
        });

      // Alice is only facing away from Bob
      entityManager.addComponent(alice, 'facing-states:facing_away', {
        facing_away_from: [bob],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(1);
      expect(extractTargetIds(turnAroundActions[0].params)).toContain(bob);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle bidirectional facing away', async () => {
      // Mock the unifiedScopeResolver to return appropriate targets for each actor
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope, context) => {
          if (scope === 'facing-states:actors_im_facing_away_from') {
            // Check which actor is requesting
            if (context?.actor?.id === alice) {
              return { success: true, value: new Set([bob]) };
            } else if (context?.actor?.id === bob) {
              return { success: true, value: new Set([alice]) };
            }
          }
          return { success: true, value: new Set() };
        });

      // Set up closeness
      entityManager.addComponent(alice, 'personal-space-states:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'personal-space-states:closeness', {
        partners: [alice],
      });

      // Both are facing away from each other
      entityManager.addComponent(alice, 'facing-states:facing_away', {
        facing_away_from: [bob],
      });
      entityManager.addComponent(bob, 'facing-states:facing_away', {
        facing_away_from: [alice],
      });

      // Check Alice's actions
      const aliceEntity = entityManager.getEntityInstance(alice);
      const aliceResult =
        await actionDiscoveryService.getValidActions(aliceEntity);
      const aliceActions = aliceResult.actions;
      const aliceTurnActions = aliceActions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );
      expect(aliceTurnActions).toHaveLength(1);
      expect(extractTargetIds(aliceTurnActions[0].params)).toContain(bob);

      // Check Bob's actions
      const bobEntity = entityManager.getEntityInstance(bob);
      const bobResult = await actionDiscoveryService.getValidActions(bobEntity);
      const bobActions = bobResult.actions;
      const bobTurnActions = bobActions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );
      expect(bobTurnActions).toHaveLength(1);
      expect(extractTargetIds(bobTurnActions[0].params)).toContain(alice);
    });

    it('should handle partial facing away in group', async () => {
      // Mock the unifiedScopeResolver to return only Bob
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_im_facing_away_from') {
            return { success: true, value: new Set([bob]) };
          }
          return { success: true, value: new Set() };
        });

      // Set up closeness for all
      entityManager.addComponent(alice, 'personal-space-states:closeness', {
        partners: [bob, charlie],
      });
      entityManager.addComponent(bob, 'personal-space-states:closeness', {
        partners: [alice, charlie],
      });
      entityManager.addComponent(charlie, 'personal-space-states:closeness', {
        partners: [alice, bob],
      });

      // Alice faces away from Bob but faces Charlie
      entityManager.addComponent(alice, 'facing-states:facing_away', {
        facing_away_from: [bob],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      // Only Bob should be a valid target
      expect(turnAroundActions).toHaveLength(1);
      expect(extractTargetIds(turnAroundActions[0].params)).toContain(bob);
    });
  });
});
