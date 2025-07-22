/**
 * @file Unit tests for CharacterBuilderService
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { CharacterBuilderService } from '../../../../src/characterBuilder/services/characterBuilderService.js';

/**
 * @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../../src/characterBuilder/services/characterStorageService.js').CharacterStorageService} CharacterStorageService
 * @typedef {import('../../../../src/characterBuilder/services/thematicDirectionGenerator.js').ThematicDirectionGenerator} ThematicDirectionGenerator
 * @typedef {import('../../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

describe('CharacterBuilderService', () => {
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<CharacterStorageService>} */
  let mockStorageService;
  /** @type {jest.Mocked<ThematicDirectionGenerator>} */
  let mockDirectionGenerator;
  /** @type {jest.Mocked<ISafeEventDispatcher>} */
  let mockEventBus;
  /** @type {CharacterBuilderService} */
  let service;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockStorageService = {
      initialize: jest.fn(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
      validateResponse: jest.fn(),
      getResponseSchema: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    service = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(CharacterBuilderService);
    });

    test('should throw error if logger is invalid', () => {
      expect(() => {
        new CharacterBuilderService({
          logger: null,
          storageService: mockStorageService,
          directionGenerator: mockDirectionGenerator,
          eventBus: mockEventBus,
        });
      }).toThrow('Missing required dependency: ILogger.');
    });

    test('should throw error if storageService is invalid', () => {
      expect(() => {
        new CharacterBuilderService({
          logger: mockLogger,
          storageService: null,
          directionGenerator: mockDirectionGenerator,
          eventBus: mockEventBus,
        });
      }).toThrow('Missing required dependency: CharacterStorageService.');
    });

    test('should throw error if directionGenerator is invalid', () => {
      expect(() => {
        new CharacterBuilderService({
          logger: mockLogger,
          storageService: mockStorageService,
          directionGenerator: null,
          eventBus: mockEventBus,
        });
      }).toThrow('Missing required dependency: ThematicDirectionGenerator.');
    });

    test('should throw error if eventBus is invalid', () => {
      expect(() => {
        new CharacterBuilderService({
          logger: mockLogger,
          storageService: mockStorageService,
          directionGenerator: mockDirectionGenerator,
          eventBus: null,
        });
      }).toThrow('Missing required dependency: ISafeEventDispatcher.');
    });
  });

  describe('createCharacterConcept', () => {
    test('should successfully create and store character concept', async () => {
      const conceptText = 'Test Hero - A brave adventurer with a mysterious past. Noble background, courageous but impulsive.';

      const mockStoredConcept = {
        id: 'generated-uuid-123',
        concept: conceptText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStorageService.storeCharacterConcept.mockResolvedValue(mockStoredConcept);

      const result = await service.createCharacterConcept(conceptText);

      expect(result).toEqual(mockStoredConcept);
      expect(mockStorageService.storeCharacterConcept).toHaveBeenCalledWith(expect.objectContaining({
        concept: conceptText
      }));
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_CONCEPT_CREATED',
        payload: expect.objectContaining({
          conceptId: mockStoredConcept.id,
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created character concept'),
        expect.any(Object)
      );
    });

    test('should throw error if concept data is invalid', async () => {
      await expect(service.createCharacterConcept(null)).rejects.toThrow();
      await expect(service.createCharacterConcept('')).rejects.toThrow();
      await expect(service.createCharacterConcept('   ')).rejects.toThrow();
    });

    test('should handle storage errors', async () => {
      const conceptText = 'Test Hero - A brave adventurer';

      const storageError = new Error('Storage unavailable');
      mockStorageService.storeCharacterConcept.mockRejectedValue(storageError);

      await expect(service.createCharacterConcept(conceptText)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create character concept'),
        expect.any(Object)
      );
    });
  });

  describe('generateThematicDirections', () => {
    test('should successfully generate and store thematic directions', async () => {
      const conceptId = 'test-concept-123';
      const mockCharacterConcept = {
        id: conceptId,
        concept: 'Test Hero - A brave adventurer with noble background and courageous personality',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockGeneratedDirections = [
        {
          id: 'direction-1',
          conceptId,
          title: 'The Hero\'s Journey',
          description: 'Classic heroic arc',
          coreTension: 'Duty vs. personal desires',
          uniqueTwist: 'Hidden nobility',
          narrativePotential: 'Epic adventures',
          llmMetadata: {
            modelId: 'openrouter-claude-sonnet-4',
            promptTokens: 150,
            responseTokens: 300,
            processingTime: 2500,
          },
        },
      ];

      mockStorageService.getCharacterConcept.mockResolvedValue(mockCharacterConcept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(mockGeneratedDirections);
      mockStorageService.storeThematicDirections.mockResolvedValue(mockGeneratedDirections);

      const result = await service.generateThematicDirections(conceptId);

      expect(result).toEqual(mockGeneratedDirections);
      expect(mockStorageService.getCharacterConcept).toHaveBeenCalledWith(conceptId);
      expect(mockDirectionGenerator.generateDirections).toHaveBeenCalledWith(
        conceptId,
        mockCharacterConcept.concept,
        expect.any(Object)
      );
      expect(mockStorageService.storeThematicDirections).toHaveBeenCalledWith(
        conceptId,
        mockGeneratedDirections
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'THEMATIC_DIRECTIONS_GENERATED',
        payload: expect.objectContaining({
          conceptId,
          directionCount: mockGeneratedDirections.length,
        }),
      });
    });

    test('should throw error if concept not found', async () => {
      const conceptId = 'non-existent-concept';
      mockStorageService.getCharacterConcept.mockResolvedValue(null);

      await expect(service.generateThematicDirections(conceptId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate thematic directions'),
        expect.any(Error)
      );
    });

    test('should handle generation errors', async () => {
      const conceptId = 'test-concept-123';
      const mockCharacterConcept = {
        id: conceptId,
        concept: 'Test Hero - A brave adventurer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const generationError = new Error('LLM service unavailable');
      mockStorageService.getCharacterConcept.mockResolvedValue(mockCharacterConcept);
      mockDirectionGenerator.generateDirections.mockRejectedValue(generationError);

      await expect(service.generateThematicDirections(conceptId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate thematic directions'),
        expect.any(Object)
      );
    });

    test('should use custom LLM config when provided', async () => {
      const conceptId = 'test-concept-123';
      const customLlmConfigId = 'custom-config';
      const mockCharacterConcept = {
        id: conceptId,
        concept: 'Test Hero - A brave adventurer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const mockDirections = [
        {
          id: 'direction-1',
          conceptId,
          title: 'Test Direction',
          description: 'Test description',
        },
      ];

      mockStorageService.getCharacterConcept.mockResolvedValue(mockCharacterConcept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(mockDirections);
      mockStorageService.storeThematicDirections.mockResolvedValue(mockDirections);

      await service.generateThematicDirections(conceptId, { llmConfigId: customLlmConfigId });

      expect(mockDirectionGenerator.generateDirections).toHaveBeenCalledWith(
        conceptId,
        mockCharacterConcept.concept,
        expect.objectContaining({ llmConfigId: customLlmConfigId })
      );
    });
  });

  describe('getCharacterConcept', () => {
    test('should retrieve character concept successfully', async () => {
      const conceptId = 'test-concept-123';
      const mockConcept = {
        id: conceptId,
        concept: 'Test Hero - A brave adventurer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);

      const result = await service.getCharacterConcept(conceptId);

      expect(result).toEqual(mockConcept);
      expect(mockStorageService.getCharacterConcept).toHaveBeenCalledWith(conceptId);
    });

    test('should return null if concept not found', async () => {
      const conceptId = 'non-existent-concept';
      mockStorageService.getCharacterConcept.mockResolvedValue(null);

      const result = await service.getCharacterConcept(conceptId);

      expect(result).toBeNull();
    });

    test('should handle storage errors', async () => {
      const conceptId = 'test-concept-123';
      const storageError = new Error('Database connection failed');
      mockStorageService.getCharacterConcept.mockRejectedValue(storageError);

      await expect(service.getCharacterConcept(conceptId)).rejects.toThrow();
    });
  });

  describe('getThematicDirections', () => {
    test('should retrieve thematic directions successfully', async () => {
      const conceptId = 'test-concept-123';
      const mockDirections = [
        {
          id: 'direction-1',
          conceptId,
          title: 'The Hero\'s Journey',
          description: 'Classic heroic arc',
        },
      ];

      mockStorageService.getThematicDirections.mockResolvedValue(mockDirections);

      const result = await service.getThematicDirections(conceptId);

      expect(result).toEqual(mockDirections);
      expect(mockStorageService.getThematicDirections).toHaveBeenCalledWith(conceptId);
    });

    test('should return empty array if no directions found', async () => {
      const conceptId = 'test-concept-123';
      mockStorageService.getThematicDirections.mockResolvedValue([]);

      const result = await service.getThematicDirections(conceptId);

      expect(result).toEqual([]);
    });

    test('should handle storage errors', async () => {
      const conceptId = 'test-concept-123';
      const storageError = new Error('Database connection failed');
      mockStorageService.getThematicDirections.mockRejectedValue(storageError);

      await expect(service.getThematicDirections(conceptId)).rejects.toThrow();
    });
  });

  describe('listCharacterConcepts', () => {
    test('should list all character concepts successfully', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          concept: 'Hero One - First hero',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'concept-2',
          concept: 'Hero Two - Second hero',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockStorageService.listCharacterConcepts.mockResolvedValue(mockConcepts);

      const result = await service.listCharacterConcepts();

      expect(result).toEqual(mockConcepts);
      expect(mockStorageService.listCharacterConcepts).toHaveBeenCalled();
    });

    test('should return empty array if no concepts exist', async () => {
      mockStorageService.listCharacterConcepts.mockResolvedValue([]);

      const result = await service.listCharacterConcepts();

      expect(result).toEqual([]);
    });

    test('should handle storage errors', async () => {
      const storageError = new Error('Database connection failed');
      mockStorageService.listCharacterConcepts.mockRejectedValue(storageError);

      await expect(service.listCharacterConcepts()).rejects.toThrow();
    });
  });

  describe('deleteCharacterConcept', () => {
    test('should delete character concept successfully', async () => {
      const conceptId = 'test-concept-123';
      mockStorageService.deleteCharacterConcept.mockResolvedValue(true);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(true);
      expect(mockStorageService.deleteCharacterConcept).toHaveBeenCalledWith(conceptId);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_CONCEPT_DELETED',
        payload: expect.objectContaining({ conceptId }),
      });
    });

    test('should return false if concept not found', async () => {
      const conceptId = 'non-existent-concept';
      mockStorageService.deleteCharacterConcept.mockResolvedValue(false);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(false);
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    test('should handle storage errors', async () => {
      const conceptId = 'test-concept-123';
      const storageError = new Error('Database connection failed');
      mockStorageService.deleteCharacterConcept.mockRejectedValue(storageError);

      await expect(service.deleteCharacterConcept(conceptId)).rejects.toThrow();
    });
  });
});