/**
 * @file Integration test for the rule that executes the action "core:stop_following"
 * @see tests/integration/stopFollowingRule.integration.test.js
 */

/**
 * @file Integration tests for follower-system rules: `core:handle_stop_following`.
 * @description This file contains comprehensive unit tests for the system rule logic defined in
 * `core:handle_stop_following.rule.json`. The tests verify
 * all success paths, edge cases, and conditional logic as specified in the ticket. They use a
 * fully-wired test harness that mocks all external dependencies.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import EventBus from '../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';
import EntityManager from '../../src/entities/entityManager.js';
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';

// ────────────────────────────────────────────────────────────────────────────
// 1.  “Micro-container” – only the bits the rule needs
// ────────────────────────────────────────────────────────────────────────────
const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const makeSchemaValidator = () => ({
  validate: jest.fn().mockReturnValue({ isValid: true }),
  isSchemaLoaded: jest.fn().mockReturnValue(false),
});

const makeSpatialIndexMgr = () => ({
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  updateEntityLocation: jest.fn(),
  clearIndex: jest.fn(),
  getEntitiesInLocation: jest.fn().mockReturnValue(new Set()),
});

// MODIFIED: Now accepts an array of rules to load multiple for a test suite
const makeDataRegistry = (rules, leaderSyncServiceMock) => ({
  getAllSystemRules: () => rules,
  getEventDefinition: () => undefined,
  getEntityDefinition: () => undefined,
});

// ────────────────────────────────────────────────────────────────────────────
// 2.  Thin fakes that the rule invokes through QUERY_* operations
// ────────────────────────────────────────────────────────────────────────────
class FakeSystemDataRegistry {
  constructor(logger, leaderSyncService) {
    this.logger = logger;
    this.leaderSyncService = leaderSyncService;
  }

  query(sourceId, details) {
    if (sourceId === 'LeaderListSyncService') {
      return this.leaderSyncService.handleQuery(details);
    }
    if (sourceId === 'WorldContext') {
      if (details.action === 'getCurrentISOTimestamp') {
        return new Date().toISOString();
      }
    }
    return undefined;
  }
}

class FakeLeaderSyncService {
  constructor(logger) {
    this.logger = logger;
  }

  handleQuery = jest.fn().mockReturnValue({ success: true, leadersUpdated: 1 });
}

// ────────────────────────────────────────────────────────────────────────────
// 3.  Helper to stand-up a *fully-wired* interpreter for each test
// ────────────────────────────────────────────────────────────────────────────
function buildTestHarness() {
  const logger = makeLogger();
  const leaderSyncService = new FakeLeaderSyncService(logger);

  // Load the rule JSON files from disk
  const stopFollowingRulePath = path.resolve(
    'data/mods/core/rules/stop_following.rule.json'
  );
  const dismissRulePath = path.resolve(
    'data/mods/core/rules/dismiss.rule.json'
  );

  const stopFollowingRuleJson = JSON.parse(
    fs.readFileSync(stopFollowingRulePath, 'utf8')
  );
  const dismissRuleJson = JSON.parse(fs.readFileSync(dismissRulePath, 'utf8'));

  // Pass an array of rules to the data registry
  const dataRegistry = makeDataRegistry(
    [stopFollowingRuleJson, dismissRuleJson],
    leaderSyncService
  );
  const schemaValidator = makeSchemaValidator();
  const spatialIndex = makeSpatialIndexMgr();
  const entityManager = new EntityManager(
    dataRegistry,
    schemaValidator,
    logger,
    spatialIndex
  );

  const eventBus = new EventBus();
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: dataRegistry,
    schemaValidator,
    logger,
  });

  jest.spyOn(validatedDispatcher, 'dispatch');
  jest.spyOn(entityManager, 'removeComponent'); // Spy on removeComponent for assertions

  const opRegistry = new OperationRegistry({ logger });
  const opInterpreter = new OperationInterpreter({
    logger,
    operationRegistry: opRegistry,
  });

  importAddHandlers(opRegistry, {
    entityManager,
    logger,
    systemDataRegistry: new FakeSystemDataRegistry(logger, leaderSyncService),
    validatedDispatcher,
  });

  const jsonLogicEvalSvc = new JsonLogicEvaluationService({ logger });

  const sysInterpreter = new SystemLogicInterpreter({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService: jsonLogicEvalSvc,
    entityManager,
    operationInterpreter: opInterpreter,
  });

  sysInterpreter.initialize();

  // Expose helpers for assertions
  return {
    logger,
    eventBus,
    validatedDispatcher,
    entityManager,
    leaderSyncService,
    sysInterpreter,
  };
}

// Dynamically import the operation handlers the rule uses
function importAddHandlers(registry, deps) {
  // Local implementation of RemoveComponentHandler for testing purposes
  class RemoveComponentHandler {
    #logger;
    #entityManager;

    constructor(dependencies) {
      this.#logger = dependencies.logger;
      this.#entityManager = dependencies.entityManager;
    }

    #resolveEntityId(ref, ctx) {
      const ec = ctx?.evaluationContext ?? {};
      if (typeof ref === 'string') {
        const t = ref.trim();
        if (!t) return null;
        if (t === 'actor') return ec.actor?.id ?? null;
        if (t === 'target') return ec.target?.id ?? null;
        return t;
      }
      if (
        ref &&
        typeof ref === 'object' &&
        typeof ref.entityId === 'string' &&
        ref.entityId.trim()
      ) {
        return ref.entityId.trim();
      }
      return null;
    }

    execute(params, executionContext) {
      const log = executionContext?.logger ?? this.#logger;
      if (!params) {
        log.warn('REMOVE_COMPONENT: params missing.');
        return;
      }
      const { entity_ref, component_type } = params;
      const entityId = this.#resolveEntityId(entity_ref, executionContext);
      if (entityId && component_type) {
        this.#entityManager.removeComponent(entityId, component_type);
      }
    }
  }

  const add = (type, mod) =>
    registry.register(type, (params, ctx) => mod.execute(params, ctx));

  const {
    default: QueryComponentHandler,
  } = require('../../src/logic/operationHandlers/queryComponentHandler.js');
  const {
    default: QuerySystemDataHandler,
  } = require('../../src/logic/operationHandlers/querySystemDataHandler.js');
  const {
    default: DispatchEventHandler,
  } = require('../../src/logic/operationHandlers/dispatchEventHandler.js');

  add('QUERY_COMPONENT', new QueryComponentHandler(deps));
  add(
    'QUERY_SYSTEM_DATA',
    new QuerySystemDataHandler({
      logger: deps.logger,
      systemDataRegistry: deps.systemDataRegistry,
    })
  );
  add(
    'DISPATCH_EVENT',
    new DispatchEventHandler({
      dispatcher: deps.validatedDispatcher,
      logger: deps.logger,
    })
  );
  // ADDED: Register the REMOVE_COMPONENT handler required by the new rules.
  add('REMOVE_COMPONENT', new RemoveComponentHandler(deps));
}

// ────────────────────────────────────────────────────────────────────────────
// 4.  Shared test fixtures
// ────────────────────────────────────────────────────────────────────────────
const FOLLOWER_ID = 'follower-1';
const LEADER_ID = 'leader-1';
const LOCATION_A = 'loc-a';
const LOCATION_B = 'loc-b';

/**
 * Seeds a standard leader/follower scenario into the EntityManager.
 * @param {EntityManager} entityManager - The entity manager instance.
 * @param {object} options - Configuration for entity locations.
 * @param {string} options.followerLocation - The location ID for the follower.
 * @param {string} options.leaderLocation - The location ID for the leader.
 */
