// src/tests/logic/systemLogicInterpreter.complex.integration.test.js

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
/** @typedef {import('../../entities/entity.js').default} Entity */ // Assuming path
/** @typedef {import('../../logic/operationInterpreter.js').default} OperationInterpreter */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
// Import jest functions directly if not using globals implicitly
import { describe, beforeEach, afterEach, it, expect, jest } from "@jest/globals";
import OperationRegistry from "../../logic/operationRegistry";


// --- Mock Data Definitions (Constants) ---
// Mock SystemRule Definitions
const MOCK_RULE_INVISIBILITY_BUFF = {
    rule_id: "RULE_INVISIBILITY_BUFF",
    event_type: "ENEMY_SPOTTED",
    condition: {
        "==": [ { "var": "actor.components.buffs.invisibility" }, true ]
    },
    actions: [ { type: 'TEST_ACTION', parameters: { description: "Avoid detection" } } ]
};

const MOCK_RULE_NO_CONDITION = {
    rule_id: "RULE_NO_CONDITION",
    event_type: "ITEM_PICKED_UP",
    actions: [ { type: 'TEST_ACTION', parameters: { description: "Log item pickup" } } ]
};

const MOCK_RULE_ALWAYS_TRUE = {
    rule_id: "RULE_ALWAYS_TRUE",
    event_type: "PLAYER_HEALED",
    condition: { "==": [ true, true ] },
    actions: [ { type: 'TEST_ACTION', parameters: { description: "Apply post-heal effect" } } ]
};

const MOCK_RULE_INVALID_CONDITION = {
    rule_id: "RULE_INVALID_CONDITION",
    event_type: "DOOR_OPENED",
    condition: { "invalidOperator": [1, 2] }, // Intentionally malformed
    actions: [ { type: 'TEST_ACTION', parameters: { description: "Should not run" } } ]
};

const MOCK_RULE_MULTIPLE_A = {
    rule_id: "RULE_ENEMY_CHECK_HP_A",
    event_type: "ENEMY_DAMAGED",
    condition: { ">": [ { "var": "target.components.health.current" }, 0 ] },
    actions: [ { type: 'TEST_ACTION', parameters: { description: "Enemy still alive" } } ]
};

const MOCK_RULE_MULTIPLE_B = {
    rule_id: "RULE_ENEMY_CHECK_HP_B",
    event_type: "ENEMY_DAMAGED",
    condition: { "<=": [ { "var": "target.components.health.current" }, 0 ] },
    actions: [ { type: 'TEST_ACTION', parameters: { description: "Enemy defeated" } } ]
};

const MOCK_RULE_CONTEXT_ACCESS = {
    rule_id: "RULE_CONTEXT_ACCESS",
    event_type: "CUSTOM_EVENT",
    condition: { "==": [ { "var": "event.payload.value" }, 42 ] },
    actions: [ { type: 'TEST_ACTION', parameters: { description: "Payload value matched" } } ]
};

// Mock Entity Data Definitions
const MOCK_PLAYER_NO_BUFF = {
    id: 'player-1',
    components: {
        'buffs': { invisibility: false },
        'status': { mana: 20 },
        'inventory': { has_key: null },
        'skills': { lockpicking: 2 }
    },
    getComponentData: function(type) { return this.components[type]; },
    hasComponent: function(type) { return type in this.components; },
};

const MOCK_PLAYER_WITH_BUFF = {
    id: 'player-2',
    components: {
        'buffs': { invisibility: true },
        'status': { mana: 5 },
        'inventory': { has_key: "blue_key" },
        'skills': { lockpicking: 6 }
    },
    getComponentData: function(type) { return this.components[type]; },
    hasComponent: function(type) { return type in this.components; },
};

const MOCK_ENEMY_HP_5 = {
    id: 'enemy-1',
    components: {
        'health': { current: 5, max: 10 },
        'attributes': { vulnerable: true }
    },
    getComponentData: function(type) { return this.components[type]; },
    hasComponent: function(type) { return type in this.components; },
};

