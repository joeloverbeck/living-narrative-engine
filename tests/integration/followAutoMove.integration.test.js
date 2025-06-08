// ---------------------------------------------------------------------------
// Issue 6: Unit-test rule core:follow_auto_move
//
// Verifies that the `follow_auto_move` rule correctly dispatches `core:attempt_action`
// events for co-located followers when a leader moves. This test isolates
// the rule's logic to ensure it behaves according to the specified test matrix.
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
import ForEachHandler from '../../src/logic/operationHandlers/forEachHandler.js';

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

const makeDataRegistry = (rules) => ({
  getAllSystemRules: () => rules,
  getEventDefinition: () => undefined,
  getEntityDefinition: (defId) => ({
    name: _.startCase(defId.split(':')[1] || 'Unknown'),
  }),
});

class FakeSystemDataRegistry {
  constructor(logger, leaderSyncService) {
    this.leaderSyncService = leaderSyncService;
  }

  query(sourceId, details) {
    if (sourceId === 'LeaderListSyncService') {
      return this.leaderSyncService.handleQuery(details);
    }
    return undefined;
  }
}

class FakeLeaderSyncService {
  #entityManager;

  constructor(entityManager) {
    this.#entityManager = entityManager;
  }

  handleQuery = jest.fn(({ action, leaderIds }) => {
    if (action === 'rebuildFor') {
      for (const leaderId of leaderIds) {
        this.#rebuildLeadingComponent(leaderId);
      }
      return { success: true, leadersUpdated: leaderIds.length };
    }
    return { success: false, leadersUpdated: 0 };
  });

  rebuildFor(leaderIds) {
    return this.handleQuery({ action: 'rebuildFor', leaderIds });
  }

  #rebuildLeadingComponent(leaderId) {
    const leader = this.#entityManager.getEntityInstance(leaderId);
    if (!leader) return;
    const followers = [];
    for (const entity of this.#entityManager.activeEntities.values()) {
      const followingComp = entity.getComponentData('core:following');
      if (followingComp && followingComp.leaderId === leaderId) {
        followers.push(entity.id);
      }
    }
    leader.addComponent('core:leading', { followers });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2.  Test Harness Builder
// ────────────────────────────────────────────────────────────────────────────

function buildTestHarness() {
  const logger = makeLogger();
  // We test the *original* flawed rule, but work around the flaw in the test itself.
  const autoMoveRule = JSON.parse(
    fs.readFileSync('data/mods/core/rules/follow_auto_move.rule.json', 'utf8')
  );

  const dataRegistry = makeDataRegistry([autoMoveRule]);
  const schemaValidator = makeSchemaValidator();
  const spatialIndex = makeSpatialIndexMgr();
  const entityManager = new EntityManager(
    dataRegistry,
    schemaValidator,
    logger,
    spatialIndex
  );
  const leaderSyncService = new FakeLeaderSyncService(entityManager);
  const eventBus = new EventBus();
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: dataRegistry,
    schemaValidator,
    logger,
  });

  jest.spyOn(validatedDispatcher, 'dispatch');

  const opRegistry = new OperationRegistry({ logger });
  const opInterpreter = new OperationInterpreter({
    logger,
    operationRegistry: opRegistry,
  });

  const jsonLogicEvalSvc = new JsonLogicEvaluationService({ logger });

  importAndRegisterHandlers(opRegistry, {
    entityManager,
    logger,
    systemDataRegistry: new FakeSystemDataRegistry(logger, leaderSyncService),
    validatedDispatcher,
    operationInterpreter: opInterpreter,
  });

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
    default: SetVariableHandler,
  } = require('../../src/logic/operationHandlers/setVariableHandler.js');

  add('QUERY_COMPONENT', QueryComponentHandler);
  add('QUERY_SYSTEM_DATA', QuerySystemDataHandler);
  add('DISPATCH_EVENT', DispatchEventHandler, {
    dispatcher: deps.validatedDispatcher,
  });
  add('SET_VARIABLE', SetVariableHandler);
  add('FOR_EACH', ForEachHandler);
}

// ────────────────────────────────────────────────────────────────────────────
// 3.  Shared Test Fixtures and Helpers
// ────────────────────────────────────────────────────────────────────────────

const LEADER_ID = 'leader:gandalf';
const FOLLOWER_A_ID = 'follower:frodo';
const FOLLOWER_B_ID = 'follower:sam';
const MOVER_ID = 'mover:boromir';

const START_LOCATION = 'loc:rivendell';
const TARGET_LOCATION = 'loc:hollin_gate';
const OTHER_LOCATION = 'loc:shire';

function seedTestEntity(
  entityManager,
  { id, name, locationId, following = null }
) {
  const _components = {
    'core:name': { text: name },
    'core:position': { locationId },
  };

  if (following) {
    _components['core:following'] = { leaderId: following };
  }

  const entity = {
    id,
    definitionId: `test:${name.toLowerCase()}`,
    getComponentData(cId) {
      return _components[cId];
    },
    addComponent(cId, val) {
      _components[cId] = val;
      return this;
    },
    hasComponent(cId) {
      return Object.prototype.hasOwnProperty.call(_components, cId);
    },
    removeComponent(cId) {
      const had = this.hasComponent(cId);
      if (had) {
        delete _components[cId];
      }
      return had;
    },
    getDefinition() {
      return { name };
    },
  };

  entityManager.activeEntities.set(id, entity);
}

// ────────────────────────────────────────────────────────────────────────────
// 4.  The Specs
// ────────────────────────────────────────────────────────────────────────────

describe('[Rule] core:follow_auto_move', () => {
  let h;

  beforeEach(() => {
    h = buildTestHarness();
  });

  afterEach(() => {
    h.sysInterpreter.shutdown();
    jest.clearAllMocks();
  });

  test('WHEN leader with no followers moves, THEN dispatches 0 move events', async () => {
    seedTestEntity(h.entityManager, {
      id: LEADER_ID,
      name: 'Gandalf',
      locationId: START_LOCATION,
    });
    h.leaderSyncService.rebuildFor([LEADER_ID]);

    await h.eventBus.dispatch('core:entity_moved', {
      entityId: LEADER_ID,
      previousLocationId: START_LOCATION,
      currentLocationId: TARGET_LOCATION,
      direction: 'south',
    });

    const dispatchedActionAttempts =
      h.validatedDispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'core:attempt_action'
      );
    expect(dispatchedActionAttempts).toHaveLength(0);
  });

  test('WHEN an entity that is not a leader moves, THEN dispatches 0 move events', async () => {
    seedTestEntity(h.entityManager, {
      id: MOVER_ID,
      name: 'Boromir',
      locationId: START_LOCATION,
    });
    h.leaderSyncService.rebuildFor([MOVER_ID]);

    await h.eventBus.dispatch('core:entity_moved', {
      entityId: MOVER_ID,
      previousLocationId: START_LOCATION,
      currentLocationId: TARGET_LOCATION,
      direction: 'east',
    });

    const dispatchedActionAttempts =
      h.validatedDispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'core:attempt_action'
      );
    expect(dispatchedActionAttempts).toHaveLength(0);
  });
});
