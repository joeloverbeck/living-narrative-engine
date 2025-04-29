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
import {SystemDataRegistry} from '../../core/services/systemDataRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';

// --- Handler Imports ---
import DispatchEventHandler from '../../logic/operationHandlers/dispatchEventHandler.js';
import LogHandler from '../../logic/operationHandlers/logHandler.js';
import SetVariableHandler from '../../logic/operationHandlers/setVariableHandler.js';
import QuerySystemDataHandler from '../../logic/operationHandlers/querySystemDataHandler.js';

// --- Jest Imports ---
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Mock Data Definitions (Constants) ---

// Single rule definition incorporating IF/ELSE logic
const MOCK_RULE_SINGLE_WELCOME_MESSAGE = {
    "rule_id": "show_welcome_message", // Using the original ID
    "event_type": "core:engine_initialized",
    "comment": "Displays the initial welcome message upon engine startup, setting the title and showing a greeting.",
    "actions": [
        {
            "type": "QUERY_SYSTEM_DATA",
            "comment": "Get the official world name from the game data manifest.",
            "parameters": {
                "source_id": "GameDataRepository",
                "query_details": "getWorldName",
                "result_variable": "officialWorldName" // Stores result in context.officialWorldName
            }
        },
        {
            "type": "IF",
            "comment": "Determine the actual world name to use and construct the appropriate welcome message text.",
            "parameters": {
                "condition": { // Condition evaluated *after* QUERY_SYSTEM_DATA runs
                    "!!": {"var": "context.officialWorldName"} // Check if official name exists
                },
                "then_actions": [
                    // Actions to run IF official name exists
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Use the official name found.",
                        "parameters": {
                            "variable_name": "determinedName",
                            "value": "{context.officialWorldName}" // Use the value from context
                        }
                    },
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Set the welcome message text using the official name.",
                        "parameters": {
                            "variable_name": "welcomeMessageText",
                            "value": "Welcome to {context.determinedName}!" // Placeholder resolved later
                        }
                    }
                ],
                "else_actions": [
                    // Actions to run IF official name does NOT exist
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Use the input name from the event payload, or a default if missing.",
                        "parameters": {
                            "variable_name": "determinedName",
                            "value": { // JsonLogic evaluated by SetVariableHandler
                                "or": [
                                    // <<< FIX: Corrected path from event.data to event.payload >>>
                                    {"var": "event.payload.inputWorldName"},
                                    "an Unnamed World" // Default fallback
                                ]
                            }
                        }
                    },
                    {
                        "type": "SET_VARIABLE",
                        "comment": "Set the welcome message text using the fallback name and add suffix.",
                        "parameters": {
                            "variable_name": "welcomeMessageText",
                            // Placeholder resolved by Interpreter AFTER determinedName is set
                            "value": "Welcome to {context.determinedName}! (Name from input)"
                        }
                    }
                ]
            } // End IF parameters
        }, // End IF action
        // --- Common Actions (Dispatch, Log) ---
        // These run AFTER the IF/ELSE block has determined the variables
        {
            "type": "DISPATCH_EVENT",
            "comment": "Dispatch event to set the application/UI title using the determined name.",
            "parameters": {
                "eventType": "textUI:set_title",
                "payload": {"text": "{context.determinedName}"} // Uses determinedName from IF/ELSE
            }
        },
        {
            "type": "DISPATCH_EVENT",
            "comment": "Dispatch event to display the welcome message text in the UI using the determined text.",
            "parameters": {
                "eventType": "textUI:display_message",
                "payload": {
                    "text": "{context.welcomeMessageText}", // Uses welcomeMessageText from IF/ELSE
                    "type": "info"
                }
            }
        },
        {
            "type": "LOG",
            // <<< FIX: Updated Rule ID in log message if needed, and use determinedName >>>
            "comment": "Log successful execution of the welcome message rule.",
            "parameters": {
                "message": "Rule show_welcome_message: Successfully dispatched welcome messages for world: '{context.determinedName}'.",
                "level": "info"
            }
        }
    ] // End actions
}; // End MOCK_RULE_SINGLE_WELCOME_MESSAGE


// Mock GameEvent Data Definitions
const MOCK_EVENT_SCENARIO_1 = {type: 'core:engine_initialized', payload: {}}; // Official Name test
const MOCK_EVENT_SCENARIO_2 = {type: 'core:engine_initialized', payload: {inputWorldName: "Input World"}}; // Input Fallback test
const MOCK_EVENT_SCENARIO_3_NULL = {type: 'core:engine_initialized', payload: {inputWorldName: null}}; // Default Fallback (null input) test
const MOCK_EVENT_SCENARIO_3_MISSING = {type: 'core:engine_initialized', payload: {}}; // Default Fallback (missing input) test


