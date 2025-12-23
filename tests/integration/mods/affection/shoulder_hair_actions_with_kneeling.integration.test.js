/**
 * @file Integration tests for shoulder/hair actions when target is kneeling
 * @description Validates that shoulder and hair-focused actions ARE available when target kneels before actor
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { SimpleEntityManager } from '../../../common/entities/index.js';
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
import { createTargetResolutionServiceWithMocks } from '../../../common/mocks/mockUnifiedScopeResolver.js';
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

// Import action definitions
import placeHandsOnShouldersAction from '../../../../data/mods/affection/actions/place_hands_on_shoulders.action.json';
import ruffleHairPlayfullyAction from '../../../../data/mods/affection/actions/ruffle_hair_playfully.action.json';
import massageShouldersAction from '../../../../data/mods/affection/actions/massage_shoulders.action.json';

/**
 * Creates a mock body graph service for anatomy-related conditions
 *
 * @returns {object} Mock body graph service with anatomy detection methods
 */
function createMockBodyGraphService() {
  const rootToParts = new Map();
  const partCache = new Map();

  const registerParts = (rootId, parts = []) => {
    rootToParts.set(
      rootId,
      parts.map((part) => {
        partCache.set(part.id, { partType: part.partType });
        return part.id;
      })
    );
  };

  return {
    getPartsOfType: jest.fn((rootId, partType) => {
      const parts = rootToParts.get(rootId) || [];
      return parts
        .map((id) => ({ id, partType: partCache.get(id)?.partType }))
        .filter(
          (part) =>
            part.partType &&
            part.partType.toLowerCase() === partType.toLowerCase()
        );
    }),
    getBodyPart: jest.fn((partId) => partCache.get(partId) || null),
    hasPartWithComponentValue: jest.fn().mockReturnValue(false),
    findPartsByType: jest.fn((rootId, partType) => {
      const parts = rootToParts.get(rootId) || [];
      return parts.filter((id) =>
        (partCache.get(id)?.partType || '')
          .toLowerCase()
          .includes(partType.toLowerCase())
      );
    }),
    buildAdjacencyCache: jest.fn(),
    clearCache: jest.fn(),
    getAllParts: jest.fn((bodyComponent) => {
      const rootId = bodyComponent?.body?.root ?? bodyComponent?.root ?? null;
      return rootId ? rootToParts.get(rootId) || [] : [];
    }),
    getCacheNode: jest.fn((partId) => partCache.get(partId) || null),
    registerParts,
  };
}

