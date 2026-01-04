/**
 * @file Integration test for the turn_around_to_face action availability after turn_your_back.
 * @description Tests the specific bug scenario: When two actors NOT in closeness are in
 * the same location, if actor A uses turn_your_back on actor B, the turn_around_to_face
 * action should be available for A to turn back around to face B.
 *
 * Bug context: The original scope (personal-space-states:actors_im_facing_away_from)
 * required closeness, which meant turn_around_to_face was unavailable after turn_your_back
 * when actors were not in closeness. The fix uses a new scope
 * (facing-states:actors_in_location_im_facing_away_from) that only requires same location.
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
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import DefaultDslParser from '../../../../src/scopeDsl/parser/defaultDslParser.js';
import { extractTargetIds } from '../../../common/actions/targetParamTestHelpers.js';

describe('Turn Around After Turn Back Without Closeness (Bug Fix Verification)', () => {
  let entityManager;
  let actionDiscoveryService;
  let alicia;
  let bobby;
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

    // Load the NEW scope file from facing-states mod (not personal-space-states)
    const scopePath = path.join(
      process.cwd(),
      'data/mods/facing-states/scopes/actors_in_location_im_facing_away_from.scope'
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

    // Store the condition definitions in the data registry
    const entityInFacingAwayCondition = {
      id: 'facing-states:entity-in-facing-away',
      description:
        "Checks if the entity is in the actor's facing_away_from array",
      logic: {
        in: [
          { var: 'entity.id' },
          {
            var: 'actor.components.facing-states:facing_away.facing_away_from',
          },
        ],
      },
    };
    dataRegistry.store(
      'conditions',
      entityInFacingAwayCondition.id,
      entityInFacingAwayCondition
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

    // Create mock UnifiedScopeResolver
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
    const testLocation = 'tavern-common-room';
    entityManager.addComponent(testLocation, NAME_COMPONENT_ID, {
      name: 'Tavern Common Room',
    });
    entityManager.addComponent(testLocation, 'core:location', {
      description: 'A busy tavern common room',
    });

    // Create Alicia (the actor who will turn her back and then turn around)
    alicia = 'alicia-entity';
    entityManager.addComponent(alicia, NAME_COMPONENT_ID, {
      name: 'Alicia',
    });
    entityManager.addComponent(alicia, POSITION_COMPONENT_ID, {
      locationId: 'tavern-common-room',
    });
    entityManager.addComponent(alicia, 'core:actor', {});

    // Create Bobby (the target Alicia will turn her back to)
    bobby = 'bobby-entity';
    entityManager.addComponent(bobby, NAME_COMPONENT_ID, { name: 'Bobby' });
    entityManager.addComponent(bobby, POSITION_COMPONENT_ID, {
      locationId: 'tavern-common-room',
    });
    entityManager.addComponent(bobby, 'core:actor', {});

    // IMPORTANT: Alicia and Bobby are NOT in closeness!
    // No personal-space-states:closeness component is added to either entity
  });

  afterEach(() => {
    // Clean up
    entityManager = null;
    actionDiscoveryService = null;
    scopeRegistry = null;
    scopeEngine = null;
  });

  describe('Bug Scenario: Turn Your Back Without Closeness', () => {
    it('should show turn_around_to_face action after Alicia turns her back to Bobby (no closeness)', async () => {
      // Simulate the state AFTER Alicia used turn_your_back on Bobby
      // This adds the facing_away component with Bobby in the facing_away_from array
      entityManager.addComponent(alicia, 'facing-states:facing_away', {
        facing_away_from: [bobby],
      });

      // Mock the unifiedScopeResolver to return Bobby as a valid target
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_in_location_im_facing_away_from') {
            return { success: true, value: new Set([bobby]) };
          }
          return { success: true, value: new Set() };
        });

      // Get Alicia's available actions
      const aliciaEntity = entityManager.getEntityInstance(alicia);
      const result = await actionDiscoveryService.getValidActions(aliciaEntity);
      const actions = result.actions;

      // turn_around_to_face should be available with Bobby as a target
      const turnAroundAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundAction).toBeDefined();
      expect(turnAroundAction.command).toBe('turn around to face bobby-entity');

      const targetIds = extractTargetIds(turnAroundAction.params);
      expect(targetIds).toContain(bobby);
    });

    it('should NOT require closeness component for turn_around_to_face to be available', async () => {
      // Add facing_away component (simulating post-turn_your_back state)
      entityManager.addComponent(alicia, 'facing-states:facing_away', {
        facing_away_from: [bobby],
      });

      // Verify that Alicia does NOT have closeness component
      const aliciaCloseness = entityManager.getComponent(
        alicia,
        'personal-space-states:closeness'
      );
      expect(aliciaCloseness).toBeFalsy();

      // Mock the unifiedScopeResolver to return Bobby
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_in_location_im_facing_away_from') {
            return { success: true, value: new Set([bobby]) };
          }
          return { success: true, value: new Set() };
        });

      // Get Alicia's available actions
      const aliciaEntity = entityManager.getEntityInstance(alicia);
      const result = await actionDiscoveryService.getValidActions(aliciaEntity);
      const actions = result.actions;

      // turn_around_to_face should still be available without closeness
      const turnAroundAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundAction).toBeDefined();
    });

    it('should handle multiple actors in facing_away_from without closeness', async () => {
      // Create a third actor
      const carol = 'carol-entity';
      entityManager.addComponent(carol, NAME_COMPONENT_ID, { name: 'Carol' });
      entityManager.addComponent(carol, POSITION_COMPONENT_ID, {
        locationId: 'tavern-common-room',
      });
      entityManager.addComponent(carol, 'core:actor', {});

      // Alicia turned her back to both Bobby and Carol
      entityManager.addComponent(alicia, 'facing-states:facing_away', {
        facing_away_from: [bobby, carol],
      });

      // Mock the unifiedScopeResolver to return both Bobby and Carol
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_in_location_im_facing_away_from') {
            return { success: true, value: new Set([bobby, carol]) };
          }
          return { success: true, value: new Set() };
        });

      // Get Alicia's available actions
      const aliciaEntity = entityManager.getEntityInstance(alicia);
      const result = await actionDiscoveryService.getValidActions(aliciaEntity);
      const actions = result.actions;

      // turn_around_to_face should be available with both as targets
      const turnAroundActions = actions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(1);

      const targetIds = extractTargetIds(turnAroundActions[0].params);
      expect(targetIds).toContain(bobby);
      expect(targetIds).toContain(carol);
    });
  });

  describe('Location-Based Filtering', () => {
    it('should only include actors in the same location', async () => {
      // Create an actor in a different location
      const distantActor = 'distant-actor';
      entityManager.addComponent(distantActor, NAME_COMPONENT_ID, {
        name: 'Distant',
      });
      entityManager.addComponent(distantActor, POSITION_COMPONENT_ID, {
        locationId: 'another-location', // Different location!
      });
      entityManager.addComponent(distantActor, 'core:actor', {});

      // Alicia is facing away from Bobby (same location) and distantActor (different location)
      entityManager.addComponent(alicia, 'facing-states:facing_away', {
        facing_away_from: [bobby, distantActor],
      });

      // Mock the unifiedScopeResolver to return only Bobby (scope filters by location)
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_in_location_im_facing_away_from') {
            // Only Bobby is in the same location
            return { success: true, value: new Set([bobby]) };
          }
          return { success: true, value: new Set() };
        });

      // Get Alicia's available actions
      const aliciaEntity = entityManager.getEntityInstance(alicia);
      const result = await actionDiscoveryService.getValidActions(aliciaEntity);
      const actions = result.actions;

      // turn_around_to_face should only show Bobby, not distantActor
      const turnAroundActions = actions.filter(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(1);

      const targetIds = extractTargetIds(turnAroundActions[0].params);
      expect(targetIds).toContain(bobby);
      expect(targetIds).not.toContain(distantActor);
    });
  });

  describe('Edge Cases', () => {
    it('should NOT show action when actor has no facing_away component', async () => {
      // Alicia has no facing_away component (hasn't turned her back to anyone)
      const aliciaEntity = entityManager.getEntityInstance(alicia);
      const result = await actionDiscoveryService.getValidActions(aliciaEntity);
      const actions = result.actions;

      const turnAroundAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundAction).toBeUndefined();
    });

    it('should NOT show action when facing_away_from array is empty', async () => {
      // Alicia has facing_away component but empty array
      entityManager.addComponent(alicia, 'facing-states:facing_away', {
        facing_away_from: [],
      });

      const aliciaEntity = entityManager.getEntityInstance(alicia);
      const result = await actionDiscoveryService.getValidActions(aliciaEntity);
      const actions = result.actions;

      const turnAroundAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      // No valid targets, so action should not appear
      expect(turnAroundAction).toBeUndefined();
    });

    it('should handle the case where closeness EXISTS but is not required', async () => {
      // Add closeness component (even though it's not needed for this action)
      entityManager.addComponent(alicia, 'personal-space-states:closeness', {
        partners: [bobby],
      });
      entityManager.addComponent(bobby, 'personal-space-states:closeness', {
        partners: [alicia],
      });

      // Alicia turns her back to Bobby
      entityManager.addComponent(alicia, 'facing-states:facing_away', {
        facing_away_from: [bobby],
      });

      // Mock the unifiedScopeResolver to return Bobby
      mockUnifiedScopeResolver.resolve = jest
        .fn()
        .mockImplementation((scope) => {
          if (scope === 'facing-states:actors_in_location_im_facing_away_from') {
            return { success: true, value: new Set([bobby]) };
          }
          return { success: true, value: new Set() };
        });

      // Get Alicia's available actions
      const aliciaEntity = entityManager.getEntityInstance(alicia);
      const result = await actionDiscoveryService.getValidActions(aliciaEntity);
      const actions = result.actions;

      // Action should still work when closeness exists
      const turnAroundAction = actions.find(
        (a) => a.id === 'facing:turn_around_to_face'
      );

      expect(turnAroundAction).toBeDefined();
      expect(extractTargetIds(turnAroundAction.params)).toContain(bobby);
    });
  });
});
