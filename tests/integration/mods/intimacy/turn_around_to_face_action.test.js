/**
 * @file Integration tests for the intimacy:turn_around_to_face action.
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
import { createMockActionErrorContextBuilder } from '../../../common/mockFactories/actions.js';
import turnAroundToFaceAction from '../../../../data/mods/intimacy/actions/turn_around_to_face.action.json';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { TargetResolutionService } from '../../../../src/actions/targetResolutionService.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import DefaultDslParser from '../../../../src/scopeDsl/parser/defaultDslParser.js';

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
      'data/mods/intimacy/scopes/actors_im_facing_away_from.scope'
    );
    const scopeContent = fs.readFileSync(scopePath, 'utf-8');
    const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);

    // Register scopes
    scopeRegistry.initialize(Object.fromEntries(parsedScopes));

    scopeEngine = new ScopeEngine({
      entityManager,
      scopeRegistry,
      logger,
    });

    // Set up dslParser and other dependencies
    const dslParser = new DefaultDslParser();
    const jsonLogicService = new JsonLogicEvaluationService({ logger });
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
    targetResolutionService = new TargetResolutionService({
      entityManager,
      scopeEngine,
      scopeRegistry,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicService,
      dslParser,
      actionErrorContextBuilder,
    });

    // Set up action discovery dependencies
    const dataRegistry = new InMemoryDataRegistry();
    const gameDataRepository = new GameDataRepository(dataRegistry, logger);

    // Create mock actionValidationContextBuilder for PrerequisiteEvaluationService
    const actionValidationContextBuilder = {
      buildContext: jest.fn(() => ({})),
    };

    const prereqService = new PrerequisiteEvaluationService({
      entityManager,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder,
      gameDataRepository,
      logger,
    });

    const actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex([turnAroundToFaceAction]);

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
        (a) => a.id === 'intimacy:turn_around_to_face'
      );
      expect(turnAroundToFaceAction).toBeUndefined();
    });

    it('should not show action when actor has closeness but no facing_away', async () => {
      // Alice is in closeness with Bob but not facing away
      entityManager.addComponent(alice, 'intimacy:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'intimacy:closeness', {
        partners: [alice],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundToFaceAction = actions.find(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );
      expect(turnAroundToFaceAction).toBeUndefined();
    });

    it('should show action when actor has both required components', async () => {
      // Set up closeness
      entityManager.addComponent(alice, 'intimacy:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'intimacy:closeness', {
        partners: [alice],
      });

      // Alice is facing away from Bob
      entityManager.addComponent(alice, 'intimacy:facing_away', {
        facing_away_from: [bob],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundToFaceAction = actions.find(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );
      expect(turnAroundToFaceAction).toBeDefined();
      expect(turnAroundToFaceAction.command).toBe(
        'turn around to face bob-entity'
      );
      expect(turnAroundToFaceAction.params.targetId).toBe(bob);
    });
  });

  describe('Scope Resolution', () => {
    beforeEach(() => {
      // Set up a complex closeness circle
      entityManager.addComponent(alice, 'intimacy:closeness', {
        partners: [bob, charlie, diana],
      });
      entityManager.addComponent(bob, 'intimacy:closeness', {
        partners: [alice, charlie, diana],
      });
      entityManager.addComponent(charlie, 'intimacy:closeness', {
        partners: [alice, bob, diana],
      });
      entityManager.addComponent(diana, 'intimacy:closeness', {
        partners: [alice, bob, charlie],
      });
    });

    it('should only show entities that actor is facing away from', async () => {
      // Alice is facing away from Bob and Charlie, but not Diana
      entityManager.addComponent(alice, 'intimacy:facing_away', {
        facing_away_from: [bob, charlie],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      // There should be separate actions for each target
      const turnAroundActions = actions.filter(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(2);

      // Check that we have actions for Bob and Charlie only
      const targetIds = turnAroundActions.map((a) => a.params.targetId);
      expect(targetIds).toContain(bob);
      expect(targetIds).toContain(charlie);
      expect(targetIds).not.toContain(diana);
    });

    it('should handle empty facing_away_from array', async () => {
      // Alice has facing_away component but empty array
      entityManager.addComponent(alice, 'intimacy:facing_away', {
        facing_away_from: [],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      // Should have no turn around actions since facing_away_from is empty
      const turnAroundActions = actions.filter(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(0);
    });

    it('should filter out entities not in closeness', async () => {
      // Create an entity outside closeness
      const outsider = 'outsider-entity';
      entityManager.addComponent(outsider, NAME_COMPONENT_ID, {
        name: 'Outsider',
      });
      entityManager.addComponent(outsider, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });

      // Alice is facing away from Bob and the outsider
      entityManager.addComponent(alice, 'intimacy:facing_away', {
        facing_away_from: [bob, outsider],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      // Only Bob should have an action (outsider not in closeness)
      const turnAroundActions = actions.filter(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(1);
      expect(turnAroundActions[0].params.targetId).toBe(bob);
    });

    it('should handle single target in facing_away_from', async () => {
      // Alice is only facing away from Bob
      entityManager.addComponent(alice, 'intimacy:facing_away', {
        facing_away_from: [bob],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );

      expect(turnAroundActions).toHaveLength(1);
      expect(turnAroundActions[0].params.targetId).toBe(bob);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle bidirectional facing away', async () => {
      // Set up closeness
      entityManager.addComponent(alice, 'intimacy:closeness', {
        partners: [bob],
      });
      entityManager.addComponent(bob, 'intimacy:closeness', {
        partners: [alice],
      });

      // Both are facing away from each other
      entityManager.addComponent(alice, 'intimacy:facing_away', {
        facing_away_from: [bob],
      });
      entityManager.addComponent(bob, 'intimacy:facing_away', {
        facing_away_from: [alice],
      });

      // Check Alice's actions
      const aliceEntity = entityManager.getEntityInstance(alice);
      const aliceResult =
        await actionDiscoveryService.getValidActions(aliceEntity);
      const aliceActions = aliceResult.actions;
      const aliceTurnActions = aliceActions.filter(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );
      expect(aliceTurnActions).toHaveLength(1);
      expect(aliceTurnActions[0].params.targetId).toBe(bob);

      // Check Bob's actions
      const bobEntity = entityManager.getEntityInstance(bob);
      const bobResult = await actionDiscoveryService.getValidActions(bobEntity);
      const bobActions = bobResult.actions;
      const bobTurnActions = bobActions.filter(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );
      expect(bobTurnActions).toHaveLength(1);
      expect(bobTurnActions[0].params.targetId).toBe(alice);
    });

    it('should handle partial facing away in group', async () => {
      // Set up closeness for all
      entityManager.addComponent(alice, 'intimacy:closeness', {
        partners: [bob, charlie],
      });
      entityManager.addComponent(bob, 'intimacy:closeness', {
        partners: [alice, charlie],
      });
      entityManager.addComponent(charlie, 'intimacy:closeness', {
        partners: [alice, bob],
      });

      // Alice faces away from Bob but faces Charlie
      entityManager.addComponent(alice, 'intimacy:facing_away', {
        facing_away_from: [bob],
      });

      const aliceEntity = entityManager.getEntityInstance(alice);
      const result = await actionDiscoveryService.getValidActions(aliceEntity);
      const actions = result.actions;

      const turnAroundActions = actions.filter(
        (a) => a.id === 'intimacy:turn_around_to_face'
      );

      // Only Bob should be a valid target
      expect(turnAroundActions).toHaveLength(1);
      expect(turnAroundActions[0].params.targetId).toBe(bob);
    });
  });
});
