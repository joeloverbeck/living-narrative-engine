// tests/integration/movementSystem.integration.test.js
// ---------------------------------------------------------------------------
// • Integration tests for the `handle_core_go_action_with_perception` rule.
// • Verifies that the `core:entity_moved` event is correctly dispatched after
//   a successful move and not dispatched on a failed move.
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
  getEventDefinition: (eventId) => {
    if (eventId === 'core:entity_moved') {
      return { id: 'core:entity_moved', payloadSchema: {} }; // Simplified
    }
    return undefined;
  },
  getEntityDefinition: (defId) => ({
    name: _.startCase(defId.split(':')[1] || 'Unknown'),
  }),
});

class FakeSystemDataRegistry {
  constructor() {
    this.worldContext = {
      getTargetLocationForDirection: jest.fn(),
      getCurrentISOTimestamp: jest
        .fn()
        .mockReturnValue(new Date().toISOString()),
    };
  }

  query(sourceId, details) {
    if (sourceId === 'WorldContext') {
      if (details.action === 'getTargetLocationForDirection') {
        return this.worldContext.getTargetLocationForDirection(
          details.current_location_id,
          details.direction_taken
        );
      }
      if (details.action === 'getCurrentISOTimestamp') {
        return this.worldContext.getCurrentISOTimestamp();
      }
    }
    return undefined;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2.  Test Harness Builder
// ────────────────────────────────────────────────────────────────────────────

function buildTestHarness() {
  const logger = makeLogger();
  const movementRule = JSON.parse(
    fs.readFileSync('data/mods/core/rules/go.rule.json', 'utf8')
  );

  const dataRegistry = makeDataRegistry([movementRule]);
  const schemaValidator = makeSchemaValidator();
  const spatialIndex = makeSpatialIndexMgr();
  const entityManager = new EntityManager(
    dataRegistry,
    schemaValidator,
    logger,
    spatialIndex
  );
  const fakeSystemData = new FakeSystemDataRegistry();
  const eventBus = new EventBus();
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: dataRegistry,
    schemaValidator,
    logger,
  });
  jest.spyOn(validatedDispatcher, 'dispatch');
  // --- FIX START ---
  // The ModifyComponentHandler uses addComponent to commit changes, so we spy on that.
  jest.spyOn(entityManager, 'addComponent');
  // --- FIX END ---

  const opRegistry = new OperationRegistry({ logger });
  const opInterpreter = new OperationInterpreter({
    logger,
    operationRegistry: opRegistry,
  });

  // Dynamically require handlers to avoid circular dependency issues in Jest
  const {
    default: QueryComponentHandler,
  } = require('../../src/logic/operationHandlers/queryComponentHandler.js');
  const {
    default: ModifyComponentHandler,
  } = require('../../src/logic/operationHandlers/modifyComponentHandler.js');
  const {
    default: QuerySystemDataHandler,
  } = require('../../src/logic/operationHandlers/querySystemDataHandler.js');
  const {
    default: DispatchEventHandler,
  } = require('../../src/logic/operationHandlers/dispatchEventHandler.js');

