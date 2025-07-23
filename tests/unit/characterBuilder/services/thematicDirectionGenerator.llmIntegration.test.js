/**
 * @file Unit test for ThematicDirectionGenerator LLM integration
 * @description Tests that ThematicDirectionGenerator properly uses ILLMConfigurationManager
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ThematicDirectionGenerator } from '../../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('ThematicDirectionGenerator - LLM Integration', () => {
  let generator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmAdapter;
  let mockLlmConfigManager;

  beforeEach(() => {
    mockLogger = new ConsoleLogger('error');

    mockLlmJsonService = {
      clean: jest.fn((text) => text),
      parseAndRepair: jest.fn(async (text) => ({
        thematicDirections: [
          {
            title: 'Adventure Seeker',
            description:
              'This character embodies the spirit of exploration and adventure, always seeking new challenges and experiences that push the boundaries of their comfort zone.',
            coreTension: 'Desire for freedom versus responsibility',
            uniqueTwist: 'Hidden fear of settling down',
            narrativePotential:
              'Stories of self-discovery through dangerous quests',
          },
          {
            title: 'Mystery Solver',
            description:
              'A character driven by an insatiable curiosity to uncover hidden truths and solve complex puzzles, often at great personal cost to relationships.',
            coreTension: 'Truth seeking versus social harmony',
            uniqueTwist: 'Compulsive need to know everything',
            narrativePotential:
              'Investigative narratives with moral complexity',
          },
          {
            title: 'Romance Seeker',
            description:
              'This character believes deeply in the transformative power of love and dedicates their life to finding and nurturing meaningful romantic connections.',
            coreTension: 'Idealistic love versus realistic relationships',
            uniqueTwist: 'Fear of being truly vulnerable',
            narrativePotential:
              'Character growth through relationship challenges',
          },
        ],
      })),
    };

    mockLlmAdapter = {
      getAIDecision: jest.fn(
        async () =>
          '{"thematicDirections":[{"theme":"Adventure","description":"Test direction"}]}'
      ),
      getCurrentActiveLlmConfig: jest.fn(async () => ({
        configId: 'test-config',
      })),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(async (configId) => ({
        configId,
        displayName: 'Test Config',
      })),
      getActiveConfiguration: jest.fn(async () => ({
        configId: 'openrouter-claude-sonnet-4',
        displayName: 'Claude Sonnet 4',
      })),
      setActiveConfiguration: jest.fn(async () => true),
      getAvailableOptions: jest.fn(async () => [
        {
          configId: 'openrouter-claude-sonnet-4',
          displayName: 'Claude Sonnet 4',
        },
      ]),
    };
  });

  const createGenerator = () => {
    return new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmAdapter,
      llmConfigManager: mockLlmConfigManager,
    });
  };

  it('should use ILLMConfigurationManager interface correctly', () => {
    expect(() => createGenerator()).not.toThrow();

    const generator = createGenerator();
    expect(generator).toBeDefined();
    expect(typeof generator.generateDirections).toBe('function');
  });

  it('should use active configuration when no specific config provided', async () => {
    const generator = createGenerator();

    await generator.generateDirections(
      'test-concept-id',
      'Test character concept'
    );

    expect(mockLlmConfigManager.getActiveConfiguration).toHaveBeenCalled();
    expect(mockLlmAdapter.getAIDecision).toHaveBeenCalled();
    // Verify the prompt includes the character concept
    const calledWith = mockLlmAdapter.getAIDecision.mock.calls[0][0];
    expect(calledWith).toContain('Test character concept');
  });

  it('should set specific configuration when provided', async () => {
    const generator = createGenerator();

    await generator.generateDirections(
      'test-concept-id',
      'Test character concept',
      {
        llmConfigId: 'openrouter-qwen3-235b-a22b',
      }
    );

    expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
      'openrouter-qwen3-235b-a22b'
    );
    expect(mockLlmAdapter.getAIDecision).toHaveBeenCalled();
  });

  it('should handle missing configuration gracefully', async () => {
    const generator = createGenerator();

    // Mock config not found
    mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(false);
    mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

    await expect(
      generator.generateDirections(
        'test-concept-id',
        'Test character concept',
        {
          llmConfigId: 'non-existent-config',
        }
      )
    ).rejects.toThrow('LLM configuration not found: non-existent-config');
  });

  it('should handle no active configuration scenario', async () => {
    const generator = createGenerator();

    // Mock no active config
    mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(null);

    await expect(
      generator.generateDirections('test-concept-id', 'Test character concept')
    ).rejects.toThrow('No active LLM configuration found');
  });

  it('should use current active config in metadata', async () => {
    const generator = createGenerator();
    const testConfig = { configId: 'test-model-id', displayName: 'Test Model' };

    mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(testConfig);

    const result = await generator.generateDirections(
      'test-concept-id',
      'Test character concept'
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // The result should contain thematic directions with metadata including the model ID
    expect(result.length).toBeGreaterThan(0);
  });

  it('should validate input parameters', async () => {
    const generator = createGenerator();

    // Test missing conceptId
    await expect(
      generator.generateDirections('', 'Test character concept')
    ).rejects.toThrow('conceptId must be a non-empty string');

    // Test missing character concept
    await expect(generator.generateDirections('test-id', '')).rejects.toThrow(
      'characterConcept must be a non-empty string'
    );

    // Test null inputs
    await expect(
      generator.generateDirections(null, 'Test character concept')
    ).rejects.toThrow('conceptId must be a non-empty string');

    await expect(generator.generateDirections('test-id', null)).rejects.toThrow(
      'characterConcept must be a non-empty string'
    );
  });

  it('should handle LLM adapter errors', async () => {
    const generator = createGenerator();

    // Mock LLM adapter error
    mockLlmAdapter.getAIDecision.mockRejectedValue(
      new Error('LLM service unavailable')
    );

    await expect(
      generator.generateDirections('test-concept-id', 'Test character concept')
    ).rejects.toThrow('LLM request failed: LLM service unavailable');
  });

  it('should handle JSON parsing errors', async () => {
    const generator = createGenerator();

    // Mock invalid JSON response
    mockLlmJsonService.parseAndRepair.mockRejectedValue(
      new Error('Invalid JSON')
    );

    await expect(
      generator.generateDirections('test-concept-id', 'Test character concept')
    ).rejects.toThrow('Failed to parse LLM response: Invalid JSON');
  });
});
