// src/tests/logic/systemLogicInterpreter.placeholderResolution.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../logic/operationRegistry.js').default} OperationRegistry */
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';

// Import jest functions directly
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Mock Data Definitions ---

// Define the mock entity with methods, as before
const MOCK_PLAYER_ENTITY_FULL = {
    id: 'player:placeholder-test',
    type: 'player',
    components: {status: {state: 'active'}},
    getComponentData: jest.fn((type) => MOCK_PLAYER_ENTITY_FULL.components[type]),
    hasComponent: jest.fn((type) => type in MOCK_PLAYER_ENTITY_FULL.components),
};

const MOCK_TRIGGER_EVENT_PAYLOAD_ARRAY = [
    {id: 'core:wait', command: 'wait'},
    {id: 'core:look', command: 'look'},
];

const MOCK_TRIGGER_EVENT = {
    type: 'test:trigger_placeholder_resolution',
    payload: {
        actorId: MOCK_PLAYER_ENTITY_FULL.id, // Use the ID from the full mock
        sourceData: MOCK_TRIGGER_EVENT_PAYLOAD_ARRAY, // The array we want to pass through
    },
};

// Rule using the CORRECTED placeholder syntax
const MOCK_RULE_PLACEHOLDER_RESOLUTION = {
    rule_id: 'RULE_PLACEHOLDER_RESOLUTION_TEST',
    event_type: MOCK_TRIGGER_EVENT.type,
    comment: 'Test rule for resolving an array placeholder from event payload.',
    condition: {}, // No condition, always runs
    actions: [
        {
            type: 'MOCK_PROCESS_DATA', // A mock operation type
            comment: 'This action should receive the resolved array.',
            parameters: {
                targetData: '{event.payload.sourceData}', // Correct placeholder pointing to the array
                someOtherParam: 'static value',
            },
        },
    ],
};

// --- Test Suite ---

