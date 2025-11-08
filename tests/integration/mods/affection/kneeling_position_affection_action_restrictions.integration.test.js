/**
 * @file Integration tests for kneeling position restrictions on affection actions
 * @description Validates that affection actions are unavailable when actors have incompatible kneeling positions
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';
import { ActionDiscoveryService } from '../../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';
import ActionCommandFormatter from '../../../../src/actions/actionFormatter.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import {
  createMockActionErrorContextBuilder,
  createMockTargetRequiredComponentsValidator,
} from '../../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../../common/mocks/mockTargetContextBuilder.js';
import { createMultiTargetResolutionStage } from '../../../common/actions/multiTargetStageTestUtilities.js';
import { ScopeContextBuilder } from '../../../../src/actions/pipeline/services/implementations/ScopeContextBuilder.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import {
  createTargetResolutionServiceWithMocks,
} from '../../../common/mocks/mockUnifiedScopeResolver.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import DefaultDslParser from '../../../../src/scopeDsl/parser/defaultDslParser.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';

// Import action definitions
import hugTightAction from '../../../../data/mods/hugging/actions/hug_tight.action.json';
import linkArmsAction from '../../../../data/mods/affection/actions/link_arms.action.json';
import placeHandOnWaistAction from '../../../../data/mods/affection/actions/place_hand_on_waist.action.json';
import restHeadOnShoulderAction from '../../../../data/mods/affection/actions/rest_head_on_shoulder.action.json';
import slingArmAroundShouldersAction from '../../../../data/mods/affection/actions/sling_arm_around_shoulders.action.json';
import wrapArmAroundWaistAction from '../../../../data/mods/affection/actions/wrap_arm_around_waist.action.json';

/**
 * Creates a mock body graph service for anatomy-related conditions
 *
 * @returns {object} Mock body graph service with anatomy detection methods
 */
function createMockBodyGraphService() {
  return {
    getPartsOfType: jest.fn(() => []),
    getBodyPart: jest.fn().mockReturnValue(null),
    hasPartWithComponentValue: jest.fn().mockReturnValue(false),
    findPartsByType: jest.fn().mockReturnValue([]),
    buildAdjacencyCache: jest.fn(),
    clearCache: jest.fn(),
    getAllParts: jest.fn().mockReturnValue([]),
  };
}

