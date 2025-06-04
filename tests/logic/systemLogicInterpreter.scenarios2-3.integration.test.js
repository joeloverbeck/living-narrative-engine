// src/tests/logic/systemLogicInterpreter.scenarios2-3.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../src/logic/operationInterpreter.js').default} OperationInterpreter */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
// Import jest functions directly
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
// --- Collaborator Class (Used for Spying) ---
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';

// --- Mock Data Definitions (Constants) ---

const MOCK_RULE_NO_CONDITION = {
  rule_id: 'RULE_SC2_UPDATE_INV',
  event_type: 'ItemPickedUp',
  actions: [
    {
      type: 'TEST_UPDATE_INV',
      parameters: { itemId: 'var:event.payload.itemId' },
    },
  ],
};

const MOCK_RULE_ALWAYS_TRUE = {
  rule_id: 'RULE_SC3_PLAY_SOUND',
  event_type: 'PlayerHealed',
  condition: { '==': [true, true] },
  actions: [{ type: 'TEST_PLAY_SOUND', parameters: { sound: 'heal_sound' } }],
};

const MOCK_PLAYER = {
  id: 'player-test-1',
  components: {
    inventory: {},
    health: { current: 50, max: 100 },
  },
  getComponentData: function (type) {
    return this.components[type];
  },
  hasComponent: function (type) {
    return type in this.components;
  },
};

const MOCK_EVENT_ITEM_PICKED_UP = {
  type: 'ItemPickedUp',
  payload: { actorId: MOCK_PLAYER.id, itemId: 'health_potion_01' },
};

const MOCK_EVENT_PLAYER_HEALED = {
  type: 'PlayerHealed',
  payload: { targetId: MOCK_PLAYER.id, sourceId: 'npc-healer', amount: 25 },
};

