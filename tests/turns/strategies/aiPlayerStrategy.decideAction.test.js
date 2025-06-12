/**
 * @file This test proves the proper behavior of decideAction, that involves LLMs.
 * @see tests/turns/strategies/aiPlayerStrategy.decideAction.test.js
 */

import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import { AIFallbackActionFactory } from '../../../src/turns/services/AIFallbackActionFactory.js';
import { describe, beforeEach, test, expect, afterEach } from '@jest/globals';
import { DEFAULT_FALLBACK_ACTION } from '../../../src/llms/constants/llmConstants.js';
import { persistThoughts } from '../../../src/ai/thoughtPersistenceHook.js';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';

// --- Typedefs for Mocks ---
/** @typedef {import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../../src/prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../../../src/turns/interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../src/interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../src/interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/** @typedef {import('../../../src/turns/interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} DiscoveredActionInfo */

// --- Mocking Persistence Hooks ---
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
 * @param {string} [id]
 * @returns {MockEntity}
 */
const createMockActor = (id = 'actor1') => {
  return new MockEntity(id, { name: { text: `Mock Entity ${id}` } });
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

  beforeEach(() => {
    llmAdapter = mockLlmAdapter();
    aiPromptPipeline = mockAiPromptPipeline();
    llmResponseProcessor = mockLlmResponseProcessor();
    currentLoggerMock = mockLogger();
    jest.clearAllMocks();
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
    /** @type {DiscoveredActionInfo[]} */
    let mockDiscoveredActions;
    /** @type {import('../../../src/turns/interfaces/IActorTurnStrategy.js').ITurnAction} */
    let mockProcessedAction_da;
    /** @type {{speech: string | null}} */
    let mockExtractedData_da;
    /** @type {jest.Mocked<IEntityManager>} */
    let mockEntityManager_da;
    /** @type {jest.Mocked<IActionDiscoveryService>} */
    let mockActionDiscoveryService_da;

    /**
     * @param {MockEntity | null} actorEntity
     * @param {Partial<ITurnContext>} [overrides]
     * @returns {ITurnContext}
     */
    const createLocalMockContext_da = (actorEntity, overrides = {}) => {
      mockEntityManager_da = {
        getEntityInstance: jest.fn().mockReturnValue(actorEntity),
      };

      mockActionDiscoveryService_da = {
        getValidActions: jest.fn().mockResolvedValue(mockDiscoveredActions),
      };

      // @ts-ignore
      return {
        getActor: jest.fn(() => actorEntity),
        getLogger: jest.fn(() => da_logger),
        getEntityManager: jest.fn(() => mockEntityManager_da),
        getActionDiscoveryService: jest
          .fn()
          .mockReturnValue(mockActionDiscoveryService_da),
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

      mockDiscoveredActions = [
        {
          id: 'core:interact',
          command: 'Interact with shiny_object',
          name: 'Interact',
          description: 'Check out the shiny object.',
          params: { target: 'shiny_object' },
        },
        {
          id: 'core:wait',
          command: 'wait',
          name: 'Wait',
          description: 'Do nothing.',
          params: {},
        },
      ];

      const mockFinalPromptString_da =
        'This is the final test prompt for the LLM.';
      const mockLlmJsonResponse_da = JSON.stringify({
        chosenIndex: 1,
        speech: 'I will check this shiny object.',
      });

      mockProcessedAction_da = {
        actionDefinitionId: 'core:interact',
        resolvedParameters: { target: 'shiny_object' },
        commandString: 'Interact with shiny_object',
        speech: 'I will check this shiny object.',
      };

      mockExtractedData_da = {
        speech: 'I will check this shiny object.',
      };

      da_aiPromptPipeline.generatePrompt.mockResolvedValue(
        mockFinalPromptString_da
      );
      da_llmAdapter.getAIDecision.mockResolvedValue(mockLlmJsonResponse_da);

      da_llmResponseProcessor.processResponse.mockResolvedValue({
        action: {
          chosenIndex: 1,
          speech: 'I will check this shiny object.',
        },
        extractedData: {
          speech: 'I will check this shiny object.',
        },
      });
    });

    // --- FIXED TEST ---
    test('should throw if context is null', async () => {
      await expect(instance_da.decideAction(null)).rejects.toThrow(
        'AIPlayerStrategy received an invalid ITurnContext.'
      );
    });

    // --- FIXED TEST ---
    test('should throw if context.getActor() returns null', async () => {
      const context = createLocalMockContext_da(null);
      await expect(instance_da.decideAction(context)).rejects.toThrow(
        'AIPlayerStrategy could not retrieve a valid actor from the context.'
      );
    });

    // --- FIXED TEST ---
    test('should throw if actor has no ID', async () => {
      const actorWithoutId = new MockEntity(undefined);
      // @ts-ignore
      actorWithoutId.id = null; // Explicitly set id to null
      const context = createLocalMockContext_da(actorWithoutId);
      await expect(instance_da.decideAction(context)).rejects.toThrow(
        'AIPlayerStrategy could not retrieve a valid actor from the context.'
      );
    });

    test('HAPPY PATH: should orchestrate calls and return action from processor', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const result = await instance_da.decideAction(context);

      expect(context.getActionDiscoveryService).toHaveBeenCalled();
      expect(
        mockActionDiscoveryService_da.getValidActions
      ).toHaveBeenCalledWith(mockActor_da, context);

      const internalActionComposites =
        da_aiPromptPipeline.generatePrompt.mock.calls[0][2];
      expect(internalActionComposites[0].actionId).toBe(
        mockDiscoveredActions[0].id
      );

      expect(da_llmAdapter.getAIDecision).toHaveBeenCalledWith(
        expect.any(String)
      );
      expect(da_llmResponseProcessor.processResponse).toHaveBeenCalledWith(
        expect.any(String),
        mockActor_da.id
      );

      // This part of the test now depends on the mock for llmResponseProcessor
      const llmResponseProcessorResult =
        await da_llmResponseProcessor.processResponse.mock.results[0].value;

      const chosenActionIndex =
        llmResponseProcessorResult.action.chosenIndex - 1; // Adjust for 0-based index
      const chosenDiscoveredAction = mockDiscoveredActions[chosenActionIndex];

      const expectedTurnAction = {
        actionDefinitionId: chosenDiscoveredAction.id,
        resolvedParameters: chosenDiscoveredAction.params,
        commandString: chosenDiscoveredAction.command,
        speech: llmResponseProcessorResult.action.speech,
      };

      expect(result.action).toEqual(expectedTurnAction);
      expect(result.extractedData).toEqual(
        llmResponseProcessorResult.extractedData
      );
      expect(da_logger.error).not.toHaveBeenCalled();
    });

    test('should correctly build turn action when processor returns no speech', async () => {
      da_llmResponseProcessor.processResponse.mockResolvedValue({
        action: { chosenIndex: 1, speech: null },
        extractedData: { speech: null },
      });

      const context = createLocalMockContext_da(mockActor_da);
      const result = await instance_da.decideAction(context);

      const expectedAction = {
        actionDefinitionId: mockDiscoveredActions[0].id,
        commandString: mockDiscoveredActions[0].command,
        resolvedParameters: mockDiscoveredActions[0].params,
      };

      expect(result.action).toEqual(expectedAction);
      expect(result.extractedData).toEqual({ speech: null });
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
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'unhandled_strategy_error'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Critical error during action decision for actor ${mockActor_da.id}.`,
        error
      );
    });

    test('should return fallback if aiPromptPipeline.generatePrompt returns null', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_aiPromptPipeline.generatePrompt.mockResolvedValue(null);
      const error = new Error(
        'AIPromptPipeline returned an empty or invalid prompt.'
      );

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.isFallback).toBe(true);
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'unhandled_strategy_error'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Critical error during action decision for actor ${mockActor_da.id}.`,
        error
      );
    });

    test('should return fallback if aiPromptPipeline.generatePrompt returns an empty string', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      da_aiPromptPipeline.generatePrompt.mockResolvedValue('');
      const error = new Error(
        'AIPromptPipeline returned an empty or invalid prompt.'
      );

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'unhandled_strategy_error'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Critical error during action decision for actor ${mockActor_da.id}.`,
        error
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
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'unhandled_strategy_error'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Critical error during action decision for actor ${mockActor_da.id}.`,
        error
      );
    });

    test('should return fallback if llmResponseProcessor.processResponse throws an unexpected error', async () => {
      const context = createLocalMockContext_da(mockActor_da);
      const processorError = new Error('ResponseProcessor crashed');
      processorError.name = 'LLMProcessingError';
      da_llmResponseProcessor.processResponse.mockRejectedValue(processorError);

      const result = await instance_da.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters?.failureReason).toBe(
        'llm_response_processing'
      );
      expect(da_logger.error).toHaveBeenCalledWith(
        `AIPlayerStrategy: Critical error during action decision for actor ${mockActor_da.id}.`,
        processorError
      );
    });

    // --- FIXED TEST ---
    test('should throw if context.getActor() throws', async () => {
      const actorError = new Error('Failed to retrieve actor from context');
      const faultyContext = {
        getActor: jest.fn(() => {
          throw actorError;
        }),
        getLogger: jest.fn(() => da_logger),
      };

      await expect(
        // @ts-ignore
        instance_da.decideAction(faultyContext)
      ).rejects.toThrow(actorError);
    });
  });
});
