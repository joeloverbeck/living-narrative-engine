/**
 * @file This test proves the proper behavior of decideAction, that involves LLMs.
 */

import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import { AIFallbackActionFactory } from '../../../src/turns/services/AIFallbackActionFactory.js';
import {
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
  jest,
} from '@jest/globals';
import { DEFAULT_FALLBACK_ACTION } from '../../../src/llms/constants/llmConstants.js';

// --- Mocking Persistence Hooks ---
jest.mock('../../../src/ai/thoughtPersistenceHook.js', () => ({
  persistThoughts: jest.fn(),
}));
jest.mock('../../../src/ai/notesPersistenceHook.js', () => ({
  persistNotes: jest.fn(),
}));

// --- Mock Implementations ---
const mockLlmAdapter = () => ({
  getAIDecision: jest.fn(),
  getCurrentActiveLlmId: jest.fn(),
});
const mockAiPromptPipeline = () => ({ generatePrompt: jest.fn() });
const mockLlmResponseProcessor = () => ({ processResponse: jest.fn() });
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class MockEntity {
  constructor(
    id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`
  ) {
    this.id = id;
  }
}

const createMockActor = (id = 'actor1') => new MockEntity(id);

describe('AIPlayerStrategy', () => {
  let llmAdapter, aiPromptPipeline, llmResponseProcessor, logger;

  beforeEach(() => {
    jest.clearAllMocks();
    llmAdapter = mockLlmAdapter();
    aiPromptPipeline = mockAiPromptPipeline();
    llmResponseProcessor = mockLlmResponseProcessor();
    logger = mockLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('decideAction', () => {
    let instance;
    let mockActionDiscoveryService;
    let mockActionIndexingService;
    let fallbackFactory;
    let mockActor;
    let mockDiscoveredActions;

    beforeEach(() => {
      mockDiscoveredActions = [
        {
          id: 'core:interact',
          command: 'Interact with shiny_object',
          params: { target: 'shiny_object' },
        },
        { id: 'core:wait', command: 'wait', params: {} },
      ];
      mockActionDiscoveryService = {
        getValidActions: jest.fn().mockResolvedValue(mockDiscoveredActions),
      };
      mockActionIndexingService = {
        indexActions: jest.fn((actorId, actions) =>
          actions.map((a) => ({
            actionId: a.id,
            params: a.params,
            commandString: a.command,
          }))
        ),
      };

      fallbackFactory = new AIFallbackActionFactory({ logger });

      instance = new AIPlayerStrategy({
        llmAdapter,
        aiPromptPipeline,
        llmResponseProcessor,
        aiFallbackActionFactory: fallbackFactory,
        actionDiscoveryService: mockActionDiscoveryService,
        actionIndexingService: mockActionIndexingService,
        logger,
      });

      mockActor = createMockActor('playerTest1');

      aiPromptPipeline.generatePrompt.mockResolvedValue('prompt');
      llmAdapter.getAIDecision.mockResolvedValue(
        JSON.stringify({
          chosenIndex: 1,
          speech: 'I will check this shiny object.',
        })
      );
      llmResponseProcessor.processResponse.mockResolvedValue({
        action: { chosenIndex: 1, speech: 'I will check this shiny object.' },
        extractedData: { speech: 'I will check this shiny object.' },
      });
    });

    test('should throw if context is null', async () => {
      await expect(instance.decideAction(null)).rejects.toThrow(
        'AIPlayerStrategy received an invalid ITurnContext.'
      );
    });

    test('should throw if context.getActor() returns null', async () => {
      const context = { getActor: jest.fn().mockReturnValue(null) };
      await expect(instance.decideAction(context)).rejects.toThrow(
        'AIPlayerStrategy could not retrieve a valid actor from the context.'
      );
    });

    test('should throw if actor has no ID', async () => {
      const actorNoId = new MockEntity();
      actorNoId.id = null;
      const context = { getActor: jest.fn().mockReturnValue(actorNoId) };
      await expect(instance.decideAction(context)).rejects.toThrow(
        'AIPlayerStrategy could not retrieve a valid actor from the context.'
      );
    });

    test('HAPPY PATH: should orchestrate calls and return action from processor', async () => {
      const context = { getActor: jest.fn().mockReturnValue(mockActor) };
      const result = await instance.decideAction(context);

      expect(mockActionDiscoveryService.getValidActions).toHaveBeenCalledWith(
        mockActor,
        context
      );
      expect(mockActionIndexingService.indexActions).toHaveBeenCalledWith(
        mockActor.id,
        mockDiscoveredActions
      );

      expect(aiPromptPipeline.generatePrompt).toHaveBeenCalledWith(
        mockActor,
        context,
        [
          {
            actionId: 'core:interact',
            params: { target: 'shiny_object' },
            commandString: 'Interact with shiny_object',
          },
          { actionId: 'core:wait', params: {}, commandString: 'wait' },
        ]
      );
      expect(llmAdapter.getAIDecision).toHaveBeenCalledWith(expect.any(String));
      expect(llmResponseProcessor.processResponse).toHaveBeenCalledWith(
        expect.any(String),
        mockActor.id
      );

      expect(result.action).toEqual({
        actionDefinitionId: 'core:interact',
        resolvedParameters: { target: 'shiny_object' },
        commandString: 'Interact with shiny_object',
        speech: 'I will check this shiny object.',
      });
      expect(result.extractedData).toEqual({
        speech: 'I will check this shiny object.',
      });
      expect(logger.error).not.toHaveBeenCalled();
    });

    test('should correctly build turn action when processor returns no speech', async () => {
      llmResponseProcessor.processResponse.mockResolvedValue({
        action: { chosenIndex: 1, speech: null },
        extractedData: { speech: null },
      });
      const context = { getActor: jest.fn().mockReturnValue(mockActor) };
      const result = await instance.decideAction(context);
      expect(result.action).toEqual({
        actionDefinitionId: 'core:interact',
        commandString: 'Interact with shiny_object',
        resolvedParameters: { target: 'shiny_object' },
      });
      expect(result.extractedData).toEqual({ speech: null });
    });

    test('should return fallback if aiPromptPipeline.generatePrompt throws', async () => {
      aiPromptPipeline.generatePrompt.mockRejectedValue(
        new Error('Pipeline Error')
      );
      const context = { getActor: jest.fn().mockReturnValue(mockActor) };
      const result = await instance.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters.isFallback).toBe(true);
      expect(result.action.resolvedParameters.failureReason).toBe(
        'unhandled_strategy_error'
      );
    });

    test('should return fallback if aiPromptPipeline returns invalid prompt', async () => {
      const context = { getActor: jest.fn().mockReturnValue(mockActor) };
      for (const ret of [null, '']) {
        aiPromptPipeline.generatePrompt.mockResolvedValue(ret);
        const result = await instance.decideAction(context);
        expect(result.action.actionDefinitionId).toBe(
          DEFAULT_FALLBACK_ACTION.actionDefinitionId
        );
        expect(result.action.resolvedParameters.isFallback).toBe(true);
        expect(result.action.resolvedParameters.failureReason).toBe(
          'unhandled_strategy_error'
        );
      }
    });

    test('should return fallback if llmAdapter.getAIDecision throws', async () => {
      llmAdapter.getAIDecision.mockRejectedValue(new Error('LLM Error'));
      const context = { getActor: jest.fn().mockReturnValue(mockActor) };
      const result = await instance.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters.failureReason).toBe(
        'unhandled_strategy_error'
      );
    });

    test('should return fallback if processResponse throws LLMProcessingError', async () => {
      const err = new Error('proc error');
      err.name = 'LLMProcessingError';
      llmResponseProcessor.processResponse.mockRejectedValue(err);
      const context = { getActor: jest.fn().mockReturnValue(mockActor) };
      const result = await instance.decideAction(context);
      expect(result.action.actionDefinitionId).toBe(
        DEFAULT_FALLBACK_ACTION.actionDefinitionId
      );
      expect(result.action.resolvedParameters.failureReason).toBe(
        'llm_response_processing'
      );
    });

    test('should throw if context.getActor() throws', async () => {
      const actorErr = new Error('actor fail');
      const context = {
        getActor: jest.fn(() => {
          throw actorErr;
        }),
      };
      await expect(instance.decideAction(context)).rejects.toThrow(actorErr);
    });
  });
});
