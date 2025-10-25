import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsGenerator from '../../../../src/characterBuilder/services/SpeechPatternsGenerator.js';
import {
  SpeechPatternsValidationError,
  SpeechPatternsGenerationError,
} from '../../../../src/characterBuilder/errors/SpeechPatternsGenerationError.js';
import { SpeechPatternsResponseProcessor } from '../../../../src/characterBuilder/services/SpeechPatternsResponseProcessor.js';
import * as promptModule from '../../../../src/characterBuilder/prompts/speechPatternsPrompts.js';
import { createMockLLMResponse } from '../../../common/characterBuilder/speechPatternsTestHelpers.js';

function createValidCharacterData(overrides = {}) {
  return {
    'core:name': { name: 'Edge Case Tester', text: 'Edge Case Tester' },
    'core:background': {
      summary:
        'Raised by dramatists and scholars, this character speaks with layered metaphor and precise diction honed over years.',
    },
    'core:motivations': {
      primary: [
        'connecting disparate ideas',
        'explaining complex subjects with warmth',
        'guiding others through emotional nuance',
      ],
    },
    ...overrides,
  };
}

function createGenerator(overrides = {}) {
  const testBed = createTestBed();
  const logger = testBed.createMockLogger();
  const llmJsonService = testBed.createMock('LlmJsonService', ['clean', 'parseAndRepair']);
  const llmStrategyFactory = testBed.createMock('ConfigurableLLMAdapter', [
    'getAIDecision',
  ]);
  const llmConfigManager = testBed.createMock('ILLMConfigurationManager', [
    'loadConfiguration',
    'getActiveConfiguration',
    'setActiveConfiguration',
  ]);
  const eventBus = testBed.createMock('ISafeEventDispatcher', ['dispatch']);
  const tokenEstimator = testBed.createMock('ITokenEstimator', ['estimateTokens']);
  const schemaValidator = testBed.createMock('ISchemaValidator', [
    'validateAgainstSchema',
    'validate',
    'isSchemaLoaded',
  ]);

  llmJsonService.clean.mockImplementation((value) => value);
  llmJsonService.parseAndRepair.mockImplementation(async (value) => JSON.parse(value));
  llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());
  tokenEstimator.estimateTokens.mockReturnValue(1234);
  schemaValidator.validateAgainstSchema.mockReturnValue({ isValid: true, errors: [] });
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

function createValidResponse(patternOverrides) {
  const basePatterns = [
    {
      pattern: 'Shares a reflective observation before offering advice',
      example: 'It sounds like the echo of your choices is still whispering; let us answer it together.',
      circumstances: 'When guiding someone through a dilemma',
    },
    {
      pattern: 'Uses gentle humor to dissolve tension',
      example: 'If words were dancers, yours are still stretching; shall we help them rehearse?',
      circumstances: 'When easing a stressful conversation',
    },
    {
      pattern: 'Builds cadence before revealing a sharp insight',
      example: 'Listen to the rhythm of their hesitation—it crescendos into the truth they fear.',
      circumstances: 'When highlighting hidden motives',
    },
    {
      pattern: 'Adapts vocabulary to mirror the listener',
      example: 'Your language is all constellations; let me chart alongside you in matching starlight.',
      circumstances: 'When creating rapport with scholars or poets',
    },
  ];

  return {
    characterName: 'Edge Case Tester',
    speechPatterns: patternOverrides || basePatterns,
    metadata: { raw: true },
  };
}