describe('Kneeling Position Affection Action Restrictions', () => {
  let entityManager;
  let actionDiscoveryService;
  let actionPipelineOrchestrator;
  let eventBus;
  let actor1;
  let actor2;
  let location;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let targetResolutionService;
  let gameDataRepository;
  let actionIndex;
  let safeEventDispatcher;
  let mockBodyGraphService;

  beforeEach(async () => {
    // Clear entity cache to prevent stale data from previous tests
    clearEntityCache();

    // Set up logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Set up entity manager
    entityManager = new SimpleEntityManager([], logger);

    // Set up mock body graph service
    mockBodyGraphService = createMockBodyGraphService();

    // Set up scope registry and engine
    scopeRegistry = new ScopeRegistry();

    // Load necessary scope files
    const scopePaths = [
      'data/mods/core/scopes/actors_in_location.scope',
      'data/mods/positioning/scopes/actors_in_location_facing.scope',
      'data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope',
      'data/mods/positioning/scopes/close_actors.scope',
      'data/mods/affection/scopes/close_actors_facing_each_other.scope',
      'data/mods/positioning/scopes/close_actors_or_entity_kneeling_before_actor.scope',
    ];

    const parsedScopes = [];
    for (const scopePath of scopePaths) {
      const fullPath = path.join(process.cwd(), scopePath);
      if (fs.existsSync(fullPath)) {
        const scopeContent = fs.readFileSync(fullPath, 'utf-8');
        const scopes = parseScopeDefinitions(scopeContent, fullPath);
        parsedScopes.push(...scopes);
      }
    }

    // Register scopes
    scopeRegistry.initialize(Object.fromEntries(parsedScopes));

    scopeEngine = new ScopeEngine({ scopeRegistry });

    // Set up action discovery dependencies
    const dataRegistry = new InMemoryDataRegistry();

    // Store the action definitions in the data registry
    dataRegistry.store('actions', hugTightAction.id, hugTightAction);
    dataRegistry.store('actions', linkArmsAction.id, linkArmsAction);
    dataRegistry.store('actions', placeHandOnWaistAction.id, placeHandOnWaistAction);
    dataRegistry.store('actions', restHeadOnShoulderAction.id, restHeadOnShoulderAction);
    dataRegistry.store('actions', slingArmAroundShouldersAction.id, slingArmAroundShouldersAction);
    dataRegistry.store('actions', wrapArmAroundWaistAction.id, wrapArmAroundWaistAction);

    // Load necessary condition files
    const conditionPaths = [
      'data/mods/core/conditions/entity-at-location.condition.json',
      'data/mods/core/conditions/entity-is-not-current-actor.condition.json',
      'data/mods/core/conditions/entity-has-actor-component.condition.json',
      'data/mods/positioning/conditions/entity-in-facing-away.condition.json',
      'data/mods/positioning/conditions/entity-not-in-facing-away.condition.json',
      'data/mods/positioning/conditions/both-actors-facing-each-other.condition.json',
      'data/mods/positioning/conditions/actor-is-behind-entity.condition.json',
      'data/mods/positioning/conditions/entity-kneeling-before-actor.condition.json',
      'data/mods/positioning/conditions/actor-kneeling-before-entity.condition.json',
      'data/mods/positioning/conditions/entity-is-bending-over.condition.json',
    ];

    for (const conditionPath of conditionPaths) {
      const fullPath = path.join(process.cwd(), conditionPath);
      if (fs.existsSync(fullPath)) {
        const conditionContent = fs.readFileSync(fullPath, 'utf-8');
        const condition = JSON.parse(conditionContent);
        dataRegistry.store('conditions', condition.id, condition);
      }
    }

    gameDataRepository = new GameDataRepository(dataRegistry, logger);

    // Set up dslParser and other dependencies
    const dslParser = new DefaultDslParser();
    const jsonLogicService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    // Register custom operators for anatomy-related conditions
    const customOperators = new JsonLogicCustomOperators({
      entityManager,
      bodyGraphService: mockBodyGraphService,
      logger,
    });
    customOperators.registerOperators(jsonLogicService);
    const actionErrorContextBuilder = createMockActionErrorContextBuilder();

    // Create mock validatedEventDispatcher for SafeEventDispatcher
    const validatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    eventBus = validatedEventDispatcher;

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

    // Create real prerequisiteEvaluationService
    const actionValidationContextBuilder = new ActionValidationContextBuilder({
      entityManager,
      logger,
    });

    const prereqService = new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder,
      gameDataRepository,
    });

    actionIndex = new ActionIndex({ logger, entityManager });

    // Build index with the loaded actions
    const allActions = [
      hugTightAction,
      linkArmsAction,
      placeHandOnWaistAction,
      restHeadOnShoulderAction,
      slingArmAroundShouldersAction,
      wrapArmAroundWaistAction,
    ];
    actionIndex.buildIndex(allActions);

    const actionCommandFormatter = new ActionCommandFormatter({ logger });

    const mockTargetContextBuilder = createMockTargetContextBuilder(entityManager);

    const scopeContextBuilder = new ScopeContextBuilder({
      targetContextBuilder: mockTargetContextBuilder,
      entityManager,
      logger,
    });

    // Create mock TargetComponentValidator
    const mockTargetComponentValidator = {
      validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
      validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
    };

    const targetRequiredComponentsValidator = createMockTargetRequiredComponentsValidator();

    const multiTargetStage = createMultiTargetResolutionStage({
      logger,
      entityManager,
      targetResolver: targetResolutionService,
      scopeContextBuilder,
    });

    // Create getEntityDisplayNameFn
    const getEntityDisplayNameFn = (entity) => {
      const nameComponent = entityManager.getComponent(entity.id || entity, 'core:name');
      return nameComponent?.name || entity.id || entity;
    };

    actionPipelineOrchestrator = new ActionPipelineOrchestrator({
      actionIndex,
      prerequisiteService: prereqService,
      targetService: targetResolutionService,
      formatter: actionCommandFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn,
      errorBuilder: actionErrorContextBuilder,
      logger,
      unifiedScopeResolver: targetResolutionService,
      targetContextBuilder: mockTargetContextBuilder,
      multiTargetResolutionStage: multiTargetStage,
      targetComponentValidator: mockTargetComponentValidator,
      targetRequiredComponentsValidator,
    });

    // Create mock traceContextFactory as a function
    const traceContextFactory = jest.fn(() => ({
      addStep: jest.fn(),
      toJSON: jest.fn(() => ({})),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      context: {},
    }));

    // Create action discovery service
    actionDiscoveryService = new ActionDiscoveryService({
      actionPipelineOrchestrator,
      entityManager,
      traceContextFactory,
      logger,
    });

    // Create test location
    location = entityManager.createEntity('test:location');
    entityManager.addComponent(location, NAME_COMPONENT_ID, {
      name: 'Test Location',
    });
  });

  /**
   * Helper to create an actor with required anatomy
   *
   * @param entityId
   * @param actorName
   */
  function createActor(entityId, actorName) {
    const actor = entityManager.createEntity(entityId);
    entityManager.addComponent(entityId, NAME_COMPONENT_ID, { name: actorName });
    entityManager.addComponent(entityId, POSITION_COMPONENT_ID, {
      location: location,
    });
    entityManager.addComponent(entityId, 'core:actor', {});
    // Add empty facing_away component to indicate actors are facing each other
    entityManager.addComponent(entityId, 'positioning:facing_away', {
      facing_away_from: [],
    });
    return actor;
  }

  /**
   * Helper to establish closeness between two actors
   * Appends to existing partners if closeness already exists
   *
   * @param actor1Id
   * @param actor2Id
   */
  function establishCloseness(actor1Id, actor2Id) {
    const id1 = actor1Id.id || actor1Id;
    const id2 = actor2Id.id || actor2Id;

    // Get existing closeness or create new
    const actor1Closeness = entityManager.getComponent(id1, 'positioning:closeness');
    const actor2Closeness = entityManager.getComponent(id2, 'positioning:closeness');

    // Add actor2 to actor1's partners (if not already there)
    // IMPORTANT: Create a copy of the array to avoid mutation
    const actor1Partners = [...(actor1Closeness?.partners || [])];
    if (!actor1Partners.includes(id2)) {
      actor1Partners.push(id2);
    }
    entityManager.addComponent(id1, 'positioning:closeness', {
      partners: actor1Partners,
    });

    // Add actor1 to actor2's partners (if not already there)
    // IMPORTANT: Create a copy of the array to avoid mutation
    const actor2Partners = [...(actor2Closeness?.partners || [])];
    if (!actor2Partners.includes(id1)) {
      actor2Partners.push(id1);
    }
    entityManager.addComponent(id2, 'positioning:closeness', {
      partners: actor2Partners,
    });
  }

  /**
   * Helper to make an actor kneel before another
   *
   * @param kneelerId
   * @param targetId
   */
  function makeActorKneelBefore(kneelerId, targetId) {
    const kneelingEntityId = kneelerId.id || kneelerId;
    const targetEntityId = targetId.id || targetId;
    entityManager.addComponent(kneelingEntityId, 'positioning:kneeling_before', {
      entityId: targetEntityId,
    });
  }

  /**
   * Helper to check if action is available for a specific target
   *
   * @param result
   * @param actionId
   * @param targetId
   */
  function hasActionForTarget(result, actionId, targetId) {
    if (!result?.actions) return false;
    // Extract ID from entity object if needed
    const targetIdString = typeof targetId === 'string' ? targetId : targetId?.id;
    return result.actions.some(
      (a) => a.id === actionId && a.params?.targetId === targetIdString
    );
  }

  describe('Hug Tight Action (positioning:close_actors_facing_each_other_or_behind_target)', () => {
    it('should NOT be available when target is kneeling before actor', async () => {
      // Arrange: Two actors in closeness, facing each other
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act: Get available actions for Actor1
      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      // Assert: Hug tight action should NOT be available for Actor2
      expect(hasActionForTarget(actor1Actions, 'hugging:hug_tight', actor2)).toBe(false);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor1 kneels before Actor2
      makeActorKneelBefore(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      // Assert: Hug tight action should NOT be available for Actor2
      expect(hasActionForTarget(actor1Actions, 'hugging:hug_tight', actor2)).toBe(false);
    });

    it('should BE available when neither is kneeling', async () => {
      // Arrange: Two actors in closeness, neither kneeling
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      // Assert: Hug tight action SHOULD be available
      expect(hasActionForTarget(actor1Actions, 'hugging:hug_tight', actor2)).toBe(true);
    });
  });

  describe('Link Arms Action (positioning:close_actors_facing_each_other_or_behind_target)', () => {
    it('should NOT be available when target is kneeling before actor', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor2, actor1);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:link_arms', actor2)).toBe(false);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor1, actor2);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:link_arms', actor2)).toBe(false);
    });
  });

  describe('Place Hand on Waist Action (positioning:close_actors)', () => {
    it('should NOT be available when target is kneeling before actor', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor2, actor1);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:place_hand_on_waist', actor2)).toBe(false);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor1, actor2);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:place_hand_on_waist', actor2)).toBe(false);
    });
  });

  describe('Rest Head on Shoulder Action (positioning:close_actors_facing_each_other_or_behind_target)', () => {
    it('should NOT be available when target is kneeling before actor', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor2, actor1);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:rest_head_on_shoulder', actor2)).toBe(false);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor1, actor2);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:rest_head_on_shoulder', actor2)).toBe(false);
    });
  });

  describe('Sling Arm Around Shoulders Action (affection:close_actors_facing_each_other)', () => {
    it('should NOT be available when target is kneeling before actor', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor2, actor1);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:sling_arm_around_shoulders', actor2)).toBe(false);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor1, actor2);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:sling_arm_around_shoulders', actor2)).toBe(false);
    });
  });

  describe('Wrap Arm Around Waist Action (affection:close_actors_facing_each_other)', () => {
    it('should NOT be available when target is kneeling before actor', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor2, actor1);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:wrap_arm_around_waist', actor2)).toBe(false);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);
      makeActorKneelBefore(actor1, actor2);

      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      expect(hasActionForTarget(actor1Actions, 'affection:wrap_arm_around_waist', actor2)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple actors with mixed kneeling states', async () => {
      // Arrange: Three actors all in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      const actor3 = createActor('test:actor3', 'Charlie');

      establishCloseness(actor1, actor2);
      establishCloseness(actor1, actor3);
      establishCloseness(actor2, actor3);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act: Get available actions for all actors
      const actor1Actions = await actionDiscoveryService.getValidActions(actor1);
      const actor3Actions = await actionDiscoveryService.getValidActions(actor3);

      // Assert: Actor1 can hug Actor3 but not Actor2 (who is kneeling)
      expect(hasActionForTarget(actor1Actions, 'hugging:hug_tight', actor3)).toBe(true);
      expect(hasActionForTarget(actor1Actions, 'hugging:hug_tight', actor2)).toBe(false);

      // Assert: Actor3 can hug both Actor1 and Actor2
      expect(hasActionForTarget(actor3Actions, 'hugging:hug_tight', actor1)).toBe(true);
      expect(hasActionForTarget(actor3Actions, 'hugging:hug_tight', actor2)).toBe(true);
    });

    it('should make actions available again after standing up', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act 1: Verify actions are unavailable while kneeling
      let actor1Actions = await actionDiscoveryService.getValidActions(actor1);
      expect(hasActionForTarget(actor1Actions, 'hugging:hug_tight', actor2)).toBe(false);

      // Act 2: Actor2 stands up
      entityManager.removeComponent(actor2.id, 'positioning:kneeling_before');

      // Clear cache after component removal since SimpleEntityManager doesn't emit events
      clearEntityCache();

      // Act 3: Get actions again
      actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      // Assert: Actions should be available again
      expect(hasActionForTarget(actor1Actions, 'hugging:hug_tight', actor2)).toBe(true);
    });
  });
});
