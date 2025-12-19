/**
 * @file Action Target Resolution Workflow E2E Tests
 * @description End-to-end tests for the complete action discovery workflow,
 * specifically validating that the target resolution bug is fixed where
 * follow actions were incorrectly targeting locations instead of actors.
 * @see specs/action-target-resolution-validation.spec.md
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { createActionPipelineOrchestrator } from '../../common/actions/multiTargetStageTestUtilities.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { extractTargetIds } from '../../common/actions/targetParamTestHelpers.js';

// Import core action definitions
import dismissAction from '../../../data/mods/companionship/actions/dismiss.action.json';
import followAction from '../../../data/mods/companionship/actions/follow.action.json';
import goAction from '../../../data/mods/movement/actions/go.action.json';
import waitAction from '../../../data/mods/core/actions/wait.action.json';

// Import scope definitions
import fs from 'fs';
import path from 'path';

// Unmock the real singleton to ensure the test and SUT use the same instance
jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

/**
 * E2E test suite for action target resolution workflow
 * Tests the complete pipeline using real mod system to ensure target resolution works correctly
 */
describe('Action Target Resolution Workflow E2E', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let gameDataRepository;
  let safeEventDispatcher;
  let actionIndex;
  let dataRegistry;
  let testWorld;

  beforeEach(async () => {
    // Set up logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Initialize data registry with core actions
    dataRegistry = new InMemoryDataRegistry();
    dataRegistry.store('actions', dismissAction.id, dismissAction);
    dataRegistry.store('actions', followAction.id, followAction);
    dataRegistry.store('actions', goAction.id, goAction);
    dataRegistry.store('actions', waitAction.id, waitAction);

    // Store core conditions used by scopes
    dataRegistry.store('conditions', 'core:entity-at-location', {
      id: 'core:entity-at-location',
      logic: {
        '==': [
          { var: 'entity.components.core:position.locationId' },
          { var: 'location.id' },
        ],
      },
    });
    dataRegistry.store('conditions', 'core:entity-is-not-current-actor', {
      id: 'core:entity-is-not-current-actor',
      logic: { '!=': [{ var: 'entity.id' }, { var: 'actor.id' }] },
    });
    dataRegistry.store('conditions', 'core:entity-has-actor-component', {
      id: 'core:entity-has-actor-component',
      logic: { '!!': { var: 'entity.components.core:actor' } },
    });
    dataRegistry.store(
      'conditions',
      'companionship:entity-is-following-actor',
      {
        id: 'companionship:entity-is-following-actor',
        logic: {
          '==': [
            { var: 'entity.components.companionship:following.leaderId' },
            { var: 'actor.id' },
          ],
        },
      }
    );
    dataRegistry.store('conditions', 'movement:exit-is-unblocked', {
      id: 'movement:exit-is-unblocked',
      logic: { '!': { var: 'entity.blocker' } },
    });
    dataRegistry.store('conditions', 'anatomy:actor-can-move', {
      id: 'anatomy:actor-can-move',
      logic: {
        '==': [{ var: 'actor.components.movement:movement.locked' }, false],
      },
    });
    dataRegistry.store('conditions', 'companionship:actor-is-following', {
      id: 'companionship:actor-is-following',
      logic: {
        '!!': { var: 'actor.components.companionship:following.leaderId' },
      },
    });

    // Initialize scope registry
    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    // Load and parse scope definitions from actual files
    const coreScopeFiles = ['environment.scope'];
    const companionshipScopeFiles = [
      'potential_leaders.scope',
      'followers.scope',
    ];
    const movementScopeFiles = ['clear_directions.scope'];

    const scopeDefinitions = {};

    // Load core scopes
    for (const filename of coreScopeFiles) {
      const scopeContent = fs.readFileSync(
        path.resolve(__dirname, '../../../data/mods/core/scopes', filename),
        'utf8'
      );
      const defs = parseScopeDefinitions(scopeContent, filename);
      for (const [id, definition] of defs) {
        scopeDefinitions[id] = definition;
      }
    }

    // Load companionship scopes
    for (const filename of companionshipScopeFiles) {
      const scopeContent = fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../data/mods/companionship/scopes',
          filename
        ),
        'utf8'
      );
      const defs = parseScopeDefinitions(scopeContent, filename);
      for (const [id, definition] of defs) {
        scopeDefinitions[id] = definition;
      }
    }

    // Load movement scopes
    for (const filename of movementScopeFiles) {
      const scopeContent = fs.readFileSync(
        path.resolve(__dirname, '../../../data/mods/movement/scopes', filename),
        'utf8'
      );
      const defs = parseScopeDefinitions(scopeContent, filename);
      for (const [id, definition] of defs) {
        scopeDefinitions[id] = definition;
      }
    }

    scopeRegistry.initialize(scopeDefinitions);

    // Initialize other services
    scopeEngine = new ScopeEngine();
    gameDataRepository = new GameDataRepository(dataRegistry, logger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    const validatedEventDispatcher = {
      dispatch: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
    };

    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    // Set up test world and actors
    await setupTestWorld();

    // Create mock bodyGraphService for JsonLogicCustomOperators
    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn().mockReturnValue(false),
      findPartsByType: jest.fn().mockReturnValue([]),
      getAllParts: jest.fn().mockReturnValue([]),
      buildAdjacencyCache: jest.fn(),
    };

    // Create mock lightingStateService for JsonLogicCustomOperators
    const mockLightingStateService = {
      getLocationLightingState: jest.fn((locationId) => ({
        isLit: true,
        lightSources: [],
      })),
      isLocationLit: jest.fn((locationId) => true),
    };

    // Register custom operators so isActorLocationLit is available for prerequisites
    const jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      entityManager,
      bodyGraphService: mockBodyGraphService,
      lightingStateService: mockLightingStateService,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    await setupCoreActions();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Creates a trace context for action discovery testing
   *
   * @returns {TraceContext} A new trace context instance
   */
  function createTraceContext() {
    return new TraceContext();
  }

  /**
   * Creates the standard test scenario with two actors in connected locations
   */
  function createStandardTestScenario() {
    const entities = [
      // Location X
      {
        id: 'test-location-x',
        components: {
          'core:name': { text: 'Location X' },
          'core:description': { description: 'Test location X' },
          [EXITS_COMPONENT_ID]: [
            { direction: 'north', target: 'test-location-y', blocker: null },
          ],
        },
      },
      // Location Y
      {
        id: 'test-location-y',
        components: {
          'core:name': { text: 'Location Y' },
          'core:description': { description: 'Test location Y' },
          [EXITS_COMPONENT_ID]: [
            { direction: 'south', target: 'test-location-x', blocker: null },
          ],
        },
      },
      // Actor 1 (current actor)
      {
        id: 'test-actor-1',
        components: {
          'core:name': { text: 'Actor One' },
          [ACTOR_COMPONENT_ID]: { isPlayer: true },
          [POSITION_COMPONENT_ID]: { locationId: 'test-location-x' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: null },
          [LEADING_COMPONENT_ID]: { followers: [] },
          'movement:movement': { locked: false },
        },
      },
      // Actor 2 (target actor)
      {
        id: 'test-actor-2',
        components: {
          'core:name': { text: 'Actor Two' },
          [ACTOR_COMPONENT_ID]: { isPlayer: false },
          [POSITION_COMPONENT_ID]: { locationId: 'test-location-x' },
          [FOLLOWING_COMPONENT_ID]: { leaderId: null },
          [LEADING_COMPONENT_ID]: { followers: [] },
          'movement:movement': { locked: false },
        },
      },
    ];

    return entities;
  }

  /**
   * Sets up the complete test world with two actors in connected locations
   */
  async function setupTestWorld() {
    testWorld = createStandardTestScenario();
    entityManager = new SimpleEntityManager(testWorld);
  }

  /**
   * Creates and configures the action discovery service with test entities
   */
  async function setupCoreActions() {
    // Create and build ActionIndex
    actionIndex = new ActionIndex({ logger, entityManager });
    const allActions = gameDataRepository.getAllActionDefinitions();
    actionIndex.buildIndex(allActions);

    // Create target resolution service
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

    // Create prerequisite evaluation service that actually evaluates conditions
    const prerequisiteEvaluationService = {
      evaluate: (prerequisites, actionDef, actor, actionContext, trace) => {
        if (!prerequisites || prerequisites.length === 0) {
          return true; // No prerequisites to check
        }

        // Build actor context for condition evaluation
        const actorData = {
          id: actor.id,
          components: actor.getAllComponents(),
        };

        // Evaluate each prerequisite using JSON Logic
        for (const prereq of prerequisites) {
          const result = jsonLogicEval.evaluate(prereq.logic, {
            actor: actorData,
          });
          if (!result) {
            return false;
          }
        }

        return true;
      },
    };

    // Create the ActionPipelineOrchestrator using test utility
    const orchestrator = createActionPipelineOrchestrator({
      entityManager,
      logger,
      actionIndex,
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new MultiTargetActionFormatter(
        new ActionCommandFormatter(),
        logger
      ),
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
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
      targetContextBuilder: createMockTargetContextBuilder(entityManager),
    });

    // Create action discovery service with proper trace context factory
    actionDiscoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator: orchestrator,
      traceContextFactory: jest.fn(() => ({
        addLog: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        step: jest.fn(),
        error: jest.fn(),
        data: jest.fn(),
        logs: [],
      })),
    });
  }

  /**
   * Test: Critical bug validation - standard scenario
   * This is the primary test case that validates the bug described in the problem statement
   */
  test('should discover exactly 3 actions: go to Y, follow actor 2, and wait', async () => {
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: Array.from(entityManager.entities),
    };

    // Test complete discovery workflow using the real service
    const discoveredActions = await actionDiscoveryService.getValidActions(
      currentActor,
      context,
      { trace: true }
    );

    // Should return exactly 3 valid actions
    expect(discoveredActions).toBeDefined();
    expect(discoveredActions.actions).toBeDefined();
    expect(Array.isArray(discoveredActions.actions)).toBe(true);

    expect(discoveredActions.actions.length).toBe(3);

    // Group actions by type for validation
    const actionsByType = discoveredActions.actions.reduce((acc, action) => {
      acc[action.id] = action;
      return acc;
    }, {});

    // Validate go action - should target Location Y
    expect(actionsByType['movement:go']).toBeDefined();
    const goTargets = extractTargetIds(actionsByType['movement:go'].params);
    expect(goTargets).toContain('test-location-y');
    expect(actionsByType['movement:go'].command).toContain('Location Y');
    expect(actionsByType['movement:go'].command).toMatch(/go to Location Y/i);

    // Validate follow action - should target Actor Two, NOT a location
    expect(actionsByType['companionship:follow']).toBeDefined();
    const followTargets = extractTargetIds(
      actionsByType['companionship:follow'].params
    );
    expect(followTargets).toContain('test-actor-2');
    expect(actionsByType['companionship:follow'].command).toContain(
      'Actor Two'
    );
    expect(actionsByType['companionship:follow'].command).toMatch(
      /follow Actor Two/i
    );

    // Critical validation: follow action should NEVER contain location names
    expect(actionsByType['companionship:follow'].command).not.toContain(
      'Location X'
    );
    expect(actionsByType['companionship:follow'].command).not.toContain(
      'Location Y'
    );
    expect(actionsByType['companionship:follow'].command).not.toContain(
      '[LOCATION NAME]'
    );

    // Validate wait action - should have no target
    expect(actionsByType['core:wait']).toBeDefined();
    const waitTargets = extractTargetIds(actionsByType['core:wait'].params, {
      placeholder: null,
    });
    expect(waitTargets.length).toBe(0);
    expect(actionsByType['core:wait'].params?.targetId ?? null).toBeNull();
    expect(actionsByType['core:wait'].command).toBe('wait');

    // Should have tracing information for debugging
    expect(discoveredActions.trace).toBeDefined();
  });

  /**
   * Test: Follow action target validation
   * Ensures follow actions only target entities with actor components
   */
  test('should only produce follow actions targeting entities with actor components', async () => {
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: Array.from(entityManager.entities),
    };

    const discoveredActions = await actionDiscoveryService.getValidActions(
      currentActor,
      context,
      { trace: true }
    );

    // Find all follow actions
    const followActions = discoveredActions.actions.filter(
      (action) => action.id === 'companionship:follow'
    );

    expect(followActions.length).toBeGreaterThan(0);

    // Validate each follow action
    for (const followAction of followActions) {
      const targetIds = extractTargetIds(followAction.params);
      expect(targetIds.length).toBeGreaterThan(0);

      for (const targetId of targetIds) {
        const targetEntity = await entityManager.getEntityInstance(targetId);
        expect(targetEntity).toBeDefined();

        const actorComponent =
          targetEntity.getComponentData(ACTOR_COMPONENT_ID);
        expect(actorComponent).toBeDefined();

        const exitsComponent =
          targetEntity.getComponentData(EXITS_COMPONENT_ID);
        expect(exitsComponent).toBeNull();
      }

      // Validate command formatting
      expect(followAction.command).not.toContain('[LOCATION NAME]');
      expect(followAction.command).not.toContain('Location X');
      expect(followAction.command).not.toContain('Location Y');
      expect(followAction.command).toMatch(/follow\s+\w+/i);
    }
  });

  /**
   * Test: Go action target validation
   * Ensures go actions only target location entities
   */
  test('should only produce go actions targeting location entities', async () => {
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: Array.from(entityManager.entities),
    };

    const discoveredActions = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Find all go actions
    const goActions = discoveredActions.actions.filter(
      (action) => action.id === 'movement:go'
    );

    expect(goActions.length).toBeGreaterThan(0);

    // Validate each go action
    for (const goAction of goActions) {
      const targetIds = extractTargetIds(goAction.params);
      expect(targetIds.length).toBeGreaterThan(0);

      for (const targetId of targetIds) {
        const targetEntity = await entityManager.getEntityInstance(targetId);
        expect(targetEntity).toBeDefined();

        const actorComponent =
          targetEntity.getComponentData(ACTOR_COMPONENT_ID);
        expect(actorComponent).toBeNull();

        const nameComponent = targetEntity.getComponentData('core:name');
        expect(nameComponent).toBeDefined();
      }

      // Validate command formatting
      expect(goAction.command).toMatch(/go\s+to\s+\w+/i);
      expect(goAction.command).not.toContain('Actor One');
      expect(goAction.command).not.toContain('Actor Two');
    }
  });

  /**
   * Test: Cross-validation between actors
   * Ensures different actors get appropriate action sets
   */
  test('should provide consistent target resolution for different actors', async () => {
    const actor1 = entityManager.getEntityInstance('test-actor-1');
    const actor2 = entityManager.getEntityInstance('test-actor-2');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: Array.from(entityManager.entities),
    };

    // Get actions for Actor 1
    const actor1Actions = await actionDiscoveryService.getValidActions(
      actor1,
      context
    );

    // Get actions for Actor 2
    const actor2Actions = await actionDiscoveryService.getValidActions(
      actor2,
      context
    );

    // Both should have same number of actions (3)
    expect(actor1Actions.actions.length).toBe(3);
    expect(actor2Actions.actions.length).toBe(3);

    // Both should have the same action types
    const actor1ActionIds = new Set(actor1Actions.actions.map((a) => a.id));
    const actor2ActionIds = new Set(actor2Actions.actions.map((a) => a.id));

    expect(actor1ActionIds).toEqual(actor2ActionIds);
    expect(actor1ActionIds.has('movement:go')).toBe(true);
    expect(actor1ActionIds.has('companionship:follow')).toBe(true);
    expect(actor1ActionIds.has('core:wait')).toBe(true);

    // Follow actions should target the other actor
    const actor1FollowAction = actor1Actions.actions.find(
      (a) => a.id === 'companionship:follow'
    );
    const actor2FollowAction = actor2Actions.actions.find(
      (a) => a.id === 'companionship:follow'
    );

    expect(extractTargetIds(actor1FollowAction.params)).toContain(
      'test-actor-2'
    );
    expect(extractTargetIds(actor2FollowAction.params)).toContain(
      'test-actor-1'
    );

    // Go actions should target the same location for both
    const actor1GoAction = actor1Actions.actions.find(
      (a) => a.id === 'movement:go'
    );
    const actor2GoAction = actor2Actions.actions.find(
      (a) => a.id === 'movement:go'
    );

    expect(extractTargetIds(actor1GoAction.params)).toContain(
      'test-location-y'
    );
    expect(extractTargetIds(actor2GoAction.params)).toContain(
      'test-location-y'
    );
  });

  /**
   * Test: Action formatting validation
   * Ensures all actions have proper command formatting without placeholder text
   */
  test('should produce properly formatted actions without placeholder text', async () => {
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: Array.from(entityManager.entities),
    };

    const discoveredActions = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Validate all action commands
    discoveredActions.actions.forEach((action) => {
      // Required fields
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('command');
      expect(action).toHaveProperty('params');

      // Fields should be proper types
      expect(typeof action.id).toBe('string');
      expect(typeof action.name).toBe('string');
      expect(typeof action.command).toBe('string');
      expect(typeof action.params).toBe('object');

      // Command should be formatted (not contain placeholders)
      expect(action.command).not.toContain('{');
      expect(action.command).not.toContain('}');
      expect(action.command).not.toContain('[TARGET');
      expect(action.command).not.toContain('[LOCATION NAME]');
      expect(action.command).not.toContain('[ACTOR NAME]');
      expect(action.command).not.toContain('undefined');
      expect(action.command).not.toContain('null');

      // Command should not be empty
      expect(action.command.trim().length).toBeGreaterThan(0);

      // Params should contain appropriate targetId
      if (action.id === 'core:wait') {
        expect(
          extractTargetIds(action.params, { placeholder: null })
        ).toHaveLength(0);
        expect(action.params?.targetId ?? null).toBeNull();
      } else {
        const allTargetIds = extractTargetIds(action.params, {
          placeholder: null,
        });
        expect(allTargetIds.length).toBeGreaterThan(0);
        for (const id of allTargetIds) {
          expect(typeof id).toBe('string');
        }

        if (
          action.params?.targetId !== undefined &&
          action.params?.targetId !== null
        ) {
          expect(typeof action.params.targetId).toBe('string');
        }
      }
    });
  });

  /**
   * Test: Caching behavior validation
   * Ensures action caching works correctly and doesn't introduce stale data
   */
  test('should cache actions correctly without introducing stale target data', async () => {
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    // First call should populate cache
    const firstCall = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    expect(firstCall).toBeDefined();
    expect(firstCall.actions).toBeDefined();
    expect(Array.isArray(firstCall.actions)).toBe(true);
    expect(firstCall.actions.length).toBeGreaterThan(0);

    // Validate first call results
    const firstCallActionIds = new Set(firstCall.actions.map((a) => a.id));
    expect(firstCallActionIds.has('movement:go')).toBe(true);
    expect(firstCallActionIds.has('companionship:follow')).toBe(true);
    expect(firstCallActionIds.has('core:wait')).toBe(true);

    // Second call with same context should use cache
    const secondCall = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    expect(secondCall).toBeDefined();
    expect(secondCall.actions.length).toBe(firstCall.actions.length);

    // Results should be consistent (from cache)
    expect(secondCall.actions).toEqual(firstCall.actions);

    // Validate cached results are still correct
    const cachedFollowAction = secondCall.actions.find(
      (a) => a.id === 'companionship:follow'
    );
    expect(extractTargetIds(cachedFollowAction.params)).toContain(
      'test-actor-2'
    );
    expect(cachedFollowAction.command).toContain('Actor Two');
    expect(cachedFollowAction.command).not.toContain('Location');
  });

  /**
   * Test: Performance validation
   * Ensures the complete pipeline performs within acceptable limits
   */
  test('should complete full pipeline within performance limits', async () => {
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: Array.from(entityManager.entities),
    };

    // Measure discovery time
    const startTime = Date.now();
    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );
    const endTime = Date.now();

    const discoveryTime = endTime - startTime;

    // Should complete within reasonable time (as per spec: 500ms)
    expect(discoveryTime).toBeLessThan(500);

    // Should return valid results
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.actions.length).toBe(3);

    // Test multiple discoveries for caching performance
    const cacheStartTime = Date.now();
    await actionDiscoveryService.getValidActions(currentActor, context);
    await actionDiscoveryService.getValidActions(currentActor, context);
    await actionDiscoveryService.getValidActions(currentActor, context);
    const cacheEndTime = Date.now();

    const cacheTime = cacheEndTime - cacheStartTime;

    // Multiple calls should be reasonable (allowing for some overhead)
    expect(cacheTime).toBeLessThan(150);
  });

  /**
   * Test: Error handling and recovery
   * Ensures proper error handling when issues occur in target resolution
   */
  test('should handle target resolution errors gracefully', async () => {
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    // Create a problematic context that might cause issues
    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: [], // Empty entities list to potentially cause issues
    };

    // Should not throw errors, even with problematic context
    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context,
      { trace: true }
    );

    // Should return some result (even if limited)
    expect(result).toBeDefined();
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);

    // Should at least have wait action (which requires no targets)
    const waitActions = result.actions.filter((a) => a.id === 'core:wait');
    expect(waitActions.length).toBe(1);

    // Should have tracing information for debugging
    expect(result.trace).toBeDefined();
  });

  /**
   * Test: Real mod system integration
   * Validates that the test works with the actual mod loading system
   */
  test('should work correctly with real mod system data', async () => {
    // This test ensures our test setup properly integrates with the real mod system

    // Verify core actions are loaded from mod system
    const coreActions = gameDataRepository.getAllActionDefinitions();
    const coreActionIds = coreActions.map((a) => a.id);

    expect(coreActionIds).toContain('movement:go');
    expect(coreActionIds).toContain('companionship:follow');
    expect(coreActionIds).toContain('core:wait');

    // Verify scope definitions are loaded
    const clearDirectionsScope = scopeRegistry.getScope(
      'movement:clear_directions'
    );
    const potentialLeadersScope = scopeRegistry.getScope(
      'companionship:potential_leaders'
    );

    expect(clearDirectionsScope).toBeDefined();
    expect(potentialLeadersScope).toBeDefined();

    // Verify our test can discover actions using real mod data
    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const currentLocation = entityManager.getEntityInstance('test-location-x');

    const context = {
      jsonLogicEval,
      location: currentLocation,
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Should discover the expected actions using real mod data
    expect(result.actions.length).toBeGreaterThan(0);

    const actionIds = result.actions.map((a) => a.id);
    expect(actionIds).toContain('movement:go');
    expect(actionIds).toContain('companionship:follow');
    expect(actionIds).toContain('core:wait');
  });
});