describe('SpeechPatternsGenerator additional coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('validates character data presence and structure', async () => {
    const { generator } = createGenerator();

    await expect(generator.generateSpeechPatterns(null)).rejects.toThrow(
      'Failed to generate speech patterns: Character data is required and must be an object'
    );

    const withoutComponents = {
      biography: {
        summary:
          'A mysterious speaker who echoes every feeling back with lyrical fragments from forgotten songs, weaving intrigue.',
      },
    };

    await expect(
      generator.generateSpeechPatterns(withoutComponents)
    ).rejects.toThrow(
      'Failed to generate speech patterns: Character data must contain at least one character component (format: "component:field").'
    );

    const insufficientContent = { 'core:name': { text: 'Ax' } };

    await expect(
      generator.generateSpeechPatterns(insufficientContent)
    ).rejects.toThrow(
      'Failed to generate speech patterns: Character data appears insufficient for speech pattern generation'
    );
  });

  it('wraps prompt construction failures in SpeechPatternsGenerationError', async () => {
    const { generator, llmStrategyFactory } = createGenerator();
    const promptSpy = jest
      .spyOn(promptModule, 'buildSpeechPatternsGenerationPrompt')
      .mockImplementation(() => {
        throw new Error('prompt building exploded');
      });

    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData())
    ).rejects.toThrow(
      new SpeechPatternsGenerationError('Failed to build prompt: prompt building exploded').message
    );

    expect(promptSpy).toHaveBeenCalled();
  });

  it('attempts circuit breaker reset after timeout and clears scheduled timers', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-01T00:00:00Z'));

    const { generator, llmStrategyFactory, logger } = createGenerator();
    const character = createValidCharacterData();

    llmStrategyFactory.getAIDecision.mockRejectedValue(new Error('Service unavailable'));

    const failingOptions = {
      retryConfig: {
        maxRetries: 1,
        baseDelay: 1,
        maxDelay: 1,
        backoffMultiplier: 1,
        jitterFactor: 0,
      },
    };

    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        generator.generateSpeechPatterns(character, failingOptions)
      ).rejects.toThrow('LLM request failed after 1 attempts: Service unavailable');
    }

    llmStrategyFactory.getAIDecision.mockResolvedValueOnce(createMockLLMResponse());

    jest.setSystemTime(new Date('2025-06-01T00:01:01Z'));
    logger.info.mockClear();

    await generator.generateSpeechPatterns(character, failingOptions);

    expect(logger.info).toHaveBeenCalledWith(
      'Circuit breaker entering half-open state, attempting reset'
    );
    expect(logger.info).toHaveBeenCalledWith('Circuit breaker reset to closed state');
  });

  it('throws when abort signal is already aborted before LLM invocation', async () => {
    const { generator, llmStrategyFactory } = createGenerator();
    const abortController = new AbortController();
    abortController.abort();

    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData(), {
        abortSignal: abortController.signal,
      })
    ).rejects.toThrow('LLM request failed after 1 attempts: Operation aborted');
  });

  it('throws aggregated error when retry attempts are configured to zero', async () => {
    const { generator, llmStrategyFactory } = createGenerator();
    llmStrategyFactory.getAIDecision.mockRejectedValue(new Error('transient failure'));

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData(), {
        retryConfig: { maxRetries: 0 },
      })
    ).rejects.toThrow('LLM request failed after 0 attempts');
  });

  it('aborts pending delay immediately when abort signal already triggered during retry backoff', async () => {
    jest.useFakeTimers();
    const { generator, llmStrategyFactory } = createGenerator();
    const character = createValidCharacterData();
    const abortController = new AbortController();

    llmStrategyFactory.getAIDecision.mockImplementation(() => {
      abortController.abort();
      return Promise.reject(new Error('timeout'));
    });

    await expect(
      generator.generateSpeechPatterns(character, {
        abortSignal: abortController.signal,
        retryConfig: {
          maxRetries: 2,
          baseDelay: 10,
          maxDelay: 10,
          backoffMultiplier: 1,
          jitterFactor: 0,
        },
      })
    ).rejects.toThrow('Failed to generate speech patterns: Delay aborted');
  });

  it('does not retry validation or circuit breaker errors', async () => {
    const { generator, llmStrategyFactory } = createGenerator();
    const validationError = new SpeechPatternsValidationError('schema mismatch');
    const circuitError = new Error('temporarily unavailable');
    circuitError.circuitBreakerOpen = true;

    llmStrategyFactory.getAIDecision
      .mockRejectedValueOnce(validationError)
      .mockRejectedValueOnce(circuitError);

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData())
    ).rejects.toThrow('LLM request failed after 1 attempts: schema mismatch');

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData())
    ).rejects.toThrow('LLM request failed after 1 attempts: temporarily unavailable');

    expect(llmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(2);
  });

  it('evicts least recently used cache entries when capacity is exceeded', async () => {
    const { generator, llmStrategyFactory, logger } = createGenerator();
    const baseCharacter = createValidCharacterData();

    for (let i = 0; i < 12; i += 1) {
      llmStrategyFactory.getAIDecision.mockResolvedValueOnce(createMockLLMResponse());
      // eslint-disable-next-line no-await-in-loop
      await generator.generateSpeechPatterns(
        {
          ...baseCharacter,
          [`core:personality:${i}`]: {
            description:
              'A deeply detailed persona entry designed to ensure unique cache keys and varied speech facets for tests.',
          },
        }
      );
    }

    expect(logger.debug).toHaveBeenCalledWith('Cache eviction', {
      evictedKey: expect.any(String),
      reason: 'cache size limit',
    });
  });

  it('wraps business rule validation failures in SpeechPatternsValidationError', async () => {
    const { generator, llmStrategyFactory } = createGenerator();
    const responseSpy = jest
      .spyOn(SpeechPatternsResponseProcessor.prototype, 'processResponse')
      .mockResolvedValue(createValidResponse([{ pattern: 'One', example: 'Two', circumstances: 'Three' }]));

    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData())
    ).rejects.toThrow(
      'Response validation failed: Insufficient patterns generated: 1 < 3'
    );

    expect(responseSpy).toHaveBeenCalled();
  });

  it('detects duplicate patterns according to business rules', async () => {
    const { generator, llmStrategyFactory } = createGenerator();
    const duplicatePatterns = createValidResponse(
      Array.from({ length: 4 }, () => ({
        pattern: 'Echo phrase repeated',
        example: 'echo phrase repeated again',
        circumstances: 'testing duplicates',
      }))
    );

    jest
      .spyOn(SpeechPatternsResponseProcessor.prototype, 'processResponse')
      .mockResolvedValue(duplicatePatterns);
    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData())
    ).rejects.toThrow('Response validation failed: Too many similar patterns detected');
  });

  it('detects low-quality patterns according to business rules', async () => {
    const { generator, llmStrategyFactory } = createGenerator();
    const lowQualityPatterns = createValidResponse(
      [
        { pattern: 'ok', example: 'no', circumstances: 'rare case' },
        { pattern: 'tiny', example: 'hi', circumstances: 'quick exchange' },
        { pattern: 'unique expression', example: 'unique example', circumstances: 'context' },
      ].concat(
        Array.from({ length: 3 }, (_, idx) => ({
          pattern: `distinct pattern ${idx}`,
          example: `Example with sufficient detail ${idx}`,
          circumstances: 'contextual usage',
        }))
      )
    );

    jest
      .spyOn(SpeechPatternsResponseProcessor.prototype, 'processResponse')
      .mockResolvedValue(lowQualityPatterns);
    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());

    await expect(
      generator.generateSpeechPatterns(createValidCharacterData())
    ).rejects.toThrow('Response validation failed: Too many low-quality patterns detected');
  });

  it('extracts character names from fallback component and direct structures', async () => {
    const contexts = [];
    jest
      .spyOn(SpeechPatternsResponseProcessor.prototype, 'processResponse')
      .mockImplementation(async function process(rawResponse, context) {
        contexts.push(context);
        return createValidResponse();
      });

    const { generator, llmStrategyFactory } = createGenerator();
    llmStrategyFactory.getAIDecision.mockResolvedValue(createMockLLMResponse());

    const componentNameOnly = {
      components: {
        'core:name': { name: 'Component Name Only' },
        'core:biography': {
          summary:
            'An elder storyteller who gathers the dialects of every town and weaves them into clever performances with layered wit.',
        },
      },
    };

    const componentAltKey = {
      components: {
        'profile:nickname': { name: 'Profile Alias' },
        'core:background': {
          summary:
            'A traveling rhetorician who adapts cadence to any audience and leaves them pondering the nuances of their own speech.',
        },
      },
    };

    const directNameOnly = {
      'persona:nickname': { name: 'Direct Alias' },
      'core:background': {
        summary:
          'An improvisational poet whose shifting cadence mirrors the emotions of their companions with uncanny precision.',
      },
    };

    await generator.generateSpeechPatterns(componentNameOnly);
    await generator.generateSpeechPatterns(componentAltKey);
    await generator.generateSpeechPatterns(directNameOnly);

    expect(contexts[0].characterName).toBe('Component Name Only');
    expect(contexts[1].characterName).toBe('Profile Alias');
    expect(contexts[2].characterName).toBe('Direct Alias');
  });
});