const MOCK_ENEMY_HP_0 = {
    id: 'enemy-2',
    components: {
        'health': { current: 0, max: 10 },
        'attributes': { vulnerable: false }
    },
    getComponentData: function(type) { return this.components[type]; },
    hasComponent: function(type) { return type in this.components; },
};

// Mock GameEvent Data Definitions
const MOCK_EVENT_ENEMY_SPOTTED = {
    type: "ENEMY_SPOTTED",
    payload: { actorId: 'player-2', targetId: 'enemy-1' }
};

const MOCK_EVENT_ENEMY_SPOTTED_NO_BUFF = {
    type: "ENEMY_SPOTTED",
    payload: { actorId: 'player-1', targetId: 'enemy-1' }
};

const MOCK_EVENT_ITEM_PICKED = {
    type: "ITEM_PICKED_UP",
    payload: { actorId: 'player-1', itemId: 'potion-123' }
};

const MOCK_EVENT_PLAYER_HEALED = {
    type: "PLAYER_HEALED",
    payload: { targetId: 'player-1', amount: 10 }
};

const MOCK_EVENT_DOOR_OPENED = {
    type: "DOOR_OPENED",
    payload: { actorId: 'player-1', doorId: 'door-main-hall' }
};

const MOCK_EVENT_ENEMY_DAMAGED = {
    type: "ENEMY_DAMAGED",
    payload: { actorId: 'player-1', targetId: 'enemy-1', damage: 3 }
};

const MOCK_EVENT_ENEMY_DEFEATED = {
    type: "ENEMY_DAMAGED",
    payload: { actorId: 'player-1', targetId: 'enemy-2', damage: 10 }
};

const MOCK_EVENT_CUSTOM = {
    type: "CUSTOM_EVENT",
    payload: { entityId: 'player-1', value: 42, source: 'magic_crystal' }
};


// --- Test Suite ---