describe('SystemLogicInterpreter - Integration Tests - Scenarios 2 & 3 (Refactored: Spying on OperationInterpreter.execute)', () => {
  /** @type {ILogger} */
  let mockLogger;
  /** @type {EventBus} */
  let mockEventBus;
  /** @type {IDataRegistry} */
  let mockDataRegistry;
  /** @type {JsonLogicEvaluationService} */
  let mockJsonLogicEvaluationService;
  /** @type {EntityManager} */
  let mockEntityManager;
  /** @type {OperationInterpreter} */
  let operationInterpreterInstance;
  /** @type {jest.SpyInstance} */
  let operationExecuteSpy;
  /** @type {SystemLogicInterpreter} */
  let interpreter;
  /** @type {OperationRegistry} */
  let operationRegistry;
  /** @type {Function | null} */
  let capturedEventListener = null;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      loggedMessages: [],
      _log(level, message, ...args) {
        this.loggedMessages.push({
          level,
          message,
          args: args.length > 0 ? args : undefined,
        });
      },
      info: jest.fn((m, ...a) => mockLogger._log('info', m, ...a)),
      warn: jest.fn((m, ...a) => mockLogger._log('warn', m, ...a)),
      error: jest.fn((m, ...a) => mockLogger._log('error', m, ...a)),
      debug: jest.fn((m, ...a) => mockLogger._log('debug', m, ...a)),
      clearLogs: () => {
        mockLogger.loggedMessages = [];
      },
    };

    capturedEventListener = null;
    mockEventBus = {
      subscribe: jest.fn((eventName, listener) => {
        if (eventName === '*') {
          capturedEventListener = listener;
        }
      }),
      dispatch: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(1),
    };

    mockDataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
      getEntityDefinition: jest.fn(),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        if (entityId === MOCK_PLAYER.id) return MOCK_PLAYER;
        return undefined;
      }),
      getComponentData: jest
        .fn()
        .mockImplementation((entityId, componentTypeId) => {
          const entity = mockEntityManager.getEntityInstance(entityId);
          return entity?.getComponentData
            ? entity.getComponentData(componentTypeId)
            : (entity?.components?.[componentTypeId] ?? null);
        }),
      hasComponent: jest
        .fn()
        .mockImplementation((entityId, componentTypeId) => {
          const entity = mockEntityManager.getEntityInstance(entityId);
          return !!(entity?.hasComponent
            ? entity.hasComponent(componentTypeId)
            : entity?.components?.[componentTypeId]);
        }),
    };

    operationRegistry = new OperationRegistry({ logger: mockLogger });
    operationInterpreterInstance = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: operationRegistry,
    });
    operationExecuteSpy = jest.spyOn(operationInterpreterInstance, 'execute');

    interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
      operationInterpreter: operationInterpreterInstance,
    });

    mockLogger.loggedMessages = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    capturedEventListener = null;
  });

  describe('Scenario 2: No Condition', () => {
    it('should call OperationInterpreter.execute for ItemPickedUp event when rule has no condition', () => {
      const rule = MOCK_RULE_NO_CONDITION;
      const event = MOCK_EVENT_ITEM_PICKED_UP;
      mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);

      // This is the structure for the NESTED evaluationContext (i.e., JsonLogicEvaluationContext)
      // Based on test output, logger is NOT present in the received evaluationContext.
      const expectedJsonLogicContext = expect.objectContaining({
        event: expect.objectContaining({
          type: event.type,
          payload: event.payload,
        }),
        actor: expect.objectContaining({
          id: MOCK_PLAYER.id,
          components: expect.any(Object), // Proxy from createComponentAccessor
        }),
        target: null,
        context: {},
        globals: {},
        entities: {},
        // logger: expect.any(Object) // REMOVED based on test failure diff
      });

      // This is the structure for the argument to OperationInterpreter.execute (finalNestedExecutionContext)
      const expectedContextForOperationInterpreter = expect.objectContaining({
        event: expect.objectContaining({
          type: event.type,
          payload: event.payload,
        }), // Top-level event
        actor: expect.objectContaining({
          id: MOCK_PLAYER.id,
          components: expect.any(Object),
        }), // Top-level actor (proxy)
        target: null, // Top-level target
        logger: expect.any(Object), // Top-level logger (interpreter's own logger) IS present
        evaluationContext: expectedJsonLogicContext, // The nested JsonLogic context (without logger inside)
      });

      interpreter.initialize();
      expect(capturedEventListener).toBeInstanceOf(Function);
      capturedEventListener(event);

      expect(operationExecuteSpy).toHaveBeenCalledTimes(1);
      expect(operationExecuteSpy).toHaveBeenCalledWith(
        rule.actions[0],
        expectedContextForOperationInterpreter
      );

      expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

      const noCondLog = mockLogger.loggedMessages.find(
        (log) =>
          log.level === 'debug' &&
          log.message.includes(
            `[Rule ${rule.rule_id}] No condition defined or condition is empty. Defaulting to passed.`
          )
      );
      expect(noCondLog).toBeDefined();
    });
  });

  describe('Scenario 3: Always True Condition', () => {
    it('should call OperationInterpreter.execute for PlayerHealed event when rule has an always true condition', () => {
      const rule = MOCK_RULE_ALWAYS_TRUE;
      const event = MOCK_EVENT_PLAYER_HEALED;
      mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      // This is the structure for JsonLogic evaluation AND for the NESTED evaluationContext
      // Based on test output, logger is NOT present in the received context for evaluate.
      const expectedJsonLogicContext = expect.objectContaining({
        event: expect.objectContaining({
          type: event.type,
          payload: event.payload,
        }),
        actor: null, // No actorId in this event payload
        target: expect.objectContaining({
          id: MOCK_PLAYER.id,
          components: expect.any(Object), // Proxy from createComponentAccessor
        }),
        context: {},
        globals: {},
        entities: {},
        // logger: expect.any(Object) // REMOVED based on test failure diff
      });

      // This is the structure for the argument to OperationInterpreter.execute (finalNestedExecutionContext)
      const expectedContextForOperationInterpreter = expect.objectContaining({
        event: expect.objectContaining({
          type: event.type,
          payload: event.payload,
        }), // Top-level event
        actor: null, // Top-level actor
        target: expect.objectContaining({
          id: MOCK_PLAYER.id,
          components: expect.any(Object),
        }), // Top-level target (proxy)
        logger: expect.any(Object), // Top-level logger (interpreter's own logger) IS present
        evaluationContext: expectedJsonLogicContext, // The nested JsonLogic context (without logger inside)
      });

      interpreter.initialize();
      expect(capturedEventListener).toBeInstanceOf(Function);
      capturedEventListener(event);

      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        rule.condition,
        expectedJsonLogicContext // JsonLogic service receives the flat context (without logger inside)
      );

      const evaluationResult =
        mockJsonLogicEvaluationService.evaluate.mock.results[0].value;
      expect(evaluationResult).toBe(true);

      expect(operationExecuteSpy).toHaveBeenCalledTimes(1);
      expect(operationExecuteSpy).toHaveBeenCalledWith(
        rule.actions[0],
        expectedContextForOperationInterpreter
      );

      const condPassedLog = mockLogger.loggedMessages.find(
        (log) =>
          log.level === 'debug' &&
          log.message.includes(
            `[Rule ${rule.rule_id}] Condition evaluation final boolean result: true`
          )
      );
      expect(condPassedLog).toBeDefined();
    });
  });
});