  opRegistry.register('QUERY_COMPONENT', (params, context) =>
    new QueryComponentHandler({ entityManager, logger }).execute(
      params,
      context
    )
  );
  opRegistry.register('MODIFY_COMPONENT', (params, context) =>
    new ModifyComponentHandler({ entityManager, logger }).execute(
      params,
      context
    )
  );
  opRegistry.register('QUERY_SYSTEM_DATA', (params, context) =>
    new QuerySystemDataHandler({
      systemDataRegistry: fakeSystemData,
      logger,
    }).execute(params, context)
  );
  opRegistry.register('DISPATCH_EVENT', (params, context) =>
    new DispatchEventHandler({
      dispatcher: validatedDispatcher,
      logger,
    }).execute(params, context)
  );

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
    fakeSystemData,
    sysInterpreter,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3.  Shared Test Fixtures and Helpers
// ────────────────────────────────────────────────────────────────────────────

const ACTOR_ID = 'player:aragorn';
const START_LOCATION_ID = 'location:rivendell';
const TARGET_LOCATION_ID = 'location:isengard';

function seedTestEntity(entityManager, { id, name, locationId }) {
  const entity = {
    id,
    definitionId: 'test:human',
    components: new Map([
      ['core:name', { text: name }],
      ['core:position', { locationId }],
    ]),
    getComponentData(cId) {
      return this.components.get(cId);
    },
    setComponentData(cId, val) {
      this.components.set(cId, val);
    },
    addComponent(cId, val) {
      this.components.set(cId, val);
    },
    getDefinition() {
      return { name };
    },
  };

  // Seed into activeEntities so getComponentData(...) will succeed:
  entityManager.activeEntities.set(id, entity);

  // Mock entity instance methods needed by handlers
  entityManager.getEntityInstance = jest.fn((entityId) => {
    if (entityId === id) return entity;
    if (entityId === START_LOCATION_ID)
      return { getComponentData: () => ({ text: 'Rivendell' }) };
    if (entityId === TARGET_LOCATION_ID)
      return { getComponentData: () => ({ text: 'Isengard' }) };
    return undefined;
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 4.  The Specs
// ────────────────────────────────────────────────────────────────────────────

describe('[Rule] handle_core_go_action_with_perception', () => {
  let h;
  beforeEach(() => {
    h = buildTestHarness();
  });
  afterEach(() => {
    h.sysInterpreter.shutdown();
    jest.clearAllMocks();
  });

  describe('WHEN the move is valid', () => {
    beforeEach(() => {
      // Arrange
      seedTestEntity(h.entityManager, {
        id: ACTOR_ID,
        name: 'Aragorn',
        locationId: START_LOCATION_ID,
      });
      h.fakeSystemData.worldContext.getTargetLocationForDirection.mockReturnValue(
        TARGET_LOCATION_ID
      );
    });

    test('it must dispatch `core:entity_moved` exactly once', async () => {
      // Act
      await h.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: ACTOR_ID,
        actionId: 'core:go',
        direction: 'south',
        originalInput: 'go south',
      });

      // Assert
      const movedEventCalls = h.validatedDispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'core:entity_moved'
      );
      expect(movedEventCalls).toHaveLength(1);
    });

    test('the `core:entity_moved` payload must be correct', async () => {
      // Act
      await h.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: ACTOR_ID,
        actionId: 'core:go',
        direction: 'south',
        originalInput: 'go south',
      });

      // Assert
      const movedEventPayload = h.validatedDispatcher.dispatch.mock.calls.find(
        (call) => call[0] === 'core:entity_moved'
      )[1];

      expect(movedEventPayload).toEqual({
        eventName: 'core:entity_moved',
        entityId: ACTOR_ID,
        previousLocationId: START_LOCATION_ID,
        currentLocationId: TARGET_LOCATION_ID,
        direction: 'south',
        originalCommand: 'go south',
      });
    });

    test('it must be dispatched AFTER updating the component and BEFORE ending the turn', async () => {
      // Act
      await h.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: ACTOR_ID,
        actionId: 'core:go',
        direction: 'south',
        originalInput: 'go south',
      });

      // Assert
      // --- FIX START ---
      // The `MODIFY_COMPONENT` operation's handler uses `addComponent` to commit the change.
      const componentUpdateCallOrder =
        h.entityManager.addComponent.mock.invocationCallOrder[0];
      // --- FIX END ---
      const dispatchCalls =
        h.validatedDispatcher.dispatch.mock.invocationCallOrder;

      const movedEventDispatchOrder = dispatchCalls.find(
        (order, i) =>
          h.validatedDispatcher.dispatch.mock.calls[i][0] ===
          'core:entity_moved'
      );
      const turnEndedDispatchOrder = dispatchCalls.find(
        (order, i) =>
          h.validatedDispatcher.dispatch.mock.calls[i][0] === 'core:turn_ended'
      );

      expect(componentUpdateCallOrder).toBeDefined();
      expect(movedEventDispatchOrder).toBeDefined();
      expect(turnEndedDispatchOrder).toBeDefined();

      expect(componentUpdateCallOrder).toBeLessThan(movedEventDispatchOrder);
      expect(movedEventDispatchOrder).toBeLessThan(turnEndedDispatchOrder);
    });
  });

  describe('WHEN the move is invalid (no valid target location)', () => {
    beforeEach(() => {
      // Arrange
      seedTestEntity(h.entityManager, {
        id: ACTOR_ID,
        name: 'Aragorn',
        locationId: START_LOCATION_ID,
      });
      // WorldContext returns null, simulating a blocked path
      h.fakeSystemData.worldContext.getTargetLocationForDirection.mockReturnValue(
        null
      );
    });

    test('it must NOT dispatch `core:entity_moved`', async () => {
      // Act
      await h.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: ACTOR_ID,
        actionId: 'core:go',
        direction: 'north',
        originalInput: 'go north',
      });

      // Assert
      const movedEventCalls = h.validatedDispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'core:entity_moved'
      );
      expect(movedEventCalls).toHaveLength(0);
      // Also assert the failure message was sent
      expect(h.validatedDispatcher.dispatch).toHaveBeenCalledWith(
        'core:display_failed_action_result',
        expect.any(Object)
      );
    });
  });
});
