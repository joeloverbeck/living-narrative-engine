// src/tests/integration/welcome_message.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../logic/operationRegistry.js').default} OperationRegistry */
/** @typedef {import('../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
// Mock GameDataRepository interface for testing
/**
 * @typedef {object} MockGameDataRepository
 * @property {jest.Mock<() => string | null>} getWorldName
 */

// --- Class Under Test & Dependencies ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import {SystemDataRegistry} from '../../core/services/systemDataRegistry.js'; // Import concrete class for mocking its methods if needed, but we mock the instance
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Import real service

// --- Handler Imports (Needed for Manual Registration in this test) ---
import DispatchEventHandler from '../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../logic/operationHandlers/logHandler.js';
import SetVariableHandler from '../../logic/operationHandlers/setVariableHandler.js';
import QuerySystemDataHandler from '../../logic/operationHandlers/querySystemDataHandler.js';
// We don't need ModifyComponent etc. for this specific rule

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Mock Data Definitions (Constants) ---

// The rule being tested
const MOCK_RULE_SHOW_WELCOME_MESSAGE = {
    "rule_id": "show_welcome_message",
    "event_type": "core:engine_initialized",
    "comment": "Displays the initial welcome message upon engine startup, setting the title and showing a greeting.",
    "actions": [
        {
            "type": "QUERY_SYSTEM_DATA",
            "comment": "Get the official world name from the game data manifest.",
            "parameters": {
                "source_id": "GameDataRepository",
                "query_details": "getWorldName",
                "result_variable": "officialWorldName"
            }
        },
        {
            "type": "IF",
            "comment": "Determine the actual world name to use and construct the appropriate welcome message text.",
            "parameters": {
                "condition": {
                    "!!": {
                        "var": "context.officialWorldName"
                    }
                },
                "then_actions": [
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Use the official name found.",
                        "parameters": {
                            "variable_name": "determinedName",
                            "value": "{context.officialWorldName}"
                        }
                    },
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Set the welcome message text using the official name.",
                        "parameters": {
                            "variable_name": "welcomeMessageText",
                            "value": "Welcome to {context.determinedName}!"
                        }
                    }
                ],
                "else_actions": [
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Use the input name from the event payload, or a default if missing.",
                        "parameters": {
                            "variable_name": "determinedName",
                            "value": {
                                "or": [
                                    {
                                        "var": "event.data.inputWorldName"
                                    },
                                    "an Unnamed World"
                                ]
                            }
                        }
                    },
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Set the welcome message text using the fallback name and add suffix.",
                        "parameters": {
                            "variable_name": "welcomeMessageText",
                            "value": "Welcome to {context.determinedName}! (Name from input)"
                        }
                    }
                ]
            }
        },
        {
            "type": "DISPATCH_EVENT",
            "comment": "Dispatch event to set the application/UI title.",
            "parameters": {
                "eventType": "textUI:set_title",
                "payload": {
                    "text": "{context.determinedName}"
                }
            }
        },
        {
            "type": "DISPATCH_EVENT",
            "comment": "Dispatch event to display the welcome message text in the UI.",
            "parameters": {
                "eventType": "textUI:display_message",
                "payload": {
                    "text": "{context.welcomeMessageText}",
                    "type": "info"
                }
            }
        },
        {
            "type": "LOG",
            "comment": "Log successful execution of the welcome message rule.",
            "parameters": {
                "message": "Rule textUI:show_welcome_message: Successfully dispatched welcome messages for world: '{context.determinedName}'.",
                "level": "info"
            }
        }
    ]
}; // End MOCK_RULE_SHOW_WELCOME_MESSAGE


