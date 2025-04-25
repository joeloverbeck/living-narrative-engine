// src/tests/logic/systemLogicInterpreter.scenario5.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../data/schemas/system-rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
// Import jest functions directly
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import OperationInterpreter from '../../logic/operationInterpreter';
import OperationRegistry from '../../logic/operationRegistry';

// --- Mock Data Definitions (Constants for Scenario 5) ---

// Mock SystemRule Definitions for Scenario 5
const MOCK_RULE_A_ENEMY_DEATH = {
  rule_id: 'RULE_SC5_ENEMY_DEATH',
  event_type: 'EnemyDamaged', // Triggered by the same event
  condition: { // Condition: Target HP must be 0 or less
    '<=': [ { 'var': 'target.components.health.current' }, 0 ]
  },
  actions: [ { type: 'TEST_DISPATCH_EVENT', parameters: { eventName: 'dispatch_enemy_death' } } ] // Mock action
};

const MOCK_RULE_B_HIT_SFX = {
  rule_id: 'RULE_SC5_HIT_SFX',
  event_type: 'EnemyDamaged', // Triggered by the same event
  condition: { // Condition: Damage dealt must be greater than 0
    '>': [ { 'var': 'event.payload.damage' }, 0 ]
  },
  actions: [ { type: 'TEST_PLAY_SOUND', parameters: { soundName: 'play_hit_sfx' } } ] // Mock action
};

// Mock Entity Data Definitions for Scenario 5
const MOCK_TARGET_ENEMY_HP_5 = {
  id: 'enemy-target-hp5',
  components: {
    'health': { current: 5, max: 20 }
  },
  getComponentData: function(type) { return this.components[type]; },
  hasComponent: function(type) { return type in this.components; },
};

const MOCK_TARGET_ENEMY_HP_0 = {
  id: 'enemy-target-hp0',
  components: {
    'health': { current: 0, max: 20 }
  },
  getComponentData: function(type) { return this.components[type]; },
  hasComponent: function(type) { return type in this.components; },
};

const MOCK_ATTACKER = { // Needed as context for the event
  id: 'player-attacker-1',
  components: { 'status': { state: 'attacking' } },
  getComponentData: function(type) { return this.components[type]; },
  hasComponent: function(type) { return type in this.components; },
};

// Mock GameEvent Data Definitions for Scenario 5
const MOCK_EVENT_ENEMY_DAMAGED_HP5 = {
  type: 'EnemyDamaged',
  payload: { actorId: MOCK_ATTACKER.id, targetId: MOCK_TARGET_ENEMY_HP_5.id, damage: 10 } // Damage > 0
};

const MOCK_EVENT_ENEMY_DAMAGED_HP0 = {
  type: 'EnemyDamaged',
  payload: { actorId: MOCK_ATTACKER.id, targetId: MOCK_TARGET_ENEMY_HP_0.id, damage: 15 } // Damage > 0
};

