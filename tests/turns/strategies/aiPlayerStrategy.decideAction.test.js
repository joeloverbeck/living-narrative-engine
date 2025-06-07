// tests/turns/strategies/aiPlayerStrategy.decideAction.test.js
// --- FILE START ---

import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import { AIFallbackActionFactory } from '../../../src/turns/services/AIFallbackActionFactory.js';
import { describe, beforeEach, test, expect, afterEach } from '@jest/globals';
import { DEFAULT_FALLBACK_ACTION } from '../../../src/llms/constants/llmConstants.js';
// AIPromptContentProvider import is not needed here as we are not spying on its static methods anymore.
// import {AIPromptContentProvider} from "../../../src/services/AIPromptContentProvider.js";
import { persistThoughts } from '../../../src/ai/thoughtPersistenceHook.js';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';

// --- Typedefs for Mocks ---
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/types/promptData.js').PromptData} PromptData */
/** @typedef {import('../../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO_Test */
/** @typedef {import('../../../src/turns/interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */
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
 * @returns {jest.Mocked<IAIPromptPipeline>}
 */
const mockAiPromptPipeline = () => ({
  generatePrompt: jest.fn(),
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
  /** @type {ReturnType<typeof mockAiPromptPipeline>} */
  let aiPromptPipeline;
  /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
  let llmResponseProcessor;
  /** @type {ReturnType<typeof mockLogger>} */
  let currentLoggerMock;
  // Removed checkCriticalGameStateSpy as it's no longer used by AIPlayerStrategy.decideAction
  // /** @type {jest.SpyInstance} */
  // let checkCriticalGameStateSpy;

  beforeEach(() => {
    llmAdapter = mockLlmAdapter();
    aiPromptPipeline = mockAiPromptPipeline();
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
    /** @type {ReturnType<typeof mockAiPromptPipeline>} */
    let da_aiPromptPipeline;
    /** @type {ReturnType<typeof mockLlmResponseProcessor>} */
    let da_llmResponseProcessor;
    /** @type {AIFallbackActionFactory} */
    let da_aiFallbackActionFactory;
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
      da_aiPromptPipeline = aiPromptPipeline;
      da_llmResponseProcessor = llmResponseProcessor;
      da_logger = currentLoggerMock;
      da_aiFallbackActionFactory = new AIFallbackActionFactory({
        logger: da_logger,
      });

      instance_da = new AIPlayerStrategy({
        llmAdapter: da_llmAdapter,
        aiPromptPipeline: da_aiPromptPipeline,
        llmResponseProcessor: da_llmResponseProcessor,
        aiFallbackActionFactory: da_aiFallbackActionFactory,
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

      da_aiPromptPipeline.generatePrompt.mockResolvedValue(
        mockFinalPromptString_da
      );
      da_llmAdapter.getAIDecision.mockResolvedValue(mockLlmJsonResponse_da);

      da_llmResponseProcessor.processResponse.mockResolvedValue({
        action: mockProcessedAction_da,
        extractedData: mockExtractedData_da,
      });
    });

    test('should return fallback action if context is null', async () => {
      const error = new Error('Critical - ITurnContext is null.');
      const result = await instance_da.decideAction(null);

      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.commandString).toBe(
        DEFAULT_FALLBACK_ACTION.commandString
      );
      expect(result.action.speech).toBe(
        'I encountered an unexpected issue and will wait for a moment.'
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'unhandled_orchestration_error'
      );
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIFallbackActionFactory: Creating fallback for actor UnknownActor due to unhandled_orchestration_error.',
        expect.any(Object)
      );
    });

    test('should return fallback action if context.getActor() returns null', async () => {
      const context = createLocalMockContext_da(null);
      const error = new Error('Critical - Actor not available in context.');
      const result = await instance_da.decideAction(context);

      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'unhandled_orchestration_error'
      );
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIFallbackActionFactory: Creating fallback for actor UnknownActor due to unhandled_orchestration_error.',
        expect.any(Object)
      );
    });

    test('should return fallback action if actor has no ID', async () => {
      const actorWithoutId = new MockEntity(undefined);
      actorWithoutId.id = null; // Explicitly set id to null
      const context = createLocalMockContext_da(actorWithoutId);
      const error = new Error('Critical - Actor not available in context.');
      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'unhandled_orchestration_error'
      );
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        'AIFallbackActionFactory: Creating fallback for actor UnknownActor due to unhandled_orchestration_error.',
        expect.any(Object)
      );
    });

    test('HAPPY PATH: should orchestrate calls, trigger persistence, and return action from processor', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const result = await instance_da.decideAction(context);

      // --- Orchestration Assertions ---
      expect(da_aiPromptPipeline.generatePrompt).toHaveBeenCalledWith(
        mockActor_da,
        context
      );
      expect(da_llmAdapter.getAIDecision).toHaveBeenCalledWith(
        mockFinalPromptString_da
      );
      expect(da_llmResponseProcessor.processResponse).toHaveBeenCalledWith(
        mockLlmJsonResponse_da,
        mockActor_da.id,
        da_logger
      );

      // --- Persistence Assertions (none expected) ---
      expect(context.getEntityManager).not.toHaveBeenCalled();
      expect(mockEntityManager_da.getEntityInstance).not.toHaveBeenCalled();
      expect(persistThoughts).not.toHaveBeenCalled();
      expect(persistNotes).not.toHaveBeenCalled();

      // --- Final Result Assertions ---
      expect(result).toEqual({
        action: mockProcessedAction_da,
        extractedData: mockExtractedData_da,
      });
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
      const result = await instance_da.decideAction(context);

      expect(result).toEqual({
        action: mockFallbackFromProcessor,
        extractedData: undefined,
      });

      // --- Logger Assertions ---
      expect(da_logger.warn).not.toHaveBeenCalled(); // No warning for this case in the new logic

      // --- Persistence Assertions ---
      expect(persistThoughts).not.toHaveBeenCalled();
      expect(persistNotes).not.toHaveBeenCalled();
    });

    test('should return fallback if aiPromptPipeline.generatePrompt throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('Pipeline Error');
      da_aiPromptPipeline.generatePrompt.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error })
      );
    });

    test('should return fallback if aiPromptPipeline.generatePrompt returns null', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_aiPromptPipeline.generatePrompt.mockResolvedValue(null);
      const error = new Error(
        'PromptBuilder returned an empty or invalid prompt.'
      );

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.speech).toBe(
        'I encountered an unexpected issue and will wait for a moment.'
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.any(Object)
      );
    });

    test('should return fallback if aiPromptPipeline.generatePrompt returns an empty string', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_aiPromptPipeline.generatePrompt.mockResolvedValue('');
      const error = new Error(
        'PromptBuilder returned an empty or invalid prompt.'
      );

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.speech).toBe(
        'I encountered an unexpected issue and will wait for a moment.'
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.any(Object)
      );
    });

    test('should return fallback if aiPromptPipeline.generatePrompt throws error', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('PromptBuilder Error');
      da_aiPromptPipeline.generatePrompt.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error })
      );
    });

    test('should return fallback if llmAdapter.getAIDecision throws', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const error = new Error('LLM Communication Error');
      da_llmAdapter.getAIDecision.mockRejectedValue(error);

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(error.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
        expect.objectContaining({ error })
      );
    });

    test('should return fallback if llmResponseProcessor.processResponse throws an unexpected error', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const processorError = new Error('ResponseProcessor crashed');
      da_llmResponseProcessor.processResponse.mockRejectedValue(processorError);

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(processorError.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor ${mockActor_da.id} due to unhandled_orchestration_error.`,
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
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(result.action.resolvedParameters?.actorId).toBe('UnknownActor');
      expect(
        result.action.resolvedParameters?.diagnostics?.originalMessage
      ).toBe(actorError.message);
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIFallbackActionFactory: Creating fallback for actor UnknownActor due to unhandled_orchestration_error.`,
        expect.objectContaining({ error: actorError })
      );
    });
  });
});

// --- FILE END ---
