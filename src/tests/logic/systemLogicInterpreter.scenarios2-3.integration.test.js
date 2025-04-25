// src/tests/logic/systemLogicInterpreter.scenarios2-3.integration.test.js

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
/** @typedef {import('../../logic/operationInterpreter.js').default} OperationInterpreter */ // <-- Added OperationInterpreter type

// --- Class Under Test ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
// Import jest functions directly
import { describe, beforeEach, afterEach, it, expect, jest } from "@jest/globals";
// --- Collaborator Class (Used for Spying) ---
import OperationInterpreter from "../../logic/operationInterpreter.js";
import OperationRegistry from "../../logic/operationRegistry"; // Corrected path if needed

// --- Mock Data Definitions (Constants) ---

// Mock SystemRule Definitions for Scenarios 2 & 3
const MOCK_RULE_NO_CONDITION = {
    rule_id: "RULE_SC2_UPDATE_INV",
    event_type: "ItemPickedUp", // Match the event name used in the test
    // No 'condition' property
    actions: [ { type: 'TEST_UPDATE_INV', parameters: { itemId: "var:event.payload.itemId" } } ] // Mock action representing update_player_inventory
};

const MOCK_RULE_ALWAYS_TRUE = {
    rule_id: "RULE_SC3_PLAY_SOUND",
    event_type: "PlayerHealed", // Match the event name used in the test
    condition: { "==": [ true, true ] }, // Inherently true condition
    actions: [ { type: 'TEST_PLAY_SOUND', parameters: { sound: "heal_sound" } } ] // Mock action representing play_heal_sound
};

// Mock Entity Data Definitions (Minimal, reusable)
// NOTE: This mock object represents the *source* data the EntityManager returns.
// The context object built by createJsonLogicContext will have a different structure.
const MOCK_PLAYER = {
    id: 'player-test-1',
    components: {
        'inventory': {},
        'health': { current: 50, max: 100 }
    },
    // These methods are used by the EntityManager mock, but won't appear directly
    // in the context.actor/target objects created by createJsonLogicContext.
    getComponentData: function(type) { return this.components[type]; },
    hasComponent: function(type) { return type in this.components; },
};

// Mock GameEvent Data Definitions for Scenarios 2 & 3
const MOCK_EVENT_ITEM_PICKED_UP = {
    type: "ItemPickedUp",
    payload: { actorId: MOCK_PLAYER.id, itemId: 'health_potion_01' }
};

const MOCK_EVENT_PLAYER_HEALED = {
    type: "PlayerHealed",
    payload: { targetId: MOCK_PLAYER.id, sourceId: 'npc-healer', amount: 25 } // actorId (source) or targetId can be used depending on rule/context needs
};