// --- Test Suite ---
// AC: Test Suite Exists
describe('SystemLogicInterpreter - Integration Tests - Scenario 5: Multiple Rules (EnemyDamaged)', () => {
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
  /** @type {OperationInterpreter} */ // <-- ADD TYPE DEF
  let operationInterpreter;
  /** @type {jest.SpyInstance} */
  let executeActionsSpy;
  /** @type {SystemLogicInterpreter} */
  let interpreter;
  /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
  let operationRegistry;
  /** @type {Function | null} */
  let capturedEventListener = null;

  // Helper to get recorded calls from the spy
  const getExecuteActionsCalls = () => executeActionsSpy.mock.calls.map(callArgs => ({
    actions: callArgs[0],
    context: callArgs[1],
    scopeDescription: callArgs[2]
  }));

  beforeEach(() => {
    // --- Mock Implementations (Standard setup adapted from Ticket 4/other tests) ---
    mockLogger = {
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
      loggedMessages: [],
      _log(level, message, ...args) { this.loggedMessages.push({ level, message, args: args.length > 0 ? args : undefined }); },
      info: jest.fn((m, ...a) => mockLogger._log('info', m, ...a)), warn: jest.fn((m, ...a) => mockLogger._log('warn', m, ...a)),
      error: jest.fn((m, ...a) => mockLogger._log('error', m, ...a)), debug: jest.fn((m, ...a) => mockLogger._log('debug', m, ...a)),
      clearLogs: () => { mockLogger.loggedMessages = []; }
    };

    capturedEventListener = null;
    mockEventBus = {
      subscribe: jest.fn((eventName, listener) => {
        if (eventName === '*') { capturedEventListener = listener; }
      }),
      dispatch: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(1),
    };

    mockDataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
      getEntityDefinition: jest.fn(),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn(), // Behavior configured per test case
    };

    // EntityManager mock configured to return scenario-specific entities
    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        if (entityId === MOCK_ATTACKER.id) return MOCK_ATTACKER;
        if (entityId === MOCK_TARGET_ENEMY_HP_5.id) return MOCK_TARGET_ENEMY_HP_5;
        if (entityId === MOCK_TARGET_ENEMY_HP_0.id) return MOCK_TARGET_ENEMY_HP_0;
        return undefined;
      }),
      // Mock getComponentData and hasComponent to use the entity's own methods
      getComponentData: jest.fn().mockImplementation((entityId, componentTypeId) => {
        const entity = mockEntityManager.getEntityInstance(entityId);
        // Handle nested access like 'health.current' which JsonLogic might resolve via the proxy
        if (entity && componentTypeId.includes('.')) {
          const parts = componentTypeId.split('.');
          let data = entity.getComponentData(parts[0]);
          for (let i = 1; i < parts.length; i++) {
            if (data === undefined || data === null) return null;
            data = data[parts[i]];
          }
          return data !== undefined ? data : null;
        }
        return entity?.getComponentData(componentTypeId) ?? null;
      }),
      hasComponent: jest.fn().mockImplementation((entityId, componentTypeId) => {
        const entity = mockEntityManager.getEntityInstance(entityId);
        // Simplified check for top-level component existence for the proxy
        if (componentTypeId.includes('.')) {
          const parts = componentTypeId.split('.');
          return !!entity?.hasComponent(parts[0]);
        }
        return !!entity?.hasComponent(componentTypeId);
      }),
    };

    // Spy on the real _executeActions method but mock its implementation
    executeActionsSpy = jest.spyOn(SystemLogicInterpreter.prototype, '_executeActions')
      .mockImplementation((actions, context, scope) => {
        // Optional: console.log(`_executeActions called for: ${scope}`);
      });

    // 0. Instantiate OperationRegistry <-- ADD THIS STEP
    operationRegistry = new OperationRegistry({ logger: mockLogger });

    // 1. Instantiate OperationInterpreter (needs logger AND registry) <-- MODIFY THIS STEP
    operationInterpreter = new OperationInterpreter({
      logger: mockLogger,
      registry: operationRegistry // <-- Pass the registry instance
    });

    // 2. Instantiate the interpreter (remains the same)
    interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
      operationInterpreter: operationInterpreter // <-- Pass the correctly instantiated OperationInterpreter
    });

    // Clear constructor log call
    mockLogger.info.mockClear();
    mockLogger.clearLogs();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (executeActionsSpy) {
      executeActionsSpy.mockRestore();
    }
    capturedEventListener = null;
  });

  // --- Scenario 5 Test Cases ---

  // Implementation Task: Create describe block for Scenario 5
  // describe block is the parent block above.

  // Test Case 1 (Target HP 5)
  // AC: Test Clarity
  it('TC1: should execute only Rule B (play_hit_sfx) when target HP is 5', () => {
    // Arrange
    // Implementation Task: Configure mockDataRegistry
    mockDataRegistry.getAllSystemRules.mockReturnValue([MOCK_RULE_A_ENEMY_DEATH, MOCK_RULE_B_HIT_SFX]);

    // Implementation Task: Configure mockEntityManager (done in beforeEach is sufficient for this case)

    // Implementation Task: Configure mockJsonLogicEvaluationService
    // Need to return false for Rule A, true for Rule B
    mockJsonLogicEvaluationService.evaluate.mockImplementation((condition, context) => {
      // Simple check based on expected condition structure (could be more robust)
      if (condition?.['<=']?.[0]?.var === 'target.components.health.current') {
        // This is Rule A's condition (HP <= 0) -> should be false for HP=5
        expect(context.target?.id).toBe(MOCK_TARGET_ENEMY_HP_5.id); // Verify context
        return false;
      }
      if (condition?.['>']?.[0]?.var === 'event.payload.damage') {
        // This is Rule B's condition (damage > 0) -> should be true
        expect(context.event?.payload?.damage).toBeGreaterThan(0); // Verify context
        return true;
      }
      // Fallback for unexpected conditions
      mockLogger.warn('Unexpected condition evaluated in mock: ', condition);
      return false;
    });

    // Act
    // Implementation Task: Instantiate SystemLogicInterpreter (done in beforeEach)
    // Implementation Task: Call initialize()
    interpreter.initialize();
    expect(capturedEventListener).toBeInstanceOf(Function);
    // Implementation Task: Dispatch the mock EnemyDamaged event (HP 5 target)
    capturedEventListener(MOCK_EVENT_ENEMY_DAMAGED_HP5);

    // Assert
    // Implementation Task: Assert mockJsonLogicEvaluationService.evaluate was called twice
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);

    // AC: Scenario 5 / TC 1 Pass - _executeActions called once
    // Implementation Task: Assert _executeActions mock toHaveBeenCalledTimes(1)
    expect(executeActionsSpy).toHaveBeenCalledTimes(1);

    // Implementation Task: (Optional) Assert _executeActions called with Rule B's actions
    const executeCalls = getExecuteActionsCalls();
    expect(executeCalls[0].actions).toEqual(MOCK_RULE_B_HIT_SFX.actions);
    expect(executeCalls[0].scopeDescription).toContain(MOCK_RULE_B_HIT_SFX.rule_id);
    expect(executeCalls[0].context.target.id).toBe(MOCK_TARGET_ENEMY_HP_5.id); // Check context passed correctly

    // Verify Rule A was skipped and logged appropriately
    const skipLogForRuleA = mockLogger.loggedMessages.find(log =>
      log.level === 'info' && log.message.includes(`Rule '${MOCK_RULE_A_ENEMY_DEATH.rule_id}' actions skipped`) && log.message.includes('evaluating to false')
    );
    expect(skipLogForRuleA).toBeDefined();
  });

  // Test Case 2 (Target HP 0)
  // AC: Test Clarity
  it('TC2: should execute Rule A (dispatch_enemy_death) and Rule B (play_hit_sfx) when target HP is 0', () => {
    // Arrange
    // Implementation Task: Reset mocks (handled by afterEach/beforeEach)

    // Implementation Task: Configure mockDataRegistry
    mockDataRegistry.getAllSystemRules.mockReturnValue([MOCK_RULE_A_ENEMY_DEATH, MOCK_RULE_B_HIT_SFX]);

    // Implementation Task: Configure mockEntityManager (done in beforeEach,getEntityInstance returns HP 0 target for the correct ID)

    // Implementation Task: Configure mockJsonLogicEvaluationService
    // Need to return true for both Rule A and Rule B
    mockJsonLogicEvaluationService.evaluate.mockImplementation((condition, context) => {
      // Simple check based on expected condition structure
      if (condition?.['<=']?.[0]?.var === 'target.components.health.current') {
        // This is Rule A's condition (HP <= 0) -> should be true for HP=0
        expect(context.target?.id).toBe(MOCK_TARGET_ENEMY_HP_0.id); // Verify context
        return true;
      }
      if (condition?.['>']?.[0]?.var === 'event.payload.damage') {
        // This is Rule B's condition (damage > 0) -> should be true
        expect(context.event?.payload?.damage).toBeGreaterThan(0); // Verify context
        return true;
      }
      // Fallback for unexpected conditions
      mockLogger.warn('Unexpected condition evaluated in mock: ', condition);
      return false;
    });

    // Act
    // Implementation Task: Instantiate SystemLogicInterpreter (done in beforeEach)
    // Implementation Task: Call initialize()
    interpreter.initialize();
    expect(capturedEventListener).toBeInstanceOf(Function);
    // Implementation Task: Dispatch the mock EnemyDamaged event (HP 0 target)
    capturedEventListener(MOCK_EVENT_ENEMY_DAMAGED_HP0);

    // Assert
    // Implementation Task: Assert mockJsonLogicEvaluationService.evaluate was called twice
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);

    // AC: Scenario 5 / TC 2 Pass - _executeActions called twice
    // Implementation Task: Assert _executeActions mock toHaveBeenCalledTimes(2)
    expect(executeActionsSpy).toHaveBeenCalledTimes(2);

    // Implementation Task: (Optional) Assert _executeActions called once with Rule A's actions and once with Rule B's actions
    const executeCalls = getExecuteActionsCalls();
    // Check that one call was for Rule A and the other for Rule B (order might vary)
    const calledWithRuleA = executeCalls.some(call =>
      call.scopeDescription.includes(MOCK_RULE_A_ENEMY_DEATH.rule_id) &&
            call.actions === MOCK_RULE_A_ENEMY_DEATH.actions &&
            call.context.target.id === MOCK_TARGET_ENEMY_HP_0.id
    );
    const calledWithRuleB = executeCalls.some(call =>
      call.scopeDescription.includes(MOCK_RULE_B_HIT_SFX.rule_id) &&
            call.actions === MOCK_RULE_B_HIT_SFX.actions &&
            call.context.target.id === MOCK_TARGET_ENEMY_HP_0.id
    );
    expect(calledWithRuleA).toBe(true);
    expect(calledWithRuleB).toBe(true);

    // Verify no skip logs were generated
    const skipLog = mockLogger.loggedMessages.find(log => log.level === 'info' && log.message.includes('actions skipped'));
    expect(skipLog).toBeUndefined();
  });

}); // End Top-Level Describe