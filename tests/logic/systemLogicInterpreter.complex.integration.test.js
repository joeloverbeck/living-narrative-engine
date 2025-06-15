// src/tests/logic/systemLogicInterpreter.complex.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContextFlat */ // Renamed for clarity
/** @typedef {import('../../src/logic/defs.js').ExecutionContext} ExecutionContextNested */ // Assuming this is the nested one
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../src/logic/operationInterpreter.js').default} OperationInterpreter */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import OperationRegistry from '../../src/logic/operationRegistry.js'; // Corrected import path

// --- Mock Data Definitions (Constants) ---
// (MOCK_RULE_*, MOCK_PLAYER_*, MOCK_ENEMY_*, MOCK_EVENT_* definitions remain the same as in your provided file)
const MOCK_RULE_INVISIBILITY_BUFF = {
  rule_id: 'RULE_INVISIBILITY_BUFF',
  event_type: 'ENEMY_SPOTTED',
  condition: { '==': [{ var: 'actor.components.buffs.invisibility' }, true] },
  actions: [
    { type: 'TEST_ACTION', parameters: { description: 'Avoid detection' } },
  ],
};
const MOCK_RULE_NO_CONDITION = {
  rule_id: 'RULE_NO_CONDITION',
  event_type: 'ITEM_PICKED_UP',
  actions: [
    { type: 'TEST_ACTION', parameters: { description: 'Log item pickup' } },
  ],
};
const MOCK_RULE_ALWAYS_TRUE = {
  rule_id: 'RULE_ALWAYS_TRUE',
  event_type: 'PLAYER_HEALED',
  condition: { '==': [true, true] },
  actions: [
    {
      type: 'TEST_ACTION',
      parameters: { description: 'Apply post-heal effect' },
    },
  ],
};
const MOCK_RULE_INVALID_CONDITION = {
  rule_id: 'RULE_INVALID_CONDITION',
  event_type: 'DOOR_OPENED',
  condition: { invalidOperator: [1, 2] },
  actions: [
    { type: 'TEST_ACTION', parameters: { description: 'Should not run' } },
  ],
};
const MOCK_RULE_MULTIPLE_A = {
  rule_id: 'RULE_ENEMY_CHECK_HP_A',
  event_type: 'ENEMY_DAMAGED',
  condition: { '>': [{ var: 'target.components.health.current' }, 0] },
  actions: [
    { type: 'TEST_ACTION', parameters: { description: 'Enemy still alive' } },
  ],
};
const MOCK_RULE_MULTIPLE_B = {
  rule_id: 'RULE_ENEMY_CHECK_HP_B',
  event_type: 'ENEMY_DAMAGED',
  condition: { '<=': [{ var: 'target.components.health.current' }, 0] },
  actions: [
    { type: 'TEST_ACTION', parameters: { description: 'Enemy defeated' } },
  ],
};
const MOCK_RULE_CONTEXT_ACCESS = {
  rule_id: 'RULE_CONTEXT_ACCESS',
  event_type: 'CUSTOM_EVENT',
  condition: { '==': [{ var: 'event.payload.value' }, 42] },
  actions: [
    {
      type: 'TEST_ACTION',
      parameters: { description: 'Payload value matched' },
    },
  ],
};
const MOCK_PLAYER_NO_BUFF = {
  id: 'player-1',
  components: {
    buffs: { invisibility: false },
    status: { mana: 20 },
    inventory: { has_key: null },
    skills: { lockpicking: 2 },
  },
  getComponentData: function (type) {
    return this.components[type];
  },
  hasComponent: function (type) {
    return type in this.components;
  },
};
const MOCK_PLAYER_WITH_BUFF = {
  id: 'player-2',
  components: {
    buffs: { invisibility: true },
    status: { mana: 5 },
    inventory: { has_key: 'blue_key' },
    skills: { lockpicking: 6 },
  },
  getComponentData: function (type) {
    return this.components[type];
  },
  hasComponent: function (type) {
    return type in this.components;
  },
};
const MOCK_ENEMY_HP_5 = {
  id: 'enemy-1',
  components: {
    health: { current: 5, max: 10 },
    attributes: { vulnerable: true },
  },
  getComponentData: function (type) {
    return this.components[type];
  },
  hasComponent: function (type) {
    return type in this.components;
  },
};
const MOCK_ENEMY_HP_0 = {
  id: 'enemy-2',
  components: {
    health: { current: 0, max: 10 },
    attributes: { vulnerable: false },
  },
  getComponentData: function (type) {
    return this.components[type];
  },
  hasComponent: function (type) {
    return type in this.components;
  },
};
const MOCK_EVENT_ENEMY_SPOTTED = {
  type: 'ENEMY_SPOTTED',
  payload: { actorId: 'player-2', targetId: 'enemy-1' },
};
const MOCK_EVENT_ENEMY_SPOTTED_NO_BUFF = {
  type: 'ENEMY_SPOTTED',
  payload: { actorId: 'player-1', targetId: 'enemy-1' },
};
const MOCK_EVENT_ITEM_PICKED = {
  type: 'ITEM_PICKED_UP',
  payload: { actorId: 'player-1', itemId: 'potion-123' },
};
const MOCK_EVENT_PLAYER_HEALED = {
  type: 'PLAYER_HEALED',
  payload: { targetId: 'player-1', amount: 10 },
};
const MOCK_EVENT_DOOR_OPENED = {
  type: 'DOOR_OPENED',
  payload: { actorId: 'player-1', doorId: 'door-main-hall' },
};
const MOCK_EVENT_ENEMY_DAMAGED = {
  type: 'ENEMY_DAMAGED',
  payload: { actorId: 'player-1', targetId: 'enemy-1', damage: 3 },
};
const MOCK_EVENT_ENEMY_DEFEATED = {
  type: 'ENEMY_DAMAGED',
  payload: { actorId: 'player-1', targetId: 'enemy-2', damage: 10 },
};
const MOCK_EVENT_CUSTOM = {
  type: 'CUSTOM_EVENT',
  payload: { entityId: 'player-1', value: 42, source: 'magic_crystal' },
};