// --- Test Suite ---

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
    let operationInterpreterInstance; // Renamed to avoid conflict with class name
    /** @type {jest.SpyInstance} */
    let operationExecuteSpy; // <-- NEW SPY for OperationInterpreter.execute
    /** @type {SystemLogicInterpreter} */
    let interpreter;
    /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
    let operationRegistry;
    /** @type {Function | null} */
    let capturedEventListener = null;

    beforeEach(() => {
        // --- Mock Implementations (Copied and adapted from Ticket 4 setup / other tests) ---
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
                // Capture the listener passed to subscribe('*')
                if (eventName === '*') {
                    capturedEventListener = listener;
                }
            }),
            dispatch: jest.fn(),
            listenerCount: jest.fn().mockReturnValue(1), // Mock listener count if needed
        };


        mockDataRegistry = {
            getAllSystemRules: jest.fn().mockReturnValue([]),
            getEntityDefinition: jest.fn(),
        };

        mockJsonLogicEvaluationService = {
            evaluate: jest.fn(), // Behavior configured per test case
        };

        // Minimal EntityManager needed for context assembly
        mockEntityManager = {
            // IMPORTANT: This mock returns the object with methods
            getEntityInstance: jest.fn().mockImplementation((entityId) => {
                if (entityId === MOCK_PLAYER.id) return MOCK_PLAYER;
                // Add mocks for other entities if needed by tests
                // if (entityId === 'npc-healer') return MOCK_NPC_HEALER;
                return undefined; // Return undefined for unknown IDs
            }),
            // These mocks simulate what createComponentAccessor will call internally via the Proxy
            getComponentData: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                // Use the entity's *own* method if available (like in MOCK_PLAYER)
                // or access data directly if it's just data.
                return entity?.getComponentData ? entity.getComponentData(componentTypeId) : entity?.components?.[componentTypeId] ?? null;
            }),
            hasComponent: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                // Use the entity's *own* method if available
                return !!(entity?.hasComponent ? entity.hasComponent(componentTypeId) : entity?.components?.[componentTypeId]);
            }),
        };

        // 0. Instantiate OperationRegistry <-- ADD THIS STEP
        operationRegistry = new OperationRegistry({ logger: mockLogger }); // Optional: pass logger

        // 1. Instantiate OperationInterpreter (needs logger AND registry) <-- MODIFY THIS STEP
        operationInterpreterInstance = new OperationInterpreter({
            logger: mockLogger,
            registry: operationRegistry // <-- Pass the registry instance
        });

        // 2. Create Spy on the 'execute' method (remains the same)
        operationExecuteSpy = jest.spyOn(operationInterpreterInstance, 'execute');

        // 3. REMOVE Spy on SystemLogicInterpreter.prototype._executeActions (remains the same)
        // ...

        // 4. Instantiate the interpreter (remains the same)
        interpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreterInstance // Pass the correctly instantiated OperationInterpreter
        });

        // Clear constructor log call if needed
        mockLogger.info.mockClear(); // Clear logs from constructor if desired
        mockLogger.loggedMessages = []; // Clear loggedMessages array
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore original implementations (this includes spies created with jest.spyOn)
        // Ensure the old spy removal (AC2)
        // if (executeActionsSpy) { executeActionsSpy.mockRestore(); } <-- REMOVED
        capturedEventListener = null; // Reset listener capture
    });

    // --- Scenario 2: Rule with No Condition ---
    describe('Scenario 2: No Condition', () => {
        it('should call OperationInterpreter.execute for ItemPickedUp event when rule has no condition', () => {
            // Arrange
            const rule = MOCK_RULE_NO_CONDITION;
            const event = MOCK_EVENT_ITEM_PICKED_UP;
            mockDataRegistry.getAllSystemRules.mockReturnValue([rule]); // Configure mockDataRegistry

            // Define the expected context structure for the action execution
            const expectedContextForAction = expect.objectContaining({
                event: expect.objectContaining({ type: event.type, payload: event.payload }),
                actor: expect.objectContaining({ // Expect the simplified structure
                    id: MOCK_PLAYER.id,
                    components: expect.any(Object) // Should be the Proxy from createComponentAccessor
                }),
                target: null, // No target in this event/context setup
                context: {},  // Default empty context object
                globals: {},  // Expect globals property
                entities: {}  // Expect entities property
            });

            // Act
            interpreter.initialize(); // Load rules & subscribe
            expect(capturedEventListener).toBeInstanceOf(Function); // Ensure listener captured
            capturedEventListener(event); // Dispatch the mock ItemPickedUp event

            // Assert
            // AC3 & AC4: Assert OperationInterpreter.execute was called with correct arguments
            expect(operationExecuteSpy).toHaveBeenCalledTimes(1);
            expect(operationExecuteSpy).toHaveBeenCalledWith(
                rule.actions[0], // The first (and only) action object from the rule
                expectedContextForAction // The context assembled by the interpreter
            );

            // Assert that jsonLogic evaluate was NOT called (as before)
            expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();

            // Optional: Verify debug log for no condition (as before)
            // ***** CORRECTED LOG MESSAGE CHECK *****
            const noCondLog = mockLogger.loggedMessages.find(log =>
                log.level === 'debug' && log.message.includes(`[Rule ${rule.rule_id}] No condition defined or condition is empty. Defaulting to passed.`)
            );
            expect(noCondLog).toBeDefined(); // This should now pass
        });
    });

    // --- Scenario 3: Rule with Always True Condition ---
    describe('Scenario 3: Always True Condition', () => {
        it('should call OperationInterpreter.execute for PlayerHealed event when rule has an always true condition', () => {
            // Arrange
            const rule = MOCK_RULE_ALWAYS_TRUE;
            const event = MOCK_EVENT_PLAYER_HEALED;
            mockDataRegistry.getAllSystemRules.mockReturnValue([rule]); // Configure mockDataRegistry

            // Configure mockJsonLogicEvaluationService to return true
            mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

            // Define the expected context structure for evaluation AND action execution
            const expectedContext = expect.objectContaining({
                event: expect.objectContaining({ type: event.type, payload: event.payload }),
                // Actor ID (sourceId) wasn't specified in MOCK_EVENT_PLAYER_HEALED as actorId, so expect null
                actor: null,
                target: expect.objectContaining({ // Expect the simplified structure
                    id: MOCK_PLAYER.id,
                    components: expect.any(Object) // Should be the Proxy from createComponentAccessor
                }),
                context: {},
                globals: {},  // Expect globals property
                entities: {}  // Expect entities property
            });

            // Act
            interpreter.initialize(); // Load rules & subscribe
            expect(capturedEventListener).toBeInstanceOf(Function); // Ensure listener captured
            capturedEventListener(event); // Dispatch the mock PlayerHealed event

            // Assert
            // Assert evaluate was called correctly (as before)
            expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
                rule.condition,   // The exact condition object from the rule
                expectedContext   // The context assembled for evaluation
            );

            // Verify the mock *actually* returned true (as before)
            const evaluationResult = mockJsonLogicEvaluationService.evaluate.mock.results[0].value;
            expect(evaluationResult).toBe(true);

            // AC3 & AC4: Assert OperationInterpreter.execute was called with correct arguments
            expect(operationExecuteSpy).toHaveBeenCalledTimes(1);
            expect(operationExecuteSpy).toHaveBeenCalledWith(
                rule.actions[0], // The first (and only) action object from the rule
                expectedContext  // Action execution should receive the same context used for evaluation
            );

            // Optional: Verify debug log for condition passing (as before)
            const condPassedLog = mockLogger.loggedMessages.find(log =>
                log.level === 'debug' && log.message.includes(`[Rule ${rule.rule_id}] Condition evaluation final boolean result: true`) // Adjusted slightly for precision, assuming #evaluateRuleCondition logs this. Check the actual log if this fails.
            );
            // If the above fails, try the original broader check:
            // const condPassedLog = mockLogger.loggedMessages.find(log =>
            //     log.level === 'debug' && log.message.includes(`[Rule ${rule.rule_id}] Condition passed`)
            // );
            expect(condPassedLog).toBeDefined();
        });
    });

}); // End Top-Level Describe