describe('SystemLogicInterpreter - Integration Tests - Conditional Execution Setup', () => {
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
    let mockOperationInterpreter; // Changed name for clarity as we mock its method
    /** @type {jest.SpyInstance} */
    let executeSpy; // <-- REFACTORED: New spy target
    /** @type {SystemLogicInterpreter} */
    let interpreter;
    /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
    let operationRegistry;
    /** @type {Function | null} */
    let capturedEventListener = null;

    // CORRECTED Helper to create expected context object structure for assertions
    // This now includes fields observed in the error messages (`entities`, `globals`)
    const createExpectedContext = (event, actor, target) => ({
        event: expect.objectContaining({
            type: event.type,
            payload: expect.objectContaining(event.payload) // Check payload contains the expected keys/values
        }),
        actor: actor ? expect.objectContaining({ id: actor.id }) : null,
        target: target ? expect.objectContaining({ id: target.id }) : null,
        context: expect.any(Object),    // Internal context accumulator used by operations
        entities: expect.any(Object), // Top-level access to entities involved
        globals: expect.any(Object)   // Access to global game state/variables
    });


    beforeEach(() => {
        // AC: Mock Logger Functional
        mockLogger = {
            info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
            loggedMessages: [],
            _log(level, message, ...args) { this.loggedMessages.push({ level, message, args: args.length > 0 ? args : undefined }); },
            info: jest.fn((m, ...a) => mockLogger._log('info', m, ...a)), warn: jest.fn((m, ...a) => mockLogger._log('warn', m, ...a)),
            error: jest.fn((m, ...a) => mockLogger._log('error', m, ...a)), debug: jest.fn((m, ...a) => mockLogger._log('debug', m, ...a)),
            clearLogs: () => { mockLogger.loggedMessages = []; }
        };

        // AC: Mock EventBus Functional
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

        // AC: Mock DataRegistry Functional
        mockDataRegistry = {
            getAllSystemRules: jest.fn().mockReturnValue([]),
            getEntityDefinition: jest.fn(),
        };

        // AC: Mock JsonLogicEvaluationService Functional
        mockJsonLogicEvaluationService = {
            evaluate: jest.fn().mockReturnValue(true),
        };

        // AC: Mock EntityManager Functional
        mockEntityManager = {
            getEntityInstance: jest.fn().mockImplementation((entityId) => {
                if (entityId === MOCK_PLAYER_NO_BUFF.id) return MOCK_PLAYER_NO_BUFF;
                if (entityId === MOCK_PLAYER_WITH_BUFF.id) return MOCK_PLAYER_WITH_BUFF;
                if (entityId === MOCK_ENEMY_HP_5.id) return MOCK_ENEMY_HP_5;
                if (entityId === MOCK_ENEMY_HP_0.id) return MOCK_ENEMY_HP_0;
                return undefined;
            }),
            getComponentData: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                const data = entity?.getComponentData(componentTypeId);
                return data !== undefined ? data : null;
            }),
            hasComponent: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                return !!entity?.hasComponent(componentTypeId);
            }),
        };

        // 0. Instantiate OperationRegistry <-- ADD THIS STEP
        operationRegistry = new OperationRegistry({ logger: mockLogger });

        // 1. Instantiate OperationInterpreter (needs logger AND registry) <-- MODIFY THIS STEP
        //    Use the correct variable name for this file: mockOperationInterpreter
        mockOperationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            registry: operationRegistry // <-- Pass the registry instance
        });

        // 2. Create spy on the execute method (remains the same)
        executeSpy = jest.spyOn(mockOperationInterpreter, 'execute');

        // 3. Instantiate the interpreter (remains the same)
        interpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: mockEntityManager,
            operationInterpreter: mockOperationInterpreter // Pass the correctly instantiated OperationInterpreter
        });

        // Verify constructor logging
        expect(mockLogger.info).toHaveBeenCalledWith("SystemLogicInterpreter initialized. Ready to process events.");
        mockLogger.info.mockClear(); // Clear this initial call for subsequent tests
    });

    afterEach(() => {
        // Restore all mocks and spies created with jest.spyOn or jest.fn
        jest.restoreAllMocks();
        capturedEventListener = null;
    });

    // --- Test Cases ---

    // Basic Setup Tests
    it('should create an instance with valid dependencies', () => {
        expect(interpreter).toBeInstanceOf(SystemLogicInterpreter);
        expect(mockLogger.info).toHaveBeenCalledTimes(0); // Constructor log cleared in beforeEach
    });

    it('should use the mocked logger for internal logging', () => {
        interpreter.initialize(); // This logs internally
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Loading and caching system rules"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Finished caching rules"));
    });

    it('should subscribe to the EventBus during initialization if rules are loaded', () => {
        mockDataRegistry.getAllSystemRules.mockReturnValue([MOCK_RULE_NO_CONDITION]); // Provide a rule
        interpreter.initialize();
        expect(mockEventBus.subscribe).toHaveBeenCalledWith('*', expect.any(Function));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Subscribed to all events ('*')"));
        expect(capturedEventListener).toBeInstanceOf(Function); // Listener should be captured
    });

    it('should NOT subscribe to the EventBus if no rules are loaded', () => {
        mockDataRegistry.getAllSystemRules.mockReturnValue([]); // No rules
        interpreter.initialize();
        expect(mockEventBus.subscribe).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("No system rules loaded or cached"));
        expect(capturedEventListener).toBeNull(); // Listener should not be captured
    });

    // CORRECTED Test: Removed assertions accessing private fields
    it('should load and cache rules from the DataRegistry during initialization', () => {
        const rules = [MOCK_RULE_INVISIBILITY_BUFF, MOCK_RULE_NO_CONDITION, MOCK_RULE_MULTIPLE_A, MOCK_RULE_MULTIPLE_B];
        mockDataRegistry.getAllSystemRules.mockReturnValue(rules);
        interpreter.initialize();

        // Verify that the loading process was attempted
        expect(mockDataRegistry.getAllSystemRules).toHaveBeenCalledTimes(1);
        // Verify the log message indicating completion and the number of event types found
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Finished caching rules. 3 event types have associated rules.`)); // ENEMY_SPOTTED, ITEM_PICKED_UP, ENEMY_DAMAGED
    });


    // Integration and Refactored Tests
    // AC: Mock JsonLogicEvaluationService Functional (Verification)
    // This test should now pass with the corrected createExpectedContext helper
    it('should call the mock JsonLogicEvaluationService.evaluate when processing a rule with a condition', () => {
        const rule = MOCK_RULE_INVISIBILITY_BUFF;
        const event = MOCK_EVENT_ENEMY_SPOTTED;
        mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true); // Condition passes

        interpreter.initialize();

        expect(capturedEventListener).toBeInstanceOf(Function);
        capturedEventListener(event); // Simulate event

        // Check evaluation service was called correctly
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        const expectedContext = createExpectedContext(event, MOCK_PLAYER_WITH_BUFF, MOCK_ENEMY_HP_5);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule.condition,
            expectedContext // Use corrected helper
        );

        // AC3 & AC4: Verify OperationInterpreter.execute was called (because condition passed)
        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(executeSpy).toHaveBeenCalledWith(rule.actions[0], expectedContext); // Use corrected helper
    });

    // AC: Mock EntityManager Functional (Verification)
    // This test should now pass with the corrected createExpectedContext helper
    it('should use the mock EntityManager to assemble context data', () => {
        const rule = MOCK_RULE_CONTEXT_ACCESS; // Use a rule that accesses context
        const event = MOCK_EVENT_CUSTOM;
        mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
        // Assume condition passes to check context assembly during execution call
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        interpreter.initialize();

        expect(capturedEventListener).toBeInstanceOf(Function);
        capturedEventListener(event); // Simulate event

        // Verify EntityManager was used (implicit in context creation)
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(event.payload.entityId);
        // Ensure the correct entity data made it into the evaluation context
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        const expectedEvalContext = createExpectedContext(event, MOCK_PLAYER_NO_BUFF, null); // Player 1 is entityId
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(rule.condition, expectedEvalContext); // Use corrected helper

        // AC3 & AC4: Verify OperationInterpreter.execute received the assembled context
        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(executeSpy).toHaveBeenCalledWith(rule.actions[0], expectedEvalContext); // Use corrected helper
    });

    // AC3 & AC4: Verify calls to OperationInterpreter.execute
    // This test should now pass with the corrected createExpectedContext helper
    it('should call OperationInterpreter.execute when a rule condition passes or is absent', () => {
        const ruleNoCond = MOCK_RULE_NO_CONDITION;
        const eventItem = MOCK_EVENT_ITEM_PICKED;
        const ruleCondTrue = MOCK_RULE_INVISIBILITY_BUFF;
        const eventSpotted = MOCK_EVENT_ENEMY_SPOTTED;
        mockDataRegistry.getAllSystemRules.mockReturnValue([ruleNoCond, ruleCondTrue]);
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true); // Ensure condition rule passes

        interpreter.initialize();

        expect(capturedEventListener).toBeInstanceOf(Function);

        // Test rule with no condition
        capturedEventListener(eventItem);
        const expectedContextItem = createExpectedContext(eventItem, MOCK_PLAYER_NO_BUFF, null);
        expect(executeSpy).toHaveBeenCalledTimes(1); // Rule has 1 action
        expect(executeSpy).toHaveBeenCalledWith(ruleNoCond.actions[0], expectedContextItem); // Use corrected helper
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled(); // No condition to evaluate

        executeSpy.mockClear(); // Clear calls before next event
        mockJsonLogicEvaluationService.evaluate.mockClear(); // Clear this too

        // Test rule with condition that passes
        capturedEventListener(eventSpotted);
        const expectedContextSpotted = createExpectedContext(eventSpotted, MOCK_PLAYER_WITH_BUFF, MOCK_ENEMY_HP_5);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1); // Condition was evaluated
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(ruleCondTrue.condition, expectedContextSpotted); // Use corrected helper
        expect(executeSpy).toHaveBeenCalledTimes(1); // Rule has 1 action
        expect(executeSpy).toHaveBeenCalledWith(ruleCondTrue.actions[0], expectedContextSpotted); // Use corrected helper
    });

    // This test should now pass with the corrected createExpectedContext helper
    it('should NOT call OperationInterpreter.execute when a rule condition fails', () => {
        const rule = MOCK_RULE_INVISIBILITY_BUFF;
        const event = MOCK_EVENT_ENEMY_SPOTTED_NO_BUFF; // Actor is player-1 (no buff)
        mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
        // Let the actual evaluation happen based on mock data
        mockJsonLogicEvaluationService.evaluate.mockImplementation((condition, context) => {
            // Simulate the actual condition check using the provided context
            if (condition === rule.condition && context?.actor?.id === MOCK_PLAYER_NO_BUFF.id) {
                // Access the actual mock component data via the entity manager mock used by contextAssembler
                const actorEntity = mockEntityManager.getEntityInstance(context.actor.id);
                return actorEntity?.components?.buffs?.invisibility === true; // Should evaluate to false
            }
            return true; // Default pass
        });

        interpreter.initialize();

        expect(capturedEventListener).toBeInstanceOf(Function);
        capturedEventListener(event); // Simulate event

        // Verify condition was checked but actions were skipped
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        const expectedContext = createExpectedContext(event, MOCK_PLAYER_NO_BUFF, MOCK_ENEMY_HP_5);
        // Verify evaluate was called with the correct context structure
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(rule.condition, expectedContext); // Use corrected helper

        expect(executeSpy).not.toHaveBeenCalled(); // AC3: Check spy was NOT called
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rule '${rule.rule_id}' actions skipped`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`condition evaluating to false`));
    });

    // This test structure was already correct, just verifying it remains so.
    it('should NOT call OperationInterpreter.execute when condition evaluation throws an error', () => {
        const rule = MOCK_RULE_INVALID_CONDITION;
        const event = MOCK_EVENT_DOOR_OPENED;
        const evaluationError = new Error("Invalid JSON Logic operator");
        mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
        mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
            throw evaluationError;
        });

        interpreter.initialize();

        expect(capturedEventListener).toBeInstanceOf(Function);
        capturedEventListener(event); // Simulate event

        // Verify condition evaluation was attempted and failed
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        const expectedContext = createExpectedContext(event, MOCK_PLAYER_NO_BUFF, null); // Target is null for DOOR_OPENED
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(rule.condition, expectedContext); // Check context structure even on error path

        expect(executeSpy).not.toHaveBeenCalled(); // AC3: Check spy was NOT called
        // Verify logging for the error and skipping
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error during condition evaluation`), // Check core message
            evaluationError // Check the error object itself was logged
        );
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Rule '${rule.rule_id}' actions skipped`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`due to error during condition evaluation`));
    });

    // Test for Mock Data Presence (Unchanged)
    it('should have all required mock rules, entities, and events defined', () => {
        // Rules
        expect(MOCK_RULE_INVISIBILITY_BUFF).toBeDefined();
        expect(MOCK_RULE_NO_CONDITION).toBeDefined();
        expect(MOCK_RULE_ALWAYS_TRUE).toBeDefined();
        expect(MOCK_RULE_INVALID_CONDITION).toBeDefined();
        expect(MOCK_RULE_MULTIPLE_A).toBeDefined();
        expect(MOCK_RULE_MULTIPLE_B).toBeDefined();
        expect(MOCK_RULE_CONTEXT_ACCESS).toBeDefined();

        // Entities
        expect(MOCK_PLAYER_NO_BUFF).toBeDefined();
        expect(MOCK_PLAYER_WITH_BUFF).toBeDefined();
        expect(MOCK_ENEMY_HP_5).toBeDefined();
        expect(MOCK_ENEMY_HP_0).toBeDefined();

        // Events
        expect(MOCK_EVENT_ENEMY_SPOTTED).toBeDefined();
        expect(MOCK_EVENT_ENEMY_SPOTTED_NO_BUFF).toBeDefined();
        expect(MOCK_EVENT_ITEM_PICKED).toBeDefined();
        expect(MOCK_EVENT_PLAYER_HEALED).toBeDefined();
        expect(MOCK_EVENT_DOOR_OPENED).toBeDefined();
        expect(MOCK_EVENT_ENEMY_DAMAGED).toBeDefined();
        expect(MOCK_EVENT_ENEMY_DEFEATED).toBeDefined();
        expect(MOCK_EVENT_CUSTOM).toBeDefined();
    });

});