// --- Test Suite ---
describe('SystemLogicInterpreter - Integration Test: Single Welcome Message Rule', () => {
    console.log('*** TEST RUNNING (Single Rule) ***');
    // --- Mocks & Variables ---
    /** @type {ILogger} */
    let mockLogger;
    /** @type {EventBus} */
    let mockEventBus;
    /** @type {IDataRegistry} */
    let mockDataRegistry;
    /** @type {JsonLogicEvaluationService} */
    let jsonLogicEvaluationService;
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

    // --- Setup ---
    beforeEach(() => {
        // Standard Mocks (Copied from previous, assumed correct)
        mockLogger = {
            loggedMessages: [],
            _log(level, message, ...args) {
                let processedArgs;
                try {
                    processedArgs = args.map(arg => {
                        if (typeof arg === 'object' && arg !== null) {
                            try {
                                return JSON.stringify(arg);
                            } catch (e) {
                                return `[Unstringifiable Object: ${e.message}]`;
                            }
                        }
                        return arg;
                    });
                } catch (e) {
                    processedArgs = [`[Error processing log arguments: ${e.message}]`];
                }
                this.loggedMessages.push({
                    level,
                    message,
                    args: processedArgs && processedArgs.length > 0 ? processedArgs : undefined
                });
                try {
                    console.log(`--- MockLogger._log: [${level}] ${message}`, ...(processedArgs || []));
                } catch {
                    console.log(`--- MockLogger._log: [${level}] ${message} (Args unloggable)`);
                }
            },
            info: jest.fn((m, ...a) => mockLogger._log('info', m, ...a)),
            warn: jest.fn((m, ...a) => mockLogger._log('warn', m, ...a)),
            error: jest.fn((m, ...a) => mockLogger._log('error', m, ...a)),
            debug: jest.fn((m, ...a) => mockLogger._log('debug', m, ...a)),
            clearLogs: () => { /* clear implementation */
            }
        };
        capturedEventListener = null;
        mockEventBus = {
            subscribe: jest.fn((eventName, listener) => {
                if (eventName === '*') {
                    capturedEventListener = listener;
                }
            }), dispatch: jest.fn(), listenerCount: jest.fn().mockReturnValue(1),
        };
        mockDataRegistry = {
            _rules: [],
            getAllSystemRules: jest.fn(() => mockDataRegistry._rules),
            setRules: (rules) => {
                mockDataRegistry._rules = rules;
            }, /* other needed mocks */
        };
        mockEntityManager = {
            getEntityInstance: jest.fn().mockReturnValue(undefined),
            getComponentData: jest.fn().mockReturnValue(null),
            hasComponent: jest.fn().mockReturnValue(false),
        };
        mockGameDataRepository = {getWorldName: jest.fn(),};
        mockSystemDataRegistry = {
            query: jest.fn((sourceId, queryDetails) => {
                mockLogger.debug(`Mock SDR.query: ${sourceId}, ${JSON.stringify(queryDetails)}`);
                if (sourceId === 'GameDataRepository' && queryDetails === 'getWorldName') {
                    return mockGameDataRepository.getWorldName();
                }
                return undefined;
            }), registerSource: jest.fn(),
        };
        jsonLogicEvaluationService = new JsonLogicEvaluationService({logger: mockLogger});
        operationRegistry = new OperationRegistry({logger: mockLogger});
        const dispatchHandler = new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger});
        const logHandler = new LogHandler({logger: mockLogger});
        const setVariableHandler = new SetVariableHandler({logger: mockLogger});
        const querySystemDataHandler = new QuerySystemDataHandler({
            logger: mockLogger,
            systemDataRegistry: mockSystemDataRegistry
        });
        operationRegistry.register('QUERY_SYSTEM_DATA', querySystemDataHandler.execute.bind(querySystemDataHandler));
        operationRegistry.register('SET_VARIABLE', setVariableHandler.execute.bind(setVariableHandler));
        operationRegistry.register('DISPATCH_EVENT', dispatchHandler.execute.bind(dispatchHandler));
        operationRegistry.register('LOG', logHandler.execute.bind(logHandler));
        operationInterpreter = new OperationInterpreter({logger: mockLogger, operationRegistry: operationRegistry});
        interpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: jsonLogicEvaluationService,
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreter
        });

        // <<< Use the single rule >>>
        mockDataRegistry.setRules([MOCK_RULE_SINGLE_WELCOME_MESSAGE]);

        mockLogger.clearLogs();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        capturedEventListener = null;
    });

    // --- Scenario 1: Official Name ---
    describe('Scenario 1: Official World Name Used', () => {
        it('should set title and message using name from GameDataRepository via IF/THEN', () => {
            // Arrange
            const expectedWorldName = "Official World";
            mockGameDataRepository.getWorldName.mockReturnValue(expectedWorldName);
            const expectedTitlePayload = {text: expectedWorldName};
            const expectedMessagePayload = {text: `Welcome to ${expectedWorldName}!`, type: "info"};
            const expectedFinalLogMessage = `Rule ${MOCK_RULE_SINGLE_WELCOME_MESSAGE.rule_id}: Successfully dispatched welcome messages for world: '${expectedWorldName}'.`;

            // Act
            interpreter.initialize();
            expect(capturedEventListener).toBeInstanceOf(Function);
            capturedEventListener(MOCK_EVENT_SCENARIO_1);

            // Assert
            // 1. Verify Dependencies & Flow
            expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1); // Only one query needed now
            expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);

            // 2. Verify Event Dispatches (should come from common actions after IF/THEN)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2); // Title + Message
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:set_title', expectedTitlePayload);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:display_message', expectedMessagePayload);

            // 3. Verify Logs
            const logs = mockLogger.loggedMessages;

            // Check IF condition evaluation (EXPECT TRUE)
            const ifConditionLog = logs.find(log =>
                log.level === 'info' &&
                log.message.includes(`---> [Rule '${MOCK_RULE_SINGLE_WELCOME_MESSAGE.rule_id}' - IF Action 2] IF condition evaluation result: true`) // Uses rule_id and checks action 2 (the IF itself)
            );
            expect(ifConditionLog).toBeDefined();

            // Check SET_VARIABLE logs from the THEN branch
            const setDeterminedNameLog = logs.find(log => log.level === 'info' && log.message.includes(`SET_VARIABLE: Setting context variable "determinedName" to value: "${expectedWorldName}"`));
            expect(setDeterminedNameLog).toBeDefined();
            const setWelcomeTextLog = logs.find(log => log.level === 'info' && log.message.includes(`SET_VARIABLE: Setting context variable "welcomeMessageText" to value: "Welcome to ${expectedWorldName}!"`));
            expect(setWelcomeTextLog).toBeDefined();


            // Check final success log from the COMMON LOG action
            const finalLog = logs.find(log => log.level === 'info' && log.message === expectedFinalLogMessage);
            expect(finalLog).toBeDefined();

            const errorLog = logs.find(log => log.level === 'error');
            expect(errorLog).toBeUndefined();
        });
    });

    // --- Scenario 2: Input Fallback ---
    describe('Scenario 2: Input World Name Fallback', () => {
        it('should set title and message using name from event payload via IF/ELSE', () => {
            // Arrange
            const expectedWorldName = "Input World";
            mockGameDataRepository.getWorldName.mockReturnValue(null); // No official name
            const expectedTitlePayload = {text: expectedWorldName};
            const expectedMessagePayload = {text: `Welcome to ${expectedWorldName}! (Name from input)`, type: "info"};
            const expectedFinalLogMessage = `Rule ${MOCK_RULE_SINGLE_WELCOME_MESSAGE.rule_id}: Successfully dispatched welcome messages for world: '${expectedWorldName}'.`;

            // Act
            interpreter.initialize();
            expect(capturedEventListener).toBeInstanceOf(Function);
            capturedEventListener(MOCK_EVENT_SCENARIO_2); // Event has inputWorldName

            // Assert
            // 1. Verify Dependencies & Flow
            expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1); // Only one query
            expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);

            // 2. Verify Event Dispatches (should come from common actions after IF/ELSE)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:set_title', expectedTitlePayload);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:display_message', expectedMessagePayload);

            // 3. Verify Logs
            const logs = mockLogger.loggedMessages;

            // Check IF condition evaluation (EXPECT FALSE)
            const ifConditionLog = logs.find(log =>
                log.level === 'info' &&
                log.message.includes(`---> [Rule '${MOCK_RULE_SINGLE_WELCOME_MESSAGE.rule_id}' - IF Action 2] IF condition evaluation result: false`)
            );
            expect(ifConditionLog).toBeDefined();

            // Check SET_VARIABLE logs from the ELSE branch
            const setDeterminedNameLog = logs.find(log => log.level === 'info' && log.message.includes(`SET_VARIABLE: Setting context variable "determinedName" to value: "${expectedWorldName}"`));
            expect(setDeterminedNameLog).toBeDefined();
            const setWelcomeTextLog = logs.find(log => log.level === 'info' && log.message.includes(`SET_VARIABLE: Setting context variable "welcomeMessageText" to value: "Welcome to ${expectedWorldName}! (Name from input)"`));
            expect(setWelcomeTextLog).toBeDefined();

            // Check JsonLogic evaluation log within SetVariableHandler for determinedName
            const jsonLogicEvalLog = logs.find(log => log.level === 'debug' && log.message.includes(`SET_VARIABLE: JsonLogic evaluation successful for "determinedName". Result: "${expectedWorldName}"`));
            expect(jsonLogicEvalLog).toBeDefined();

            // Check final success log from the COMMON LOG action
            const finalLog = logs.find(log => log.level === 'info' && log.message === expectedFinalLogMessage);
            expect(finalLog).toBeDefined();

            const errorLog = logs.find(log => log.level === 'error');
            expect(errorLog).toBeUndefined();
        });
    });

    // --- Scenario 3: Default Fallback ---
    describe('Scenario 3: Default World Name Fallback', () => {
        it.each([
            ['null input', MOCK_EVENT_SCENARIO_3_NULL],
            ['missing input', MOCK_EVENT_SCENARIO_3_MISSING],
        ])('should set title and message using default name via IF/ELSE when inputWorldName is %s', (description, event) => {
            // Arrange
            const expectedWorldName = "an Unnamed World";
            mockGameDataRepository.getWorldName.mockReturnValue(null); // No official name
            const expectedTitlePayload = {text: expectedWorldName};
            const expectedMessagePayload = {text: `Welcome to ${expectedWorldName}! (Name from input)`, type: "info"};
            const expectedFinalLogMessage = `Rule ${MOCK_RULE_SINGLE_WELCOME_MESSAGE.rule_id}: Successfully dispatched welcome messages for world: '${expectedWorldName}'.`;


            // Act
            interpreter.initialize();
            expect(capturedEventListener).toBeInstanceOf(Function);
            capturedEventListener(event); // Use the specific event

            // Assert
            // 1. Verify Dependencies & Flow
            expect(mockSystemDataRegistry.query).toHaveBeenCalledTimes(1);
            expect(mockGameDataRepository.getWorldName).toHaveBeenCalledTimes(1);

            // 2. Verify Event Dispatches (should come from common actions after IF/ELSE)
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:set_title', expectedTitlePayload);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('textUI:display_message', expectedMessagePayload);

            // 3. Verify Logs
            const logs = mockLogger.loggedMessages;

            // Check IF condition evaluation (EXPECT FALSE)
            const ifConditionLog = logs.find(log =>
                log.level === 'info' &&
                log.message.includes(`---> [Rule '${MOCK_RULE_SINGLE_WELCOME_MESSAGE.rule_id}' - IF Action 2] IF condition evaluation result: false`)
            );
            expect(ifConditionLog).toBeDefined();

            // Check SET_VARIABLE logs from the ELSE branch (using default this time)
            const setDeterminedNameLog = logs.find(log => log.level === 'info' && log.message.includes(`SET_VARIABLE: Setting context variable "determinedName" to value: "${expectedWorldName}"`));
            expect(setDeterminedNameLog).toBeDefined();
            const setWelcomeTextLog = logs.find(log => log.level === 'info' && log.message.includes(`SET_VARIABLE: Setting context variable "welcomeMessageText" to value: "Welcome to ${expectedWorldName}! (Name from input)"`));
            expect(setWelcomeTextLog).toBeDefined();

            // Check JsonLogic evaluation log within SetVariableHandler for determinedName
            const jsonLogicEvalLog = logs.find(log => log.level === 'debug' && log.message.includes(`SET_VARIABLE: JsonLogic evaluation successful for "determinedName". Result: "${expectedWorldName}"`));
            expect(jsonLogicEvalLog).toBeDefined();

            // Check final success log from the COMMON LOG action
            const finalLog = logs.find(log => log.level === 'info' && log.message === expectedFinalLogMessage);
            expect(finalLog).toBeDefined();


            const errorLog = logs.find(log => log.level === 'error');
            expect(errorLog).toBeUndefined();
        });
    });

}); // End Top-Level Describe