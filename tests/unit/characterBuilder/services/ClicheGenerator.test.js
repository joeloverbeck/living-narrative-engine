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
