/* eslint-env node */
/**
 * @file Unit tests for MoodUpdatePromptPipeline
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MoodUpdatePromptPipeline } from '../../../src/prompting/MoodUpdatePromptPipeline.js';
import {
  createMockLogger,
  createMockLLMAdapter,
  createMockAIGameStateProvider,
  createMockPromptBuilder,
  createMockEntity,
} from '../../common/mockFactories/index.js';

/**
 * Creates a mock AIPromptContentProvider with getMoodUpdatePromptData method.
 *
 * @returns {object} Mock content provider.
 */
function createMockPromptContentProvider() {
  return {
    getMoodUpdatePromptData: jest.fn(),
  };
}

describe('MoodUpdatePromptPipeline', () => {
  let mockLogger;
  let mockLlmAdapter;
  let mockGameStateProvider;
  let mockPromptContentProvider;
  let mockPromptBuilder;
  let defaultActor;
  let defaultContext;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockLlmAdapter = createMockLLMAdapter();
    mockGameStateProvider = createMockAIGameStateProvider();
    mockPromptContentProvider = createMockPromptContentProvider();
    mockPromptBuilder = createMockPromptBuilder();
    defaultActor = createMockEntity('test-actor');
    defaultContext = {};
  });

  function createPipeline(overrides = {}) {
    return new MoodUpdatePromptPipeline({
      llmAdapter: overrides.llmAdapter ?? mockLlmAdapter,
      gameStateProvider: overrides.gameStateProvider ?? mockGameStateProvider,
      promptContentProvider:
        overrides.promptContentProvider ?? mockPromptContentProvider,
      promptBuilder: overrides.promptBuilder ?? mockPromptBuilder,
      logger: overrides.logger ?? mockLogger,
    });
  }

  function setupMockSuccess(options = {}) {
    const {
      llmId = 'test-llm-id',
      gameState = { state: 'test-state' },
      promptData = { data: 'test-data' },
      finalPrompt = 'FINAL_MOOD_PROMPT',
    } = options;

    mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(llmId);
    mockGameStateProvider.buildGameState.mockResolvedValue(gameState);
    mockPromptContentProvider.getMoodUpdatePromptData.mockResolvedValue(
      promptData
    );
    mockPromptBuilder.build.mockResolvedValue(finalPrompt);
  }

  describe('constructor validation', () => {
    test('validates llmAdapter dependency', () => {
      expect(
        () =>
          new MoodUpdatePromptPipeline({
            llmAdapter: null,
            gameStateProvider: mockGameStateProvider,
            promptContentProvider: mockPromptContentProvider,
            promptBuilder: mockPromptBuilder,
            logger: mockLogger,
          })
      ).toThrow(/MoodUpdatePromptPipeline: llmAdapter/);
    });

    test('validates gameStateProvider dependency', () => {
      expect(
        () =>
          new MoodUpdatePromptPipeline({
            llmAdapter: mockLlmAdapter,
            gameStateProvider: null,
            promptContentProvider: mockPromptContentProvider,
            promptBuilder: mockPromptBuilder,
            logger: mockLogger,
          })
      ).toThrow(/MoodUpdatePromptPipeline: gameStateProvider/);
    });

    test('validates promptContentProvider dependency', () => {
      expect(
        () =>
          new MoodUpdatePromptPipeline({
            llmAdapter: mockLlmAdapter,
            gameStateProvider: mockGameStateProvider,
            promptContentProvider: null,
            promptBuilder: mockPromptBuilder,
            logger: mockLogger,
          })
      ).toThrow(/MoodUpdatePromptPipeline: promptContentProvider/);
    });

    test('validates promptBuilder dependency', () => {
      expect(
        () =>
          new MoodUpdatePromptPipeline({
            llmAdapter: mockLlmAdapter,
            gameStateProvider: mockGameStateProvider,
            promptContentProvider: mockPromptContentProvider,
            promptBuilder: null,
            logger: mockLogger,
          })
      ).toThrow(/MoodUpdatePromptPipeline: promptBuilder/);
    });

    test('validates logger dependency', () => {
      expect(
        () =>
          new MoodUpdatePromptPipeline({
            llmAdapter: mockLlmAdapter,
            gameStateProvider: mockGameStateProvider,
            promptContentProvider: mockPromptContentProvider,
            promptBuilder: mockPromptBuilder,
            logger: null,
          })
      ).toThrow(/MoodUpdatePromptPipeline: logger/);
    });

    test('creates pipeline successfully with valid dependencies', () => {
      expect(() => createPipeline()).not.toThrow();
    });
  });

  describe('generateMoodUpdatePrompt', () => {
    test('calls llmAdapter.getCurrentActiveLlmId()', async () => {
      setupMockSuccess();
      const pipeline = createPipeline();

      await pipeline.generateMoodUpdatePrompt(defaultActor, defaultContext);

      expect(mockLlmAdapter.getCurrentActiveLlmId).toHaveBeenCalled();
    });

    test('calls gameStateProvider.buildGameState() with actor and context', async () => {
      setupMockSuccess();
      const pipeline = createPipeline();

      await pipeline.generateMoodUpdatePrompt(defaultActor, defaultContext);

      expect(mockGameStateProvider.buildGameState).toHaveBeenCalledWith(
        defaultActor,
        defaultContext,
        mockLogger
      );
    });

    test('calls promptContentProvider.getMoodUpdatePromptData()', async () => {
      const gameState = { testState: true };
      setupMockSuccess({ gameState });
      const pipeline = createPipeline();

      await pipeline.generateMoodUpdatePrompt(defaultActor, defaultContext);

      expect(
        mockPromptContentProvider.getMoodUpdatePromptData
      ).toHaveBeenCalledWith(gameState, mockLogger);
    });

    test('calls promptBuilder.build() with llmId and promptData', async () => {
      const llmId = 'specific-llm';
      const promptData = { specific: 'data' };
      setupMockSuccess({ llmId, promptData });
      const pipeline = createPipeline();

      await pipeline.generateMoodUpdatePrompt(defaultActor, defaultContext);

      expect(mockPromptBuilder.build).toHaveBeenCalledWith(llmId, promptData);
    });

    test('returns string result from promptBuilder', async () => {
      const expectedPrompt = 'EXPECTED_MOOD_PROMPT_OUTPUT';
      setupMockSuccess({ finalPrompt: expectedPrompt });
      const pipeline = createPipeline();

      const result = await pipeline.generateMoodUpdatePrompt(
        defaultActor,
        defaultContext
      );

      expect(result).toBe(expectedPrompt);
    });

    test('throws error when actor is missing', async () => {
      setupMockSuccess();
      const pipeline = createPipeline();

      await expect(
        pipeline.generateMoodUpdatePrompt(null, defaultContext)
      ).rejects.toThrow(/actor is required/);
    });

    test('throws error when llmAdapter returns falsy llmId', async () => {
      mockLlmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);
      const pipeline = createPipeline();

      await expect(
        pipeline.generateMoodUpdatePrompt(defaultActor, defaultContext)
      ).rejects.toThrow(/Could not determine active LLM ID/);
    });

    test('throws error when promptBuilder returns empty string', async () => {
      setupMockSuccess({ finalPrompt: '' });
      const pipeline = createPipeline();

      await expect(
        pipeline.generateMoodUpdatePrompt(defaultActor, defaultContext)
      ).rejects.toThrow(/PromptBuilder returned an empty or invalid prompt/);
    });

    test('does not mutate gameStateDto returned by provider', async () => {
      const originalGameState = { originalKey: 'originalValue' };
      setupMockSuccess({ gameState: originalGameState });
      const pipeline = createPipeline();

      await pipeline.generateMoodUpdatePrompt(defaultActor, defaultContext);

      expect(originalGameState).toEqual({ originalKey: 'originalValue' });
    });
  });
});