describe('Shoulder and Hair Actions with Kneeling Position', () => {
  let entityManager;
  let actionDiscoveryService;
  let actionPipelineOrchestrator;
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
      'data/mods/facing-states/scopes/actors_in_location_facing.scope',
      'data/mods/personal-space/scopes/close_actors_or_entity_kneeling_before_actor.scope',
      'data/mods/personal-space/scopes/close_actors.scope',
      'data/mods/personal-space/scopes/close_actors_facing_each_other_or_behind_target.scope',
      'data/mods/affection/scopes/close_actors_with_hair_or_entity_kneeling_before_actor.scope',
      'data/mods/affection/scopes/actors_with_arms_facing_each_other_or_behind_target.scope',
      'data/mods/affection/scopes/close_actors_facing_each_other.scope',
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
    dataRegistry.store(
      'actions',
      placeHandsOnShouldersAction.id,
      placeHandsOnShouldersAction
    );
    dataRegistry.store(
      'actions',
      ruffleHairPlayfullyAction.id,
      ruffleHairPlayfullyAction
    );
    dataRegistry.store(
      'actions',
      massageShouldersAction.id,
      massageShouldersAction
    );

    // Load necessary condition files
    const conditionPaths = [
      'data/mods/core/conditions/entity-at-location.condition.json',
      'data/mods/core/conditions/entity-is-not-current-actor.condition.json',
      'data/mods/core/conditions/entity-has-actor-component.condition.json',
      'data/mods/facing-states/conditions/entity-in-facing-away.condition.json',
      'data/mods/facing-states/conditions/entity-not-in-facing-away.condition.json',
      'data/mods/facing-states/conditions/both-actors-facing-each-other.condition.json',
      'data/mods/facing-states/conditions/actor-is-behind-entity.condition.json',
      'data/mods/deference-states/conditions/entity-kneeling-before-actor.condition.json',
      'data/mods/deference-states/conditions/actor-kneeling-before-entity.condition.json',
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
    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    const customOperators = new JsonLogicCustomOperators({
      entityManager,
      bodyGraphService: mockBodyGraphService,
      logger,
      lightingStateService: mockLightingStateService,
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
      placeHandsOnShouldersAction,
      ruffleHairPlayfullyAction,
      massageShouldersAction,
    ];
    actionIndex.buildIndex(allActions);

    const actionCommandFormatter = new ActionCommandFormatter({ logger });

    const mockTargetContextBuilder =
      createMockTargetContextBuilder(entityManager);

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

    const targetRequiredComponentsValidator =
      createMockTargetRequiredComponentsValidator();

    const multiTargetStage = createMultiTargetResolutionStage({
      logger,
      entityManager,
      targetResolver: targetResolutionService, // Fixed: use correct parameter name
      scopeContextBuilder,
    });

    // Create getEntityDisplayNameFn
    const getEntityDisplayNameFn = (entity) => {
      const nameComponent = entityManager.getComponent(
        entity.id || entity,
        'core:name'
      );
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
   * @param {string} entityId - The entity ID
   * @param {string} actorName - The actor name
   * @returns {string} The created entity ID
   */
  function createActor(entityId, actorName) {
    const actor = entityManager.createEntity(entityId);
    entityManager.addComponent(entityId, NAME_COMPONENT_ID, {
      name: actorName,
    });
    entityManager.addComponent(entityId, POSITION_COMPONENT_ID, {
      location: location,
    });
    entityManager.addComponent(entityId, 'core:actor', {});
    // Add empty facing_away component to indicate actors are facing each other
    entityManager.addComponent(entityId, 'facing-states:facing_away', {
      facing_away_from: [],
    });
    addHairAnatomy(entityId);
    return actor;
  }

  function addHairAnatomy(entityId) {
    const rootId = `${entityId}:head`;
    const hairId = `${entityId}:hair`;

    entityManager.createEntity(rootId);
    entityManager.addComponent(rootId, 'anatomy:part', {
      parent: null,
      children: [hairId],
      subType: 'head',
    });

    entityManager.createEntity(hairId);
    entityManager.addComponent(hairId, 'anatomy:part', {
      parent: rootId,
      children: [],
      subType: 'hair',
    });
    entityManager.addComponent(hairId, 'anatomy:joint', {
      parentId: rootId,
      socketId: 'head-hair',
    });

    entityManager.addComponent(entityId, 'anatomy:body', { root: rootId });

    mockBodyGraphService.registerParts(rootId, [
      { id: rootId, partType: 'head' },
      { id: hairId, partType: 'hair' },
    ]);
  }

  /**
   * Helper to establish closeness between two actors
   *
   * @param {string|object} actor1Id - The first actor ID or entity
   * @param {string|object} actor2Id - The second actor ID or entity
   */
  function establishCloseness(actor1Id, actor2Id) {
    const id1 = actor1Id.id || actor1Id;
    const id2 = actor2Id.id || actor2Id;

    // Get existing closeness components or create new ones
    const actor1Closeness = entityManager.getComponent(
      id1,
      'personal-space-states:closeness'
    );
    const actor2Closeness = entityManager.getComponent(
      id2,
      'personal-space-states:closeness'
    );

    // Merge partners arrays, avoiding duplicates
    const actor1Partners = actor1Closeness?.partners || [];
    const actor2Partners = actor2Closeness?.partners || [];

    entityManager.addComponent(id1, 'personal-space-states:closeness', {
      partners: [...new Set([...actor1Partners, id2])],
    });
    entityManager.addComponent(id2, 'personal-space-states:closeness', {
      partners: [...new Set([...actor2Partners, id1])],
    });
  }

  /**
   * Helper to make an actor kneel before another
   *
   * @param {string|object} kneelerId - The kneeling actor ID or entity
   * @param {string|object} targetId - The target actor ID or entity
   */
  function makeActorKneelBefore(kneelerId, targetId) {
    entityManager.addComponent(
      kneelerId.id || kneelerId,
      'deference-states:kneeling_before',
      {
        entityId: targetId.id || targetId,
      }
    );
  }

  /**
   * Helper to check if action is available for a specific target
   *
   * @param {object} result - The action discovery result
   * @param {string} actionId - The action ID to check
   * @param {string|object} targetId - The target actor ID or entity
   * @returns {boolean} True if the action is available for the target
   */
  function hasActionForTarget(result, actionId, targetId) {
    if (!result?.actions) return false;
    // Normalize targetId to string (handle both entity objects and string IDs)
    const normalizedTargetId = targetId?.id || targetId;
    return result.actions.some(
      (a) => a.id === actionId && a.params?.targetId === normalizedTargetId
    );
  }

  describe('Place Hands on Shoulders Action', () => {
    it('should BE available when target is kneeling before actor', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Place hands on shoulders SHOULD be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2
        )
      ).toBe(true);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor1 kneels before Actor2
      makeActorKneelBefore(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Place hands on shoulders should NOT be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2
        )
      ).toBe(false);
    });

    it('should BE available when neither is kneeling', async () => {
      // Arrange: Two actors in closeness, neither kneeling
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Place hands on shoulders SHOULD be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2.id || actor2
        )
      ).toBe(true);
    });
  });

  describe('Ruffle Hair Playfully Action', () => {
    it('should BE available when target is kneeling before actor', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Ruffle hair SHOULD be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor2
        )
      ).toBe(true);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor1 kneels before Actor2
      makeActorKneelBefore(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Ruffle hair should NOT be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor2
        )
      ).toBe(false);
    });

    it('should BE available when neither is kneeling', async () => {
      // Arrange: Two actors in closeness, neither kneeling
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Ruffle hair SHOULD be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor2
        )
      ).toBe(true);
    });
  });

  describe('Massage Shoulders Action', () => {
    it('should BE available when target is kneeling before actor', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Massage shoulders SHOULD be available
      expect(
        hasActionForTarget(actor1Actions, 'affection:massage_shoulders', actor2)
      ).toBe(true);
    });

    it('should NOT be available when actor is kneeling before target', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor1 kneels before Actor2
      makeActorKneelBefore(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Massage shoulders should NOT be available
      expect(
        hasActionForTarget(actor1Actions, 'affection:massage_shoulders', actor2)
      ).toBe(false);
    });

    it('should BE available when neither is kneeling', async () => {
      // Arrange: Two actors in closeness, neither kneeling
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Massage shoulders SHOULD be available
      expect(
        hasActionForTarget(actor1Actions, 'affection:massage_shoulders', actor2)
      ).toBe(true);
    });
  });

  describe('Combined Scenario - All Three Actions', () => {
    it('should have all three shoulder/hair actions available when target kneels before actor', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: All three actions SHOULD be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2
        )
      ).toBe(true);
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor2
        )
      ).toBe(true);
      expect(
        hasActionForTarget(actor1Actions, 'affection:massage_shoulders', actor2)
      ).toBe(true);
    });

    it('should have NO shoulder/hair actions available when actor kneels before target', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor1 kneels before Actor2
      makeActorKneelBefore(actor1, actor2);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: All three actions should NOT be available
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2
        )
      ).toBe(false);
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor2
        )
      ).toBe(false);
      expect(
        hasActionForTarget(actor1Actions, 'affection:massage_shoulders', actor2)
      ).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should make actions available again after target stands up', async () => {
      // Arrange: Two actors in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      establishCloseness(actor1, actor2);

      // Actor1 kneels before Actor2
      makeActorKneelBefore(actor1, actor2);

      // Act 1: Verify actions are unavailable while kneeling
      let actor1Actions = await actionDiscoveryService.getValidActions(actor1);
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2
        )
      ).toBe(false);

      // Act 2: Actor1 stands up
      entityManager.removeComponent(
        actor1.id || actor1,
        'deference-states:kneeling_before'
      );

      // Act 3: Get actions again
      actor1Actions = await actionDiscoveryService.getValidActions(actor1);

      // Assert: Actions should be available again
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2
        )
      ).toBe(true);
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor2
        )
      ).toBe(true);
      expect(
        hasActionForTarget(actor1Actions, 'affection:massage_shoulders', actor2)
      ).toBe(true);
    });

    it('should handle multiple actors with mixed kneeling states correctly', async () => {
      // Arrange: Three actors all in closeness
      actor1 = createActor('test:actor1', 'Alice');
      actor2 = createActor('test:actor2', 'Bob');
      const actor3 = createActor('test:actor3', 'Charlie');

      establishCloseness(actor1, actor2);
      establishCloseness(actor1, actor3);
      establishCloseness(actor2, actor3);

      // Actor2 kneels before Actor1
      makeActorKneelBefore(actor2, actor1);

      // Act: Get available actions for Actor1
      const actor1Actions =
        await actionDiscoveryService.getValidActions(actor1);

      // Assert: Actor1 can use shoulder/hair actions on Actor2 (kneeling) and Actor3 (standing)
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor2
        )
      ).toBe(true);
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:place_hands_on_shoulders',
          actor3
        )
      ).toBe(true);
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor2
        )
      ).toBe(true);
      expect(
        hasActionForTarget(
          actor1Actions,
          'affection:ruffle_hair_playfully',
          actor3
        )
      ).toBe(true);
    });
  });
});
