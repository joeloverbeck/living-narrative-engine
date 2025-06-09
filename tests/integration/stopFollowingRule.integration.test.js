/**
 * @file This module proves the behavior of the rule to stop following.
 * @see tests/integration/stopFollowingRule.integration.test.js
 */

// tests/integration/stopFollowing.integration.test.js
// ---------------------------------------------------------------------------
// Issue #XX: Unit-test rule core:stop_following
//
// Verifies that the `handle_stop_following` rule correctly removes the
// 'core:following' component, updates the leader cache, and conditionally
// dispatches a valid `core:perceptible_event` with a fully-rendered
// description. This suite specifically validates the fixes for payload
// validation errors and unresolved placeholders.
// ---------------------------------------------------------------------------

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import fs from 'node:fs';
import _ from 'lodash';

import EventBus from '../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';
import EntityManager from '../../src/entities/entityManager.js';
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';

// ────────────────────────────────────────────────────────────────────────────
// 1.  “Micro-container” – Mocks and Fakes for External Dependencies
// ────────────────────────────────────────────────────────────────────────────

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const makeSchemaValidator = () => ({
  // We mock a successful validation, as the VED's internal logic is not the
  // focus of this test. We test the *payload*, not the validator itself.
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

// A simplified DataRegistry that only provides the rule we're testing.
const makeDataRegistry = (rule) => ({
  getAllSystemRules: () => [rule],
  getEventDefinition: () => undefined,
  getEntityDefinition: (defId) => ({
    name: _.startCase(defId.split(':')[1] || 'Unknown'),
  }),
});

// A fake SystemDataRegistry that can respond to our rule's specific queries.
class FakeSystemDataRegistry {
  constructor(logger, leaderSyncService) {
    this.leaderSyncService = leaderSyncService;
    this.timestamp = new Date().toISOString();
  }

  query(sourceId, details) {
    if (sourceId === 'LeaderListSyncService') {
      return this.leaderSyncService.handleQuery(details);
    }
    if (sourceId === 'WorldContext') {
      if (details.action === 'getCurrentISOTimestamp') {
        return this.timestamp;
      }
    }
    return undefined;
  }
}

// A fake service to handle leader/follower cache rebuilding.
class FakeLeaderSyncService {
  handleQuery = jest.fn(({ action, leaderIds }) => {
    if (action === 'rebuildFor') {
      return { success: true, leadersUpdated: leaderIds.length, warnings: [] };
    }
    return { success: false };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 2.  Test Harness Builder
// ────────────────────────────────────────────────────────────────────────────

function buildTestHarness() {
  const logger = makeLogger();
  // IMPORTANT: Load the corrected rule file for this test.
  const stopFollowingRule = JSON.parse(
    fs.readFileSync('data/mods/core/rules/stop_following.rule.json', 'utf8')
  );

  const dataRegistry = makeDataRegistry(stopFollowingRule);
  const schemaValidator = makeSchemaValidator();
  const spatialIndex = makeSpatialIndexMgr();
  const entityManager = new EntityManager(
    dataRegistry,
    schemaValidator,
    logger,
    spatialIndex
  );
  const leaderSyncService = new FakeLeaderSyncService(entityManager);
  const systemDataRegistry = new FakeSystemDataRegistry(
    logger,
    leaderSyncService
  );
  const eventBus = new EventBus();
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: dataRegistry,
    schemaValidator,
    logger,
  });

  // Spy on key interactions to verify outcomes.
  jest.spyOn(validatedDispatcher, 'dispatch');
  jest.spyOn(entityManager, 'removeComponent');

  const opRegistry = new OperationRegistry({ logger });
  const opInterpreter = new OperationInterpreter({
    logger,
    operationRegistry: opRegistry,
  });

  // Register all operation handlers used by the rule.
  importAndRegisterHandlers(opRegistry, {
    entityManager,
    logger,
    systemDataRegistry,
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

  return {
    logger,
    eventBus,
    validatedDispatcher,
    entityManager,
    leaderSyncService,
    systemDataRegistry, // expose to get timestamp
    sysInterpreter,
  };
}

function importAndRegisterHandlers(registry, deps) {
  const add = (type, HandlerClass, extraDeps = {}) =>
    registry.register(type, (params, context) =>
      new HandlerClass({ ...deps, ...extraDeps }).execute(params, context)
    );

  const {
    default: QueryComponentHandler,
  } = require('../../src/logic/operationHandlers/queryComponentHandler.js');
  const {
    default: QuerySystemDataHandler,
  } = require('../../src/logic/operationHandlers/querySystemDataHandler.js');
  const {
    default: DispatchEventHandler,
  } = require('../../src/logic/operationHandlers/dispatchEventHandler.js');
  const {
    default: RemoveComponentHandler,
  } = require('../../src/logic/operationHandlers/removeComponentHandler.js');

  add('QUERY_COMPONENT', QueryComponentHandler);
  add('QUERY_SYSTEM_DATA', QuerySystemDataHandler);
  add('DISPATCH_EVENT', DispatchEventHandler, {
    dispatcher: deps.validatedDispatcher,
  });
  add('REMOVE_COMPONENT', RemoveComponentHandler);
}

// ────────────────────────────────────────────────────────────────────────────
// 3.  Shared Test Fixtures and Helpers
// ────────────────────────────────────────────────────────────────────────────

const FOLLOWER_ID = 'char:frodo';
const LEADER_ID = 'char:aragorn';
const SAME_LOCATION = 'loc:rivendell';
const OTHER_LOCATION = 'loc:bree';

function seedTestEntity(
  entityManager,
  { id, name, locationId, following = null }
) {
  const entity = {
    id,
    definitionId: `test:${name.toLowerCase()}`,
    components: new Map([
      ['core:name', { text: name }],
      ['core:position', { locationId }],
    ]),
    getComponentData: (cId) => entity.components.get(cId),
    removeComponent: (cId) => entity.components.delete(cId),
  };

  if (following) {
    entity.components.set('core:following', { leaderId: following });
  }

  entityManager.activeEntities.set(id, entity);
}

// ────────────────────────────────────────────────────────────────────────────
// 4.  The Specs
// ────────────────────────────────────────────────────────────────────────────

describe('[Rule] handle_stop_following', () => {
  let h;

  beforeEach(() => {
    h = buildTestHarness();
  });

  afterEach(() => {
    h.sysInterpreter.shutdown();
    jest.clearAllMocks();
  });

  describe('WHEN follower and leader are in the SAME location', () => {
    beforeEach(async () => {
      // Arrange
      seedTestEntity(h.entityManager, {
        id: LEADER_ID,
        name: 'Aragorn',
        locationId: SAME_LOCATION,
      });
      seedTestEntity(h.entityManager, {
        id: FOLLOWER_ID,
        name: 'Frodo',
        locationId: SAME_LOCATION,
        following: LEADER_ID,
      });

      // Act
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: FOLLOWER_ID,
        actionId: 'core:stop_following',
      });
    });

    test('it must remove the `core:following` component from the actor', () => {
      // Assert
      expect(h.entityManager.removeComponent).toHaveBeenCalledWith(
        FOLLOWER_ID,
        'core:following'
      );
    });

    test('it must rebuild the cache for the old leader', () => {
      // Assert
      expect(h.leaderSyncService.handleQuery).toHaveBeenCalledWith({
        action: 'rebuildFor',
        leaderIds: [LEADER_ID],
      });
    });

    test('it must dispatch a `core:perceptible_event`', () => {
      // Assert
      const perceptibleEventCall =
        h.validatedDispatcher.dispatch.mock.calls.find(
          (call) => call[0] === 'core:perceptible_event'
        );
      expect(perceptibleEventCall).toBeDefined();
    });

    test('the `perceptible_event` payload must be valid and complete', () => {
      // Assert
      const perceptibleEventPayload =
        h.validatedDispatcher.dispatch.mock.calls.find(
          (call) => call[0] === 'core:perceptible_event'
        )[1];

      expect(perceptibleEventPayload).toEqual({
        eventName: 'core:perceptible_event',
        timestamp: h.systemDataRegistry.timestamp,
        locationId: SAME_LOCATION,
        descriptionText: 'Frodo is no longer following Aragorn.',
        perceptionType: 'state_change_observable',
        actorId: FOLLOWER_ID,
        targetId: LEADER_ID,
        involvedEntities: [],
      });
    });

    test('it must dispatch a `core:turn_ended` event', () => {
      // Assert
      expect(h.validatedDispatcher.dispatch).toHaveBeenCalledWith(
        'core:turn_ended',
        { entityId: FOLLOWER_ID, success: true }
      );
    });
  });

  describe('WHEN follower and leader are in DIFFERENT locations', () => {
    beforeEach(async () => {
      // Arrange
      seedTestEntity(h.entityManager, {
        id: LEADER_ID,
        name: 'Aragorn',
        locationId: OTHER_LOCATION,
      });
      seedTestEntity(h.entityManager, {
        id: FOLLOWER_ID,
        name: 'Frodo',
        locationId: SAME_LOCATION,
        following: LEADER_ID,
      });

      // Act
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: FOLLOWER_ID,
        actionId: 'core:stop_following',
      });
    });

    test('it must still remove the `core:following` component', () => {
      // Assert
      expect(h.entityManager.removeComponent).toHaveBeenCalledWith(
        FOLLOWER_ID,
        'core:following'
      );
    });

    test('it must NOT dispatch a `core:perceptible_event`', () => {
      // Assert
      const perceptibleEventCall =
        h.validatedDispatcher.dispatch.mock.calls.find(
          (call) => call[0] === 'core:perceptible_event'
        );
      expect(perceptibleEventCall).toBeUndefined();
    });
  });
});
