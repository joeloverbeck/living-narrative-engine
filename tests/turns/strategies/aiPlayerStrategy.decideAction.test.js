// tests/turns/strategies/aiPlayerStrategy.decideAction.test.js
// --- FILE START ---

import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';
import { DEFAULT_FALLBACK_ACTION } from '../../../src/llms/constants/llmConstants.js';
// AIPromptContentProvider import is not needed here as we are not spying on its static methods anymore.
// import {AIPromptContentProvider} from "../../../src/services/AIPromptContentProvider.js";

// --- Typedefs for Mocks ---
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../../../src/turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../../src/prompting/promptBuilder.js').PromptBuilder} PromptBuilder */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/types/promptData.js').PromptData} PromptData */
/** @typedef {import('../../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO_Test */
/** @typedef {import('../../../src/turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */

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
  // validateGameStateForPrompting: jest.fn(), // Not spied on/called directly by AIPlayerStrategy
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
   * @param {string | undefined} id
   * @param {Record<string, any>} componentsData
   */
  constructor(
    id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`,
    componentsData = {}
  ) {
    this.id = id;
    // @ts-ignore
    this.name = componentsData.name?.text || `Mock Entity ${id}`;
  }
}

/**
 * Creates a mock actor instance.
 *
 * @param {string} [id]
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
  // Removed checkCriticalGameStateSpy as it's no longer used by AIPlayerStrategy.decideAction
  // /** @type {jest.SpyInstance} */
  // let checkCriticalGameStateSpy;

  beforeEach(() => {
    llmAdapter = mockLlmAdapter();
    gameStateProvider = mockGameStateProvider();
    promptContentProvider = mockAIPromptContentProvider();
    promptBuilder = mockPromptBuilder();
    llmResponseProcessor = mockLlmResponseProcessor();
    currentLoggerMock = mockLogger();

    jest.clearAllMocks();
    // The spy on AIPromptContentProvider.checkCriticalGameState is removed.
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    /**
     * @param {MockEntity | null} actorEntity
     * @param {Partial<ITurnContext>} [overrides]
     * @returns {ITurnContext}
     */
    const createLocalMockContext_da = (actorEntity, overrides = {}) => {
      // @ts-ignore
      return {
        getActor: jest.fn(() => actorEntity),
        getLogger: jest.fn(() => da_logger), // Ensure context provides logger if needed by tested code path
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
        logger: da_logger,
      });

      mockActor_da = createMockActor('playerTest1');
      mockLlmId_da = 'test-llm-v1';
      // @ts-ignore
      mockGameStateDto_da = {
        actorPromptData: {
          name: 'TestCharacterFromDTO',
          description: 'A brave tester from DTO.',
        },
        currentUserInput: "What's that shiny object from DTO?",
        currentLocation: {
          name: 'The Test Chamber DTO',
          description: 'A room full of mocks DTO.',
          exits: [],
          characters: [],
        },
        perceptionLog: [
          {
            description: 'Something happened in DTO',
            type: 'generic',
            timestamp: Date.now(),
          },
        ],
        availableActions: [
          {
            id: 'act1',
            command: 'do act1',
            name: 'Test Action DTO',
            description: 'Test Action Desc DTO',
          },
        ],
        actorState: { id: mockActor_da.id },
      };
      // @ts-ignore
      mockPromptDataObject_da = {
        taskDefinitionContent: 'Mock Task Def',
        characterPersonaContent: 'Mock Persona',
        portrayalGuidelinesContent: 'Mock Portrayal',
        contentPolicyContent: 'Mock Policy',
        worldContextContent: 'Mock World',
        availableActionsInfoContent: 'Mock Actions Info',
        userInputContent: 'Mock User Input From PromptData',
        finalInstructionsContent: 'Mock Final Instr',
        perceptionLogArray: [
          {
            description: 'Mock event in PromptData',
            type: 'generic',
            timestamp: Date.now(),
          },
        ],
        characterName: 'TestCharacterFromPromptData',
        locationName: 'The Test Chamber From PromptData',
      };
      mockFinalPromptString_da = 'This is the final test prompt for the LLM.';
      mockLlmJsonResponse_da = JSON.stringify({
        actionDefinitionId: 'core:interact',
        target: 'shiny_object',
      });
      mockProcessedAction_da = {
        actionDefinitionId: 'core:interact',
        resolvedParameters: { target: 'shiny_object' },
        commandString: 'Interact with shiny_object',
        speech: 'I will check this shiny object.',
      };

      da_llmAdapter.getCurrentActiveLlmId.mockResolvedValue(mockLlmId_da);
      da_gameStateProvider.buildGameState.mockResolvedValue(
        mockGameStateDto_da
      );
      da_promptContentProvider.getPromptData.mockResolvedValue(
        mockPromptDataObject_da
      );

      da_promptBuilder.build.mockResolvedValue(mockFinalPromptString_da);
      da_llmAdapter.getAIDecision.mockResolvedValue(mockLlmJsonResponse_da);
      da_llmResponseProcessor.processResponse.mockResolvedValue(
        mockProcessedAction_da
      );
    });

    test('should return fallback action if context is null', async () => {
      const result = await instance_da.decideAction(null);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
      expect(result.speech).toBe(
        'I encountered an unexpected issue and will wait.'
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        'AI Error for UnknownActor: null_turn_context. Waiting.'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIPlayerStrategy: Critical - ITurnContext is null.'
      );
    });

    test('should return fallback action if context.getActor() returns null', async () => {
      const context = createLocalMockContext_da(null);
      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        'AI Error for UnknownActor: missing_actor_in_context. Waiting.'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIPlayerStrategy: Critical - Actor not available in context.'
      );
    });

    test('should return fallback action if actor has no ID', async () => {
      const actorWithoutId = new MockEntity(undefined);
      actorWithoutId.id = null; // Explicitly set id to null
      const context = createLocalMockContext_da(actorWithoutId);
      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        'AI Error for UnknownActor: missing_actor_in_context. Waiting.'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIPlayerStrategy: Critical - Actor not available in context.'
      );
    });

    test('should return fallback if llmAdapter.getCurrentActiveLlmId returns null or undefined', async () => {
      da_llmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);
      const context = createLocalMockContext_da(mockActor_da);
      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: missing_active_llm_id. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Could not determine active LLM ID for actor ${mockActor_da.id}. Cannot build prompt.`
      );
    });

    test('HAPPY PATH: should orchestrate calls and return action from processor', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const resultAction = await instance_da.decideAction(context);

      expect(da_logger.info).toHaveBeenCalledWith(
        `AIPlayerStrategy: decideAction for actor ${mockActor_da.id}.`
      );
      expect(da_llmAdapter.getCurrentActiveLlmId).toHaveBeenCalled();
      expect(da_logger.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: Active LLM ID for prompt construction: ${mockLlmId_da}`
      );
      expect(da_gameStateProvider.buildGameState).toHaveBeenCalledWith(
        mockActor_da,
        context,
        da_logger
      );

      // The direct call to checkCriticalGameState is removed from AIPlayerStrategy, so this assertion is removed.
      // expect(checkCriticalGameStateSpy).toHaveBeenCalledWith(mockGameStateDto_da, da_logger);

      expect(da_promptContentProvider.getPromptData).toHaveBeenCalledWith(
        mockGameStateDto_da,
        da_logger
      );
      expect(da_logger.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: Requesting PromptData from AIPromptContentProvider for actor ${mockActor_da.id}.`
      );
      expect(da_logger.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: promptData received for actor ${mockActor_da.id}. Keys: ${Object.keys(mockPromptDataObject_da).join(', ')}`
      );

      expect(da_promptBuilder.build).toHaveBeenCalledWith(
        mockLlmId_da,
        mockPromptDataObject_da
      );
      expect(da_logger.info).toHaveBeenCalledWith(
        `AIPlayerStrategy: Generated final prompt string for actor ${mockActor_da.id} using LLM config for '${mockLlmId_da}'. Length: ${mockFinalPromptString_da.length}.`
      );
      expect(da_logger.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: Final Prompt String for ${mockActor_da.id} (LLM: ${mockLlmId_da}):\n${mockFinalPromptString_da}`
      );

      expect(da_llmAdapter.getAIDecision).toHaveBeenCalledWith(
        mockFinalPromptString_da
      );
      expect(da_logger.debug).toHaveBeenCalledWith(
        `AIPlayerStrategy: Received LLM JSON response for actor ${mockActor_da.id}: ${mockLlmJsonResponse_da}`
      );
      expect(da_llmResponseProcessor.processResponse).toHaveBeenCalledWith(
        mockLlmJsonResponse_da,
        mockActor_da.id,
        da_logger
      );
      expect(resultAction).toBe(mockProcessedAction_da);
      expect(da_logger.error).not.toHaveBeenCalled();
    });

    test('should return fallback if gameStateProvider.buildGameState throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('GameStateProvider Error');
      da_gameStateProvider.buildGameState.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
        expect.objectContaining({ errorDetails: error, stack: error.stack })
      );
    });

    test('should return fallback if promptContentProvider.getPromptData throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('GetPromptDataFailedDueToValidationOrOther'); // Renamed for clarity
      da_promptContentProvider.getPromptData.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);

      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
        expect.objectContaining({ errorDetails: error, stack: error.stack })
      );
      // Ensure buildGameState was called before getPromptData
      expect(da_gameStateProvider.buildGameState).toHaveBeenCalledWith(
        mockActor_da,
        context,
        da_logger
      );
    });

    // This test is obsolete as the static method is no longer called directly by AIPlayerStrategy
    // test('should still call static checkCriticalGameState even if getPromptData is going to throw', async () => { ... });

    test('should return fallback if promptBuilder.build returns null', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_promptBuilder.build.mockResolvedValue(null);

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.speech).toBe(
        'I encountered an unexpected issue and will wait.'
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: prompt_builder_empty_result. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: PromptBuilder returned an empty or invalid prompt for LLM ${mockLlmId_da}, actor ${mockActor_da.id}.`
      );
    });

    test('should return fallback if promptBuilder.build returns an empty string', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_promptBuilder.build.mockResolvedValue('');

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.speech).toBe(
        'I encountered an unexpected issue and will wait.'
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: prompt_builder_empty_result. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: PromptBuilder returned an empty or invalid prompt for LLM ${mockLlmId_da}, actor ${mockActor_da.id}.`
      );
    });

    test('should return fallback if promptBuilder.build throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('PromptBuilder Error');
      da_promptBuilder.build.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
        expect.objectContaining({ errorDetails: error, stack: error.stack })
      );
    });

    test('should return fallback if llmAdapter.getAIDecision throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('LLM Communication Error');
      da_llmAdapter.getAIDecision.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${error.message}. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${error.message}`,
        expect.objectContaining({ errorDetails: error, stack: error.stack })
      );
    });

    test('should return fallback if llmResponseProcessor.processResponse throws an unexpected error', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const processorError = new Error('ResponseProcessor crashed');
      da_llmResponseProcessor.processResponse.mockRejectedValue(processorError);

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for ${mockActor_da.id}: unhandled_orchestration_error: ${processorError.message}. Waiting.`
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Unhandled error for actor ${mockActor_da.id}: ${processorError.message}`,
        expect.objectContaining({
          errorDetails: processorError,
          stack: processorError.stack,
        })
      );
    });

    test('should return fallback if context.getActor() throws', async () => {
      const actorError = new Error('Failed to retrieve actor from context');
      const faultyContext = {
        getActor: jest.fn(() => {
          throw actorError;
        }),
        getLogger: jest.fn(() => da_logger),
      };

      // @ts-ignore
      const result = await instance_da.decideAction(faultyContext);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.errorContext).toBe(
        `AI Error for UnknownActor: unhandled_orchestration_error: ${actorError.message}. Waiting.`
      );
      // @ts-ignore
      expect(result.resolvedParameters?.actorId).toBe('UnknownActor');
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Unhandled error for actor UnknownActor: ${actorError.message}`,
        expect.objectContaining({
          errorDetails: actorError,
          stack: actorError.stack,
        })
      );
    });
  });
});

// --- FILE END ---
