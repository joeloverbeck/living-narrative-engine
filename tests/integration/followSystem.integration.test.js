// tests/integration/followSystem.integration.test.js
// ---------------------------------------------------------------------------
// • Consolidated integration tests for the Follow/Stop/Dismiss mutator rule.
// • Covers all scenarios from Ticket #3 and the original isolated test files,
//   including success paths, leader switching, negative paths, resilience,
//   conditional event dispatching, and the data consistency stress test.
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
    if (sourceId === 'WorldContext') {
      if (details.action === 'getCurrentISOTimestamp') {
        return new Date().toISOString();
      }
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
    if (followers.length > 0) {
      leader.addComponent('core:leading', { followers });
    } else {
      leader.removeComponent('core:leading');
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2.  Test Harness Builder
// ────────────────────────────────────────────────────────────────────────────

/**
 *
 */
function buildTestHarness() {
  const logger = makeLogger();
  const followRule = JSON.parse(
    fs.readFileSync('data/mods/core/rules/follow.rule.json', 'utf8')
  );
  const stopRule = JSON.parse(
    fs.readFileSync('data/mods/core/rules/stop_following.rule.json', 'utf8')
  );
  const dismissRule = JSON.parse(
    fs.readFileSync('data/mods/core/rules/dismiss.rule.json', 'utf8')
  );

  const dataRegistry = makeDataRegistry([followRule, stopRule, dismissRule]);
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
  jest.spyOn(entityManager, 'removeComponent');
  jest.spyOn(entityManager, 'addComponent');
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
  return {
    logger,
    eventBus,
    validatedDispatcher,
    entityManager,
    leaderSyncService,
    sysInterpreter,
  };
}

/**
 *
 * @param registry
 * @param deps
 */
function importAddHandlers(registry, deps) {
  class RemoveComponentHandler {
    #entityManager;

    constructor(d) {
      this.#entityManager = d.entityManager;
    }

    #resolveEntityId(ref, ctx) {
      const ec = ctx?.evaluationContext ?? {};
      if (typeof ref === 'string') {
        const t = ref.trim();
        if (t === 'actor') return ec.actor?.id ?? null;
        if (t === 'target') return ec.target?.id ?? null;
        return t || null;
      }
      return null;
    }

    execute(params, ctx) {
      const id = this.#resolveEntityId(params.entity_ref, ctx);
      if (id && params.component_type)
        this.#entityManager.removeComponent(id, params.component_type);
    }
  }

  const add = (type, H, extraDeps = {}) =>
    registry.register(type, (p, c) =>
      new H({ ...deps, ...extraDeps }).execute(p, c)
    );
  const {
    default: QCH,
  } = require('../../src/logic/operationHandlers/queryComponentHandler.js');
  const {
    default: ACH,
  } = require('../../src/logic/operationHandlers/addComponentHandler.js');
  const {
    default: QSDH,
  } = require('../../src/logic/operationHandlers/querySystemDataHandler.js');
  const {
    default: DEH,
  } = require('../../src/logic/operationHandlers/dispatchEventHandler.js');
  add('QUERY_COMPONENT', QCH);
  add('ADD_COMPONENT', ACH, { safeEventDispatcher: deps.validatedDispatcher });
  add('QUERY_SYSTEM_DATA', QSDH, {
    systemDataRegistry: deps.systemDataRegistry,
  });
  add('DISPATCH_EVENT', DEH, { dispatcher: deps.validatedDispatcher });
  registry.register('REMOVE_COMPONENT', (p, c) =>
    new RemoveComponentHandler(deps).execute(p, c)
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 3.  Shared Test Fixtures and Helpers
// ────────────────────────────────────────────────────────────────────────────

const ACTOR_A_ID = 'actor-A';
const ACTOR_B_ID = 'actor-B';
const ACTOR_C_ID = 'actor-C';
const LOCATION_A = 'loc-a';
const LOCATION_B = 'loc-b';

/**
 *
 * @param entityManager
 * @param root0
 * @param root0.id
 * @param root0.name
 * @param root0.locationId
 * @param root0.following
 */
function seedTestEntity(
  entityManager,
  { id, name, locationId, following = null }
) {
  const entity = {
    id,
    definitionId: `test:${name.toLowerCase().replace(' ', '-')}`,
    components: new Map([
      ['core:name', { text: name }],
      ['core:position', { locationId }],
    ]),
    getComponentData(cId) {
      return this.components.get(cId);
    },
    addComponent(cId, val) {
      this.components.set(cId, val);
      return this;
    },
    hasComponent(cId) {
      return this.components.has(cId);
    },
    removeComponent(cId) {
      return this.components.delete(cId);
    },
    getDefinition() {
      return { name };
    },
  };
  if (following)
    entity.components.set('core:following', { leaderId: following });
  entityManager.activeEntities.set(id, entity);
  if (following && !entityManager.getEntityInstance(following)) {
    seedTestEntity(entityManager, {
      id: following,
      name: `Leader ${following}`,
      locationId,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4.  The Specs
// ────────────────────────────────────────────────────────────────────────────

describe('[Mutator Rule] Follow/Stop/Dismiss System', () => {
  let h;
  beforeEach(() => {
    h = buildTestHarness();
  });
  afterEach(() => {
    h.sysInterpreter.shutdown();
    jest.clearAllMocks();
  });

  // ———————————————————— core:follow ————————————————————
  describe('Action: core:follow', () => {
    test('First-time follow: Acquires component, triggers ONE sync, dispatches events', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_B_ID,
        name: 'Bob',
        locationId: LOCATION_A,
      });
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_A_ID,
        targetId: ACTOR_B_ID,
        actionId: 'core:follow',
      });
      expect(
        h.entityManager
          .getEntityInstance(ACTOR_A_ID)
          .getComponentData('core:following')
      ).toEqual({ leaderId: ACTOR_B_ID });
      expect(h.leaderSyncService.handleQuery).toHaveBeenCalledTimes(1);
      expect(h.leaderSyncService.handleQuery).toHaveBeenCalledWith({
        action: 'rebuildFor',
        leaderIds: [ACTOR_B_ID],
      });
      const dispatched = h.validatedDispatcher.dispatch.mock.calls
        .map((c) => c[0])
        .sort();
      expect(dispatched).toEqual([
        'core:display_successful_action_result',
        'core:perceptible_event',
        'core:turn_ended',
      ]);
    });

    test('Switching leaders: Updates component, triggers TWO syncs (old and new)', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_C_ID,
        name: 'Charlie',
        locationId: LOCATION_A,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
        following: ACTOR_C_ID,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_B_ID,
        name: 'Bob',
        locationId: LOCATION_A,
      });
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_A_ID,
        targetId: ACTOR_B_ID,
        actionId: 'core:follow',
      });
      expect(
        h.entityManager
          .getEntityInstance(ACTOR_A_ID)
          .getComponentData('core:following')
      ).toEqual({ leaderId: ACTOR_B_ID });
      expect(h.leaderSyncService.handleQuery).toHaveBeenCalledTimes(2);
      expect(h.leaderSyncService.handleQuery).toHaveBeenCalledWith({
        action: 'rebuildFor',
        leaderIds: [ACTOR_C_ID],
      });
      expect(h.leaderSyncService.handleQuery).toHaveBeenCalledWith({
        action: 'rebuildFor',
        leaderIds: [ACTOR_B_ID],
      });
    });
  });

  // ———————————————————— core:stop_following ————————————————————
  describe('Action: core:stop_following', () => {
    test('Co-located: Component removed, perceptible event dispatched', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_B_ID,
        name: 'Bob',
        locationId: LOCATION_A,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
        following: ACTOR_B_ID,
      });
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_A_ID,
        actionId: 'core:stop_following',
      });
      expect(h.entityManager.removeComponent).toHaveBeenCalledWith(
        ACTOR_A_ID,
        'core:following'
      );
      const dispatched = h.validatedDispatcher.dispatch.mock.calls.map(
        (c) => c[0]
      );
      expect(dispatched).toContain('core:perceptible_event');
    });

    test('Remote: Component removed, NO perceptible event dispatched', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_B_ID,
        name: 'Bob',
        locationId: LOCATION_B,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
        following: ACTOR_B_ID,
      });
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_A_ID,
        actionId: 'core:stop_following',
      });
      expect(h.entityManager.removeComponent).toHaveBeenCalledWith(
        ACTOR_A_ID,
        'core:following'
      );
      const dispatched = h.validatedDispatcher.dispatch.mock.calls.map(
        (c) => c[0]
      );
      expect(dispatched).not.toContain('core:perceptible_event');
    });
  });

  // ———————————————————— core:dismiss ————————————————————
  describe('Action: core:dismiss', () => {
    test('Co-located: Target component removed, perceptible event dispatched', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_B_ID,
        name: 'Bob',
        locationId: LOCATION_A,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
        following: ACTOR_B_ID,
      });
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_B_ID,
        targetId: ACTOR_A_ID,
        actionId: 'core:dismiss',
      });
      expect(h.entityManager.removeComponent).toHaveBeenCalledWith(
        ACTOR_A_ID,
        'core:following'
      );
      const dispatched = h.validatedDispatcher.dispatch.mock.calls.map(
        (c) => c[0]
      );
      expect(dispatched).toContain('core:perceptible_event');
    });

    test('Remote: Target component removed, NO perceptible event dispatched', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_B_ID,
        name: 'Bob',
        locationId: LOCATION_B,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
        following: ACTOR_B_ID,
      });
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_B_ID,
        targetId: ACTOR_A_ID,
        actionId: 'core:dismiss',
      });
      expect(h.entityManager.removeComponent).toHaveBeenCalledWith(
        ACTOR_A_ID,
        'core:following'
      );
      const dispatched = h.validatedDispatcher.dispatch.mock.calls.map(
        (c) => c[0]
      );
      expect(dispatched).not.toContain('core:perceptible_event');
    });
  });

  // ———————————————————— Negative Path & Resilience Tests ————————————————————
  describe('Edge Cases and Resilience', () => {
    test('Irrelevant actionId: Rules are ignored, no state is changed', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
        following: ACTOR_B_ID,
      });
      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_A_ID,
        actionId: 'core:some_other_action',
      });
      expect(h.entityManager.addComponent).not.toHaveBeenCalled();
      expect(h.entityManager.removeComponent).not.toHaveBeenCalled();
      expect(h.leaderSyncService.handleQuery).not.toHaveBeenCalled();
    });

    test('Dependency Error: Action sequence halts, error is logged, system survives', async () => {
      seedTestEntity(h.entityManager, {
        id: ACTOR_A_ID,
        name: 'Alice',
        locationId: LOCATION_A,
      });
      seedTestEntity(h.entityManager, {
        id: ACTOR_B_ID,
        name: 'Bob',
        locationId: LOCATION_A,
      });
      h.leaderSyncService.handleQuery.mockImplementation(() => {
        throw new Error('Simulated DB failure');
      });

      await h.eventBus.dispatch('core:attempt_action', {
        actorId: ACTOR_A_ID,
        targetId: ACTOR_B_ID,
        actionId: 'core:follow',
      });

      expect(h.entityManager.addComponent).toHaveBeenCalledWith(
        ACTOR_A_ID,
        'core:following',
        { leaderId: ACTOR_B_ID }
      );
      const dispatched = h.validatedDispatcher.dispatch.mock.calls.map(
        (c) => c[0]
      );
      expect(dispatched).not.toContain('core:turn_ended');
      expect(h.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL error during execution of Operation QUERY_SYSTEM_DATA'
        ),
        expect.any(Error)
      );
    });
  });

  // ———————————————————— Data Consistency Stress Test ————————————————————
  describe('Data Consistency Stress Test', () => {
    const NUM_ACTORS = 8;
    const NUM_ITERATIONS = 100;

    /**
     *
     * @param entityManager
     */
    function assertDataConsistency(entityManager) {
      const groundTruth = new Map();
      for (const entity of entityManager.activeEntities.values()) {
        const followingComp = entity.getComponentData('core:following');
        if (followingComp) {
          const leaderId = followingComp.leaderId;
          if (!groundTruth.has(leaderId)) groundTruth.set(leaderId, new Set());
          groundTruth.get(leaderId).add(entity.id);
        }
      }
      for (const potentialLeader of entityManager.activeEntities.values()) {
        const expected = groundTruth.get(potentialLeader.id) || new Set();
        const actualData = potentialLeader.getComponentData('core:leading');
        if (expected.size === 0) {
          expect(actualData).toBeUndefined();
        } else {
          expect(new Set(actualData.followers)).toEqual(expected);
        }
      }
    }

    test('A randomized sequence of actions leaves the data in a consistent state', async () => {
      const actorIds = Array.from(
        { length: NUM_ACTORS },
        (_, i) => `actor-${i}`
      );
      actorIds.forEach((id, i) =>
        seedTestEntity(h.entityManager, {
          id,
          name: `Actor ${i}`,
          locationId: 'loc-main',
        })
      );
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const actionType = _.sample(['follow', 'stop', 'dismiss']);
        const [actorId, targetId] = _.sampleSize(actorIds, 2);
        const actor = h.entityManager.getEntityInstance(actorId);
        switch (actionType) {
          case 'follow':
            await h.eventBus.dispatch('core:attempt_action', {
              actorId,
              targetId,
              actionId: 'core:follow',
            });
            break;
          case 'stop':
            if (actor.hasComponent('core:following')) {
              await h.eventBus.dispatch('core:attempt_action', {
                actorId,
                actionId: 'core:stop_following',
              });
            }
            break;
          case 'dismiss':
            const target = h.entityManager.getEntityInstance(targetId);
            if (
              target?.getComponentData('core:following')?.leaderId === actorId
            ) {
              await h.eventBus.dispatch('core:attempt_action', {
                actorId,
                targetId,
                actionId: 'core:dismiss',
              });
            }
            break;
        }
        assertDataConsistency(h.entityManager);
      }
      expect(h.logger.error).not.toHaveBeenCalled();
    });
  });
});