// Mock GameEvent Data Definitions
const MOCK_EVENT_SCENARIO_1 = {type: 'core:engine_initialized', payload: {}}; // Official Name
const MOCK_EVENT_SCENARIO_2 = {type: 'core:engine_initialized', payload: {inputWorldName: "Input World"}}; // Input Fallback
const MOCK_EVENT_SCENARIO_3_NULL = {type: 'core:engine_initialized', payload: {inputWorldName: null}}; // Default Fallback (null input)
const MOCK_EVENT_SCENARIO_3_MISSING = {type: 'core:engine_initialized', payload: {}}; // Default Fallback (missing input)


// --- Test Suite ---
describe('SystemLogicInterpreter - E2E Test: Welcome Message Rule', () => {
    // --- Mocks & Variables ---
    /** @type {ILogger} */
    let mockLogger;
    /** @type {EventBus} */
    let mockEventBus;
    /** @type {IDataRegistry} */
    let mockDataRegistry;
    /** @type {JsonLogicEvaluationService} */
    let jsonLogicEvaluationService; // Use real instance
    /** @type {EntityManager} */
    let mockEntityManager;
    /** @type {OperationRegistry} */
    let operationRegistry;
    /** @type {OperationInterpreter} */
    let operationInterpreter;
    /** @type {SystemLogicInterpreter} */
    let interpreter;
    /** @type {SystemDataRegistry} */
    let mockSystemDataRegistry;
    /** @type {MockGameDataRepository} */
    let mockGameDataRepository;
    /** @type {Function | null} */
    let capturedEventListener = null;
    // /** @type {jest.SpyInstance} */ // <-- REMOVED/Commented Out Spy Variable
    // let systemLogicInterpreterProcessRuleSpy;
    /** @type {jest.SpyInstance} */
    let systemLogicInterpreterExecuteActionsSpy; // NOTE: This might also fail if _executeActions becomes #executeActions
    /** @type {jest.SpyInstance} */
    let operationInterpreterExecuteSpy;

    // --- Setup ---
    beforeEach(() => {
        // Standard Mocks (Logger, EventBus, EntityManager, DataRegistry)
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

        capturedEventListener = null;
        mockEventBus = {
            subscribe: jest.fn((eventName, listener) => {
                if (eventName === '*') {
                    capturedEventListener = listener;
                }
            }),
            dispatch: jest.fn(), // Spy on dispatched events
            listenerCount: jest.fn().mockReturnValue(1),
        };

        mockDataRegistry = {
            // Configure getAllSystemRules in each test
            getAllSystemRules: jest.fn().mockReturnValue([MOCK_RULE_SHOW_WELCOME_MESSAGE]),
            getEntityDefinition: jest.fn(), // Not used by this rule
            // Add other methods if SystemLogicInterpreter uses them indirectly
            getAll: jest.fn().mockReturnValue([]),
            get: jest.fn(),
            clear: jest.fn(),
            store: jest.fn(),
            // Methods needed by ACs
            getActionDefinition: jest.fn(),
            getEventDefinition: jest.fn(),
            getComponentDefinition: jest.fn(),
            getAllEntityDefinitions: jest.fn().mockReturnValue([]),
            getAllActionDefinitions: jest.fn().mockReturnValue([]),
            getAllEventDefinitions: jest.fn().mockReturnValue([]),
            getAllComponentDefinitions: jest.fn().mockReturnValue([]),
            getStartingPlayerId: jest.fn().mockReturnValue(null),
            getStartingLocationId: jest.fn().mockReturnValue(null),
        };

        mockEntityManager = { // Minimal mock, rule doesn't interact with entities directly
            getEntityInstance: jest.fn().mockReturnValue(undefined), // No actor/target expected
            getComponentData: jest.fn().mockReturnValue(null),
            hasComponent: jest.fn().mockReturnValue(false),
        };

        // Mock GameDataRepository (the source being queried)
        mockGameDataRepository = {
            // Configure return value in each test
            getWorldName: jest.fn(),
        };

        // Mock SystemDataRegistry
        mockSystemDataRegistry = {
            query: jest.fn((sourceId, queryDetails) => {
                // This mock correctly delegates based on the previous fix in QuerySystemDataHandler
                mockLogger.debug(`Mock SystemDataRegistry.query called with: sourceId='${sourceId}', queryDetails='${JSON.stringify(queryDetails)}'`);
                if (sourceId === 'GameDataRepository' && queryDetails === 'getWorldName') {
                    mockLogger.debug('Mock SystemDataRegistry delegating to mockGameDataRepository.getWorldName()');
                    return mockGameDataRepository.getWorldName();
                }
                mockLogger.warn(`Mock SystemDataRegistry received unhandled query: sourceId='${sourceId}', queryDetails='${JSON.stringify(queryDetails)}'`);
                return undefined;
            }),
            registerSource: jest.fn(),
        };


        // Real JsonLogicEvaluationService (no complex custom ops needed here)
        jsonLogicEvaluationService = new JsonLogicEvaluationService({logger: mockLogger}); // Instantiated here

        // Instantiate OperationRegistry and Manually Register Handlers needed by the rule
        operationRegistry = new OperationRegistry({logger: mockLogger});

        // Instantiate handlers with their dependencies (using mocks where needed)
        const dispatchHandler = new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger});
        const logHandler = new LogHandler({logger: mockLogger});
        // --- FIX: Provide JsonLogicEvaluationService to SetVariableHandler ---
        const setVariableHandler = new SetVariableHandler({
            logger: mockLogger,
            jsonLogicEvaluationService: jsonLogicEvaluationService // Inject the service
        });
        // --- END FIX ---
        // QuerySystemDataHandler instantiation uses the corrected mockSystemDataRegistry
        const querySystemDataHandler = new QuerySystemDataHandler({
            logger: mockLogger,
            systemDataRegistry: mockSystemDataRegistry
        });

        // Register only the handlers used by show_welcome_message rule
        operationRegistry.register('QUERY_SYSTEM_DATA', querySystemDataHandler.execute.bind(querySystemDataHandler));
        operationRegistry.register('SET_VARIABLE', setVariableHandler.execute.bind(setVariableHandler)); // Now uses correctly instantiated handler
        operationRegistry.register('DISPATCH_EVENT', dispatchHandler.execute.bind(dispatchHandler));
        operationRegistry.register('LOG', logHandler.execute.bind(logHandler));
        // IF is handled internally by SystemLogicInterpreter._executeActions

        // Instantiate OperationInterpreter
        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: operationRegistry
        });
        operationInterpreterExecuteSpy = jest.spyOn(operationInterpreter, 'execute');


        // Instantiate SystemLogicInterpreter
        interpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: jsonLogicEvaluationService, // Provided here as well
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreter
        });

        // --- Spies are correctly handled (no spy on private methods) ---

        // Clear initial logs
        mockLogger.clearLogs();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        capturedEventListener = null;
    });

    // --- Scenario 1: Official Name ---
    describe('Scenario 1: Official World Name Used', () => {
        it('should set title and message using name from GameDataRepository', () => {
            // Arrange
            const expectedWorldName = "Official World";
            mockGameDataRepository.getWorldName.mockReturnValue(expectedWorldName);
            const expectedTitlePayload = {text: expectedWorldName};
            const expectedMessagePayload = {text: `Welcome to ${expectedWorldName}!`, type: "info"};
            const expectedFinalLogMessage = `Rule show_welcome_message: Successfully dispatched welcome messages for world: '${expectedWorldName}'.`;

            // Act
            interpreter.initialize(); // Load rules & subscribe
            expect(capturedEventListener).toBeInstanceOf(Function); // Ensure listener captured
            capturedEventListener(MOCK_EVENT_SCENARIO_1); // Dispatch the event

            // Assert
            // 1. Verify Dependencies & Flow
            expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
            // Check the specific call to the underlying mock repo method
            expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
            // --- FIX: Remove assertion checking the spy that was removed ---
            // expect(systemLogicInterpreterProcessRuleSpy).toHaveBeenCalledWith(MOCK_RULE_SHOW_WELCOME_MESSAGE, MOCK_EVENT_SCENARIO_1);
            // --- END FIX ---

            // 2. Verify Event Dispatches (Outputs)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2); // Title + Message
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:set_title', expectedTitlePayload);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:display_message', expectedMessagePayload);

            // 3. Verify Logs
            const logs = mockLogger.loggedMessages;
            // Check specific log messages indicating flow
            const queryLog = logs.find(log => log.level === 'debug' && log.message.includes('Mock SystemDataRegistry delegating'));
            expect(queryLog).toBeDefined();
            const ifConditionLog = logs.find(log => log.level === 'info' && log.message.includes('IF condition evaluation result: true'));
            expect(ifConditionLog).toBeDefined();
            const thenBranchLog = logs.find(log => log.level === 'debug' && log.message.includes('Executing THEN branch'));
            expect(thenBranchLog).toBeDefined();
            // Check final success log message content
            const finalLog = logs.find(log => log.level === 'info' && log.message === expectedFinalLogMessage);
            expect(finalLog).toBeDefined();
            // Check for unexpected errors
            const errorLog = logs.find(log => log.level === 'error');
            // If errors related to the removed spy were logged, they should now be gone.
            // Filter out potential benign errors if necessary, or ensure none exist.
            expect(errorLog).toBeUndefined();

            // AC Checks:
            // - Application displays the correct window title and welcome message text -> Checked via mockEventBus.dispatch args
            // - No unexpected errors related to rule execution appear in the logs -> Checked via errorLog
            // - Logs confirm the expected flow -> Checked via specific log message presence
        });
    });

    // --- Scenario 2: Input Fallback ---
    describe('Scenario 2: Input World Name Fallback', () => {
        it('should set title and message using name from event payload', () => {
            // Arrange
            const expectedWorldName = "Input World"; // From MOCK_EVENT_SCENARIO_2 payload
            mockGameDataRepository.getWorldName.mockReturnValue(null); // No official name
            const expectedTitlePayload = {text: expectedWorldName};
            const expectedMessagePayload = {text: `Welcome to ${expectedWorldName}! (Name from input)`, type: "info"};
            const expectedFinalLogMessage = `Rule show_welcome_message: Successfully dispatched welcome messages for world: '${expectedWorldName}'.`;

            // Act
            interpreter.initialize();
            expect(capturedEventListener).toBeInstanceOf(Function);
            capturedEventListener(MOCK_EVENT_SCENARIO_2);

            // Assert
            // 1. Verify Dependencies & Flow
            expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
            expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
            // --- FIX: Remove assertion checking the spy that was removed ---
            // expect(systemLogicInterpreterProcessRuleSpy).toHaveBeenCalledWith(MOCK_RULE_SHOW_WELCOME_MESSAGE, MOCK_EVENT_SCENARIO_2);
            // --- END FIX ---

            // 2. Verify Event Dispatches (Outputs)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:set_title', expectedTitlePayload);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:display_message', expectedMessagePayload);

            // 3. Verify Logs
            const logs = mockLogger.loggedMessages;
            const queryLog = logs.find(log => log.level === 'debug' && log.message.includes('Mock SystemDataRegistry delegating'));
            expect(queryLog).toBeDefined();
            // Check IF condition evaluates to false
            const ifConditionLog = logs.find(log => log.level === 'info' && log.message.includes('IF condition evaluation result: false'));
            expect(ifConditionLog).toBeDefined();
            // Check ELSE branch is executed
            const elseBranchLog = logs.find(log => log.level === 'debug' && log.message.includes('Executing ELSE branch'));
            expect(elseBranchLog).toBeDefined();
            // Check JSON Logic var access log for payload (might be too detailed, depends on JsonLogic service logging)
            // Check SET_VARIABLE logs confirm 'Input World' is set
            const setDeterminedNameLog = logs.find(log => log.level === 'info' && log.message.includes('Setting context variable "determinedName" to ORIGINAL value: "Input World"'));
            expect(setDeterminedNameLog).toBeDefined();
            // Check final success log message content
            const finalLog = logs.find(log => log.level === 'info' && log.message === expectedFinalLogMessage);
            expect(finalLog).toBeDefined();
            // Check for unexpected errors
            const errorLog = logs.find(log => log.level === 'error');
            expect(errorLog).toBeUndefined();

            // AC Checks:
            // - Application displays the correct window title and welcome message text (including fallback indicator) -> Checked via mockEventBus.dispatch args
            // - No unexpected errors related to rule execution appear in the logs -> Checked via errorLog
            // - Logs confirm the expected flow -> Checked via specific log message presence (IF false, ELSE branch)
        });
    });

    // --- Scenario 3: Default Fallback ---
    describe('Scenario 3: Default World Name Fallback', () => {
        // Test both null and missing inputWorldName just in case
        it.each([
            ['null input', MOCK_EVENT_SCENARIO_3_NULL],
            ['missing input', MOCK_EVENT_SCENARIO_3_MISSING],
        ])('should set title and message using default name when inputWorldName is %s', (description, event) => {
            // Arrange
            const expectedWorldName = "an Unnamed World"; // Default from rule's 'or'
            mockGameDataRepository.getWorldName.mockReturnValue(null); // No official name
            const expectedTitlePayload = {text: expectedWorldName};
            // Note: Rule adds suffix even for the default
            const expectedMessagePayload = {text: `Welcome to ${expectedWorldName}! (Name from input)`, type: "info"};
            const expectedFinalLogMessage = `Rule show_welcome_message: Successfully dispatched welcome messages for world: '${expectedWorldName}'.`;

            // Act
            interpreter.initialize();
            expect(capturedEventListener).toBeInstanceOf(Function);
            capturedEventListener(event); // Dispatch the specific event for this case

            // Assert
            // 1. Verify Dependencies & Flow
            expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
            expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);
            // --- FIX: Remove assertion checking the spy that was removed ---
            // expect(systemLogicInterpreterProcessRuleSpy).toHaveBeenCalledWith(MOCK_RULE_SHOW_WELCOME_MESSAGE, event);
            // --- END FIX ---

            // 2. Verify Event Dispatches (Outputs)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:set_title', expectedTitlePayload);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:display_message', expectedMessagePayload);

            // 3. Verify Logs
            const logs = mockLogger.loggedMessages;
            const queryLog = logs.find(log => log.level === 'debug' && log.message.includes('Mock SystemDataRegistry delegating'));
            expect(queryLog).toBeDefined();
            const ifConditionLog = logs.find(log => log.level === 'info' && log.message.includes('IF condition evaluation result: false'));
            expect(ifConditionLog).toBeDefined();
            const elseBranchLog = logs.find(log => log.level === 'debug' && log.message.includes('Executing ELSE branch'));
            expect(elseBranchLog).toBeDefined();
            // Check SET_VARIABLE logs confirm 'an Unnamed World' is set
            const setDeterminedNameLog = logs.find(log => log.level === 'info' && log.message.includes('Setting context variable "determinedName" to ORIGINAL value: "an Unnamed World"'));
            expect(setDeterminedNameLog).toBeDefined();
            const finalLog = logs.find(log => log.level === 'info' && log.message === expectedFinalLogMessage);
            expect(finalLog).toBeDefined();
            const errorLog = logs.find(log => log.level === 'error');
            expect(errorLog).toBeUndefined();

            // AC Checks:
            // - Application displays the correct window title and welcome message text (including fallback indicator) -> Checked via mockEventBus.dispatch args
            // - No unexpected errors related to rule execution appear in the logs -> Checked via errorLog
            // - Logs confirm the expected flow -> Checked via specific log message presence (IF false, ELSE branch, default name set)
        });
    });

}); // End Top-Level Describe