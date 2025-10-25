import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsGenerator from '../../../../src/characterBuilder/services/SpeechPatternsGenerator.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { createMockLLMResponse } from '../../../common/characterBuilder/speechPatternsTestHelpers.js';
import { SpeechPatternsResponseProcessor } from '../../../../src/characterBuilder/services/SpeechPatternsResponseProcessor.js';

function createValidCharacterData() {
  return {
    'core:name': { name: 'Advanced Tester' },
    'core:personality': {
      traits: ['analytical', 'observant', 'empathetic'],
      background:
        'An experienced investigator who documents every detail meticulously and cares deeply about the truth.',
      motivations: [
        'discovering hidden patterns',
        'helping others understand themselves',
      ],
    },
    'core:history': {
      summary:
        'Started as a linguist before moving into behavioral profiling, giving them a broad range of speech insights.',
    },
  };
}

function createGenerator(overrides = {}) {
  const testBed = createTestBed();
  const logger = testBed.createMockLogger();
  const llmJsonService = testBed.createMock('LlmJsonService', [
    'clean',
    'parseAndRepair',
  ]);
  const llmStrategyFactory = testBed.createMock('ConfigurableLLMAdapter', [
    'getAIDecision',
  ]);
  const llmConfigManager = testBed.createMock('ILLMConfigurationManager', [
    'loadConfiguration',
    'getActiveConfiguration',
    'setActiveConfiguration',
  ]);
  const eventBus = testBed.createMock('ISafeEventDispatcher', ['dispatch']);
  const tokenEstimator = testBed.createMock('ITokenEstimator', [
    'estimateTokens',
  ]);
  const schemaValidator = testBed.createMock('ISchemaValidator', [
    'validateAgainstSchema',
    'validate',
    'isSchemaLoaded',
  ]);

  llmJsonService.clean.mockImplementation((value) => value);
  llmJsonService.parseAndRepair.mockImplementation(async (value) =>
    JSON.parse(value)
  );
  llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());
  tokenEstimator.estimateTokens.mockReturnValue(1200);
  schemaValidator.validateAgainstSchema.mockReturnValue({
    isValid: true,
    errors: [],
  });
  schemaValidator.validate.mockReturnValue({ isValid: true, errors: [] });
  schemaValidator.isSchemaLoaded.mockReturnValue(true);

  const generator = new SpeechPatternsGenerator({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
    eventBus,
    tokenEstimator,
    schemaValidator,
    ...overrides,
  });

  return {
    generator,
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
    eventBus,
    tokenEstimator,
    schemaValidator,
  };
}

const originalProcessResponse =
  SpeechPatternsResponseProcessor.prototype.processResponse;

