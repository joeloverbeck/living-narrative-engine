// tests/turns/strategies/aiPlayerStrategy.decideAction.test.js
// --- FILE START ---

import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import { describe, beforeEach, test, expect, afterEach } from '@jest/globals';
import { DEFAULT_FALLBACK_ACTION } from '../../../src/llms/constants/llmConstants.js';
// AIPromptContentProvider import is not needed here as we are not spying on its static methods anymore.
// import {AIPromptContentProvider} from "../../../src/services/AIPromptContentProvider.js";
import { persistThoughts } from '../../../src/ai/thoughtPersistenceHook.js';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';

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
/** @typedef {import('../../../src/interfaces/coreServices.js').IEntityManager} IEntityManager */

// --- Mocking Persistence Hooks ---
// These are hoisted by Jest and will run before imports are resolved.
// They must rely on the global `jest` object.
jest.mock('../../../src/ai/thoughtPersistenceHook.js', () => ({
  persistThoughts: jest.fn(),
}));
jest.mock('../../../src/ai/notesPersistenceHook.js', () => ({
  persistNotes: jest.fn(),
}));

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
    /** @type {{thoughts: string, notes: string[]}} */
    let mockExtractedData_da;
    /** @type {jest.Mocked<IEntityManager>} */
    let mockEntityManager_da;

    /**
     * @param {MockEntity | null} actorEntity
     * @param {Partial<ITurnContext>} [overrides]
     * @returns {ITurnContext}
     */
    const createLocalMockContext_da = (actorEntity, overrides = {}) => {
      mockEntityManager_da = {
        getEntityInstance: jest.fn().mockReturnValue(actorEntity),
      };
      // @ts-ignore
      return {
        getActor: jest.fn(() => actorEntity),
        getLogger: jest.fn(() => da_logger), // Ensure context provides logger if needed by tested code path
        getEntityManager: jest.fn(() => mockEntityManager_da),
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

      mockExtractedData_da = {
        thoughts: 'I should examine this object.',
        notes: ['This object is shiny.', 'It might be important.'],
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

      da_llmResponseProcessor.processResponse.mockResolvedValue({
        action: mockProcessedAction_da,
        extractedData: mockExtractedData_da,
      });
    });

    test('should return fallback action if context is null', async () => {
      const error = new Error('Critical - ITurnContext is null.');
      const result = await instance_da.decideAction(null);

      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.commandString).toBe(DEFAULT_FALLBACK_ACTION.commandString);
      expect(result.speech).toBe(
        'I encountered an unexpected issue and will wait for a moment.'
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.failureReason).toBe(
        'unhandled_orchestration_error'
      );
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIPlayerStrategy: Creating canonical fallback action for actor UnknownActor due to unhandled_orchestration_error.',
        expect.any(Object)
      );
    });

    test('should return fallback action if context.getActor() returns null', async () => {
      const context = createLocalMockContext_da(null);
      const error = new Error('Critical - Actor not available in context.');
      const result = await instance_da.decideAction(context);

      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.failureReason).toBe(
        'unhandled_orchestration_error'
      );
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIPlayerStrategy: Creating canonical fallback action for actor UnknownActor due to unhandled_orchestration_error.',
        expect.any(Object)
      );
    });

    test('should return fallback action if actor has no ID', async () => {
      const actorWithoutId = new MockEntity(undefined);
      actorWithoutId.id = null; // Explicitly set id to null
      const context = createLocalMockContext_da(actorWithoutId);
      const error = new Error('Critical - Actor not available in context.');
      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.failureReason).toBe(
        'unhandled_orchestration_error'
      );
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIPlayerStrategy: Creating canonical fallback action for actor UnknownActor due to unhandled_orchestration_error.',
        expect.any(Object)
      );
    });

    test('should return fallback if llmAdapter.getCurrentActiveLlmId returns null or undefined', async () => {
      da_llmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('Could not determine active LLM ID.');
      const result = await instance_da.decideAction(context);

      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.failureReason).toBe(
        'unhandled_orchestration_error'
      );
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.any(Object)
      );
    });

    test('HAPPY PATH: should orchestrate calls, trigger persistence, and return action from processor', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const resultAction = await instance_da.decideAction(context);

      // --- Orchestration Assertions ---
      expect(da_logger.info).toHaveBeenCalledWith(
        `AIPlayerStrategy: decideAction for actor ${mockActor_da.id}.`
      );
      expect(da_llmAdapter.getCurrentActiveLlmId).toHaveBeenCalled();
      expect(da_gameStateProvider.buildGameState).toHaveBeenCalledWith(
        mockActor_da,
        context,
        da_logger
      );
      expect(da_promptContentProvider.getPromptData).toHaveBeenCalledWith(
        mockGameStateDto_da,
        da_logger
      );
      expect(da_promptBuilder.build).toHaveBeenCalledWith(
        mockLlmId_da,
        mockPromptDataObject_da
      );
      expect(da_llmAdapter.getAIDecision).toHaveBeenCalledWith(
        mockFinalPromptString_da
      );
      expect(da_llmResponseProcessor.processResponse).toHaveBeenCalledWith(
        mockLlmJsonResponse_da,
        mockActor_da.id,
        da_logger
      );

      // --- Persistence Assertions ---
      expect(context.getEntityManager).toHaveBeenCalled();
      expect(mockEntityManager_da.getEntityInstance).toHaveBeenCalledWith(
        mockActor_da.id
      );
      expect(persistThoughts).toHaveBeenCalledWith(
        { thoughts: mockExtractedData_da.thoughts },
        mockActor_da,
        da_logger
      );
      expect(persistNotes).toHaveBeenCalledWith(
        { notes: mockExtractedData_da.notes },
        mockActor_da,
        da_logger
      );

      // --- Final Result Assertions ---
      expect(resultAction).toEqual(mockProcessedAction_da);
      expect(da_logger.error).not.toHaveBeenCalled();
    });

    test('should not call persistence hooks when processor returns a fallback without extracted data', async () => {
      const mockFallbackFromProcessor = {
        actionDefinitionId: 'core:wait',
        commandString: 'wait',
        speech: 'Processor decided to wait.',
        resolvedParameters: { errorContext: 'processor_internal_logic' },
      };
      // Simulate a "soft fail" where the processor returns a fallback, but doesn't throw
      da_llmResponseProcessor.processResponse.mockResolvedValue({
        action: mockFallbackFromProcessor,
        extractedData: undefined, // No thoughts/notes
      });

      const context = createLocalMockContext_da(mockActor_da);
      const resultAction = await instance_da.decideAction(context);

      expect(resultAction).toEqual(mockFallbackFromProcessor);

      // --- Logger Assertions ---
      expect(da_logger.warn).not.toHaveBeenCalled(); // No warning for this case in the new logic

      // --- Persistence Assertions ---
      expect(persistThoughts).not.toHaveBeenCalled();
      expect(persistNotes).not.toHaveBeenCalled();
    });

    test('should return fallback if gameStateProvider.buildGameState throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('GameStateProvider Error');
      da_gameStateProvider.buildGameState.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error })
      );
    });

    test('should return fallback if promptContentProvider.getPromptData throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('GetPromptDataFailedDueToValidationOrOther');
      da_promptContentProvider.getPromptData.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);

      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error })
      );
      // Ensure buildGameState was called before getPromptData
      expect(da_gameStateProvider.buildGameState).toHaveBeenCalledWith(
        mockActor_da,
        context,
        da_logger
      );
    });

    test('should return fallback if promptBuilder.build returns null', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_promptBuilder.build.mockResolvedValue(null);
      const error = new Error(
        'PromptBuilder returned an empty or invalid prompt.'
      );

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.speech).toBe(
        'I encountered an unexpected issue and will wait for a moment.'
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.any(Object)
      );
    });

    test('should return fallback if promptBuilder.build returns an empty string', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_promptBuilder.build.mockResolvedValue('');
      const error = new Error(
        'PromptBuilder returned an empty or invalid prompt.'
      );

      const result = await instance_da.decideAction(context);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.speech).toBe(
        'I encountered an unexpected issue and will wait for a moment.'
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.any(Object)
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
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error })
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
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        error.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error })
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
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        processorError.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error: processorError })
      );
    });

    test('should return fallback if context.getActor() throws', async () => {
      const actorError = new Error('Failed to retrieve actor from context');
      const faultyContext = {
        getActor: jest.fn(() => {
          throw actorError;
        }),
        getLogger: jest.fn(() => da_logger),
        getEntityManager: jest.fn(),
      };

      // @ts-ignore
      const result = await instance_da.decideAction(faultyContext);
      expect(result.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.resolvedParameters?.isFallback).toBe(true);
      expect(result.resolvedParameters?.actorId).toBe('UnknownActor');
      expect(result.resolvedParameters?.diagnostics?.originalMessage).toBe(
        actorError.message
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Creating canonical fallback action for actor UnknownActor due to unhandled_orchestration_error.`,
        expect.objectContaining({ error: actorError })
      );
    });
  });
});

// --- FILE END ---
