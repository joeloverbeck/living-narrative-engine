/**
 * @file Integration tests for Character Builder LLM integration
 * @description Tests the interaction with real LLM services (mocked for testing)
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { LlmJsonService } from '../../../src/llms/llmJsonService.js';

/**
 * Integration tests for LLM service interaction
 * Uses mocked LLM services but tests the actual integration patterns
 */
describe('Character Builder LLM Integration', () => {
  let directionGenerator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockStrategy;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn(),
      parseAndRepair: jest.fn(),
    };

    mockStrategy = {
      execute: jest.fn(),
    };

    mockLlmStrategyFactory = {
      getStrategy: jest.fn(() => mockStrategy),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
    };

    directionGenerator = new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('LLM Configuration Integration', () => {
    test('should use base openrouter-claude-sonnet-4 configuration with dynamic schema injection', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        modelIdentifier: 'anthropic/claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: {
          method: 'openrouter_json_schema',
          jsonSchema: {
            type: 'object',
            properties: {
              thematicDirections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    coreTension: { type: 'string' },
                    uniqueTwist: { type: 'string' },
                    narrativePotential: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        defaultParameters: {
          temperature: 0.7,
          max_tokens: 2000,
        },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'The Reluctant Hero',
            description: 'A character who must overcome their reluctance',
            coreTension: 'Desire for normalcy vs. call to adventure',
            uniqueTwist: 'Their reluctance is actually hidden strength',
            narrativePotential: 'Growth through adversity',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A ditzy archer who loves adventure'
      );

      // Assert
      expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith('openrouter-claude-sonnet-4');
      expect(mockLlmStrategyFactory.getStrategy).toHaveBeenCalledWith(mockLlmConfig);
      expect(result).toHaveLength(1);
      expect(result[0].llmMetadata.modelId).toBe('openrouter-claude-sonnet-4');
    });

    test('should use custom LLM configuration when provided', async () => {
      // Arrange
      const customConfigId = 'custom-character-config';
      const mockLlmConfig = {
        configId: customConfigId,
        modelIdentifier: 'custom-model',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Custom Direction',
            description: 'A custom thematic direction',
            coreTension: 'Custom tension',
            uniqueTwist: 'Custom twist',
            narrativePotential: 'Custom potential',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A test character',
        { llmConfigId: customConfigId }
      );

      // Assert
      expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith(customConfigId);
      expect(result[0].llmMetadata.modelId).toBe(customConfigId);
    });

    test('should handle LLM configuration not found', async () => {
      // Arrange
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow('LLM configuration not found: openrouter-claude-sonnet-4');
    });
  });

  describe('LLM Request Format Integration', () => {
    test('should format LLM request with correct message structure', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const characterConcept = 'Elara, a mysterious elven archer with ancient knowledge';
      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction',
            description: 'Test description',
            coreTension: 'Test tension',
            uniqueTwist: 'Test twist',
            narrativePotential: 'Test potential',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      await directionGenerator.generateDirections('concept-123', characterConcept);

      // Assert
      expect(mockStrategy.execute).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining(characterConcept) }],
        temperature: 0.7,
        max_tokens: 2000,
        llmConfig: mockLlmConfig,
        environmentContext: { environment: 'client' },
      });

      // Verify the prompt contains the character concept
      const executeCall = mockStrategy.execute.mock.calls[0][0];
      expect(executeCall.messages[0].content).toContain('Elara');
      expect(executeCall.messages[0].content).toContain('elven archer');
      expect(executeCall.messages[0].content).toContain('ancient knowledge');
    });

    test('should include proper prompt structure for thematic directions', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction',
            description: 'Test description',
            coreTension: 'Test tension',
            uniqueTwist: 'Test twist',
            narrativePotential: 'Test potential',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      await directionGenerator.generateDirections(
        'concept-123',
        'A young wizard seeking knowledge'
      );

      // Assert - Verify prompt contains expected structure
      const executeCall = mockStrategy.execute.mock.calls[0][0];
      const promptContent = executeCall.messages[0].content;

      expect(promptContent).toContain('<task_definition>');
      expect(promptContent).toContain('<character_concept>');
      expect(promptContent).toContain('<instructions>');
      expect(promptContent).toContain('<response_format>');
      expect(promptContent).toContain('thematicDirections');
      expect(promptContent).toContain('title');
      expect(promptContent).toContain('description');
      expect(promptContent).toContain('coreTension');
      expect(promptContent).toContain('uniqueTwist');
      expect(promptContent).toContain('narrativePotential');
    });
  });

  describe('LLM Response Processing Integration', () => {
    test('should properly clean and parse LLM response', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const rawLlmResponse = `
        Here are the thematic directions:
        
        {
          "thematicDirections": [
            {
              "title": "The Seeker of Lost Wisdom",
              "description": "A character driven by the pursuit of forgotten knowledge",
              "coreTension": "The price of knowledge versus the burden of ignorance",
              "uniqueTwist": "Each spell learned takes away a cherished memory",
              "narrativePotential": "Stories of sacrifice, discovery, and the true cost of power"
            }
          ]
        }
      `;

      const cleanedResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'The Seeker of Lost Wisdom',
            description: 'A character driven by the pursuit of forgotten knowledge',
            coreTension: 'The price of knowledge versus the burden of ignorance',
            uniqueTwist: 'Each spell learned takes away a cherished memory',
            narrativePotential: 'Stories of sacrifice, discovery, and the true cost of power',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(rawLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(cleanedResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(cleanedResponse));

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A young wizard seeking knowledge'
      );

      // Assert
      expect(mockLlmJsonService.clean).toHaveBeenCalledWith(rawLlmResponse);
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledWith(cleanedResponse, {
        logger: mockLogger,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'The Seeker of Lost Wisdom',
        description: 'A character driven by the pursuit of forgotten knowledge',
        coreTension: 'The price of knowledge versus the burden of ignorance',
        uniqueTwist: 'Each spell learned takes away a cherished memory',
        narrativePotential: 'Stories of sacrifice, discovery, and the true cost of power',
      });
    });

    test('should handle multiple thematic directions in response', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Direction One',
            description: 'First thematic direction',
            coreTension: 'First tension',
            uniqueTwist: 'First twist',
            narrativePotential: 'First potential',
          },
          {
            title: 'Direction Two',
            description: 'Second thematic direction',
            coreTension: 'Second tension',
            uniqueTwist: 'Second twist',
            narrativePotential: 'Second potential',
          },
          {
            title: 'Direction Three',
            description: 'Third thematic direction',
            coreTension: 'Third tension',
            uniqueTwist: 'Third twist',
            narrativePotential: 'Third potential',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A complex character with multiple facets'
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Direction One');
      expect(result[1].title).toBe('Direction Two');
      expect(result[2].title).toBe('Direction Three');

      // All directions should have the same conceptId and unique IDs
      expect(result.every(dir => dir.conceptId === 'concept-123')).toBe(true);
      expect(new Set(result.map(dir => dir.id)).size).toBe(3); // All IDs are unique
    });

    test('should include LLM metadata in generated directions', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction',
            description: 'Test description',
            coreTension: 'Test tension',
            uniqueTwist: 'Test twist',
            narrativePotential: 'Test potential',
          },
        ],
      });

      const characterConcept = 'A character concept for metadata testing';
      const promptLength = characterConcept.length * 4; // Rough token estimate
      const responseLength = mockLlmResponse.length * 4; // Rough token estimate

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      const startTime = Date.now();
      const result = await directionGenerator.generateDirections('concept-123', characterConcept);
      const endTime = Date.now();

      // Assert
      expect(result[0]).toHaveProperty('llmMetadata');
      expect(result[0].llmMetadata).toMatchObject({
        modelId: 'openrouter-claude-sonnet-4',
        promptTokens: expect.any(Number),
        responseTokens: expect.any(Number),
        processingTime: expect.any(Number),
      });

      // Verify processing time is reasonable
      expect(result[0].llmMetadata.processingTime).toBeGreaterThan(0);
      expect(result[0].llmMetadata.processingTime).toBeLessThan(endTime - startTime + 100); // Allow some margin

      // Verify token estimates are reasonable
      expect(result[0].llmMetadata.promptTokens).toBeGreaterThan(0);
      expect(result[0].llmMetadata.responseTokens).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle LLM strategy execution errors', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow('LLM request failed: Network timeout');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Generation failed'),
        expect.any(Object)
      );
    });

    test('should handle JSON parsing errors', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const invalidJsonResponse = 'This is not valid JSON';

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(invalidJsonResponse);
      mockLlmJsonService.clean.mockReturnValue(invalidJsonResponse);
      mockLlmJsonService.parseAndRepair.mockRejectedValue(new Error('Invalid JSON format'));

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow('Failed to parse LLM response: Invalid JSON format');
    });

    test('should handle response structure validation errors', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const invalidStructureResponse = JSON.stringify({
        invalidField: 'This does not match the expected structure',
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(invalidStructureResponse);
      mockLlmJsonService.clean.mockReturnValue(invalidStructureResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(invalidStructureResponse));

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow('Invalid response structure');
    });
  });

  describe('Performance and Logging Integration', () => {
    test('should log appropriate debug and info messages', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction',
            description: 'Test description',
            coreTension: 'Test tension',
            uniqueTwist: 'Test twist',
            narrativePotential: 'Test potential',
          },
        ],
      });

      const conceptId = 'concept-logging-test';
      const characterConcept = 'A character for testing logging';

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      await directionGenerator.generateDirections(conceptId, characterConcept);

      // Assert - Verify logging calls
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting generation for concept'),
        expect.objectContaining({
          conceptId,
          conceptLength: characterConcept.length,
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Built prompt'),
        expect.objectContaining({ conceptId })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Received LLM response'),
        expect.any(Object)
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated thematic directions'),
        expect.objectContaining({
          conceptId,
          directionCount: 1,
          processingTime: expect.any(Number),
        })
      );
    });

    test('should measure and report processing time accurately', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Performance Test Direction',
            description: 'A direction for testing performance measurement',
            coreTension: 'Speed vs. accuracy',
            uniqueTwist: 'Time is relative',
            narrativePotential: 'Adventures in temporal mechanics',
          },
        ],
      });

      // Simulate realistic processing delay
      mockStrategy.execute.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockLlmResponse), 100))
      );

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(JSON.parse(mockLlmResponse));

      // Act
      const startTime = Date.now();
      const result = await directionGenerator.generateDirections(
        'concept-performance',
        'Performance test character'
      );
      const endTime = Date.now();
      const actualProcessingTime = endTime - startTime;

      // Assert
      expect(result[0].llmMetadata.processingTime).toBeGreaterThanOrEqual(100);
      expect(result[0].llmMetadata.processingTime).toBeLessThan(actualProcessingTime + 50); // Allow small margin
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated thematic directions'),
        expect.objectContaining({
          processingTime: expect.any(Number),
        })
      );
    });
  });
});