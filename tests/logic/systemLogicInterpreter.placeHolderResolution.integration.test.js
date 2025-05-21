// src/tests/logic/systemLogicInterpreter.placeholderResolution.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../src/logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../src/logic/operationRegistry.js').default} OperationRegistry */
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../src/entities/entity.js').default} Entity */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';

// Import jest functions directly
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Mock Data Definitions ---

const MOCK_PLAYER_ENTITY_FULL = {
    id: 'player:placeholder-test',
    type: 'player',
    components: {status: {state: 'active'}},
    // Ensure these are jest.fn() if createComponentAccessor might call them directly on the object
    // For this test, the main thing is that getEntityInstance returns this object,
    // and createComponentAccessor wraps it.
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
        actorId: MOCK_PLAYER_ENTITY_FULL.id,
        sourceData: MOCK_TRIGGER_EVENT_PAYLOAD_ARRAY,
    },
};

const MOCK_RULE_PLACEHOLDER_RESOLUTION = {
    rule_id: 'RULE_PLACEHOLDER_RESOLUTION_TEST',
    event_type: MOCK_TRIGGER_EVENT.type,
    comment: 'Test rule for resolving an array placeholder from event payload.',
    condition: {}, // No condition, always runs
    actions: [
        {
            type: 'MOCK_PROCESS_DATA',
            comment: 'This action should receive the resolved array.',
            parameters: {
                targetData: '{event.payload.sourceData}',
                someOtherParam: 'static value',
            },
        },
    ],
};

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
    /** @type {jest.Mock<any, any, any>} */
    let mockProcessDataHandler;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
            loggedMessages: [],
            _log(level, message, ...args) {
                this.loggedMessages.push({level, message, args: args.length > 0 ? args : undefined});
            },
            clearLogs: () => {
                mockLogger.loggedMessages = [];
            }
        };
        // Re-assign specific level loggers to use the _log spy
        mockLogger.info = jest.fn((m, ...a) => mockLogger._log('info', m, ...a));
        mockLogger.warn = jest.fn((m, ...a) => mockLogger._log('warn', m, ...a));
        mockLogger.error = jest.fn((m, ...a) => mockLogger._log('error', m, ...a));
        mockLogger.debug = jest.fn((m, ...a) => mockLogger._log('debug', m, ...a));


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

        mockDataRegistry = {
            getAllSystemRules: jest.fn().mockReturnValue([]),
            getEntityDefinition: jest.fn(),
        };

        mockJsonLogicEvaluationService = {
            evaluate: jest.fn(() => true),
        };

        mockEntityManager = {
            getEntityInstance: jest.fn((entityId) => {
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

        operationRegistry = new OperationRegistry({logger: mockLogger});
        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: operationRegistry,
        });

        mockProcessDataHandler = jest.fn();
        operationRegistry.register('MOCK_PROCESS_DATA', mockProcessDataHandler);

        interpreter = new SystemLogicInterpreter({
            logger: mockLogger, eventBus: mockEventBus, dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: mockEntityManager,
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
        mockDataRegistry.getAllSystemRules.mockReturnValue([MOCK_RULE_PLACEHOLDER_RESOLUTION]);
        interpreter.initialize();
        expect(capturedEventListener).toBeInstanceOf(Function);

        capturedEventListener(MOCK_TRIGGER_EVENT);

        expect(mockProcessDataHandler).toHaveBeenCalledTimes(1);

        const expectedResolvedParameters = {
            targetData: MOCK_TRIGGER_EVENT_PAYLOAD_ARRAY,
            someOtherParam: 'static value',
        };

        // Define the structure for the NESTED evaluationContext
        const expectedJsonLogicContext = expect.objectContaining({
            event: expect.objectContaining(MOCK_TRIGGER_EVENT),
            actor: expect.objectContaining({
                id: MOCK_PLAYER_ENTITY_FULL.id,
                components: expect.any(Object) // Proxy from createComponentAccessor
            }),
            target: null,
            context: {}, // As observed in received context
            globals: {}, // As observed in received context
            entities: {}  // As observed in received context
            // logger is NOT in the received evaluationContext
        });

        // Define the structure for the actual argument passed to the handler (finalNestedExecutionContext)
        const expectedCorrectExecutionContext = expect.objectContaining({
            event: expect.objectContaining(MOCK_TRIGGER_EVENT), // Top-level event
            actor: expect.objectContaining({
                id: MOCK_PLAYER_ENTITY_FULL.id,
                components: expect.any(Object) // Top-level actor (proxy)
            }), // Top-level actor
            target: null, // Top-level target
            logger: expect.any(Object), // Top-level logger from SystemLogicInterpreter
            evaluationContext: expectedJsonLogicContext
        });

        expect(mockProcessDataHandler).toHaveBeenCalledWith(
            expectedResolvedParameters,
            expectedCorrectExecutionContext // Use the corrected nested structure
        );

        const unresolvedWarning = mockLogger.loggedMessages.find(log =>
            log.level === 'warn' &&
            log.message.includes('Placeholder path "event.payload.sourceData" from {event.payload.sourceData} could not be resolved')
        );
        expect(unresolvedWarning).toBeUndefined();

        const validationErrorLog = mockLogger.loggedMessages.find(log =>
            log.level === 'error' &&
            log.message.includes('Payload validation FAILED')
        );
        expect(validationErrorLog).toBeUndefined();
    });
});