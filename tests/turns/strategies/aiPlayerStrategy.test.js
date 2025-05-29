// tests/turns/strategies/aiPlayerStrategy.test.js
// --- FILE START ---

import {AIPlayerStrategy} from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';
import {DEFAULT_FALLBACK_ACTION} from "../../../src/llms/constants/llmConstants.js";
import {AIPromptContentProvider} from "../../../src/services/AIPromptContentProvider.js";

// --- Typedefs for Mocks ---
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../../../src/turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../../src/services/promptBuilder.js').PromptBuilder} PromptBuilder */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/types/promptData.js').PromptData} PromptData */
/** @typedef {import('../../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO_Test */


// --- Mock Implementations ---

/**
 * @returns {jest.Mocked<ILLMAdapter>}
 */
const mockLlmAdapter = () => ({
    getAIDecision: jest.fn(),
    getCurrentActiveLlmId: jest.fn(),
});

/**
 * @returns {jest.Mocked<IAIGameStateProvider>}
 */
const mockGameStateProvider = () => ({
    buildGameState: jest.fn(),
});

/**
 * @returns {jest.Mocked<IAIPromptContentProvider>}
 */
const mockAIPromptContentProvider = () => ({
    getPromptData: jest.fn(),
    // Static methods like checkCriticalGameState are spied on separately
});

/**
 * @returns {jest.Mocked<PromptBuilder>}
 */
const mockPromptBuilder = () => ({
    build: jest.fn(),
});

/**
 * @returns {jest.Mocked<ILLMResponseProcessor>}
 */
const mockLlmResponseProcessor = () => ({
    processResponse: jest.fn(),
});