describe('SpeechPatternsGenerator advanced behaviours', () => {
  let contextSpy;

  afterEach(() => {
    jest.useRealTimers();
    if (contextSpy) {
      contextSpy.mockRestore();
      contextSpy = undefined;
    }
    if (Math.random.mockRestore) {
      Math.random.mockRestore();
    }
  });

  it('deduplicates concurrent requests, serves cached responses, and reports cache stats', async () => {
    const { generator, llmStrategyFactory, eventBus, logger } =
      createGenerator();
    const character = createValidCharacterData();

    let deferredResolve;
    const deferredPromise = new Promise((resolve) => {
      deferredResolve = resolve;
    });

    llmStrategyFactory.getAIDecision.mockImplementationOnce(
      () => deferredPromise
    );

    const firstCall = generator.generateSpeechPatterns(character);
    const secondCall = generator.generateSpeechPatterns(character);

    deferredResolve(createMockLLMResponse());
    const [firstResult, secondResult] = await Promise.all([
      firstCall,
      secondCall,
    ]);
    expect(firstResult).toEqual(secondResult);
    expect(llmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(1);

    eventBus.dispatch.mockClear();
    const cachedResult = await generator.generateSpeechPatterns(character);
    expect(cachedResult).toEqual(firstResult);
    expect(llmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(1);
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_CACHE_HIT,
      expect.objectContaining({ cacheKey: expect.any(String) })
    );

    const stats = generator.getCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.entries[0].expired).toBe(false);

    generator.clearCache();
    expect(logger.info).toHaveBeenCalledWith('Cache cleared', {
      entriesRemoved: 1,
    });
    expect(generator.getCacheStats().size).toBe(0);
  });

  it('expires cached responses based on TTL', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const { generator, llmStrategyFactory, eventBus } = createGenerator();
    const character = createValidCharacterData();

    await generator.generateSpeechPatterns(character);
    expect(llmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(1);

    eventBus.dispatch.mockClear();
    jest.advanceTimersByTime(300000 + 1);

    llmStrategyFactory.getAIDecision.mockResolvedValueOnce(
      createMockLLMResponse()
    );
    await generator.generateSpeechPatterns(character);

    expect(llmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(2);
    expect(eventBus.dispatch).not.toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_CACHE_HIT,
      expect.anything()
    );
  });

  it('retries retryable errors with exponential backoff and emits retry events', async () => {
    jest.useFakeTimers();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const { generator, llmStrategyFactory, eventBus, logger } =
      createGenerator();
    const character = createValidCharacterData();

    llmStrategyFactory.getAIDecision
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(createMockLLMResponse());

    const promise = generator.generateSpeechPatterns(character, {
      retryConfig: {
        maxRetries: 2,
        baseDelay: 20,
        maxDelay: 20,
        backoffMultiplier: 2,
        jitterFactor: 0.3,
      },
    });

    await Promise.resolve();
    jest.advanceTimersByTime(20);

    await promise;

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_RETRY,
      expect.objectContaining({ attempt: 1, delay: 20 })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('LLM request failed, retrying in'),
      expect.objectContaining({ delay: 20, attempt: 1 })
    );
    expect(randomSpy).toHaveBeenCalled();
  });

  it('opens the circuit breaker after repeated failures and recovers after reset', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-15T12:00:00Z'));

    const { generator, llmStrategyFactory, eventBus, logger } =
      createGenerator();
    const character = createValidCharacterData();

    llmStrategyFactory.getAIDecision.mockRejectedValue(
      new Error('Service unavailable')
    );

    const failingOptions = {
      retryConfig: {
        maxRetries: 1,
        baseDelay: 1,
        maxDelay: 1,
        backoffMultiplier: 1,
        jitterFactor: 0,
      },
    };

    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        generator.generateSpeechPatterns(character, failingOptions)
      ).rejects.toThrow(
        'LLM request failed after 1 attempts: Service unavailable'
      );
    }

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CIRCUIT_BREAKER_OPENED,
      expect.objectContaining({ consecutiveFailures: 5 })
    );

    await expect(
      generator.generateSpeechPatterns(character, failingOptions)
    ).rejects.toThrow(
      'Service temporarily unavailable due to repeated failures. Please try again later.'
    );

    jest.advanceTimersByTime(60000);
    expect(logger.info).toHaveBeenCalledWith(
      'Attempting automatic circuit breaker reset'
    );

    llmStrategyFactory.getAIDecision.mockResolvedValueOnce(
      createMockLLMResponse()
    );
    await generator.generateSpeechPatterns(character, failingOptions);

    expect(logger.info).toHaveBeenCalledWith(
      'Circuit breaker reset to closed state'
    );
  });

  it('aborts delayed retries when abort signal is triggered during backoff', async () => {
    jest.useFakeTimers();
    const { generator, llmStrategyFactory } = createGenerator();
    const character = createValidCharacterData();
    const abortController = new AbortController();

    llmStrategyFactory.getAIDecision.mockRejectedValue(
      new Error('network interruption')
    );

    const promise = generator.generateSpeechPatterns(character, {
      abortSignal: abortController.signal,
      retryConfig: {
        maxRetries: 2,
        baseDelay: 25,
        maxDelay: 25,
        backoffMultiplier: 2,
        jitterFactor: 0,
      },
    });

    await Promise.resolve();
    abortController.abort();
    jest.advanceTimersByTime(25);

    await expect(promise).rejects.toThrow(
      'Failed to generate speech patterns: Delay aborted'
    );
  });

  it('extracts character names from different structures when building context', async () => {
    const contexts = [];
    contextSpy = jest
      .spyOn(SpeechPatternsResponseProcessor.prototype, 'processResponse')
      .mockImplementation(async function (rawResponse, context) {
        contexts.push(context);
        return originalProcessResponse.call(this, rawResponse, context);
      });

    const { generator, llmStrategyFactory } = createGenerator();

    const nestedCharacter = {
      components: {
        'core:name': { text: 'Nested Name' },
        'core:background': {
          summary:
            'Raised among scholars, this character developed a layered communication style rich with metaphor.',
        },
      },
    };

    const indirectCharacter = {
      'core:identity:name': { name: 'Indirect Name', text: 'Indirect Name' },
      'core:background': {
        summary:
          'A traveling performer who adapts language to whatever stage they find themselves upon, never revealing their true self.',
      },
    };

    const anonymousCharacter = {
      'core:background': {
        summary:
          'An enigmatic presence with no recorded name but a complex way of speaking shaped by countless disguises.',
      },
      'core:habits': {
        details:
          'Alternates between theatrical flourishes and clipped, precise diction depending on who is listening.',
      },
    };

    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());
    await generator.generateSpeechPatterns(nestedCharacter);

    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());
    await generator.generateSpeechPatterns(indirectCharacter);

    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());
    await generator.generateSpeechPatterns(anonymousCharacter);

    expect(contexts[0].characterName).toBe('Nested Name');
    expect(contexts[1].characterName).toBe('Indirect Name');
    expect(contexts[2].characterName).toBe('Character');
  });
});
