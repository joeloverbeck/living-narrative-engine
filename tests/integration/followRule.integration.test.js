// tests/integration/followRule.integration.test.js
// ---------------------------------------------------------------------------
// • One “happy-path” spec that exercises EVERY operation in follow.rule.json
// • One “wrong-actionId” spec (negative path)
// • One “syncService throws” spec (resilience / short-circuit)
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

const makeDataRegistry = (ruleJson, leaderSyncServiceMock) => ({
  getAllSystemRules: () => [ruleJson],
  /* the rule doesn’t use GameDataRepository here, so leave the rest empty */
  /* but VED looks up EventDefinitions — return undefined so it skips validation */
  getEventDefinition: () => undefined,
  /* SystemDataRegistry is accessed through QUERY_SYSTEM_DATA */
  /* We patch it directly in the SystemDataRegistry mock below                */
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
    /* unreachable in this rule */
    return undefined;
  }
}

class FakeLeaderSyncService {
  constructor(logger) {
    this.logger = logger;
  }

  /** we only need to know it was called with the right leaderIds */
  handleQuery = jest.fn().mockReturnValue({ success: true, leadersUpdated: 1 });
}

// ────────────────────────────────────────────────────────────────────────────
// 3.  Helper to stand-up a *fully-wired* interpreter for each test
// ────────────────────────────────────────────────────────────────────────────
function buildTestHarness() {
  const logger = makeLogger();
  const leaderSyncService = new FakeLeaderSyncService(logger);

  // —— load the real rule JSON from disk (unchanged engine asset) ——
  const followRulePath = path.resolve('data/mods/core/rules/follow.rule.json');
  const followRuleJson = JSON.parse(fs.readFileSync(followRulePath, 'utf8'));

  const dataRegistry = makeDataRegistry(followRuleJson, leaderSyncService);
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
    gameDataRepository: dataRegistry, // minimal stub – no definitions loaded
    schemaValidator,
    logger,
  });

  jest.spyOn(validatedDispatcher, 'dispatch');

  // —— Operation registry with ONLY the handlers referenced by the rule ——
  const opRegistry = new OperationRegistry({ logger });
  const opInterpreter = new OperationInterpreter({
    logger,
    operationRegistry: opRegistry,
  });

  // Handlers come straight from production code:
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

  // expose helpers for assertions
  return {
    logger,
    eventBus,
    validatedDispatcher,
    entityManager,
    leaderSyncService,
    sysInterpreter,
  };
}

// Dynamically import the seven operation handlers the rule uses
function importAddHandlers(registry, deps) {
  const add = (type, mod) =>
    registry.register(type, (params, ctx) => mod.execute(params, ctx));

  const {
    default: QueryComponentHandler,
  } = require('../../src/logic/operationHandlers/queryComponentHandler.js');
  const {
    default: AddComponentHandler,
  } = require('../../src/logic/operationHandlers/addComponentHandler.js');
  const {
    default: QuerySystemDataHandler,
  } = require('../../src/logic/operationHandlers/querySystemDataHandler.js');
  const {
    default: DispatchEventHandler,
  } = require('../../src/logic/operationHandlers/dispatchEventHandler.js');

  add('QUERY_COMPONENT', new QueryComponentHandler(deps));
  add(
    'ADD_COMPONENT',
    new AddComponentHandler({
      ...deps,
      safeEventDispatcher: deps.validatedDispatcher, // fulfils constructor
    })
  );
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
}

// ────────────────────────────────────────────────────────────────────────────
// 4.  Shared test fixtures
// ────────────────────────────────────────────────────────────────────────────
const ACTOR_ID = 'actor-1';
const OLD_LEADER = 'leader-A';
const NEW_LEADER = 'leader-B';

