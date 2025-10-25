/**
 * @file Additional unit tests for TraitsGenerator service to improve coverage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';
import { TraitsGenerationError } from '../../../../src/characterBuilder/errors/TraitsGenerationError.js';

jest.mock(
  '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js',
  () => ({
    buildTraitsGenerationPrompt: jest.fn(),
    validateTraitsGenerationResponse: jest.fn(),
    TRAITS_RESPONSE_SCHEMA: {
      type: 'object',
    },
    TRAITS_GENERATION_LLM_PARAMS: {
      temperature: 0.8,
    },
    PROMPT_VERSION_INFO: {
      version: '1.0.0',
    },
  })
);

const { buildTraitsGenerationPrompt, validateTraitsGenerationResponse } =
  jest.requireMock(
    '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js'
  );

describe('TraitsGenerator additional coverage', () => {
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockEventBus;
  let mockTokenEstimator;
  let mockRetryManager;
  let generator;

  const concept = {
    id: 'concept-1',
    concept: 'An enigmatic traveller seeking purpose.',
  };

  const baseDirection = {
    id: 'direction-1',
    title: 'Forging a new destiny',
    description: 'A journey to rebuild a fractured identity with hope.',
    coreTension: 'Hope versus resignation',
  };

  const userInputs = {
    coreMotivation: 'To prove their worth to themselves.',
    internalContradiction: 'Craves connection yet fears rejection.',
    centralQuestion: 'Can they rewrite the story of their life?',
  };

  const minimalValidResponse = {
    names: [
      {
        name: 'Aeryn',
        justification: 'A carefully chosen name reflecting hidden resilience.',
      },
    ],
    physicalDescription: 'Tall silhouette cloaked in weathered fabrics, eyes bright with unspoken plans.'
      .padEnd(140, ' '),
    personality: [
      {
        trait: 'Observant',
        explanation: 'Spends long hours watching others to learn how to belong.',
      },
    ],
    strengths: ['Quick thinking'],
    weaknesses: ['Keeps secrets'],
    likes: ['Quiet taverns'],
    dislikes: ['Broken promises'],
    fears: ['Losing newfound trust'],
    goals: {
      shortTerm: ['Find allies willing to believe in them'],
      longTerm: 'Establish a sanctuary where misfits can heal?'
        .padEnd(55, '!'),
    },
    notes: ['Writes letters never sent'],
    profile: 'A winding path from exile to belonging unfolds in deliberate steps.'.padEnd(
      220,
      ' '
    ),
    secrets: ['Carries a token from an abandoned past life'],
  };

  const params = {
    concept,
    direction: baseDirection,
    userInputs,
    cliches: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn((value) => value),
      parseAndRepair: jest.fn().mockResolvedValue(minimalValidResponse),
    };

    mockLlmStrategyFactory = {
      getAIDecision: jest
        .fn()
        .mockResolvedValue(JSON.stringify(minimalValidResponse)),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn().mockResolvedValue({
        configId: 'gpt-4',
      }),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockTokenEstimator = {
      estimateTokens: jest.fn().mockResolvedValue(42),
    };

    mockRetryManager = {
      retry: jest.fn(async (operation) => operation()),
    };

    buildTraitsGenerationPrompt.mockReturnValue('A richly detailed prompt.');
    validateTraitsGenerationResponse.mockReturnValue(true);

    generator = new TraitsGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
      eventBus: mockEventBus,
      tokenEstimator: mockTokenEstimator,
      retryManager: mockRetryManager,
    });
  });

  it('wraps unexpected errors with TraitsGenerationError and processing stage', async () => {
    buildTraitsGenerationPrompt
      .mockImplementationOnce(() => 'Prompt for llm execution')
      .mockImplementationOnce(() => {
        throw new Error('Generic processing hiccup');
      });

    let caught;
    try {
      await generator.generateTraits(params);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TraitsGenerationError);
    expect(caught.message).toContain('Generic processing hiccup');
    expect(caught.context.stage).toBe('processing');
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:traits_generation_failed',
      expect.objectContaining({
        failureStage: 'processing',
      })
    );
  });

  it.each([
    [
      'direction.id',
      (direction) => ({ ...direction, id: ' ' }),
      'Validation failed for direction.id: must be a non-empty string',
    ],
    [
      'direction.description',
      (direction) => ({ ...direction, description: '' }),
      'Validation failed for direction.description: must be a non-empty string',
    ],
    [
      'direction.coreTension',
      (direction) => ({ ...direction, coreTension: '' }),
      'Validation failed for direction.coreTension: must be a non-empty string',
    ],
  ])('validates %s input', async (_label, mutateDirection, expectedMessage) => {
    const invalidParams = {
      ...params,
      direction: mutateDirection(baseDirection),
    };

    await expect(generator.generateTraits(invalidParams)).rejects.toThrow(
      TraitsGenerationError
    );

    await expect(generator.generateTraits(invalidParams)).rejects.toThrow(
      expectedMessage
    );
  });

  it('rethrows parsing TraitsGenerationError without wrapping', async () => {
    const parsingError = TraitsGenerationError.forParsingFailure('bad JSON');
    mockLlmJsonService.parseAndRepair.mockRejectedValueOnce(parsingError);

    mockRetryManager.retry.mockImplementation(async (operation) => {
      return operation();
    });

    let caught;
    try {
      await generator.generateTraits(params, { maxRetries: 0 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TraitsGenerationError);
    expect(caught.message).toContain('Response parsing failed: bad JSON');
    expect(caught.context.stage).toBe('response_parsing');
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:traits_generation_failed',
      expect.objectContaining({ failureStage: 'response_parsing' })
    );
  });

  it('propagates structural TraitsGenerationError from validation', async () => {
    const structureError = new TraitsGenerationError('Schema mismatch', {
      stage: 'structure_validation',
    });
    validateTraitsGenerationResponse.mockImplementation(() => {
      throw structureError;
    });

    let caught;
    try {
      await generator.generateTraits(params, { maxRetries: 0 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TraitsGenerationError);
    expect(caught.message).toContain('Schema mismatch');
    expect(caught.context.stage).toBe('structure_validation');
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:traits_generation_failed',
      expect.objectContaining({ failureStage: 'structure_validation' })
    );
  });

  it('identifies detailed quality issues', async () => {
    const poorResponse = {
      ...minimalValidResponse,
      names: [
        {
          name: 'Talen',
          justification: 'Too short',
        },
      ],
      personality: [
        {
          trait: 'Guarded',
          explanation: 'Keeps things close',
        },
      ],
      goals: {
        shortTerm: ['Keep moving'],
        longTerm: 'Build trust',
      },
    };

    mockLlmJsonService.parseAndRepair.mockResolvedValueOnce(poorResponse);

    await expect(
      generator.generateTraits(params, { maxRetries: 0 })
    ).rejects.toThrow('Response quality issues');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'TraitsGenerator: Response quality issues detected',
      expect.objectContaining({
        issueCount: 3,
        issues: expect.arrayContaining([
          expect.stringContaining('Name 1: Justification too brief'),
          expect.stringContaining('Personality trait 1: Explanation too brief'),
          expect.stringContaining('Long-term goal too brief'),
        ]),
      })
    );
  });

  it('returns zero tokens when prompt is blank', async () => {
    buildTraitsGenerationPrompt.mockReturnValue('');

    const result = await generator.generateTraits(params, { maxRetries: 0 });

    expect(result.metadata.promptTokens).toBe(0);
    expect(mockTokenEstimator.estimateTokens).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unknown', ''],
    ['llm_request', 'LLM request failed due to network drop'],
    ['response_parsing', 'Failed to parse response payload'],
    ['structure_validation', 'Invalid response structure detected'],
    ['quality_validation', 'Response quality lacks depth and insight'],
    ['configuration', 'Configuration missing active model'],
    ['validation', 'Validation failed because field must be string'],
  ])('maps error messages to %s stage', async (expectedStage, message) => {
    mockEventBus.dispatch
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error(message);
      });

    let caught;
    try {
      await generator.generateTraits(params);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TraitsGenerationError);
    expect(caught.context.stage).toBe(expectedStage);
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:traits_generation_failed',
      expect.objectContaining({ failureStage: expectedStage })
    );
  });

  it('returns stage from TraitsGenerationError context', async () => {
    const qualityError = TraitsGenerationError.forQualityFailure('Too shallow');

    mockLlmJsonService.parseAndRepair.mockImplementationOnce(async () => {
      throw qualityError;
    });

    let caught;
    try {
      await generator.generateTraits(params);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TraitsGenerationError);
    expect(caught.message).toContain('Too shallow');
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'core:traits_generation_failed',
      expect.objectContaining({ failureStage: 'quality_validation' })
    );
  });
});
