/**
 * @file Unit tests for ClicheGenerator service
 * @see src/characterBuilder/services/ClicheGenerator.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  ClicheGenerator,
  ClicheGenerationError,
} from '../../../../src/characterBuilder/services/ClicheGenerator.js';
import {
  DEFAULT_ENHANCEMENT_OPTIONS,
  PROMPT_VERSION_INFO,
} from '../../../../src/characterBuilder/prompts/clicheGenerationPrompt.js';

describe('ClicheGenerator', () => {
  let service;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;

  // Sample valid LLM response
  const validLlmResponse = {
    categories: {
      names: ['John', 'Mary', 'Bob'],
      physicalDescriptions: ['tall and dark', 'blonde hair'],
      personalityTraits: ['brooding', 'cheerful'],
      skillsAbilities: ['swordsmanship', 'magic'],
      typicalLikes: ['justice', 'freedom'],
      typicalDislikes: ['evil', 'tyranny'],
      commonFears: ['death', 'failure'],
      genericGoals: ['save the world', 'find love'],
      backgroundElements: ['orphaned', 'royal bloodline'],
      overusedSecrets: ['secret power', 'hidden identity'],
      speechPatterns: ['ye olde english', 'catchphrases'],
    },
    tropesAndStereotypes: ['chosen one', 'reluctant hero'],
  };

  // Sample thematic direction
  const sampleDirection = {
    title: 'The Reluctant Guardian',
    description:
      'A character who must protect something they never wanted to guard',
    coreTension: 'Duty versus personal freedom',
  };

  beforeEach(() => {
    // Create mocks for all dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn().mockReturnValue('{"cleaned": "response"}'),
      parseAndRepair: jest.fn().mockResolvedValue(validLlmResponse),
    };

    mockLlmStrategyFactory = {
      getAIDecision: jest.fn().mockResolvedValue('{"mocked": "response"}'),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-model',
      }),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(() => {
        service = new ClicheGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).not.toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing info, warn, error

      expect(() => {
        new ClicheGenerator({
          logger: invalidLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmJsonService is missing required methods', () => {
      const invalidService = { clean: jest.fn() }; // Missing parseAndRepair

      expect(() => {
        new ClicheGenerator({
          logger: mockLogger,
          llmJsonService: invalidService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmStrategyFactory is missing required methods', () => {
      const invalidFactory = {}; // Missing getAIDecision

      expect(() => {
        new ClicheGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: invalidFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmConfigManager is missing required methods', () => {
      const invalidManager = { loadConfiguration: jest.fn() }; // Missing other methods

      expect(() => {
        new ClicheGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: invalidManager,
        });
      }).toThrow();
    });
  });

  describe('generateCliches', () => {
    beforeEach(() => {
      service = new ClicheGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
      });
    });

    describe('input validation', () => {
      it('should throw error when conceptId is empty string', async () => {
        await expect(
          service.generateCliches('', 'concept text', sampleDirection)
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should throw error when conceptId is not string', async () => {
        await expect(
          service.generateCliches(123, 'concept text', sampleDirection)
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should throw error when conceptText is empty string', async () => {
        await expect(
          service.generateCliches('concept-1', '', sampleDirection)
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should throw error when conceptText is not string', async () => {
        await expect(
          service.generateCliches('concept-1', null, sampleDirection)
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should throw error when direction is not object', async () => {
        await expect(
          service.generateCliches('concept-1', 'concept text', null)
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should throw error when direction is missing required fields', async () => {
        const invalidDirection = { title: 'Test' }; // Missing description and coreTension

        await expect(
          service.generateCliches('concept-1', 'concept text', invalidDirection)
        ).rejects.toThrow();
      });
    });

    describe('successful generation', () => {
      it('should generate clichés successfully with valid inputs', async () => {
        const result = await service.generateCliches(
          'concept-1',
          'A brave warrior',
          sampleDirection
        );

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('conceptId', 'concept-1');
        expect(result[0]).toHaveProperty('categories');
        expect(result[0]).toHaveProperty('tropesAndStereotypes');

        // Verify LLM was called
        expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledTimes(1);
        expect(mockLlmJsonService.clean).toHaveBeenCalledTimes(1);
        expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledTimes(1);
      });

      it('should use custom LLM config when provided', async () => {
        await service.generateCliches(
          'concept-1',
          'A brave warrior',
          sampleDirection,
          { llmConfigId: 'custom-config' }
        );

        expect(
          mockLlmConfigManager.setActiveConfiguration
        ).toHaveBeenCalledWith('custom-config');
      });

      it('should log generation start and success', async () => {
        await service.generateCliches(
          'concept-1',
          'A brave warrior',
          sampleDirection
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'ClicheGenerator: Starting generation for concept concept-1',
          expect.any(Object)
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'ClicheGenerator: Successfully generated clichés',
          expect.any(Object)
        );
      });

      it('should include processing time in metadata', async () => {
        const result = await service.generateCliches(
          'concept-1',
          'A brave warrior',
          sampleDirection
        );

        expect(result[0].llmMetadata).toHaveProperty('processingTime');
        expect(result[0].llmMetadata.processingTime).toBeGreaterThanOrEqual(0);
      });

      it('should include token estimates in metadata', async () => {
        const result = await service.generateCliches(
          'concept-1',
          'A brave warrior',
          sampleDirection
        );

        expect(result[0].llmMetadata).toHaveProperty('promptTokens');
        expect(result[0].llmMetadata).toHaveProperty('responseTokens');
        expect(result[0].llmMetadata.promptTokens).toBeGreaterThan(0);
        expect(result[0].llmMetadata.responseTokens).toBeGreaterThan(0);
      });
    });

    describe('error handling', () => {
      it('should throw ClicheGenerationError when LLM call fails', async () => {
        mockLlmStrategyFactory.getAIDecision.mockRejectedValue(
          new Error('LLM service unavailable')
        );

        await expect(
          service.generateCliches(
            'concept-1',
            'A brave warrior',
            sampleDirection
          )
        ).rejects.toThrow(ClicheGenerationError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'ClicheGenerator: Generation failed',
          expect.any(Object)
        );
      });

      it('should throw ClicheGenerationError when JSON parsing fails', async () => {
        mockLlmJsonService.parseAndRepair.mockRejectedValue(
          new Error('Invalid JSON')
        );

        await expect(
          service.generateCliches(
            'concept-1',
            'A brave warrior',
            sampleDirection
          )
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should throw ClicheGenerationError when response validation fails', async () => {
        const invalidResponse = {
          categories: {},
          tropesAndStereotypes: 'invalid',
        }; // tropesAndStereotypes should be array
        mockLlmJsonService.parseAndRepair.mockResolvedValue(invalidResponse);

        await expect(
          service.generateCliches(
            'concept-1',
            'A brave warrior',
            sampleDirection
          )
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should throw ClicheGenerationError when no active LLM config', async () => {
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(null);

        await expect(
          service.generateCliches(
            'concept-1',
            'A brave warrior',
            sampleDirection
          )
        ).rejects.toThrow(ClicheGenerationError);
      });

      it('should handle LLM config loading failure', async () => {
        mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(false);
        mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

        await expect(
          service.generateCliches(
            'concept-1',
            'A brave warrior',
            sampleDirection,
            { llmConfigId: 'missing-config' }
          )
        ).rejects.toThrow(ClicheGenerationError);
      });
    });
  });

  describe('validateResponse', () => {
    beforeEach(() => {
      service = new ClicheGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
      });
    });

    it('should return true for valid response', () => {
      const result = service.validateResponse(validLlmResponse);
      expect(result).toBe(true);
    });

    it('should throw error for invalid response structure', () => {
      const invalidResponse = {
        categories: {},
        tropesAndStereotypes: 'invalid',
      };

      expect(() => {
        service.validateResponse(invalidResponse);
      }).toThrow();
    });
  });

  describe('getResponseSchema', () => {
    beforeEach(() => {
      service = new ClicheGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
      });
    });

    it('should return the response schema object', () => {
      const schema = service.getResponseSchema();

      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema.properties).toHaveProperty('categories');
      expect(schema.properties).toHaveProperty('tropesAndStereotypes');
    });
  });

  describe('Enhancement Features', () => {
    describe('generateCliches with enhancement options', () => {
      beforeEach(() => {
        // Mock successful LLM response
        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.clean.mockReturnValue(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.parseAndRepair.mockResolvedValue(validLlmResponse);
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue({
          configId: 'test-config',
        });
      });

      it('should use standard prompt by default', async () => {
        const result = await service.generateCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection
        );

        expect(result).toHaveLength(1);
        expect(result[0].llmMetadata.enhanced).toBe(false);
        expect(result[0].llmMetadata.promptVersion).toBe('1.0.0');
      });

      it('should use enhanced prompt when requested', async () => {
        const result = await service.generateCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection,
          {
            useEnhancedPrompt: true,
            enhancementOptions: { genre: 'fantasy' },
          }
        );

        expect(result).toHaveLength(1);
        expect(result[0].llmMetadata.enhanced).toBe(true);
        expect(result[0].llmMetadata.promptVersion).toBe(
          PROMPT_VERSION_INFO.version
        );
        expect(result[0].llmMetadata.qualityMetrics).not.toBeNull();
      });

      it('should include quality metrics with enhanced validation', async () => {
        const result = await service.generateCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection,
          {
            useEnhancedPrompt: true,
            enhancementOptions: { enableAdvancedValidation: true },
          }
        );

        expect(result[0].llmMetadata.qualityMetrics).toBeDefined();
        expect(result[0].llmMetadata.validationWarnings).toBeDefined();
        expect(result[0].llmMetadata.recommendations).toBeDefined();
        expect(Array.isArray(result[0].llmMetadata.validationWarnings)).toBe(
          true
        );
        expect(Array.isArray(result[0].llmMetadata.recommendations)).toBe(true);
      });

      it('should skip enhanced validation when disabled', async () => {
        const result = await service.generateCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection,
          {
            useEnhancedPrompt: true,
            enhancementOptions: { enableAdvancedValidation: false },
          }
        );

        expect(result[0].llmMetadata.qualityMetrics).toBeNull();
        expect(result[0].llmMetadata.validationWarnings).toEqual([]);
        expect(result[0].llmMetadata.recommendations).toEqual([]);
      });

      it('should log warnings when quality issues detected', async () => {
        const sparseResponse = {
          categories: {
            names: ['John'], // Only 1 item - will trigger warning
            physicalDescriptions: ['tall', 'dark'], // 2 items - will trigger warning
            personalityTraits: ['brooding', 'cheerful', 'brave'],
            skillsAbilities: ['swordsmanship', 'magic', 'archery'],
            typicalLikes: ['justice', 'freedom', 'honor'],
            typicalDislikes: ['evil', 'tyranny', 'dishonesty'],
            commonFears: ['death', 'failure', 'betrayal'],
            genericGoals: ['save world', 'find love', 'get revenge'],
            backgroundElements: ['orphaned', 'royal', 'trained'],
            overusedSecrets: ['secret power', 'hidden identity', 'prophecy'],
            speechPatterns: ['heroic', 'noble', 'inspiring'],
          },
          tropesAndStereotypes: ['chosen one', 'reluctant hero'],
        };

        // Reset mocks to use sparse response
        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
          JSON.stringify(sparseResponse)
        );
        mockLlmJsonService.clean.mockReturnValue(
          JSON.stringify(sparseResponse)
        );
        mockLlmJsonService.parseAndRepair.mockResolvedValue(sparseResponse);
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue({
          configId: 'test-config',
        });

        const result = await service.generateCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection,
          {
            useEnhancedPrompt: true,
            enhancementOptions: { enableAdvancedValidation: true },
          }
        );

        // Verify warnings were generated in metadata
        expect(result[0].llmMetadata.validationWarnings.length).toBeGreaterThan(
          0
        );
        const hasExpectedWarning =
          result[0].llmMetadata.validationWarnings.some((warning) =>
            warning.includes('Category "physicalDescriptions" has only 2 items')
          );
        expect(hasExpectedWarning).toBe(true);
      });

      it('should handle enhanced validation errors gracefully', async () => {
        const invalidResponse = { invalid: 'response' };

        // Create a new service instance with fresh mocks to avoid conflicts
        const testService = new ClicheGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });

        // Set up mocks for this specific test
        mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(
          JSON.stringify(invalidResponse)
        );
        mockLlmJsonService.clean.mockReturnValueOnce(
          JSON.stringify(invalidResponse)
        );
        mockLlmJsonService.parseAndRepair.mockResolvedValueOnce(
          invalidResponse
        );
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValueOnce({
          configId: 'test-config',
        });

        await expect(
          testService.generateCliches(
            'test-concept-id',
            'A brave warrior',
            sampleDirection,
            {
              useEnhancedPrompt: true,
              enhancementOptions: { enableAdvancedValidation: true },
            }
          )
        ).rejects.toThrow(ClicheGenerationError);
      });
    });

    describe('generateEnhancedCliches', () => {
      beforeEach(() => {
        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.clean.mockReturnValue(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.parseAndRepair.mockResolvedValue(validLlmResponse);
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue({
          configId: 'test-config',
        });
      });

      it('should generate clichés with enhancements by default', async () => {
        const result = await service.generateEnhancedCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection
        );

        expect(result).toHaveLength(1);
        expect(result[0].llmMetadata.enhanced).toBe(true);
        expect(result[0].llmMetadata.promptVersion).toBe(
          PROMPT_VERSION_INFO.version
        );
      });

      it('should accept custom enhancement options', async () => {
        const customOptions = {
          genre: 'fantasy',
          includeFewShotExamples: true,
          minItemsPerCategory: 5,
        };

        const result = await service.generateEnhancedCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection,
          customOptions
        );

        expect(result).toHaveLength(1);
        expect(result[0].llmMetadata.enhanced).toBe(true);
      });

      it('should merge enhancement options with defaults', async () => {
        const customOptions = {
          genre: 'scifi',
          includeFewShotExamples: true,
          // Other options should use defaults
        };

        const result = await service.generateEnhancedCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection,
          customOptions
        );

        expect(result).toHaveLength(1);
        // Should have quality metrics enabled by default
        expect(result[0].llmMetadata.qualityMetrics).not.toBeNull();
      });

      it('should accept additional generation options', async () => {
        const enhancementOptions = { genre: 'horror' };
        const additionalOptions = { llmConfigId: 'custom-config' };

        // Create a fresh service instance to avoid mock state issues
        const testService = new ClicheGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });

        // Clear previous calls and set up fresh mocks
        mockLlmConfigManager.setActiveConfiguration.mockClear();
        mockLlmConfigManager.setActiveConfiguration.mockResolvedValueOnce(true);
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValueOnce({
          configId: 'custom-config',
        });
        mockLlmStrategyFactory.getAIDecision.mockResolvedValueOnce(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.clean.mockReturnValueOnce(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.parseAndRepair.mockResolvedValueOnce(
          validLlmResponse
        );

        await testService.generateEnhancedCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection,
          enhancementOptions,
          additionalOptions
        );

        expect(
          mockLlmConfigManager.setActiveConfiguration
        ).toHaveBeenCalledWith('custom-config');
      });

      it('should handle errors in enhanced generation', async () => {
        // Create a new service instance for this test
        const testService = new ClicheGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });

        mockLlmStrategyFactory.getAIDecision.mockRejectedValueOnce(
          new Error('LLM request failed')
        );

        await expect(
          testService.generateEnhancedCliches(
            'test-concept-id',
            'A brave warrior',
            sampleDirection
          )
        ).rejects.toThrow(ClicheGenerationError);
      });
    });

    describe('utility methods', () => {
      it('should return prompt version info', () => {
        const versionInfo = service.getPromptVersionInfo();

        expect(versionInfo).toEqual(PROMPT_VERSION_INFO);
        expect(versionInfo.version).toBe('1.2.0');
        expect(versionInfo).toHaveProperty('previousVersions');
        expect(versionInfo).toHaveProperty('currentChanges');
      });

      it('should return default enhancement options', () => {
        const defaultOptions = service.getDefaultEnhancementOptions();

        expect(defaultOptions).toEqual(DEFAULT_ENHANCEMENT_OPTIONS);
        expect(defaultOptions.includeFewShotExamples).toBe(false);
        expect(defaultOptions.genre).toBeNull();
        expect(defaultOptions.minItemsPerCategory).toBe(3);
        expect(defaultOptions.maxItemsPerCategory).toBe(8);
        expect(defaultOptions.enableAdvancedValidation).toBe(true);
        expect(defaultOptions.includeQualityMetrics).toBe(true);
      });

      it('should return copy of default options to prevent mutation', () => {
        const defaultOptions1 = service.getDefaultEnhancementOptions();
        const defaultOptions2 = service.getDefaultEnhancementOptions();

        defaultOptions1.genre = 'modified';

        expect(defaultOptions2.genre).toBeNull(); // Should not be affected
      });
    });

    describe('backward compatibility', () => {
      beforeEach(() => {
        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.clean.mockReturnValue(
          JSON.stringify(validLlmResponse)
        );
        mockLlmJsonService.parseAndRepair.mockResolvedValue(validLlmResponse);
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue({
          configId: 'test-config',
        });
      });

      it('should work exactly as before without enhancement options', async () => {
        const result = await service.generateCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('conceptId');
        expect(result[0]).toHaveProperty('categories');
        expect(result[0]).toHaveProperty('tropesAndStereotypes');
        expect(result[0]).toHaveProperty('llmMetadata');
        expect(result[0].llmMetadata.enhanced).toBe(false);
      });

      it('should maintain existing method signatures', () => {
        // These methods should exist and work as before
        expect(typeof service.validateResponse).toBe('function');
        expect(typeof service.getResponseSchema).toBe('function');

        const isValid = service.validateResponse(validLlmResponse);
        expect(isValid).toBe(true);

        const schema = service.getResponseSchema();
        expect(schema).toBeDefined();
        expect(schema).toHaveProperty('properties');
      });

      it('should generate same metadata structure for standard mode', async () => {
        const result = await service.generateCliches(
          'test-concept-id',
          'A brave warrior',
          sampleDirection
        );

        const metadata = result[0].llmMetadata;

        // Standard metadata fields should exist
        expect(metadata).toHaveProperty('modelId');
        expect(metadata).toHaveProperty('promptTokens');
        expect(metadata).toHaveProperty('responseTokens');
        expect(metadata).toHaveProperty('processingTime');

        // Enhanced fields should have default values
        expect(metadata.promptVersion).toBe('1.0.0');
        expect(metadata.enhanced).toBe(false);
        expect(metadata.qualityMetrics).toBeNull();
        expect(metadata.validationWarnings).toEqual([]);
        expect(metadata.recommendations).toEqual([]);
      });
    });
  });
});

describe('ClicheGenerationError', () => {
  it('should create error with message and cause', () => {
    const cause = new Error('Original error');
    const error = new ClicheGenerationError('Custom message', cause);

    expect(error.message).toBe('Custom message');
    expect(error.name).toBe('ClicheGenerationError');
    expect(error.cause).toBe(cause);
  });

  it('should create error without cause', () => {
    const error = new ClicheGenerationError('Custom message');

    expect(error.message).toBe('Custom message');
    expect(error.name).toBe('ClicheGenerationError');
    expect(error.cause).toBeUndefined();
  });
});