/**
 * @returns {jest.Mocked<ILogger>}
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
     * @param {Record<string, any>} componentsData
     */
    constructor(id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`, componentsData = {}) {
        this.id = id;
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
    /** @type {ReturnType<typeof mockAIPromptContentProvider>} */
    let promptContentProvider;
    /** @type {ReturnType<typeof mockPromptBuilder>} */
    let promptBuilder;
    /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
    let llmResponseProcessor;
    /** @type {ReturnType<typeof mockLogger>} */
    let currentLoggerMock;
    /** @type {jest.SpyInstance} */
    let checkCriticalGameStateSpy;


    beforeEach(() => {
        llmAdapter = mockLlmAdapter();
        gameStateProvider = mockGameStateProvider();
        promptContentProvider = mockAIPromptContentProvider();
        promptBuilder = mockPromptBuilder();
        llmResponseProcessor = mockLlmResponseProcessor();
        currentLoggerMock = mockLogger();

        jest.clearAllMocks();
        // jest.spyOn(console, 'error').mockImplementation(() => {}); // Uncomment if needed for debugging
        // jest.spyOn(console, 'warn').mockImplementation(() => {});
        // jest.spyOn(console, 'info').mockImplementation(() => {});
        // jest.spyOn(console, 'debug').mockImplementation(() => {});

        checkCriticalGameStateSpy = jest.spyOn(AIPromptContentProvider, 'checkCriticalGameState').mockReturnValue({
            isValid: true,
            errorContent: null
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
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock
            })).not.toThrow();
            const instance = new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock
            });
            expect(instance).toBeInstanceOf(AIPlayerStrategy);
        });

        const commonILLMAdapterError = "AIPlayerStrategy: Constructor requires a valid ILLMAdapter.";
        test('should throw an error if llmAdapter is not provided', () => {
            expect(() => new AIPlayerStrategy({
                gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonILLMAdapterError);
        });
        test('should throw an error if llmAdapter is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: null,
                gameStateProvider,
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock
            })).toThrow(commonILLMAdapterError);
        });
        test('should throw an error if llmAdapter does not have getAIDecision method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: {getCurrentActiveLlmId: jest.fn()},
                gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonILLMAdapterError);
        });
        test('should throw an error if llmAdapter.getAIDecision is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: {getAIDecision: "not-a-function", getCurrentActiveLlmId: jest.fn()},
                gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonILLMAdapterError);
        });
        test('should throw an error if llmAdapter does not have getCurrentActiveLlmId method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: {getAIDecision: jest.fn()},
                gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonILLMAdapterError);
        });
        test('should throw an error if llmAdapter.getCurrentActiveLlmId is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter: {getAIDecision: jest.fn(), getCurrentActiveLlmId: "not-a-function"},
                gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonILLMAdapterError);
        });

        const commonIAIGameStateProviderError = "AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider.";
        test('should throw an error if gameStateProvider is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, promptContentProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonIAIGameStateProviderError);
        });
        test('should throw an error if gameStateProvider is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider: null,
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock
            })).toThrow(commonIAIGameStateProviderError);
        });
        test('should throw an error if gameStateProvider does not have buildGameState method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider: {},
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock
            })).toThrow(commonIAIGameStateProviderError);
        });
        test('should throw an error if gameStateProvider.buildGameState is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider: {buildGameState: "not-a-function"},
                promptContentProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonIAIGameStateProviderError);
        });

        const commonAIPromptContentProviderError = "AIPlayerStrategy: Constructor requires a valid IAIPromptContentProvider with a getPromptData method.";
        test('should throw an error if promptContentProvider is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonAIPromptContentProviderError);
        });
        test('should throw an error if promptContentProvider is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider: null,
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock
            })).toThrow(commonAIPromptContentProviderError);
        });
        test('should throw an error if promptContentProvider does not have getPromptData method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider: {},
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock
            })).toThrow(commonAIPromptContentProviderError);
        });
        test('should throw an error if promptContentProvider.getPromptData is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider,
                promptContentProvider: {getPromptData: "not-a-function"},
                promptBuilder, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonAIPromptContentProviderError);
        });

        const commonPromptBuilderError = "AIPlayerStrategy: Constructor requires a valid PromptBuilder instance.";
        test('should throw an error if promptBuilder is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptContentProvider, llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonPromptBuilderError);
        });
        test('should throw an error if promptBuilder is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider,
                promptBuilder: null,
                llmResponseProcessor,
                logger: currentLoggerMock
            })).toThrow(commonPromptBuilderError);
        });
        test('should throw an error if promptBuilder does not have build method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider,
                promptBuilder: {},
                llmResponseProcessor,
                logger: currentLoggerMock
            })).toThrow(commonPromptBuilderError);
        });
        test('should throw an error if promptBuilder.build is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptContentProvider,
                promptBuilder: {build: "not-a-function"},
                llmResponseProcessor, logger: currentLoggerMock
            })).toThrow(commonPromptBuilderError);
        });

        const commonILLMResponseProcessorError = "AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor.";
        test('should throw an error if llmResponseProcessor is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptContentProvider, promptBuilder, logger: currentLoggerMock
            })).toThrow(commonILLMResponseProcessorError);
        });
        test('should throw an error if llmResponseProcessor is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor: null,
                logger: currentLoggerMock
            })).toThrow(commonILLMResponseProcessorError);
        });
        test('should throw an error if llmResponseProcessor does not have processResponse method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor: {},
                logger: currentLoggerMock
            })).toThrow(commonILLMResponseProcessorError);
        });
        test('should throw an error if llmResponseProcessor.processResponse is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptContentProvider, promptBuilder,
                llmResponseProcessor: {processResponse: "not-a-function"},
                logger: currentLoggerMock
            })).toThrow(commonILLMResponseProcessorError);
        });

        const commonILoggerError = "AIPlayerStrategy: Constructor requires a valid ILogger instance.";
        test('should throw an error if logger is not provided', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor
            })).toThrow(commonILoggerError);
        });
        test('should throw an error if logger is null', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor, logger: null
            })).toThrow(commonILoggerError);
        });
        test('should throw an error if logger does not have an info method', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor,
                logger: {error: jest.fn(), debug: jest.fn(), warn: jest.fn()}
            })).toThrow(commonILoggerError);
        });
        test('should throw an error if logger.info is not a function', () => {
            expect(() => new AIPlayerStrategy({
                llmAdapter, gameStateProvider, promptContentProvider, promptBuilder, llmResponseProcessor,
                logger: {info: "not-a-function"}
            })).toThrow(commonILoggerError);
        });
    });

    describe('_createFallbackAction', () => {
        let instance;
        beforeEach(() => {
            instance = new AIPlayerStrategy({
                llmAdapter,
                gameStateProvider,
                promptContentProvider,
                promptBuilder,
                llmResponseProcessor,
                logger: currentLoggerMock // Use the logger from the outer scope
            });
        });

        test('should create a fallback action with default actorId and given errorContext', () => {
            const errorContext = 'test_error_context';
            const fallbackAction = instance._createFallbackAction(errorContext);
            expect(fallbackAction).toEqual({
                actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
                commandString: DEFAULT_FALLBACK_ACTION.commandString,
                speech: "I encountered an unexpected issue and will wait.",
                resolvedParameters: {
                    errorContext: `AI Error for UnknownActor: ${errorContext}. Waiting.`,
                    actorId: 'UnknownActor',
                },
            });
            expect(currentLoggerMock.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Creating fallback action. Error: "${errorContext}", Actor: UnknownActor`);
        });

        test('should create a fallback action with specified actorId and errorContext', () => {
            const errorContext = 'specific_error';
            const actorId = 'actor123';
            const fallbackAction = instance._createFallbackAction(errorContext, actorId);
            expect(fallbackAction).toEqual({
                actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
                commandString: DEFAULT_FALLBACK_ACTION.commandString,
                speech: "I encountered an unexpected issue and will wait.",
                resolvedParameters: {
                    errorContext: `AI Error for ${actorId}: ${errorContext}. Waiting.`,
                    actorId: actorId,
                },
            });
            expect(currentLoggerMock.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Creating fallback action. Error: "${errorContext}", Actor: ${actorId}`);
        });

        test('should create a fallback action with specific speech for HTTP 500 errors', () => {
            const errorContext = 'Oh no, HTTP error 500 from upstream!';
            const fallbackAction = instance._createFallbackAction(errorContext, 'actorHTTP');
            expect(fallbackAction.speech).toBe("I encountered a connection problem and will wait.");
            expect(currentLoggerMock.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Creating fallback action. Error: "${errorContext}", Actor: actorHTTP`);
        });
    });

    describe('decideAction', () => {
        /** @type {AIPlayerStrategy} */
        let instance_da;
        /** @type {ReturnType<typeof mockLlmAdapter>} */
        let da_llmAdapter;
        /** @type {ReturnType<typeof mockGameStateProvider>} */
        let da_gameStateProvider;
        /** @type {ReturnType<typeof mockAIPromptContentProvider>} */
        let da_promptContentProvider;
        /** @type {ReturnType<typeof mockPromptBuilder>} */
        let da_promptBuilder;
        /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
        let da_llmResponseProcessor;
        /** @type {ReturnType<typeof mockLogger>} */
        let da_logger;

        /** @type {MockEntity} */
        let mockActor_da;
        /** @type {AIGameStateDTO_Test} */
        let mockGameStateDto_da;
        /** @type {PromptData} */
        let mockPromptDataObject_da;
        /** @type {string} */
        let mockFinalPromptString_da;
        /** @type {string} */
        let mockLlmJsonResponse_da;
        /** @type {import('../../../src/turns/interfaces/IActorTurnStrategy.js').ITurnAction} */
        let mockProcessedAction_da;
        /** @type {string} */
        let mockLlmId_da;

        const createLocalMockContext_da = (actorEntity, overrides = {}) => {
            return {
                getActor: jest.fn(() => actorEntity),
                ...overrides,
            };
        };

        beforeEach(() => {
            da_llmAdapter = llmAdapter;
            da_gameStateProvider = gameStateProvider;
            da_promptContentProvider = promptContentProvider;
            da_promptBuilder = promptBuilder;
            da_llmResponseProcessor = llmResponseProcessor;
            da_logger = currentLoggerMock;

            instance_da = new AIPlayerStrategy({
                llmAdapter: da_llmAdapter,
                gameStateProvider: da_gameStateProvider,
                promptContentProvider: da_promptContentProvider,
                promptBuilder: da_promptBuilder,
                llmResponseProcessor: da_llmResponseProcessor,
                logger: da_logger
            });

            mockActor_da = createMockActor('playerTest1');
            mockLlmId_da = 'test-llm-v1';
            mockGameStateDto_da = {
                actorPromptData: {name: 'TestCharacterFromDTO', description: 'A brave tester from DTO.'},
                currentUserInput: "What's that shiny object from DTO?",
                currentLocation: {name: 'The Test Chamber DTO', description: 'A room full of mocks DTO.'},
                perceptionLog: [{event: "Something happened in DTO"}],
                availableActions: [{id: 'act1', name: 'Test Action DTO'}],
                actorState: {id: mockActor_da.id}
            };
            mockPromptDataObject_da = {
                taskDefinitionContent: "Mock Task Def",
                characterPersonaContent: "Mock Persona",
                portrayalGuidelinesContent: "Mock Portrayal",
                contentPolicyContent: "Mock Policy",
                worldContextContent: "Mock World",
                availableActionsInfoContent: "Mock Actions Info",
                userInputContent: "Mock User Input From PromptData",
                finalInstructionsContent: "Mock Final Instr",
                perceptionLogArray: [{event: "Mock event in PromptData"}],
                characterName: "TestCharacterFromPromptData",
                locationName: "The Test Chamber From PromptData"
            };
            mockFinalPromptString_da = 'This is the final test prompt for the LLM.';
            mockLlmJsonResponse_da = JSON.stringify({actionDefinitionId: 'core:interact', target: 'shiny_object'});
            mockProcessedAction_da = {
                actionDefinitionId: 'core:interact',
                resolvedParameters: {target: 'shiny_object'},
                commandString: 'Interact with shiny_object',
                speech: 'I will check this shiny object.'
            };

            da_llmAdapter.getCurrentActiveLlmId.mockResolvedValue(mockLlmId_da);
            da_gameStateProvider.buildGameState.mockResolvedValue(mockGameStateDto_da);
            da_promptContentProvider.getPromptData.mockResolvedValue(mockPromptDataObject_da);
            // checkCriticalGameStateSpy is managed in the outer beforeEach/afterEach

            da_promptBuilder.build.mockResolvedValue(mockFinalPromptString_da);
            da_llmAdapter.getAIDecision.mockResolvedValue(mockLlmJsonResponse_da);
            da_llmResponseProcessor.processResponse.mockResolvedValue(mockProcessedAction_da);
        });

        test('should return fallback action if context is null', async () => {
            const result = await instance_da.decideAction(null);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe('AI Error for UnknownActor: null_turn_context. Waiting.');
            expect(da_logger.error).toHaveBeenCalledWith("AIPlayerStrategy: Critical - ITurnContext is null.");
        });

        test('should return fallback action if context.getActor() returns null', async () => {
            const context = createLocalMockContext_da(null);
            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe('AI Error for UnknownActor: missing_actor_in_context. Waiting.');
            expect(da_logger.error).toHaveBeenCalledWith("AIPlayerStrategy: Critical - Actor not available in context.");
        });

        test('should return fallback action if actor has no ID', async () => {
            const actorWithoutId = new MockEntity(undefined);
            actorWithoutId.id = null;
            const context = createLocalMockContext_da(actorWithoutId);
            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe('AI Error for UnknownActor: missing_actor_in_context. Waiting.');
            expect(da_logger.error).toHaveBeenCalledWith("AIPlayerStrategy: Critical - Actor not available in context.");
        });

        test('should return fallback if llmAdapter.getCurrentActiveLlmId returns null or undefined', async () => {
            da_llmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);
            const context = createLocalMockContext_da(mockActor_da);
            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: missing_active_llm_id. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(`AIPlayerStrategy: Could not determine active LLM ID for actor ${mockActor_da.id}. Cannot build prompt.`);
        });


        test('HAPPY PATH: should orchestrate calls and return action from processor', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const resultAction = await instance_da.decideAction(context);

            expect(da_logger.info).toHaveBeenCalledWith(`AIPlayerStrategy: decideAction for actor ${mockActor_da.id}.`);
            expect(da_llmAdapter.getCurrentActiveLlmId).toHaveBeenCalled();
            expect(da_logger.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Active LLM ID for prompt construction: ${mockLlmId_da}`);
            expect(da_gameStateProvider.buildGameState).toHaveBeenCalledWith(mockActor_da, context, da_logger);

            expect(checkCriticalGameStateSpy).toHaveBeenCalledWith(mockGameStateDto_da, da_logger);

            expect(da_promptContentProvider.getPromptData).toHaveBeenCalledWith(mockGameStateDto_da, da_logger);
            expect(da_logger.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Requesting PromptData from AIPromptContentProvider for actor ${mockActor_da.id}.`);
            expect(da_logger.debug).toHaveBeenCalledWith(`AIPlayerStrategy: promptData received for actor ${mockActor_da.id}. Keys: ${Object.keys(mockPromptDataObject_da).join(', ')}`);

            expect(da_promptBuilder.build).toHaveBeenCalledWith(mockLlmId_da, mockPromptDataObject_da);
            expect(da_logger.info).toHaveBeenCalledWith(`AIPlayerStrategy: Generated final prompt string for actor ${mockActor_da.id} using LLM config for '${mockLlmId_da}'. Length: ${mockFinalPromptString_da.length}.`);
            expect(da_logger.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Final Prompt String for ${mockActor_da.id} (LLM: ${mockLlmId_da}):\n${mockFinalPromptString_da}`);

            expect(da_llmAdapter.getAIDecision).toHaveBeenCalledWith(mockFinalPromptString_da);
            expect(da_logger.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Received LLM JSON response for actor ${mockActor_da.id}: ${mockLlmJsonResponse_da}`);
            expect(da_llmResponseProcessor.processResponse).toHaveBeenCalledWith(mockLlmJsonResponse_da, mockActor_da.id, da_logger);
            expect(resultAction).toBe(mockProcessedAction_da);
            expect(da_logger.error).not.toHaveBeenCalled();
        });

        test('should return fallback if gameStateProvider.buildGameState throws', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const error = new Error("GameStateProvider Error");
            da_gameStateProvider.buildGameState.mockRejectedValue(error);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
                expect.objectContaining({errorDetails: error, stack: error.stack})
            );
        });

        test('should return fallback if promptContentProvider.getPromptData throws', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const error = new Error("GetPromptDataFailed");
            da_promptContentProvider.getPromptData.mockRejectedValue(error);

            const result = await instance_da.decideAction(context);

            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
                expect.objectContaining({errorDetails: error, stack: error.stack})
            );
        });

        test('should still call static checkCriticalGameState even if getPromptData is going to throw', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const criticalErrorMsg = "getPromptData deliberately failed";
            da_promptContentProvider.getPromptData.mockRejectedValue(new Error(criticalErrorMsg));

            await instance_da.decideAction(context); // We expect it to fail and return fallback

            // Verify the static check was still called by AIPlayerStrategy
            expect(checkCriticalGameStateSpy).toHaveBeenCalledWith(mockGameStateDto_da, da_logger);
        });


        test('should return fallback if promptBuilder.build returns null', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            da_promptBuilder.build.mockResolvedValue(null);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: prompt_builder_empty_result. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(`AIPlayerStrategy: PromptBuilder returned an empty or invalid prompt for LLM ${mockLlmId_da}, actor ${mockActor_da.id}.`);
        });

        test('should return fallback if promptBuilder.build returns an empty string', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            da_promptBuilder.build.mockResolvedValue('');

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.speech).toBe("I encountered an unexpected issue and will wait.");
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: prompt_builder_empty_result. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(`AIPlayerStrategy: PromptBuilder returned an empty or invalid prompt for LLM ${mockLlmId_da}, actor ${mockActor_da.id}.`);
        });

        test('should return fallback if promptBuilder.build throws', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const error = new Error("PromptBuilder Error");
            da_promptBuilder.build.mockRejectedValue(error);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
                expect.objectContaining({errorDetails: error, stack: error.stack})
            );
        });

        test('should return fallback if llmAdapter.getAIDecision throws', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const error = new Error("LLM Communication Error");
            da_llmAdapter.getAIDecision.mockRejectedValue(error);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
                expect.objectContaining({errorDetails: error, stack: error.stack})
            );
        });

        test('should return fallback if llmResponseProcessor.processResponse throws an unexpected error', async () => {
            const context = createLocalMockContext_da(mockActor_da);
            const processorError = new Error("ResponseProcessor crashed");
            da_llmResponseProcessor.processResponse.mockRejectedValue(processorError);

            const result = await instance_da.decideAction(context);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${processorError.message}. Waiting.`);
            expect(da_logger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${processorError.message}`,
                expect.objectContaining({errorDetails: processorError, stack: processorError.stack})
            );
        });

        test('should return fallback if context.getActor() throws', async () => {
            const actorError = new Error("Failed to retrieve actor from context");
            const faultyContext = {
                getActor: jest.fn(() => {
                    throw actorError;
                })
            };
            // Re-initialize instance_da to ensure logger is correctly passed if it matters for this specific path
            // Though logger is mainly used after actorId is determined or defaulted.
            instance_da = new AIPlayerStrategy({
                llmAdapter: da_llmAdapter,
                gameStateProvider: da_gameStateProvider,
                promptContentProvider: da_promptContentProvider,
                promptBuilder: da_promptBuilder,
                llmResponseProcessor: da_llmResponseProcessor,
                logger: da_logger
            });

            const result = await instance_da.decideAction(faultyContext);
            expect(result.actionDefinitionId).toBe(DEFAULT_FALLBACK_ACTION.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe(`AI Error for UnknownActor: unhandled_orchestration_error: ${actorError.message}. Waiting.`);
            expect(result.resolvedParameters.actorId).toBe('UnknownActor');
            expect(da_logger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error for actor UnknownActor: ${actorError.message}`,
                expect.objectContaining({errorDetails: actorError, stack: actorError.stack})
            );
        });
    });
});

// --- FILE END ---