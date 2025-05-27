// tests/turns/strategies/aiPlayerStrategy.test.js
// --- FILE START ---

import {AIPlayerStrategy} from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';
import {DEFAULT_FALLBACK_ACTION} from "../../../src/llms/constants/llmConstants";

// --- Mock Implementations ---

/**
 * @returns {jest.Mocked<import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter>}
 */
const mockLlmAdapter = () => ({
    getAIDecision: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider>}
 */
const mockGameStateProvider = () => ({
    buildGameState: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/turns/interfaces/IAIPromptFormatter.js').IAIPromptFormatter>}
 */
const mockPromptFormatter = () => ({
    formatPrompt: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor>}
 */
const mockLlmResponseProcessor = () => ({
    processResponse: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

class MockEntity {
    /**
     * @param {string} id
     * @param {Record<string, any>} componentsData // Only used for actor.id, name for logging
     */
    constructor(id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`, componentsData = {}) {
        this.id = id;
        // The actual component data and methods like getComponentData are no longer directly used
        // by AIPlayerStrategy, but an actor object with an 'id' is still needed.
        this.name = componentsData.name?.text || `Mock Entity ${id}`;
    }
}

/**
 * Creates a mock actor instance.
 * @param {string} [id='actor1']
 * @returns {MockEntity}
 */
const createMockActor = (id = 'actor1') => {
    return new MockEntity(id);
};


describe('AIPlayerStrategy', () => {
    /** @type {ReturnType<typeof mockLlmAdapter>} */
    let llmAdapter;
    /** @type {ReturnType<typeof mockGameStateProvider>} */
    let gameStateProvider;
    /** @type {ReturnType<typeof mockPromptFormatter>} */
    let promptFormatter;
    /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
    let llmResponseProcessor;
    /** @type {ReturnType<typeof mockLogger>} */
    let currentLoggerGlobalMock;

    beforeEach(() => {
        llmAdapter = mockLlmAdapter();
        gameStateProvider = mockGameStateProvider();
        promptFormatter = mockPromptFormatter();
        llmResponseProcessor = mockLlmResponseProcessor();
        currentLoggerGlobalMock = mockLogger();

        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
        jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        jest.spyOn(console, 'info').mockImplementation(() => {
        });
        jest.spyOn(console, 'debug').mockImplementation(() => {
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        test('should successfully create an instance with valid dependencies', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptFormatter,
                llmResponseProcessor
            })).not.toThrow();
            const instance = new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptFormatter,
                llmResponseProcessor
            });
            expect(instance).toBeInstanceOf(AIPlayerStrategy);
        });

        // --- ILLMAdapter validation ---
        test('should throw an error if llmAdapter is not provided', () => {
            expect(() => new AIPlayerStrategy({
                gameStateProvider, promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a getAIDecision method.");
        });

        test('should throw an error if llmAdapter is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: null, gameStateProvider, promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a getAIDecision method.");
        });

        test('should throw an error if llmAdapter does not have getAIDecision method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: {}, gameStateProvider, promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a getAIDecision method.");
        });

        test('should throw an error if llmAdapter.getAIDecision is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: {getAIDecision: "not-a-function"},
                gameStateProvider, promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a getAIDecision method.");
        });


        // --- IAIGameStateProvider validation ---
        test('should throw an error if gameStateProvider is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider instance with a buildGameState method.");
        });

        test('should throw an error if gameStateProvider is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider: null, promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider instance with a buildGameState method.");
        });

        test('should throw an error if gameStateProvider does not have buildGameState method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider: {}, promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider instance with a buildGameState method.");
        });

        test('should throw an error if gameStateProvider.buildGameState is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider: {buildGameState: "not-a-function"},
                promptFormatter, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider instance with a buildGameState method.");
        });


        // --- IAIPromptFormatter validation ---
        test('should throw an error if promptFormatter is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIPromptFormatter instance with a formatPrompt method.");
        });

        test('should throw an error if promptFormatter is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptFormatter: null, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIPromptFormatter instance with a formatPrompt method.");
        });

        test('should throw an error if promptFormatter does not have formatPrompt method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptFormatter: {}, llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIPromptFormatter instance with a formatPrompt method.");
        });

        test('should throw an error if promptFormatter.formatPrompt is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider,
                promptFormatter: {formatPrompt: "not-a-function"},
                llmResponseProcessor
            })).toThrow("AIPlayerStrategy: Constructor requires a valid IAIPromptFormatter instance with a formatPrompt method.");
        });


        // --- ILLMResponseProcessor validation ---
        test('should throw an error if llmResponseProcessor is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptFormatter
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor instance with a processResponse method.");
        });

        test('should throw an error if llmResponseProcessor is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptFormatter, llmResponseProcessor: null
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor instance with a processResponse method.");
        });

        test('should throw an error if llmResponseProcessor does not have processResponse method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptFormatter, llmResponseProcessor: {}
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor instance with a processResponse method.");
        });
        test('should throw an error if llmResponseProcessor.processResponse is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptFormatter,
                llmResponseProcessor: {processResponse: "not-a-function"}
            })).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor instance with a processResponse method.");
        });

    });

    describe('_getSafeLogger', () => {
        let instance;
        beforeEach(() => {
            instance = new AIPlayerStrategy({llmAdapter, gameStateProvider, promptFormatter, llmResponseProcessor});
        });

        test('should return logger from context if valid', () => {
            const mockContext = {getLogger: jest.fn(() => currentLoggerGlobalMock)};
            const logger = instance._getSafeLogger(mockContext);
            expect(logger).toBe(currentLoggerGlobalMock);
            expect(mockContext.getLogger).toHaveBeenCalledTimes(1);
        });

        test('should return console fallback if context is null', () => {
            const logger = instance._getSafeLogger(null);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if context is undefined', () => {
            const logger = instance._getSafeLogger(undefined);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if context.getLogger is not a function', () => {
            const mockContext = {getLogger: 'not-a-function'};
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if context.getLogger returns null', () => {
            const mockContext = {getLogger: jest.fn(() => null)};
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if logger from context does not have an error method', () => {
            const faultyLogger = {info: jest.fn(), warn: jest.fn(), debug: jest.fn()}; // Missing error
            const mockContext = {getLogger: jest.fn(() => faultyLogger)};
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if logger from context does not have all required methods', () => {
            const incompleteLogger = {error: jest.fn(), info: jest.fn()}; // Missing warn, debug
            const mockContext = {getLogger: jest.fn(() => incompleteLogger)};
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.warn).toBe('function'); // Check it's the fallback
            logger.warn("test warn");
            expect(console.warn).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test warn");
        });


        test('should return console fallback and log internal error if getLogger itself throws', () => {
            const error = new Error("getLogger failed");
            const mockContext = {
                getLogger: jest.fn(() => {
                    throw error;
                })
            };
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.error).toBe('function');
            // This console.error is from AIPlayerStrategy._getSafeLogger's catch block
            expect(console.error).toHaveBeenCalledWith("AIPlayerStrategy: Error retrieving logger from context, using console. Error:", error);
        });
    });

    describe('_createFallbackAction', () => {
        let instance;
        beforeEach(() => {
            instance = new AIPlayerStrategy({llmAdapter, gameStateProvider, promptFormatter, llmResponseProcessor});
        });

        test('should create a fallback action with default actorId and given errorContext', () => {
            const errorContext = 'test_error_context';
            const fallbackAction = instance._createFallbackAction(errorContext);
            expect(fallbackAction).toEqual({
                actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
                commandString: DEFAULT_FALLBACK_ACTION.commandString, // Changed
                speech: "I encountered an unexpected issue and will wait.", // Added
                resolvedParameters: {
                    errorContext: `AI Error for UnknownActor: ${errorContext}. Waiting.`, // Changed
                    actorId: 'UnknownActor',
                },
            });
        });

        test('should create a fallback action with specified actorId and errorContext', () => {
            const errorContext = 'specific_error';
            const actorId = 'actor123';
            const fallbackAction = instance._createFallbackAction(errorContext, actorId);
            expect(fallbackAction).toEqual({
                actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
                commandString: DEFAULT_FALLBACK_ACTION.commandString, // Changed
                speech: "I encountered an unexpected issue and will wait.", // Added
                resolvedParameters: {
                    errorContext: `AI Error for ${actorId}: ${errorContext}. Waiting.`, // Changed
                    actorId: actorId,
                },
            });
        });

        test('should not log anything itself (delegates logging to caller)', () => {
            // The method now includes a debug log, so this test is no longer valid as is.
            // We'll spy on the instance's _getSafeLogger to check its debug method.
            const safeLogger = mockLogger();
            jest.spyOn(instance, '_getSafeLogger').mockReturnValue(safeLogger);

            instance._createFallbackAction('some_error', 'some_actor');

            expect(safeLogger.debug).toHaveBeenCalledWith(
                "AIPlayerStrategy: Creating fallback action. Error context: \"some_error\", Actor: some_actor"
            );
            // Ensure other console methods were not called directly by _createFallbackAction
            expect(console.error).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
            expect(console.info).not.toHaveBeenCalled();
        });
    });

    describe('decideAction', () => {
        /** @type {AIPlayerStrategy} */
        let instance_da; // 'da' for decideAction scoped instance
        /** @type {ReturnType<typeof mockLlmAdapter>} */
        let da_llmAdapter;
        /** @type {ReturnType<typeof mockGameStateProvider>} */
        let da_gameStateProvider;
        /** @type {ReturnType<typeof mockPromptFormatter>} */
        let da_promptFormatter;
        /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
        let da_llmResponseProcessor;

        /** @type {MockEntity} */
        let mockActor_da;
        /** @type {ReturnType<typeof mockLogger>} */
        let capturedLogger_da;
        /** @type {object} */
        let mockGameStateDto_da;
        /** @type {string} */
        let mockLlmPromptString_da;
        /** @type {string} */
        let mockLlmJsonResponse_da;
        /** @type {import('../../../src/turns/interfaces/IActorTurnStrategy.js').ITurnAction} */
        let mockProcessedAction_da;

        const createLocalMockContext_da = (actorEntity, overrides = {}) => {
            const defaultLogger = mockLogger();
            capturedLogger_da = defaultLogger;
            return {
                getLogger: jest.fn(() => capturedLogger_da),
                getActor: jest.fn(() => actorEntity),
                ...overrides,
            };
        };

        beforeEach(() => {
            da_llmAdapter = mockLlmAdapter();
            da_gameStateProvider = mockGameStateProvider();
            da_promptFormatter = mockPromptFormatter();
            da_llmResponseProcessor = mockLlmResponseProcessor();

            instance_da = new AIPlayerStrategy({
                llmAdapter: da_llmAdapter,
                gameStateProvider: da_gameStateProvider,
                promptFormatter: da_promptFormatter,
                llmResponseProcessor: da_llmResponseProcessor
            });

            mockActor_da = createMockActor('playerTest1');
            mockGameStateDto_da = {someState: 'details'};
            mockLlmPromptString_da = 'This is a test prompt for the LLM.';
            mockLlmJsonResponse_da = JSON.stringify({actionDefinitionId: 'core:interact', target: 'door'});
            mockProcessedAction_da = {
                actionDefinitionId: 'core:interact',
                resolvedParameters: {target: 'door'},
                commandString: 'Interact with door'
            };

            // Default happy path mocks
            da_gameStateProvider.buildGameState.mockResolvedValue(mockGameStateDto_da);
            da_promptFormatter.formatPrompt.mockReturnValue(mockLlmPromptString_da);
            da_llmAdapter.getAIDecision.mockResolvedValue(mockLlmJsonResponse_da);
            // MODIFIED: processResponse is now async
            da_llmResponseProcessor.processResponse.mockResolvedValue(mockProcessedAction_da);
        });

        test('should return fallback action if context is null', async () => {
            const result = await instance_da.decideAction(null);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe('AI Error for UnknownActor: null_turn_context. Waiting.');
            expect(result.resolvedParameters.actorId).toBe('UnknownActor');
            // Fallback logger is used when context is null
            expect(console.error).toHaveBeenCalledWith(
                "[AIPlayerStrategy (fallback logger)]",
                "AIPlayerStrategy: Critical - ITurnContext is null or undefined in decideAction."
            );
        });

        test('should return fallback action if context.getActor() returns null', async () => {
            const context = createLocalMockContext_da(null);
            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe('AI Error for UnknownActor: missing_actor_in_context. Waiting.');
            expect(capturedLogger_da.error).toHaveBeenCalledWith("AIPlayerStrategy: Critical - Actor not available or ID missing in ITurnContext.");
        });

        test('should return fallback action if actor has no ID', async () => {
            const actorWithoutId = new MockEntity(undefined);
            actorWithoutId.id = null;
            const context = createLocalMockContext_da(actorWithoutId);
            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe('AI Error for UnknownActor: missing_actor_in_context. Waiting.');
            expect(capturedLogger_da.error).toHaveBeenCalledWith("AIPlayerStrategy: Critical - Actor not available or ID missing in ITurnContext.");
        });

        test('HAPPY PATH: should orchestrate calls and return action from processor', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const resultAction = await instance_da.decideAction(context);

            expect(da_gameStateProvider.buildGameState).toHaveBeenCalledWith(mockActor_da, context, capturedLogger_da);
            expect(da_promptFormatter.formatPrompt).toHaveBeenCalledWith(mockGameStateDto_da, capturedLogger_da);
            expect(da_llmAdapter.getAIDecision).toHaveBeenCalledWith(mockLlmPromptString_da);
            expect(da_llmResponseProcessor.processResponse).toHaveBeenCalledWith(mockLlmJsonResponse_da, mockActor_da.id, capturedLogger_da);
            expect(resultAction).toBe(mockProcessedAction_da);

            expect(capturedLogger_da.info).toHaveBeenCalledWith(`AIPlayerStrategy: decideAction called for actor ${mockActor_da.id}. Orchestrating AI decision pipeline.`);
            expect(capturedLogger_da.info).toHaveBeenCalledWith(`AIPlayerStrategy: Generated LLM prompt for actor ${mockActor_da.id}. Length: ${mockLlmPromptString_da.length}.`);
            // --- MODIFICATION START (TASK-003 Test Fix) ---
            expect(capturedLogger_da.debug).toHaveBeenCalledWith(`AIPlayerStrategy: LLM Prompt for ${mockActor_da.id}:\n${mockLlmPromptString_da}`);
            // --- MODIFICATION END (TASK-003 Test Fix) ---
            expect(capturedLogger_da.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Received LLM JSON response for actor ${mockActor_da.id}: ${mockLlmJsonResponse_da}`);
            expect(capturedLogger_da.error).not.toHaveBeenCalled();
        });

        test('should return fallback if gameStateProvider.buildGameState throws', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const error = new Error("GameStateProvider Error");
            da_gameStateProvider.buildGameState.mockRejectedValue(error);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an internal processing error and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`);
            expect(capturedLogger_da.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error during decideAction orchestration for actor ${mockActor_da.id}: ${error.message}`,
                expect.objectContaining({errorDetails: error, stack: error.stack})
            );
        });

        test('should return fallback if promptFormatter.formatPrompt returns an error string (e.g., "Error:")', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const errorPrompt = "Error: Prompt formatting failed due to reasons.";
            da_promptFormatter.formatPrompt.mockReturnValue(errorPrompt);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: prompt_formatter_failure. Waiting.`);
            expect(capturedLogger_da.error).toHaveBeenCalledWith(`AIPlayerStrategy: Prompt formatter failed or returned error for actor ${mockActor_da.id}. Prompt content: "${errorPrompt}"`);
        });

        test('should return fallback if promptFormatter.formatPrompt returns null', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            da_promptFormatter.formatPrompt.mockReturnValue(null);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: prompt_formatter_failure. Waiting.`);
            expect(capturedLogger_da.error).toHaveBeenCalledWith(`AIPlayerStrategy: Prompt formatter failed or returned error for actor ${mockActor_da.id}. Prompt content: null`);
        });

        test('should return fallback if promptFormatter.formatPrompt returns an empty string', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            da_promptFormatter.formatPrompt.mockReturnValue('');

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: prompt_formatter_failure. Waiting.`);
            expect(capturedLogger_da.error).toHaveBeenCalledWith(`AIPlayerStrategy: Prompt formatter failed or returned error for actor ${mockActor_da.id}. Prompt content: empty`);
        });


        test('should return fallback if llmAdapter.getAIDecision throws', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const error = new Error("LLM Communication Error");
            da_llmAdapter.getAIDecision.mockRejectedValue(error);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an internal processing error and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`);
            expect(capturedLogger_da.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error during decideAction orchestration for actor ${mockActor_da.id}: ${error.message}`,
                expect.objectContaining({errorDetails: error, stack: error.stack})
            );
        });

        test('should return fallback if llmResponseProcessor.processResponse throws an unexpected error', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const processorError = new Error("ResponseProcessor crashed");
            // MODIFIED: processResponse is now async
            da_llmResponseProcessor.processResponse.mockRejectedValue(processorError);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an internal processing error and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${processorError.message}. Waiting.`);
            expect(capturedLogger_da.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error during decideAction orchestration for actor ${mockActor_da.id}: ${processorError.message}`,
                expect.objectContaining({errorDetails: processorError, stack: processorError.stack})
            );
        });

        test('should return fallback if context.getActor() throws', async () => {
            const actorError = new Error("Failed to retrieve actor from context");
            const faultyContext = {
                getLogger: jest.fn(() => capturedLogger_da),
                getActor: jest.fn(() => {
                    throw actorError;
                })
            };
            const result = await instance_da.decideAction(faultyContext);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an internal processing error and will wait.");
            // ActorId is 'UnknownActor' because context.getActor() failed before actorId could be set.
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for UnknownActor: unhandled_orchestration_error: ${actorError.message}. Waiting.`);
            expect(result.resolvedParameters.actorId).toBe('UnknownActor');
            expect(capturedLogger_da.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error during decideAction orchestration for actor UnknownActor: ${actorError.message}`,
                expect.objectContaining({errorDetails: actorError, stack: actorError.stack})
            );
        });

    });
});

// --- FILE END ---