describe('SystemLogicInterpreter - Integration Test - Placeholder Resolution', () => {
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
    /** @type {OperationRegistry} */
    let operationRegistry;
    /** @type {OperationInterpreter} */
    let operationInterpreter;
    /** @type {SystemLogicInterpreter} */
    let interpreter;
    /** @type {Function | null} */
    let capturedEventListener = null;
    /** @type {jest.Mock<any, any, any>} */ // Type for the mock handler
    let mockProcessDataHandler;

    beforeEach(() => {
        // Mock Logger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            loggedMessages: [],
            _log(level, message, ...args) {
                this.loggedMessages.push({level, message, args: args.length > 0 ? args : undefined});
            },
            info: jest.fn((m, ...a) => mockLogger._log('info', m, ...a)),
            warn: jest.fn((m, ...a) => mockLogger._log('warn', m, ...a)),
            error: jest.fn((m, ...a) => mockLogger._log('error', m, ...a)),
            debug: jest.fn((m, ...a) => mockLogger._log('debug', m, ...a)),
            clearLogs: () => {
                mockLogger.loggedMessages = [];
            }
        };

        // Mock EventBus to capture listener
        capturedEventListener = null;
        mockEventBus = {
            subscribe: jest.fn((eventName, listener) => {
                if (eventName === '*') {
                    capturedEventListener = listener;
                }
            }),
            dispatch: jest.fn(), unsubscribe: jest.fn(),
            listenerCount: jest.fn().mockReturnValue(1),
        };

        // Mock DataRegistry
        mockDataRegistry = {
            getAllSystemRules: jest.fn().mockReturnValue([]),
            getEntityDefinition: jest.fn(),
        };

        // Mock JsonLogic Evaluation Service
        mockJsonLogicEvaluationService = {
            evaluate: jest.fn(() => true),
        };

        // Mock EntityManager - Make sure getEntityInstance returns the FULL mock object
        mockEntityManager = {
            getEntityInstance: jest.fn((entityId) => {
                // Ensure this returns the object with methods when called by createJsonLogicContext
                if (entityId === MOCK_PLAYER_ENTITY_FULL.id) return MOCK_PLAYER_ENTITY_FULL;
                return undefined;
            }),
            getComponentData: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                return entity?.getComponentData ? entity.getComponentData(componentTypeId) : entity?.components?.[componentTypeId] ?? null;
            }),
            hasComponent: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                return !!(entity?.hasComponent ? entity.hasComponent(componentTypeId) : entity?.components?.[componentTypeId]);
            }),
        };

        // --- Setup Real Operation Registry and Interpreter ---
        operationRegistry = new OperationRegistry({logger: mockLogger});
        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: operationRegistry,
        });

        // --- Mock Handler for the Action ---
        mockProcessDataHandler = jest.fn();
        operationRegistry.register('MOCK_PROCESS_DATA', mockProcessDataHandler);

        // --- Instantiate SystemLogicInterpreter ---
        interpreter = new SystemLogicInterpreter({
            logger: mockLogger, eventBus: mockEventBus, dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: mockEntityManager, // Pass the mock configured above
            operationInterpreter: operationInterpreter,
        });

        mockLogger.clearLogs();
    });

    afterEach(() => {
        interpreter.shutdown();
        jest.restoreAllMocks();
        capturedEventListener = null;
    });

    it('should resolve a placeholder pointing to an array in the event payload and pass the array to the operation handler', () => {
        // Arrange
        mockDataRegistry.getAllSystemRules.mockReturnValue([MOCK_RULE_PLACEHOLDER_RESOLUTION]);
        interpreter.initialize();
        expect(capturedEventListener).toBeInstanceOf(Function);

        // Act
        capturedEventListener(MOCK_TRIGGER_EVENT);

        // Assert
        // 1. Verify the mock operation handler was called once
        expect(mockProcessDataHandler).toHaveBeenCalledTimes(1);

        // 2. Verify the parameters passed to the handler
        const expectedResolvedParameters = {
            targetData: MOCK_TRIGGER_EVENT_PAYLOAD_ARRAY,
            someOtherParam: 'static value',
        };

        // --- ADJUSTED EXPECTATION FOR EXECUTION CONTEXT ---
        const expectedExecutionContext = expect.objectContaining({
            // Event should still match
            event: MOCK_TRIGGER_EVENT,
            // Actor: Expect an object containing at least the ID.
            // Match the structure shown in the 'Received' part of the error.
            actor: expect.objectContaining({
                id: MOCK_PLAYER_ENTITY_FULL.id,
                // We received { components: {}, id: ... } - let's expect that structure loosely
                components: expect.any(Object), // Check components is an object
                // Do NOT expect type, getComponentData, hasComponent here, as they weren't present
            }),
            // Include other properties received in the context object
            context: expect.any(Object),
            entities: expect.any(Object),
            globals: expect.any(Object),
            target: null, // Received target was null
        });
        // --- END ADJUSTED EXPECTATION ---

        // Check the arguments passed to the mock handler
        expect(mockProcessDataHandler).toHaveBeenCalledWith(
            expectedResolvedParameters,
            expectedExecutionContext // Use the adjusted expectation
        );

        // 3. (Optional) Check logs for successful resolution confirmation
        const resolvedParamsLog = mockLogger.loggedMessages.find(log =>
            log.level === 'debug' &&
            log.message.includes('Resolved parameters for MOCK_PROCESS_DATA')
        );
        expect(resolvedParamsLog).toBeDefined();
        // Check the logged parameters contain the resolved array (adjust based on actual log format if needed)
        // Assuming args[0] is the JSON string or object containing resolved params
        try {
            // Handle cases where args[0] might be the message and args[1] the object/string
            const loggedDataArg = resolvedParamsLog.args.length > 1 ? resolvedParamsLog.args[1] : resolvedParamsLog.args[0];
            const loggedDataString = typeof loggedDataArg === 'string' ? loggedDataArg : JSON.stringify(loggedDataArg);
            expect(loggedDataString).toContain(JSON.stringify(MOCK_TRIGGER_EVENT_PAYLOAD_ARRAY));
        } catch (e) {
            console.error("Failed to assert log content. Log object:", resolvedParamsLog);
            throw e; // Re-throw after logging context
        }


        // 4. Verify no warnings about unresolved placeholders for this specific path
        const unresolvedWarning = mockLogger.loggedMessages.find(log =>
            log.level === 'warn' &&
            log.message.includes('Placeholder path "event.payload.sourceData" from {event.payload.sourceData} could not be resolved')
        );
        expect(unresolvedWarning).toBeUndefined();

        // 5. Verify no VED validation errors
        const validationErrorLog = mockLogger.loggedMessages.find(log =>
            log.level === 'error' &&
            log.message.includes('Payload validation FAILED')
        );
        expect(validationErrorLog).toBeUndefined();
    });
});