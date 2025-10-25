/**
 * @file Unit tests for ThematicDirectionGenerator
 * @see src/characterBuilder/services/thematicDirectionGenerator.js
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
  ThematicDirectionGenerator,
  ThematicDirectionGenerationError,
} from '../../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import * as ThematicDirectionModel from '../../../../src/characterBuilder/models/thematicDirection.js';
import {
  THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
  buildThematicDirectionsPrompt,
  validateThematicDirectionsResponse,
} from '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js';

describe('ThematicDirectionGenerator', () => {
  let generator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;

  beforeEach(() => {
    // Create mocks for all dependencies
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

    mockLlmStrategyFactory = {
      getAIDecision: jest.fn(),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
      getActiveConfiguration: jest.fn(),
      setActiveConfiguration: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(() => {
        generator = new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).not.toThrow();
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ThematicDirectionGenerator({
          logger: null,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing info, warn, error

      expect(() => {
        new ThematicDirectionGenerator({
          logger: invalidLogger,
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
          llmJsonService: null,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmJsonService is missing required methods', () => {
      const invalidLlmJsonService = { clean: jest.fn() }; // Missing parseAndRepair

      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: invalidLlmJsonService,
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
          llmStrategyFactory: null,
          llmConfigManager: mockLlmConfigManager,
        });
      }).toThrow();
    });

    it('should throw error when llmStrategyFactory is missing required methods', () => {
      const invalidLlmStrategyFactory = {}; // Missing getAIDecision

      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: invalidLlmStrategyFactory,
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
          llmConfigManager: null,
        });
      }).toThrow();
    });

    it('should throw error when llmConfigManager is missing required methods', () => {
      const invalidLlmConfigManager = { loadConfiguration: jest.fn() }; // Missing other methods

      expect(() => {
        new ThematicDirectionGenerator({
          logger: mockLogger,
          llmJsonService: mockLlmJsonService,
          llmStrategyFactory: mockLlmStrategyFactory,
          llmConfigManager: invalidLlmConfigManager,
        });
      }).toThrow();
    });
  });

  describe('generateDirections', () => {
    beforeEach(() => {
      generator = new ThematicDirectionGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
      });
    });

    describe('parameter validation', () => {
      it('should throw error for null conceptId', async () => {
        await expect(
          generator.generateDirections(null, 'valid concept')
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(null, 'valid concept')
        ).rejects.toThrow('conceptId must be a non-empty string');
      });

      it('should throw error for undefined conceptId', async () => {
        await expect(
          generator.generateDirections(undefined, 'valid concept')
        ).rejects.toThrow(ThematicDirectionGenerationError);
      });

      it('should throw error for empty conceptId', async () => {
        await expect(
          generator.generateDirections('', 'valid concept')
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections('   ', 'valid concept')
        ).rejects.toThrow(ThematicDirectionGenerationError);
      });

      it('should throw error for non-string conceptId', async () => {
        await expect(
          generator.generateDirections(123, 'valid concept')
        ).rejects.toThrow(ThematicDirectionGenerationError);
      });

      it('should throw error for null characterConcept', async () => {
        await expect(
          generator.generateDirections('concept-id', null)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections('concept-id', null)
        ).rejects.toThrow('characterConcept must be a non-empty string');
      });

      it('should throw error for undefined characterConcept', async () => {
        await expect(
          generator.generateDirections('concept-id', undefined)
        ).rejects.toThrow(ThematicDirectionGenerationError);
      });

      it('should throw error for empty characterConcept', async () => {
        await expect(
          generator.generateDirections('concept-id', '')
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections('concept-id', '   ')
        ).rejects.toThrow(ThematicDirectionGenerationError);
      });

      it('should throw error for non-string characterConcept', async () => {
        await expect(
          generator.generateDirections('concept-id', 123)
        ).rejects.toThrow(ThematicDirectionGenerationError);
      });
    });

    describe('successful generation', () => {
      const validConceptId = 'test-concept-id';
      const validCharacterConcept = 'A brave warrior seeking redemption';
      const mockLlmResponse = `{
        "thematicDirections": [
          {
            "title": "Path of Redemption",
            "description": "A journey of atonement for past mistakes and finding inner peace through service to others.",
            "coreTension": "The conflict between past sins and the desire for forgiveness",
            "uniqueTwist": "The warrior must face their former victims to earn redemption",
            "narrativePotential": "Opportunities for moral choices, character growth, and emotional confrontations with the past"
          },
          {
            "title": "Guardian's Burden",
            "description": "Taking responsibility for protecting those who cannot protect themselves while struggling with personal demons.",
            "coreTension": "The weight of responsibility versus personal desires and limitations",
            "uniqueTwist": "The guardian's power comes at the cost of their own humanity",
            "narrativePotential": "Explores themes of sacrifice, duty, and the price of heroism in a complex moral landscape"
          },
          {
            "title": "Lost Honor Reclaimed",
            "description": "Rebuilding reputation and honor after a fall from grace through deeds rather than words.",
            "coreTension": "Society's judgment versus personal knowledge of one's true character",
            "uniqueTwist": "The character must choose between easy vindication and harder genuine growth",
            "narrativePotential": "Character development through actions, facing prejudice, and proving worth to skeptical allies"
          }
        ]
      }`;

      const mockParsedResponse = {
        thematicDirections: [
          {
            title: 'Path of Redemption',
            description:
              'A journey of atonement for past mistakes and finding inner peace through service to others.',
            coreTension:
              'The conflict between past sins and the desire for forgiveness',
            uniqueTwist:
              'The warrior must face their former victims to earn redemption',
            narrativePotential:
              'Opportunities for moral choices, character growth, and emotional confrontations with the past',
          },
          {
            title: "Guardian's Burden",
            description:
              'Taking responsibility for protecting those who cannot protect themselves while struggling with personal demons.',
            coreTension:
              'The weight of responsibility versus personal desires and limitations',
            uniqueTwist:
              "The guardian's power comes at the cost of their own humanity",
            narrativePotential:
              'Explores themes of sacrifice, duty, and the price of heroism in a complex moral landscape',
          },
          {
            title: 'Lost Honor Reclaimed',
            description:
              'Rebuilding reputation and honor after a fall from grace through deeds rather than words.',
            coreTension:
              "Society's judgment versus personal knowledge of one's true character",
            uniqueTwist:
              'The character must choose between easy vindication and harder genuine growth',
            narrativePotential:
              'Character development through actions, facing prejudice, and proving worth to skeptical allies',
          },
        ],
      };

      const mockActiveConfig = {
        configId: 'test-model-config',
      };

      beforeEach(() => {
        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
        mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
        mockLlmJsonService.parseAndRepair.mockResolvedValue(mockParsedResponse);
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(
          mockActiveConfig
        );

        // Mock the validation function to succeed
        jest.doMock(
          '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js',
          () => ({
            ...jest.requireActual(
              '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js'
            ),
            validateThematicDirectionsResponse: jest.fn().mockReturnValue(true),
          })
        );
      });

      it('should generate thematic directions successfully', async () => {
        const result = await generator.generateDirections(
          validConceptId,
          validCharacterConcept
        );

        expect(result).toHaveLength(3);
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('conceptId', validConceptId);
        expect(result[0]).toHaveProperty('title', 'Path of Redemption');
        expect(result[0]).toHaveProperty('description');
        expect(result[0]).toHaveProperty('coreTension');
        expect(result[0]).toHaveProperty('uniqueTwist');
        expect(result[0]).toHaveProperty('narrativePotential');
        expect(result[0]).toHaveProperty('createdAt');
        expect(result[0]).toHaveProperty('llmMetadata');
      });

      it('should log generation start and success', async () => {
        await generator.generateDirections(
          validConceptId,
          validCharacterConcept
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Starting generation for concept'),
          expect.objectContaining({
            conceptId: validConceptId,
            conceptLength: validCharacterConcept.length,
          })
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Successfully generated thematic directions'),
          expect.objectContaining({
            conceptId: validConceptId,
            directionCount: 3,
            processingTime: expect.any(Number),
          })
        );
      });

      it('should call LLM with proper prompt and options', async () => {
        await generator.generateDirections(
          validConceptId,
          validCharacterConcept
        );

        expect(mockLlmStrategyFactory.getAIDecision).toHaveBeenCalledWith(
          expect.stringContaining(validCharacterConcept),
          null,
          expect.objectContaining({
            toolSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
            toolName: 'generate_thematic_directions',
            toolDescription: expect.stringContaining(
              'Generate thematic directions'
            ),
          })
        );
      });

      it('should process LLM response through JSON service', async () => {
        await generator.generateDirections(
          validConceptId,
          validCharacterConcept
        );

        expect(mockLlmJsonService.clean).toHaveBeenCalledWith(mockLlmResponse);
        expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledWith(
          mockLlmResponse,
          expect.objectContaining({
            logger: mockLogger,
          })
        );
      });

      it('should include LLM metadata in results', async () => {
        const result = await generator.generateDirections(
          validConceptId,
          validCharacterConcept
        );

        expect(result[0].llmMetadata).toEqual(
          expect.objectContaining({
            modelId: mockActiveConfig.configId,
            promptTokens: expect.any(Number),
            responseTokens: expect.any(Number),
            processingTime: expect.any(Number),
          })
        );
      });

      it('should default metadata modelId to unknown when active config lacks identifier', async () => {
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue({});

        const result = await generator.generateDirections(
          validConceptId,
          validCharacterConcept
        );

        expect(result[0].llmMetadata.modelId).toBe('unknown');
      });

      it('should use custom LLM config when provided', async () => {
        const customConfigId = 'custom-config';
        mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(true);

        await generator.generateDirections(
          validConceptId,
          validCharacterConcept,
          {
            llmConfigId: customConfigId,
          }
        );

        expect(
          mockLlmConfigManager.setActiveConfiguration
        ).toHaveBeenCalledWith(customConfigId);
      });

      it('should load configuration if setting active fails', async () => {
        const customConfigId = 'custom-config';
        const mockConfig = { configId: customConfigId };

        mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(false);
        mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockConfig);

        await generator.generateDirections(
          validConceptId,
          validCharacterConcept,
          {
            llmConfigId: customConfigId,
          }
        );

        expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith(
          customConfigId
        );
      });
    });

    describe('error handling', () => {
      const validConceptId = 'test-concept-id';
      const validCharacterConcept = 'A brave warrior seeking redemption';

      beforeEach(() => {
        // Reset all mocks to successful defaults
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue({
          configId: 'test-config',
        });
      });

      it('should throw error when no active LLM configuration', async () => {
        mockLlmConfigManager.getActiveConfiguration.mockResolvedValue(null);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow('No active LLM configuration found');
      });

      it('should throw error when custom LLM config not found', async () => {
        const customConfigId = 'non-existent-config';

        mockLlmConfigManager.setActiveConfiguration.mockResolvedValue(false);
        mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept, {
            llmConfigId: customConfigId,
          })
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept, {
            llmConfigId: customConfigId,
          })
        ).rejects.toThrow(`LLM configuration not found: ${customConfigId}`);
      });

      it('should throw error when LLM request fails', async () => {
        const llmError = new Error('LLM service unavailable');
        mockLlmStrategyFactory.getAIDecision.mockRejectedValue(llmError);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow('LLM request failed');
      });

      it('should throw error when JSON cleaning fails', async () => {
        const mockLlmResponse = 'valid response';
        const cleaningError = new Error('JSON cleaning failed');

        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
        mockLlmJsonService.clean.mockImplementation(() => {
          throw cleaningError;
        });

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow('Failed to parse LLM response');
      });

      it('should throw error when JSON parsing fails', async () => {
        const mockLlmResponse = 'valid response';
        const parsingError = new Error('JSON parsing failed');

        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
        mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
        mockLlmJsonService.parseAndRepair.mockRejectedValue(parsingError);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow('Failed to parse LLM response');
      });

      it('should throw error when response validation fails', async () => {
        const mockLlmResponse = 'valid response';
        const mockParsedResponse = { invalid: 'structure' };

        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
        mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
        mockLlmJsonService.parseAndRepair.mockResolvedValue(mockParsedResponse);

        // Mock validation to throw error
        jest.doMock(
          '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js',
          () => ({
            ...jest.requireActual(
              '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js'
            ),
            validateThematicDirectionsResponse: jest
              .fn()
              .mockImplementation(() => {
                throw new Error('Invalid response structure');
              }),
          })
        );

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow('Invalid response structure');
      });

      it('should log error when generation fails', async () => {
        const llmError = new Error('LLM service unavailable');
        mockLlmStrategyFactory.getAIDecision.mockRejectedValue(llmError);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Generation failed'),
          expect.objectContaining({
            conceptId: validConceptId,
            error: expect.stringContaining('LLM request failed'),
            processingTime: expect.any(Number),
          })
        );
      });

      it('should re-throw ThematicDirectionGenerationError from LLM call', async () => {
        const originalError = new ThematicDirectionGenerationError(
          'Original error'
        );
        mockLlmStrategyFactory.getAIDecision.mockRejectedValue(originalError);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);

        // The error will be wrapped by #callLLM, then re-thrown by generateDirections since it's already a ThematicDirectionGenerationError
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow('LLM request failed: Original error');
      });

      it('should wrap LLM errors in ThematicDirectionGenerationError', async () => {
        const genericError = new Error('Generic error');
        mockLlmStrategyFactory.getAIDecision.mockRejectedValue(genericError);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow('LLM request failed: Generic error');
      });

      it('should wrap non-LLM errors with full context', async () => {
        const mockLlmResponse = 'valid response';
        const mockParsedResponse = { thematicDirections: [] }; // This will cause validation to fail

        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
        mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
        mockLlmJsonService.parseAndRepair.mockResolvedValue(mockParsedResponse);

        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(ThematicDirectionGenerationError);
        await expect(
          generator.generateDirections(validConceptId, validCharacterConcept)
        ).rejects.toThrow(
          'Invalid response structure: ThematicDirectionsPrompt: Must contain 3-5 thematic directions'
        );
      });

      it('should wrap unexpected transformation errors with context and original cause', async () => {
        const mockLlmResponse = '{"thematicDirections": []}';
        const mockParsedResponse = {
          thematicDirections: [
            {
              title: 'Valid Direction',
              description:
                'A description long enough to satisfy validation expectations for thematic directions.',
              coreTension:
                'Some meaningful conflict that tests loyalties and personal convictions beyond the obvious battle.',
              uniqueTwist:
                'An unexpected twist that elaborates on the dramatic shift in the narrative arc.',
              narrativePotential:
                'Plenty of opportunities for exploration and dramatic development.',
            },
            {
              title: 'Second Direction',
              description:
                'Another sufficiently descriptive thematic direction for validation.',
              coreTension:
                'Another tension point that weighs community obligations against the call of distant adventures.',
              uniqueTwist:
                'Different twist that provides several surprising angles for the protagonist to explore.',
              narrativePotential:
                'Additional narrative potential to ensure validation passes.',
            },
            {
              title: 'Third Direction',
              description:
                'More descriptive content that should be acceptable for validation routines.',
              coreTension:
                'Tension three that challenges deeply held beliefs while forcing difficult compromises for allies.',
              uniqueTwist:
                'Twist three that introduces a detailed ethical dilemma to complicate the storyline further.',
              narrativePotential:
                'This ensures the validation sees a complete thematic direction.',
            },
          ],
        };

        mockLlmStrategyFactory.getAIDecision.mockResolvedValue(mockLlmResponse);
        mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
        mockLlmJsonService.parseAndRepair.mockResolvedValue(mockParsedResponse);

        const transformationError = new Error('Transformation failed');
        const createSpy = jest
          .spyOn(
            ThematicDirectionModel,
            'createThematicDirectionsFromLLMResponse'
          )
          .mockImplementation(() => {
            throw transformationError;
          });

        let caughtError;
        try {
          await generator.generateDirections(
            validConceptId,
            validCharacterConcept
          );
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).toBeInstanceOf(ThematicDirectionGenerationError);
        expect(caughtError?.message).toBe(
          `Failed to generate thematic directions for concept ${validConceptId}: ${transformationError.message}`
        );
        expect(caughtError?.cause).toBe(transformationError);

        createSpy.mockRestore();
      });
    });
  });

  describe('public utility methods', () => {
    beforeEach(() => {
      generator = new ThematicDirectionGenerator({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
        llmStrategyFactory: mockLlmStrategyFactory,
        llmConfigManager: mockLlmConfigManager,
      });
    });

    describe('validateResponse', () => {
      it('should validate correct response structure', () => {
        const validResponse = {
          thematicDirections: [
            {
              title: 'Test Direction',
              description:
                'A test thematic direction with sufficient length to meet validation requirements',
              coreTension: 'Core tension description',
              uniqueTwist: 'Unique twist description',
              narrativePotential:
                'Narrative potential description with enough content',
            },
            {
              title: 'Second Direction',
              description:
                'Another test thematic direction with sufficient length to meet validation requirements',
              coreTension: 'Another core tension description',
              uniqueTwist: 'Another unique twist description',
              narrativePotential:
                'Another narrative potential description with enough content',
            },
            {
              title: 'Third Direction',
              description:
                'A third test thematic direction with sufficient length to meet validation requirements',
              coreTension: 'A third core tension description',
              uniqueTwist: 'A third unique twist description',
              narrativePotential:
                'A third narrative potential description with enough content',
            },
          ],
        };

        expect(() => generator.validateResponse(validResponse)).not.toThrow();
      });

      it('should throw error for invalid response structure', () => {
        const invalidResponse = { invalid: 'structure' };

        // Mock the validation function to throw error
        jest.doMock(
          '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js',
          () => ({
            ...jest.requireActual(
              '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js'
            ),
            validateThematicDirectionsResponse: jest
              .fn()
              .mockImplementation(() => {
                throw new Error('Invalid structure');
              }),
          })
        );

        expect(() => generator.validateResponse(invalidResponse)).toThrow();
      });
    });

    describe('getResponseSchema', () => {
      it('should return the correct response schema', () => {
        const schema = generator.getResponseSchema();

        expect(schema).toEqual(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA);
        expect(schema).toHaveProperty('type', 'object');
        expect(schema).toHaveProperty('properties');
        expect(schema.properties).toHaveProperty('thematicDirections');
      });
    });
  });

  describe('ThematicDirectionGenerationError', () => {
    it('should create error with message and cause', () => {
      const cause = new Error('Original error');
      const error = new ThematicDirectionGenerationError('Test message', cause);

      expect(error.message).toBe('Test message');
      expect(error.name).toBe('ThematicDirectionGenerationError');
      expect(error.cause).toBe(cause);
      expect(error).toBeInstanceOf(Error);
    });

    it('should create error with message only', () => {
      const error = new ThematicDirectionGenerationError('Test message');

      expect(error.message).toBe('Test message');
      expect(error.name).toBe('ThematicDirectionGenerationError');
      expect(error.cause).toBeUndefined();
    });
  });
});
