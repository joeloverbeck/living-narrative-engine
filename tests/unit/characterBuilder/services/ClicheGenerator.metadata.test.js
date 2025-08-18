/**
 * @file Test that ClicheGenerator produces schema-compliant metadata
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClicheGenerator } from '../../../../src/characterBuilder/services/ClicheGenerator.js';

describe('ClicheGenerator - Metadata Schema Compliance', () => {
  let clicheGenerator;
  let mockLogger;
  let mockLLMStrategyFactory;
  let mockLLMConfigManager;
  let mockLLMJsonService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLLMStrategyFactory = {
      getAIDecision: jest.fn().mockImplementation(async () => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return JSON.stringify({
          categories: {
            names: ['Test Name'],
            physicalDescriptions: ['Test Description'],
            personalityTraits: ['Test Trait'],
            skillsAbilities: ['Test Skill'],
            typicalLikes: ['Test Like'],
            typicalDislikes: ['Test Dislike'],
            commonFears: ['Test Fear'],
            genericGoals: ['Test Goal'],
            backgroundElements: ['Test Background'],
            overusedSecrets: ['Test Secret'],
            speechPatterns: ['Test Pattern'],
          },
          tropesAndStereotypes: ['Test Trope'],
        });
      }),
    };

    mockLLMConfigManager = {
      getActiveConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-model-id',
      }),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
      loadConfiguration: jest.fn().mockResolvedValue({}),
    };

    mockLLMJsonService = {
      clean: jest.fn((str) => str),
      parseAndRepair: jest.fn().mockResolvedValue({
        categories: {
          names: ['Test Name'],
          physicalDescriptions: ['Test Description'],
          personalityTraits: ['Test Trait'],
          skillsAbilities: ['Test Skill'],
          typicalLikes: ['Test Like'],
          typicalDislikes: ['Test Dislike'],
          commonFears: ['Test Fear'],
          genericGoals: ['Test Goal'],
          backgroundElements: ['Test Background'],
          overusedSecrets: ['Test Secret'],
          speechPatterns: ['Test Pattern'],
        },
        tropesAndStereotypes: ['Test Trope'],
      }),
    };

    clicheGenerator = new ClicheGenerator({
      logger: mockLogger,
      llmStrategyFactory: mockLLMStrategyFactory,
      llmConfigManager: mockLLMConfigManager,
      llmJsonService: mockLLMJsonService,
    });
  });

  it('should generate metadata with schema-compliant field names', async () => {
    const result = await clicheGenerator.generateCliches(
      'test-concept-id',
      'Test concept text',
      {
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test tension',
      }
    );

    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();

    // Check that metadata has the correct field names per schema
    expect(result.metadata.model).toBeDefined(); // Not modelId
    expect(result.metadata.tokens).toBeDefined(); // Not promptTokens/responseTokens
    expect(result.metadata.responseTime).toBeDefined(); // Not processingTime
    expect(result.metadata.promptVersion).toBeDefined();

    // Check that incorrect field names are NOT present
    expect(result.metadata.modelId).toBeUndefined();
    expect(result.metadata.promptTokens).toBeUndefined();
    expect(result.metadata.responseTokens).toBeUndefined();
    expect(result.metadata.processingTime).toBeUndefined();
    expect(result.metadata.enhanced).toBeUndefined();
    expect(result.metadata.qualityMetrics).toBeUndefined();
    expect(result.metadata.validationWarnings).toBeUndefined();
    expect(result.metadata.recommendations).toBeUndefined();
  });

  it('should calculate total tokens correctly', async () => {
    const result = await clicheGenerator.generateCliches(
      'test-concept-id',
      'Test concept text',
      {
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test tension',
      }
    );

    // tokens should be the sum of prompt and response tokens
    expect(typeof result.metadata.tokens).toBe('number');
    expect(result.metadata.tokens).toBeGreaterThan(0);
  });

  it('should use responseTime instead of processingTime', async () => {
    const result = await clicheGenerator.generateCliches(
      'test-concept-id',
      'Test concept text',
      {
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test tension',
      }
    );

    expect(typeof result.metadata.responseTime).toBe('number');
    expect(result.metadata.responseTime).toBeGreaterThan(0);
  });

  it('should use model instead of modelId', async () => {
    const result = await clicheGenerator.generateCliches(
      'test-concept-id',
      'Test concept text',
      {
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test tension',
      }
    );

    expect(result.metadata.model).toBe('test-model-id');
  });
});
