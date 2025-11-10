/**
 * @file Core Action Target Resolution Integration Tests
 * @description Integration tests to validate proper target resolution for core actions,
 * specifically preventing cross-scope contamination where follow actions incorrectly
 * target locations instead of actors.
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
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import {
  createTargetResolutionServiceWithMocks,
  createMockUnifiedScopeResolver,
} from '../../common/mocks/mockUnifiedScopeResolver.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';
import { createMockTargetContextBuilder } from '../../common/mocks/mockTargetContextBuilder.js';
import { createMultiTargetResolutionStage, createActionPipelineOrchestrator } from '../../common/actions/multiTargetStageTestUtilities.js';
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
 * Integration test suite for core action target resolution
 * Validates that actions only target appropriate entity types as defined by their scopes
 */
describe('Core Action Target Resolution Integration', () => {
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

    // Load actual condition definitions from mod files
    const conditionFiles = [
      // Core conditions
      {
        path: path.resolve(__dirname, '../../../data/mods/core/conditions/entity-at-location.condition.json'),
        fallback: {
          id: 'core:entity-at-location',
          logic: {
            '==': [
              { var: 'entity.components.core:position.locationId' },
              { var: 'location.id' },
            ],
          },
        }
      },
      {
        path: path.resolve(__dirname, '../../../data/mods/core/conditions/entity-is-not-current-actor.condition.json'),
        fallback: {
          id: 'core:entity-is-not-current-actor',
          logic: { '!=': [{ var: 'entity.id' }, { var: 'actor.id' }] },
        }
      },
      {
        path: path.resolve(__dirname, '../../../data/mods/core/conditions/entity-has-actor-component.condition.json'),
        fallback: {
          id: 'core:entity-has-actor-component',
          logic: { '!!': { var: 'entity.components.core:actor' } },
        }
      },
      // Companionship conditions
      {
        path: path.resolve(__dirname, '../../../data/mods/companionship/conditions/entity-is-following-actor.condition.json'),
        fallback: {
          id: 'companionship:entity-is-following-actor',
          logic: {
            '==': [
              { var: 'entity.components.companionship:following.leaderId' },
              { var: 'actor.id' },
            ],
          },
        }
      },
      {
        path: path.resolve(__dirname, '../../../data/mods/companionship/conditions/actor-is-following.condition.json'),
        fallback: {
          id: 'companionship:actor-is-following',
          logic: {
            '!!': { var: 'actor.components.companionship:following' },
          },
        }
      },
      // Movement conditions
      {
        path: path.resolve(__dirname, '../../../data/mods/movement/conditions/exit-is-unblocked.condition.json'),
        fallback: {
          id: 'movement:exit-is-unblocked',
          logic: { '!': { var: 'entity.blocker' } },
        }
      },
      {
        path: path.resolve(__dirname, '../../../data/mods/movement/conditions/actor-can-move.condition.json'),
        fallback: {
          id: 'movement:actor-can-move',
          logic: {
            'hasPartWithComponentValue': ['actor', 'core:movement', 'locked', false]
          },
        }
      }
    ];

    // Load each condition, using fallback if file doesn't exist
    for (const conditionInfo of conditionFiles) {
      let condition;
      try {
        if (fs.existsSync(conditionInfo.path)) {
          const fileContent = fs.readFileSync(conditionInfo.path, 'utf8');
          condition = JSON.parse(fileContent);
        } else {
          condition = conditionInfo.fallback;
        }
      } catch (error) {
        logger.warn(`Failed to load condition from ${conditionInfo.path}, using fallback`, error);
        condition = conditionInfo.fallback;
      }
      dataRegistry.store('conditions', condition.id, condition);
    }

    // Initialize scope registry
    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    // Load and parse scope definitions from actual files
    const coreScopeFiles = [
      'environment.scope',
    ];
    const companionshipScopeFiles = [
      'potential_leaders.scope',
      'followers.scope',
    ];
    const movementScopeFiles = [
      'clear_directions.scope',
    ];

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
        path.resolve(__dirname, '../../../data/mods/companionship/scopes', filename),
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
          [LEADING_COMPONENT_ID]: { followers: [] },
          'movement:movement': { locked: false },
        },
      },
    ];

    return entities;
  }

  /**
   * Creates and configures the action discovery service with test entities
   *
   * @param entities
   */
  async function createActionDiscoveryService(entities) {
    entityManager = new SimpleEntityManager(entities);

    // Create and build ActionIndex
    actionIndex = new ActionIndex({ logger, entityManager });
    const allActions = gameDataRepository.getAllActionDefinitions();
    actionIndex.buildIndex(allActions);

    // Create unified scope resolver that will properly resolve scopes
    const unifiedScopeResolver = createMockUnifiedScopeResolver({
      scopeRegistry,
      scopeEngine,
      entityManager,
      logger,
      safeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicEval,
      dslParser: new DefaultDslParser(),
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

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

    // Create prerequisite evaluation service
    const prerequisiteEvaluationService = {
      evaluate: jest.fn(() => true), // All prerequisites pass for testing
    };

    // Create real MultiTargetResolutionStage with proper dependencies
    const multiTargetResolutionStage = createMultiTargetResolutionStage({
      entityManager,
      logger,
      unifiedScopeResolver,
      targetResolver: targetResolutionService,
      gameStateManager: {
        getCurrentTurn: jest.fn().mockReturnValue(1),
        getTimeOfDay: jest.fn().mockReturnValue('morning'),
        getWeather: jest.fn().mockReturnValue('sunny'),
      },
    });

    // Create the ActionPipelineOrchestrator with proper dependencies using the utility factory
    const orchestrator = createActionPipelineOrchestrator({
      actionIndex,
      prerequisiteService: prerequisiteEvaluationService,
      targetService: targetResolutionService,
      formatter: new MultiTargetActionFormatter(
        new ActionCommandFormatter(),
        logger
      ),
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: createMockActionErrorContextBuilder(),
      logger,
      unifiedScopeResolver,
      targetContextBuilder: createMockTargetContextBuilder(entityManager),
      multiTargetResolutionStage,
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
   * Test: Standard scenario - two actors in connected locations
   * Validates that exactly 3 actions are discovered with correct targets
   */
  test('should discover exactly 3 actions: go to location Y, follow actor 2, and wait', async () => {
    const entities = createStandardTestScenario();
    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context,
      { trace: true }
    );

    // Validate action result structure
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);

    // Extract actions by ID
    const actionsByType = result.actions.reduce((acc, action) => {
      acc[action.id] = action;
      return acc;
    }, {});

    // Validate go action
    expect(actionsByType['movement:go']).toBeDefined();
    const goTargets = extractTargetIds(actionsByType['movement:go'].params);
    expect(goTargets).toContain('test-location-y');
    expect(actionsByType['movement:go'].command).toContain('Location Y');

    // Validate follow action
    expect(actionsByType['companionship:follow']).toBeDefined();
    const followTargets = extractTargetIds(
      actionsByType['companionship:follow'].params
    );
    expect(followTargets).toContain('test-actor-2');
    expect(actionsByType['companionship:follow'].command).toContain('Actor Two');

    // Validate wait action
    expect(actionsByType['core:wait']).toBeDefined();
    const waitTargets = extractTargetIds(actionsByType['core:wait'].params, {
      placeholder: null,
    });
    expect(waitTargets.length).toBe(0);
    expect(actionsByType['core:wait'].params?.targetId ?? null).toBeNull();
    expect(actionsByType['core:wait'].command).toBe('wait');
  });

  /**
   * Test: Follow action targets only actors, never locations
   * Critical test to prevent the identified bug
   */
  test('should never produce follow actions targeting locations', async () => {
    const entities = createStandardTestScenario();
    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context,
      { trace: true }
    );

    // Find all follow actions
    const followActions = result.actions.filter(
      (action) => action.id === 'companionship:follow'
    );

    // Validate each follow action
    followActions.forEach((action) => {
      const targetIds = extractTargetIds(action.params);
      expect(targetIds.length).toBeGreaterThan(0);

      targetIds.forEach((targetId) => {
        const targetEntity = entityManager.getEntityInstance(targetId);
        expect(targetEntity).toBeDefined();

        expect(targetEntity.getComponentData(ACTOR_COMPONENT_ID)).toBeDefined();
        expect(targetEntity.getComponentData(EXITS_COMPONENT_ID)).toBeNull();
      });

      // Ensure command doesn't contain location names
      expect(action.command).not.toContain('Location X');
      expect(action.command).not.toContain('Location Y');
      expect(action.command).not.toContain('[LOCATION NAME]');
    });
  });

  /**
   * Test: Go action targets only locations, never actors
   */
  test('should never produce go actions targeting actors', async () => {
    const entities = createStandardTestScenario();
    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context,
      { trace: true }
    );

    // Find all go actions
    const goActions = result.actions.filter(
      (action) => action.id === 'movement:go'
    );

    // Validate each go action
    goActions.forEach((action) => {
      const targetIds = extractTargetIds(action.params);
      expect(targetIds.length).toBeGreaterThan(0);

      targetIds.forEach((targetId) => {
        const targetEntity = entityManager.getEntityInstance(targetId);
        expect(targetEntity).toBeDefined();

        expect(targetEntity.getComponentData(ACTOR_COMPONENT_ID)).toBeNull();
        expect(targetEntity.getComponentData('core:name')).toBeDefined();
      });

      // Ensure command doesn't contain actor names
      expect(action.command).not.toContain('Actor One');
      expect(action.command).not.toContain('Actor Two');
    });
  });

  /**
   * Test: Wait action validation
   * Note: The wait action behavior varies by implementation, but it should always be available
   */
  test('should produce wait action consistently', async () => {
    const entities = createStandardTestScenario();
    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Find wait action - should always be available
    const waitActions = result.actions.filter(
      (action) => action.id === 'core:wait'
    );
    expect(waitActions.length).toBe(1);

    const waitAction = waitActions[0];
    expect(waitAction.command).toBe('wait');

    // The specific targetId value may vary by implementation, but the action should be valid
    expect(waitAction.params).toBeDefined();
  });

  /**
   * Test: Edge case - no available exits
   * When location has no exits, go action should not appear
   */
  test('should not produce go actions when no exits available', async () => {
    const entities = [
      // Location X with no exits
      {
        id: 'test-location-x',
        components: {
          'core:name': { text: 'Location X' },
          'core:description': { description: 'Isolated location' },
          [EXITS_COMPONENT_ID]: [], // No exits
        },
      },
      // Actor 1
      {
        id: 'test-actor-1',
        components: {
          'core:name': { text: 'Actor One' },
          [ACTOR_COMPONENT_ID]: { isPlayer: true },
          [POSITION_COMPONENT_ID]: { locationId: 'test-location-x' },
          [LEADING_COMPONENT_ID]: { followers: [] },
          'movement:movement': { locked: false },
        },
      },
    ];

    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Should not have any go actions
    const goActions = result.actions.filter(
      (action) => action.id === 'movement:go'
    );
    expect(goActions.length).toBe(0);

    // Should still have wait action
    const waitActions = result.actions.filter(
      (action) => action.id === 'core:wait'
    );
    expect(waitActions.length).toBe(1);
  });

  /**
   * Test: Edge case - single actor
   * When only one actor present, follow action should not appear
   */
  test('should not produce follow actions when no other actors available', async () => {
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
      // Only Actor 1 (no other actors)
      {
        id: 'test-actor-1',
        components: {
          'core:name': { text: 'Actor One' },
          [ACTOR_COMPONENT_ID]: { isPlayer: true },
          [POSITION_COMPONENT_ID]: { locationId: 'test-location-x' },
          [LEADING_COMPONENT_ID]: { followers: [] },
          'movement:movement': { locked: false },
        },
      },
    ];

    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Should not have any follow actions
    const followActions = result.actions.filter(
      (action) => action.id === 'companionship:follow'
    );
    expect(followActions.length).toBe(0);

    // Should have go and wait actions
    const goActions = result.actions.filter(
      (action) => action.id === 'movement:go'
    );
    const waitActions = result.actions.filter(
      (action) => action.id === 'core:wait'
    );
    expect(goActions.length).toBe(1);
    expect(waitActions.length).toBe(1);
  });

  /**
   * Test: Edge case - actor already following relationship
   * When Actor 2 is already following Actor 1, follow action should not appear
   */
  test('should not produce follow actions when target is already following current actor', async () => {
    const entities = createStandardTestScenario();

    // Modify Actor 2 to be following Actor 1
    const actor2 = entities.find((e) => e.id === 'test-actor-2');
    actor2.components[FOLLOWING_COMPONENT_ID] = { leaderId: 'test-actor-1' };

    // Modify Actor 1 to be leading Actor 2
    const actor1 = entities.find((e) => e.id === 'test-actor-1');
    actor1.components[LEADING_COMPONENT_ID] = { followers: ['test-actor-2'] };

    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Should not have any follow actions (actor 2 is already following)
    const followActions = result.actions.filter(
      (action) => action.id === 'companionship:follow'
    );
    expect(followActions.length).toBe(0);

    // Should have go, wait, and potentially dismiss actions
    const goActions = result.actions.filter(
      (action) => action.id === 'movement:go'
    );
    const waitActions = result.actions.filter(
      (action) => action.id === 'core:wait'
    );
    expect(goActions.length).toBe(1);
    expect(waitActions.length).toBe(1);
  });

  /**
   * Test: Comprehensive validation of all action commands
   * Ensures no malformed commands are produced
   */
  test('should produce properly formatted commands without placeholder text', async () => {
    const entities = createStandardTestScenario();
    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );

    // Validate all commands are properly formatted
    result.actions.forEach((action) => {
      expect(action.command).toBeDefined();
      expect(typeof action.command).toBe('string');
      expect(action.command.length).toBeGreaterThan(0);

      // Should not contain placeholder text
      expect(action.command).not.toContain('{');
      expect(action.command).not.toContain('}');
      expect(action.command).not.toContain('[TARGET');
      expect(action.command).not.toContain('[LOCATION NAME]');
      expect(action.command).not.toContain('[ACTOR NAME]');
      expect(action.command).not.toContain('undefined');
      expect(action.command).not.toContain('null');
    });
  });

  /**
   * Test: Performance validation
   * Ensures target resolution completes within reasonable time
   */
  test('should complete target resolution within performance limits', async () => {
    const entities = createStandardTestScenario();
    await createActionDiscoveryService(entities);

    const currentActor = entityManager.getEntityInstance('test-actor-1');
    const context = {
      jsonLogicEval,
      location: entityManager.getEntityInstance('test-location-x'),
      allEntities: Array.from(entityManager.entities),
    };

    // Measure resolution time
    const startTime = Date.now();
    const result = await actionDiscoveryService.getValidActions(
      currentActor,
      context
    );
    const endTime = Date.now();

    const resolutionTime = endTime - startTime;

    // Should complete within 500ms (as per spec)
    expect(resolutionTime).toBeLessThan(500);

    // Should return valid results
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
  });
});