function seedActor(entityManager, leaderId = OLD_LEADER) {
  entityManager.activeEntities.set(ACTOR_ID, {
    id: ACTOR_ID,
    definitionId: 'test:actor',
    components: new Map([
      ['core:name', { text: 'Follower' }],
      ['core:position', { locationId: 'loc-1' }],
      ['core:following', { leaderId }],
    ]),
    getComponentData(id) {
      return this.components.get(id);
    },
    addComponent(id, val) {
      this.components.set(id, val);
    },
    hasComponent(id) {
      return this.components.has(id);
    },
  });
  entityManager.activeEntities.set(NEW_LEADER, {
    id: NEW_LEADER,
    definitionId: 'test:leader',
    components: new Map([['core:name', { text: 'Leader' }]]),
    getComponentData(id) {
      return this.components.get(id);
    },
    addComponent(id, val) {
      this.components.set(id, val);
    },
    hasComponent(id) {
      return this.components.has(id);
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 5.  The specs
// ────────────────────────────────────────────────────────────────────────────
describe('core_handle_follow rule (integration)', () => {
  let h;

  beforeEach(() => {
    h = buildTestHarness();
  });

  afterEach(() => {
    h.sysInterpreter.shutdown();
  });

  test('happy path – actor switches leaders, sync service called, two events dispatched', async () => {
    seedActor(h.entityManager);

    // — Trigger —
    await h.eventBus.dispatch('core:attempt_action', {
      actorId: ACTOR_ID,
      targetId: NEW_LEADER,
      actionId: 'core:follow',
    });

    // — Assertions —
    // 1. component mutation
    const follow = h.entityManager
      .getEntityInstance(ACTOR_ID)
      .getComponentData('core:following');
    expect(follow.leaderId).toBe(NEW_LEADER);

    // 2. sync service got both IDs
    expect(h.leaderSyncService.handleQuery).toHaveBeenCalledTimes(1);
    expect(h.leaderSyncService.handleQuery).toHaveBeenCalledWith({
      action: 'rebuildFor',
      leaderIds: [OLD_LEADER, NEW_LEADER],
    });

    // 3. dispatcher sent two events with correct types
    const calls = h.validatedDispatcher.dispatch.mock.calls;
    const types = calls.map(([ev]) => ev).sort();
    expect(types).toEqual(['core:perceptible_event', 'core:turn_ended']);

    // 4. perceptible description interpolated
    const perceptPayload = calls.find(
      ([t]) => t === 'core:perceptible_event'
    )[1];
    expect(perceptPayload.descriptionText).toBe(
      'Follower has decided to follow Leader.'
    );

    // 5. no errors logged
    expect(h.logger.error).not.toHaveBeenCalled();
  });

  test('non-follow action does nothing', async () => {
    seedActor(h.entityManager);

    await h.eventBus.dispatch('core:attempt_action', {
      actorId: ACTOR_ID,
      targetId: NEW_LEADER,
      actionId: 'core:attack', // <- wrong actionId
    });

    expect(
      h.entityManager.getComponentData(ACTOR_ID, 'core:following').leaderId
    ).toBe(OLD_LEADER);

    expect(h.validatedDispatcher.dispatch).not.toHaveBeenCalled();
    expect(h.leaderSyncService.handleQuery).not.toHaveBeenCalled();
  });

  test('LeaderListSyncService error halts remaining actions but interpreter survives', async () => {
    seedActor(h.entityManager);

    // make the sync service explode
    h.leaderSyncService.handleQuery.mockImplementation(() => {
      throw new Error('Simulated failure');
    });

    await h.eventBus.dispatch('core:attempt_action', {
      actorId: ACTOR_ID,
      targetId: NEW_LEADER,
      actionId: 'core:follow',
    });

    // addComponent executed before the explosion, so leader changed…
    expect(
      h.entityManager.getComponentData(ACTOR_ID, 'core:following').leaderId
    ).toBe(NEW_LEADER);

    // …but the turn_ended event (last action in list) never fired
    const types = h.validatedDispatcher.dispatch.mock.calls.map(([t]) => t);
    expect(types).not.toContain('core:turn_ended');

    // interpreter caught and logged the error, test runner didn’t crash
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("rule 'core_handle_follow' threw:"),
      expect.any(Error)
    );
  });
});