function seedLeaderAndFollower(
  entityManager,
  { followerLocation, leaderLocation }
) {
  const commonEntitySetup = {
    getComponentData(id) {
      return this.components.get(id);
    },
    addComponent(id, val) {
      this.components.set(id, val);
    },
    hasComponent(id) {
      return this.components.has(id);
    },
    removeComponent(id) {
      return this.components.delete(id);
    },
  };

  // The Follower (potential actor for stop_following, target for dismiss)
  entityManager.activeEntities.set(FOLLOWER_ID, {
    ...commonEntitySetup,
    id: FOLLOWER_ID,
    definitionId: 'test:follower',
    components: new Map([
      ['core:name', { text: 'Follower' }],
      ['core:position', { locationId: followerLocation }],
      ['core:following', { leaderId: LEADER_ID }], // The crucial component
    ]),
  });

  // The Leader (potential target for stop_following, actor for dismiss)
  entityManager.activeEntities.set(LEADER_ID, {
    ...commonEntitySetup,
    id: LEADER_ID,
    definitionId: 'test:leader',
    components: new Map([
      ['core:name', { text: 'Leader' }],
      ['core:position', { locationId: leaderLocation }],
      ['core:leading', { followers: [FOLLOWER_ID] }], // Initial state
    ]),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 5.  The Specs
// ────────────────────────────────────────────────────────────────────────────

describe('core:handle_stop_following rule', () => {
  let h;

  afterEach(() => {
    h.sysInterpreter.shutdown();
    jest.clearAllMocks();
  });

  test('Given an actor is following, When they stop_following, Then the component is removed, sync service is called, and turn ends', async () => {
    // Arrange
    h = buildTestHarness();
    seedLeaderAndFollower(h.entityManager, {
      followerLocation: LOCATION_A,
      leaderLocation: LOCATION_A,
    });

    // Act
    await h.eventBus.dispatch('core:attempt_action', {
      actorId: FOLLOWER_ID,
      actionId: 'core:stop_following',
    });

    // Assert
    // 1. EntityManager's removeComponent was called correctly
    expect(h.entityManager.removeComponent).toHaveBeenCalledWith(
      FOLLOWER_ID,
      'core:following'
    );

    // 2. LeaderListSyncService was called with the old leader's ID
    expect(h.leaderSyncService.handleQuery).toHaveBeenCalledWith({
      action: 'rebuildFor',
      leaderIds: [LEADER_ID],
    });

    // 3. A turn_ended event was dispatched for the actor
    expect(h.validatedDispatcher.dispatch).toHaveBeenCalledWith(
      'core:turn_ended',
      expect.objectContaining({ entityId: FOLLOWER_ID })
    );
    expect(h.logger.error).not.toHaveBeenCalled();
  });

  test('Given actor and leader are in the SAME location, When stop_following, Then a perceptible_event SHOULD be dispatched', async () => {
    // Arrange
    h = buildTestHarness();
    seedLeaderAndFollower(h.entityManager, {
      followerLocation: LOCATION_A,
      leaderLocation: LOCATION_A, // Same location
    });

    // Act
    await h.eventBus.dispatch('core:attempt_action', {
      actorId: FOLLOWER_ID,
      actionId: 'core:stop_following',
    });

    // Assert
    const dispatchedEvents = h.validatedDispatcher.dispatch.mock.calls.map(
      (call) => call[0]
    );
    expect(dispatchedEvents).toContain('core:perceptible_event');
    expect(h.logger.error).not.toHaveBeenCalled();
  });

  test('Given actor and leader are in DIFFERENT locations, When stop_following, Then a perceptible_event SHOULD NOT be dispatched', async () => {
    // Arrange
    h = buildTestHarness();
    seedLeaderAndFollower(h.entityManager, {
      followerLocation: LOCATION_A,
      leaderLocation: LOCATION_B, // Different locations
    });

    // Act
    await h.eventBus.dispatch('core:attempt_action', {
      actorId: FOLLOWER_ID,
      actionId: 'core:stop_following',
    });

    // Assert
    const dispatchedEvents = h.validatedDispatcher.dispatch.mock.calls.map(
      (call) => call[0]
    );
    expect(dispatchedEvents).not.toContain('core:perceptible_event');
    expect(h.logger.error).not.toHaveBeenCalled();
  });
});