describe('SystemLogicInterpreter - Integration Tests - Conditional Execution Setup', () => {
  let mockLogger;
  let mockEventBus;
  let mockDataRegistry;
  let mockJsonLogicEvaluationService;
  let mockEntityManager;
  let operationInterpreterRealInstance; // Use a real instance, spy on its method
  let executeSpy;
  let interpreter;
  let operationRegistry;
  let capturedEventListener = null;

  // Helper for the FLAT JsonLogicEvaluationContext (direct output of createJsonLogicContext)
  // This is passed to JsonLogicEvaluationService.evaluate.
  // It does NOT have its own 'logger' property from createJsonLogicContext.
  const createExpectedFlatJsonLogicContext = (
    event,
    actorEntity,
    targetEntity
  ) => {
    return {
      event: expect.objectContaining({
        type: event.type,
        // Match payload precisely or allow for null if event.payload could be undefined
        payload:
          event.payload === undefined || event.payload === null
            ? null
            : expect.objectContaining(event.payload),
      }),
      actor: actorEntity
        ? expect.objectContaining({
            id: actorEntity.id,
            components: expect.any(Object),
          })
        : null,
      target: targetEntity
        ? expect.objectContaining({
            id: targetEntity.id,
            components: expect.any(Object),
          })
        : null,
      context: expect.any(Object), // Rule variables are stored here
      // createJsonLogicContext from contextAssembler.js adds these:
      entities: expect.any(Object),
      globals: expect.any(Object),
      // NO 'logger' property here, as createJsonLogicContext doesn't add it to the object it returns.
    };
  };

  // Helper for the NESTED finalNestedExecutionContext
  // This is passed to OperationInterpreter.execute.
  const createExpectedNestedContext = (
    event,
    actorEntity,
    targetEntity,
    topLevelLoggerInstance
  ) => {
    // The actor/target at the top level of finalNestedExecutionContext come from jsonLogicDataForEvaluation.actor/target
    const flatLogicContextForNesting = createExpectedFlatJsonLogicContext(
      event,
      actorEntity,
      targetEntity
    );
    return {
      event: expect.objectContaining({
        type: event.type,
        payload:
          event.payload === undefined || event.payload === null
            ? null
            : expect.objectContaining(event.payload),
      }),
      actor: actorEntity
        ? expect.objectContaining({
            id: actorEntity.id,
            components: expect.any(Object),
          })
        : null,
      target: targetEntity
        ? expect.objectContaining({
            id: targetEntity.id,
            components: expect.any(Object),
          })
        : null,
      logger: expect.any(Object),
      evaluationContext: flatLogicContextForNesting, // The nested flat context (which itself has no logger property)
    };
  };

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
        if (eventName === '*') capturedEventListener = listener;
      }),
      unsubscribe: jest.fn(),
      dispatch: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(1),
    };
    mockDataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
      getEntityDefinition: jest.fn(),
    };
    mockJsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };
    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        if (entityId === MOCK_PLAYER_NO_BUFF.id) return MOCK_PLAYER_NO_BUFF;
        if (entityId === MOCK_PLAYER_WITH_BUFF.id) return MOCK_PLAYER_WITH_BUFF;
        if (entityId === MOCK_ENEMY_HP_5.id) return MOCK_ENEMY_HP_5;
        if (entityId === MOCK_ENEMY_HP_0.id) return MOCK_ENEMY_HP_0;
        return undefined;
      }),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };
    operationRegistry = new OperationRegistry({ logger: mockLogger });
    // Use a real OperationInterpreter instance and spy on its 'execute' method
    operationInterpreterRealInstance = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: operationRegistry,
    });
    executeSpy = jest.spyOn(operationInterpreterRealInstance, 'execute');

    interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
      operationInterpreter: operationInterpreterRealInstance, // Pass the real instance
    });
    mockLogger.info.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    capturedEventListener = null;
  });

  it('should create an instance with valid dependencies', () => {
    expect(interpreter).toBeInstanceOf(SystemLogicInterpreter);
  });

  it('should subscribe to the EventBus during initialization if rules are loaded', () => {
    mockDataRegistry.getAllSystemRules.mockReturnValue([
      MOCK_RULE_NO_CONDITION,
    ]);
    interpreter.initialize();
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      '*',
      expect.any(Function)
    );
    expect(capturedEventListener).toBeInstanceOf(Function);
  });

  it('should NOT subscribe to the EventBus if no rules are loaded', () => {
    mockDataRegistry.getAllSystemRules.mockReturnValue([]);
    interpreter.initialize();
    expect(mockEventBus.subscribe).not.toHaveBeenCalled();
    expect(capturedEventListener).toBeNull();
  });

  it('should load and cache rules from the DataRegistry during initialization', () => {
    const rules = [MOCK_RULE_INVISIBILITY_BUFF, MOCK_RULE_NO_CONDITION];
    mockDataRegistry.getAllSystemRules.mockReturnValue(rules);
    interpreter.initialize();
    expect(mockDataRegistry.getAllSystemRules).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Finished caching rules. 2 event types have associated rules.'
      )
    );
  });

  it('should call the mock JsonLogicEvaluationService.evaluate when processing a rule with a condition', () => {
    const rule = MOCK_RULE_INVISIBILITY_BUFF;
    const event = MOCK_EVENT_ENEMY_SPOTTED;
    mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

    interpreter.initialize();
    capturedEventListener(event);

    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    // JsonLogicEvaluationService.evaluate receives the FLAT context
    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      event,
      MOCK_PLAYER_WITH_BUFF,
      MOCK_ENEMY_HP_5,
      mockLogger
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      rule.condition,
      expectedFlatCtx
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    // OperationInterpreter.execute receives the NESTED context
    const expectedNestedCtx = createExpectedNestedContext(
      event,
      MOCK_PLAYER_WITH_BUFF,
      MOCK_ENEMY_HP_5,
      mockLogger
    );
    expect(executeSpy).toHaveBeenCalledWith(rule.actions[0], expectedNestedCtx);
  });

  it('should use the mock EntityManager to assemble context data', () => {
    const rule = MOCK_RULE_CONTEXT_ACCESS;
    const event = MOCK_EVENT_CUSTOM; // entityId is player-1 (MOCK_PLAYER_NO_BUFF)
    mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

    interpreter.initialize();
    capturedEventListener(event);

    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
      event.payload.entityId
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    // JsonLogicEvaluationService.evaluate receives the FLAT context
    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      event,
      MOCK_PLAYER_NO_BUFF,
      null,
      mockLogger
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      rule.condition,
      expectedFlatCtx
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    // OperationInterpreter.execute receives the NESTED context
    const expectedNestedCtx = createExpectedNestedContext(
      event,
      MOCK_PLAYER_NO_BUFF,
      null,
      mockLogger
    );
    expect(executeSpy).toHaveBeenCalledWith(rule.actions[0], expectedNestedCtx);
  });

  it('should call OperationInterpreter.execute when a rule condition passes or is absent', () => {
    const ruleNoCond = MOCK_RULE_NO_CONDITION;
    const eventItem = MOCK_EVENT_ITEM_PICKED; // actorId is player-1
    const ruleCondTrue = MOCK_RULE_INVISIBILITY_BUFF;
    const eventSpotted = MOCK_EVENT_ENEMY_SPOTTED; // actorId is player-2
    mockDataRegistry.getAllSystemRules.mockReturnValue([
      ruleNoCond,
      ruleCondTrue,
    ]);
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

    interpreter.initialize();

    // Test rule with no condition
    capturedEventListener(eventItem);
    const expectedNestedForItem = createExpectedNestedContext(
      eventItem,
      MOCK_PLAYER_NO_BUFF,
      null,
      mockLogger
    );
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      ruleNoCond.actions[0],
      expectedNestedForItem
    );
    expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled(); // No condition to evaluate for this rule

    executeSpy.mockClear();
    mockJsonLogicEvaluationService.evaluate.mockClear();

    // Test rule with condition that passes
    capturedEventListener(eventSpotted);
    const expectedFlatForSpottedCond = createExpectedFlatJsonLogicContext(
      eventSpotted,
      MOCK_PLAYER_WITH_BUFF,
      MOCK_ENEMY_HP_5,
      mockLogger
    );
    const expectedNestedForSpottedOp = createExpectedNestedContext(
      eventSpotted,
      MOCK_PLAYER_WITH_BUFF,
      MOCK_ENEMY_HP_5,
      mockLogger
    );

    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      ruleCondTrue.condition,
      expectedFlatForSpottedCond
    );
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      ruleCondTrue.actions[0],
      expectedNestedForSpottedOp
    );
  });

  it('should NOT call OperationInterpreter.execute when a rule condition fails', () => {
    const rule = MOCK_RULE_INVISIBILITY_BUFF;
    const event = MOCK_EVENT_ENEMY_SPOTTED_NO_BUFF; // actor is player-1 (no buff)
    mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(false); // Condition fails

    interpreter.initialize();
    capturedEventListener(event);

    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      event,
      MOCK_PLAYER_NO_BUFF,
      MOCK_ENEMY_HP_5,
      mockLogger
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      rule.condition,
      expectedFlatCtx
    );
    expect(executeSpy).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /Rule 'RULE_INVISIBILITY_BUFF' actions skipped for event 'ENEMY_SPOTTED' due to condition evaluating to false/
      )
    );
  });

  it('should NOT call OperationInterpreter.execute when condition evaluation throws an error', () => {
    const rule = MOCK_RULE_INVALID_CONDITION;
    const event = MOCK_EVENT_DOOR_OPENED; // actor is player-1
    const evaluationError = new Error('Invalid JSON Logic operator');
    mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
    mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
      throw evaluationError;
    });

    interpreter.initialize();
    capturedEventListener(event);

    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      event,
      MOCK_PLAYER_NO_BUFF,
      null,
      mockLogger
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      rule.condition,
      expectedFlatCtx
    );
    expect(executeSpy).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during condition evaluation. Treating condition as FALSE.'
      ),
      evaluationError
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /Rule 'RULE_INVALID_CONDITION' actions skipped for event 'DOOR_OPENED' due to error during condition evaluation/
      )
    );
  });

  it('should have all required mock rules, entities, and events defined', () => {
    expect(
      MOCK_RULE_INVISIBILITY_BUFF
    ).toBeDefined(); /* ... and so on for all mocks ... */
    expect(MOCK_EVENT_CUSTOM).toBeDefined();
  });
});
