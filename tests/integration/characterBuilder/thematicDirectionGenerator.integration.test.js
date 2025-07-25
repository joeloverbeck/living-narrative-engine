/**
 * @file Integration tests for ThematicDirectionGenerator service
 * @description Comprehensive integration tests to achieve near 100% coverage
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import {
  buildThematicDirectionsPrompt,
  validateThematicDirectionsResponse,
  THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
  CHARACTER_BUILDER_LLM_PARAMS,
} from '../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js';
import { createThematicDirectionsFromLLMResponse } from '../../../src/characterBuilder/models/thematicDirection.js';

// Mock the model creation to return predictable results
jest.mock('../../../src/characterBuilder/models/thematicDirection.js', () => ({
  createThematicDirectionsFromLLMResponse: jest.fn(),
}));

describe('ThematicDirectionGenerator Integration Tests', () => {
  let generator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;

  // Test data
  const validConceptId = 'concept-123';
  const validCharacterConcept = 'A brave knight with a mysterious past';
  const validLLMResponse = {
    thematicDirections: [
      {
        title: 'The Fallen Noble',
        description: 'Once a champion of the realm, now seeking redemption for past failures.',
        coreTension: 'The conflict between past glory and present shame drives every action.',
        uniqueTwist: "The knight's greatest victory was actually their most shameful defeat.",
        narrativePotential: 'Redemption arc with opportunities for moral complexity and character growth.',
      },
      {
        title: 'The Secret Guardian',
        description: 'Sworn to protect an ancient secret that could save or doom the kingdom.',
        coreTension: 'The burden of knowledge versus the desire for a normal life.',
        uniqueTwist: 'The secret they guard may actually be better left hidden.',
        narrativePotential: 'Mystery and intrigue with potential for world-changing revelations.',
      },
      {
        title: 'The Lost Knight',
        description: 'A warrior searching for their forgotten past and true identity.',
        coreTension: "The fear that remembering their past might destroy who they've become.",
        uniqueTwist: 'Their amnesia was self-inflicted to escape unbearable guilt.',
        narrativePotential: 'Identity crisis with opportunities for self-discovery and reinvention.',
      },
    ],
  };

  beforeEach(() => {
    // Create mock logger
    mockLogger = createMockLogger();

    // Create mock LLM JSON service
    mockLlmJsonService = {
      clean: jest.fn().mockImplementation((input) => input),
      parseAndRepair: jest.fn().mockImplementation(async (input) => {
        if (typeof input === 'string') {
          return JSON.parse(input);
        }
        return input;
      }),
    };

    // Create mock LLM strategy factory (ConfigurableLLMAdapter)
    mockLlmStrategyFactory = {
      getAIDecision: jest.fn().mockResolvedValue(JSON.stringify(validLLMResponse)),
    };

    // Create mock LLM config manager
    mockLlmConfigManager = {
      loadConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
        name: 'Test Config',
      }),
      getActiveConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
        name: 'Test Config',
      }),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
    };

    // Mock the model creation function
    createThematicDirectionsFromLLMResponse.mockReturnValue(
      validLLMResponse.thematicDirections.map((dir, index) => ({
        id: `direction-${index + 1}`,
        conceptId: validConceptId,
        title: dir.title,
        description: dir.description,
        coreTension: dir.coreTension,
        uniqueTwist: dir.uniqueTwist,
        narrativePotential: dir.narrativePotential,
        createdAt: new Date().toISOString(),
        llmMetadata: {
          modelId: 'test-config',
          promptTokens: 100,
          responseTokens: 200,
          processingTime: 1000,
        },
      }))
    );

    // Create generator instance
    generator = new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor Validation', () => {
    it('should create instance with valid dependencies', () => {
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(ThematicDirectionGenerator);
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmJsonService is missing', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmStrategyFactory is missing', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmConfigManager is missing', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
        });
      }).toThrow();
    });

    it('should validate logger has required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing other required methods
      expect(() => {
        new ThematicDirectionGenerator({
          logger: invalidLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should validate llmJsonService has required methods', () => {
      const invalidService = { clean: jest.fn() }; // Missing parseAndRepair
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: invalidService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should validate llmStrategyFactory has required methods', () => {
      const invalidFactory = {}; // Missing getAIDecision
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: invalidFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should validate llmConfigManager has required methods', () => {
      const invalidManager = { loadConfiguration: jest.fn() }; // Missing other methods
      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: invalidManager,
        });
      }).toThrow();
    });
  });

  describe('generateDirections Method - Input Validation', () => {
    it('should throw error when conceptId is missing', async () => {
      await expect(
        generator.generateDirections(null, validCharacterConcept)
      ).rejects.toThrow('conceptId must be a non-empty string');
    });

    it('should throw error when conceptId is empty string', async () => {
      await expect(
        generator.generateDirections('', validCharacterConcept)
      ).rejects.toThrow('conceptId must be a non-empty string');
    });

    it('should throw error when conceptId is whitespace only', async () => {
      await expect(
        generator.generateDirections('   ', validCharacterConcept)
      ).rejects.toThrow('conceptId must be a non-empty string');
    });

    it('should throw error when conceptId is not a string', async () => {
      await expect(
        generator.generateDirections(123, validCharacterConcept)
      ).rejects.toThrow('conceptId must be a non-empty string');
    });

    it('should throw error when characterConcept is missing', async () => {
      await expect(
        generator.generateDirections(validConceptId, null)
      ).rejects.toThrow('characterConcept must be a non-empty string');
    });

    it('should throw error when characterConcept is empty string', async () => {
      await expect(
        generator.generateDirections(validConceptId, '')
      ).rejects.toThrow('characterConcept must be a non-empty string');
    });

    it('should throw error when characterConcept is whitespace only', async () => {
      await expect(
        generator.generateDirections(validConceptId, '   ')
      ).rejects.toThrow('characterConcept must be a non-empty string');
    });

    it('should throw error when characterConcept is not a string', async () => {
      await expect(
        generator.generateDirections(validConceptId, { concept: 'test' })
      ).rejects.toThrow('characterConcept must be a non-empty string');
    });
  });

  describe('generateDirections Method - Successful Generation', () => {
    it('should generate directions successfully with valid inputs', async () => {
      // Act
      const result = await generator.generateDirections(
        validConceptId,
        validCharacterConcept
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: 'direction-1',
        conceptId: validConceptId,
        title: 'The Fallen Noble',
      });

      // Verify LLM was called with correct parameters
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
        expect.stringContaining(validCharacterConcept),
        null,
        {
          toolSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
          toolName: 'generate_thematic_directions',
          toolDescription: expect.any(String),
        }
      );

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting generation'),
        expect.objectContaining({
          conceptId: validConceptId,
          conceptLength: validCharacterConcept.length,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated'),
        expect.objectContaining({
          conceptId: validConceptId,
          directionCount: 3,
          processingTime: expect.any(Number),
        })
      );
    });

    it('should use custom LLM config when provided', async () => {
      const customConfigId = 'custom-llm-config';
      
      // Act
      await generator.generateDirections(
        validConceptId,
        validCharacterConcept,
        { llmConfigId: customConfigId }
      );

      // Assert
      expect(mockLlmConfigManager.setActiveConfiguration).toHaveBeenCalledWith(
        customConfigId
      );
    });

    it('should load custom LLM config if setActiveConfiguration fails', async () => {
      const customConfigId = 'custom-llm-config';
      mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(false);
      mockLlmConfigManager.loadConfiguration.mockResolvedValue({
        configId: customConfigId,
        name: 'Custom Config',
      });

      // Act
      await generator.generateDirections(
        validConceptId,
        validCharacterConcept,
        { llmConfigId: customConfigId }
      );

      // Assert
      expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith(
        customConfigId
      );
    });

    it('should throw error if custom LLM config not found', async () => {
      const customConfigId = 'non-existent-config';
      mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(false);
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

      // Act & Assert
      await expect(
        generator.generateDirections(
          validConceptId,
          validCharacterConcept,
          { llmConfigId: customConfigId }
        )
      ).rejects.toThrow(`LLM configuration not found: ${customConfigId}`);
    });
  });

  describe('generateDirections Method - LLM Integration', () => {
    it('should handle LLM request failure', async () => {
      const llmError = new Error('LLM service unavailable');
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(llmError);

      await expect(
        generator.generateDirections(validConceptId, validCharacterConcept)
      ).rejects.toThrow('LLM request failed: LLM service unavailable');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Generation failed'),
        expect.objectContaining({
          conceptId: validConceptId,
          error: expect.stringContaining('LLM request failed'),
        })
      );
    });

    it('should throw error when no active LLM configuration', async () => {
      mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(null);

      await expect(
        generator.generateDirections(validConceptId, validCharacterConcept)
      ).rejects.toThrow('No active LLM configuration found');
    });

    it('should handle JSON parsing errors', async () => {
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue('invalid json');
      mockLlmJsonService.parseAndRepair.mockRejectedValue(
        new Error('Invalid JSON')
      );

      await expect(
        generator.generateDirections(validConceptId, validCharacterConcept)
      ).rejects.toThrow('Failed to parse LLM response');
    });

    it('should handle response validation errors', async () => {
      const invalidResponse = {
        thematicDirections: [
          {
            // Missing required fields
            title: 'Test Title',
          },
        ],
      };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
        JSON.stringify(invalidResponse)
      );
      mockLlmJsonService.parseAndRepair.mockResolvedValue(invalidResponse);

      // Mock validation to throw error
      jest.spyOn(generator, 'validateResponse').mockImplementation(() => {
        throw new Error('Invalid response structure');
      });

      await expect(
        generator.generateDirections(validConceptId, validCharacterConcept)
      ).rejects.toThrow('Invalid response structure');
    });

    it('should handle empty LLM response', async () => {
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue('');

      await expect(
        generator.generateDirections(validConceptId, validCharacterConcept)
      ).rejects.toThrow();
    });

    it('should handle malformed JSON with repair', async () => {
      const malformedJson = '{"thematicDirections": [{"title": "Test"';
      const repairedJson = { thematicDirections: [{ title: 'Test' }] };

      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(malformedJson);
      mockLlmJsonService.clean.mockReturnValue(malformedJson);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(repairedJson);

      // Mock validation to throw since repaired JSON is incomplete
      jest.spyOn(generator, 'validateResponse').mockImplementation(() => {
        throw new Error('Invalid response structure');
      });

      await expect(
        generator.generateDirections(validConceptId, validCharacterConcept)
      ).rejects.toThrow('Invalid response structure');

      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledWith(
        malformedJson,
        { logger: mockLogger }
      );
    });
  });

  describe('Public API Methods', () => {
    it('should validate response correctly with validateResponse method', () => {
      // Valid response
      expect(() => {
        generator.validateResponse(validLLMResponse);
      }).not.toThrow();

      // Invalid response
      const invalidResponse = {
        thematicDirections: [
          {
            title: 'Test',
            // Missing other required fields
          },
        ],
      };

      expect(() => {
        generator.validateResponse(invalidResponse);
      }).toThrow();
    });

    it('should return correct schema with getResponseSchema method', () => {
      const schema = generator.getResponseSchema();
      
      expect(schema).toBe(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA);
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties.thematicDirections');
      expect(schema.properties.thematicDirections).toHaveProperty('type', 'array');
      expect(schema.properties.thematicDirections).toHaveProperty('minItems', 3);
      expect(schema.properties.thematicDirections).toHaveProperty('maxItems', 5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should wrap non-ThematicDirectionGenerationError errors', async () => {
      const customError = new Error('Custom error');
      
      mockLlmStrategyFactory.getAIDecision.mockRejectedValue(customError);

      await expect(
        generator.generateDirections(validConceptId, validCharacterConcept)
      ).rejects.toThrow('LLM request failed: Custom error');
    });

    it('should handle very long character concepts', async () => {
      const longConcept = 'A' + ' very'.repeat(1000) + ' long character concept';
      
      const result = await generator.generateDirections(
        validConceptId,
        longConcept
      );

      expect(result).toHaveLength(3);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          promptLength: expect.any(Number),
        })
      );
    });

    it('should estimate tokens correctly', async () => {
      await generator.generateDirections(validConceptId, validCharacterConcept);

      // Check that token estimation was called
      expect(createThematicDirectionsFromLLMResponse).toHaveBeenCalledWith(
        validConceptId,
        validLLMResponse.thematicDirections,
        expect.objectContaining({
          promptTokens: expect.any(Number),
          responseTokens: expect.any(Number),
        })
      );
    });

    it('should handle concurrent generation requests', async () => {
      // Start multiple generation requests
      const promises = [
        generator.generateDirections(validConceptId, 'Concept 1'),
        generator.generateDirections('concept-456', 'Concept 2'),
        generator.generateDirections('concept-789', 'Concept 3'),
      ];

      // All should resolve successfully
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveLength(3);
      });

      // Verify LLM was called 3 times
      expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(3);
    });

    it('should log debug messages throughout the process', async () => {
      await generator.generateDirections(validConceptId, validCharacterConcept);

      // Verify debug logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Built prompt'),
        expect.any(Object)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Received LLM response'),
        expect.any(Object)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully parsed')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Response structure validated')
      );
    });
  });

  describe('Response Processing', () => {
    it('should clean response before parsing', async () => {
      const dirtyResponse = '  \n\n{"thematicDirections": [...]}  \n\n';
      const cleanedResponse = '{"thematicDirections": [...]}';
      
      mockLlmStrategyFactory.getAIDecision.mockResolvedValue(dirtyResponse);
      mockLlmJsonService.clean.mockReturnValue(cleanedResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(validLLMResponse);

      await generator.generateDirections(validConceptId, validCharacterConcept);

      expect(mockLlmJsonService.clean).toHaveBeenCalledWith(dirtyResponse);
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledWith(
        cleanedResponse,
        { logger: mockLogger }
      );
    });

    it('should include LLM metadata in generated directions', async () => {
      const result = await generator.generateDirections(
        validConceptId,
        validCharacterConcept
      );

      expect(createThematicDirectionsFromLLMResponse).toHaveBeenCalledWith(
        validConceptId,
        validLLMResponse.thematicDirections,
        expect.objectContaining({
          modelId: 'test-config',
          promptTokens: expect.any(Number),
          responseTokens: expect.any(Number),
          processingTime: expect.any(Number),
        })
      );
    });
  });
});