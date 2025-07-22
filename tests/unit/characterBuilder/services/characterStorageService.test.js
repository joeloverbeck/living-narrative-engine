/**
 * @file Unit tests for CharacterStorageService
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { CharacterStorageService } from '../../../../src/characterBuilder/services/characterStorageService.js';

/**
 * @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../../src/characterBuilder/storage/characterDatabase.js').CharacterDatabase} CharacterDatabase
 * @typedef {import('../../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

describe('CharacterStorageService', () => {
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<CharacterDatabase>} */
  let mockDatabase;
  /** @type {jest.Mocked<ISchemaValidator>} */
  let mockSchemaValidator;
  /** @type {CharacterStorageService} */
  let service;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDatabase = {
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      initialize: jest.fn(),
      close: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
      formatAjvErrors: jest.fn(),
      addSchema: jest.fn(),
    };

    service = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(CharacterStorageService);
    });

    test('should throw error if logger is invalid', () => {
      expect(() => {
        new CharacterStorageService({
          logger: null,
          database: mockDatabase,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow('Missing required dependency: ILogger.');
    });

    test('should throw error if database is invalid', () => {
      expect(() => {
        new CharacterStorageService({
          logger: mockLogger,
          database: null,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow('Missing required dependency: CharacterDatabase.');
    });

    test('should throw error if schemaValidator is invalid', () => {
      expect(() => {
        new CharacterStorageService({
          logger: mockLogger,
          database: mockDatabase,
          schemaValidator: null,
        });
      }).toThrow('Missing required dependency: ISchemaValidator.');
    });
  });

  describe('storeCharacterConcept', () => {
    const validConceptData = {
      name: 'Test Hero',
      description: 'A brave adventurer with a mysterious past',
      background: 'Noble',
      personality: 'Courageous but impulsive',
    };

    beforeEach(async () => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.initialize.mockResolvedValue();
      await service.initialize();
    });

    test('should successfully store character concept', async () => {
      const mockStoredConcept = {
        id: 'generated-uuid-123',
        ...validConceptData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDatabase.saveCharacterConcept.mockResolvedValue(mockStoredConcept);

      const result = await service.storeCharacterConcept(validConceptData);

      expect(result).toEqual(mockStoredConcept);
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        validConceptData,
        'character-concept'
      );
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        validConceptData
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stored character concept'),
        expect.any(Object)
      );
    });

    test('should throw error if concept data is invalid', async () => {
      const invalidData = { name: '' }; // Invalid - empty name
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Name is required');

      await expect(
        service.storeCharacterConcept(invalidData)
      ).rejects.toThrow();
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        invalidData,
        'character-concept'
      );
      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled();
    });

    test('should handle database storage errors', async () => {
      const storageError = new Error('Database connection failed');
      mockDatabase.saveCharacterConcept.mockRejectedValue(storageError);

      await expect(
        service.storeCharacterConcept(validConceptData)
      ).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store character concept'),
        expect.any(Object)
      );
    });

    test('should throw error if concept data is null', async () => {
      await expect(service.storeCharacterConcept(null)).rejects.toThrow();
      await expect(service.storeCharacterConcept(undefined)).rejects.toThrow();
    });

    test('should validate against correct schema', async () => {
      await service.storeCharacterConcept(validConceptData);

      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        validConceptData,
        'character-concept'
      );
    });
  });

  describe('getCharacterConcept', () => {
    beforeEach(async () => {
      mockDatabase.initialize.mockResolvedValue();
      await service.initialize();
    });

    test('should successfully retrieve character concept', async () => {
      const conceptId = 'test-concept-123';
      const mockConcept = {
        id: conceptId,
        name: 'Test Hero',
        description: 'A brave adventurer',
        background: 'Noble',
        personality: 'Courageous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDatabase.getCharacterConcept.mockResolvedValue(mockConcept);

      const result = await service.getCharacterConcept(conceptId);

      expect(result).toEqual(mockConcept);
      expect(mockDatabase.getCharacterConcept).toHaveBeenCalledWith(conceptId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved character concept'),
        expect.objectContaining({ conceptId })
      );
    });

    test('should return null if concept not found', async () => {
      const conceptId = 'non-existent-concept';
      mockDatabase.getCharacterConcept.mockResolvedValue(null);

      const result = await service.getCharacterConcept(conceptId);

      expect(result).toBeNull();
      expect(mockDatabase.getCharacterConcept).toHaveBeenCalledWith(conceptId);
    });

    test('should handle database retrieval errors', async () => {
      const conceptId = 'test-concept-123';
      const retrievalError = new Error('Database connection failed');
      mockDatabase.getCharacterConcept.mockRejectedValue(retrievalError);

      await expect(service.getCharacterConcept(conceptId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get character concept'),
        expect.any(Error)
      );
    });

    test('should throw error if conceptId is invalid', async () => {
      await expect(service.getCharacterConcept('')).rejects.toThrow();
      await expect(service.getCharacterConcept(null)).rejects.toThrow();
      await expect(service.getCharacterConcept(undefined)).rejects.toThrow();
    });
  });

  describe('listCharacterConcepts', () => {
    beforeEach(async () => {
      mockDatabase.initialize.mockResolvedValue();
      await service.initialize();
    });

    test('should successfully list character concepts', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          name: 'Hero One',
          description: 'First hero',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'concept-2',
          name: 'Hero Two',
          description: 'Second hero',
          createdAt: new Date().toISOString(),
        },
      ];

      mockDatabase.getAllCharacterConcepts.mockResolvedValue(mockConcepts);

      const result = await service.listCharacterConcepts();

      expect(result).toEqual(mockConcepts);
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved character concepts list'),
        expect.objectContaining({ conceptCount: mockConcepts.length })
      );
    });

    test('should return empty array if no concepts exist', async () => {
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([]);

      const result = await service.listCharacterConcepts();

      expect(result).toEqual([]);
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalled();
    });

    test('should handle database listing errors', async () => {
      const listingError = new Error('Database connection failed');
      mockDatabase.getAllCharacterConcepts.mockRejectedValue(listingError);

      await expect(service.listCharacterConcepts()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to list character concepts'),
        expect.any(Object)
      );
    });
  });

  describe('deleteCharacterConcept', () => {
    beforeEach(async () => {
      mockDatabase.initialize.mockResolvedValue();
      await service.initialize();
    });

    test('should successfully delete character concept', async () => {
      const conceptId = 'test-concept-123';
      mockDatabase.deleteCharacterConcept.mockResolvedValue(true);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(true);
      expect(mockDatabase.deleteCharacterConcept).toHaveBeenCalledWith(
        conceptId
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully deleted character concept'),
        expect.objectContaining({ conceptId })
      );
    });

    test('should return false if concept not found', async () => {
      const conceptId = 'non-existent-concept';
      mockDatabase.deleteCharacterConcept.mockResolvedValue(false);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(false);
      expect(mockDatabase.deleteCharacterConcept).toHaveBeenCalledWith(
        conceptId
      );
    });

    test('should handle database deletion errors', async () => {
      const conceptId = 'test-concept-123';
      const deletionError = new Error('Database connection failed');
      mockDatabase.deleteCharacterConcept.mockRejectedValue(deletionError);

      await expect(service.deleteCharacterConcept(conceptId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete character concept'),
        expect.any(Object)
      );
    });

    test('should throw error if conceptId is invalid', async () => {
      await expect(service.deleteCharacterConcept('')).rejects.toThrow();
      await expect(service.deleteCharacterConcept(null)).rejects.toThrow();
      await expect(service.deleteCharacterConcept(undefined)).rejects.toThrow();
    });
  });

  describe('storeThematicDirections', () => {
    beforeEach(async () => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.initialize.mockResolvedValue();
      await service.initialize();
    });

    const mockDirections = [
      {
        id: 'direction-1',
        conceptId: 'concept-123',
        title: "The Hero's Journey",
        description: 'Classic heroic arc',
        coreTension: 'Duty vs. personal desires',
        uniqueTwist: 'Hidden nobility',
        narrativePotential: 'Epic adventures',
      },
    ];

    test('should successfully store thematic directions', async () => {
      const conceptId = 'concept-123';
      mockDatabase.saveThematicDirections.mockResolvedValue(mockDirections);

      const result = await service.storeThematicDirections(
        conceptId,
        mockDirections
      );

      expect(result).toEqual(mockDirections);
      expect(mockDatabase.saveThematicDirections).toHaveBeenCalledWith(
        mockDirections
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stored thematic directions'),
        expect.objectContaining({
          conceptId,
          directionCount: mockDirections.length,
          attempt: 1,
        })
      );
    });

    test('should validate each direction against schema', async () => {
      const conceptId = 'concept-123';
      await service.storeThematicDirections(conceptId, mockDirections);

      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        mockDirections[0],
        'thematic-direction'
      );
    });

    test('should throw error if validation fails', async () => {
      const conceptId = 'concept-123';
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Invalid direction structure'
      );

      await expect(
        service.storeThematicDirections(conceptId, mockDirections)
      ).rejects.toThrow();
      expect(mockDatabase.saveThematicDirections).not.toHaveBeenCalled();
    });

    test('should handle database storage errors', async () => {
      const conceptId = 'concept-123';
      const storageError = new Error('Database connection failed');
      mockDatabase.saveThematicDirections.mockRejectedValue(storageError);

      await expect(
        service.storeThematicDirections(conceptId, mockDirections)
      ).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store thematic directions'),
        expect.any(Object)
      );
    });

    test('should throw error if conceptId is invalid', async () => {
      await expect(
        service.storeThematicDirections('', mockDirections)
      ).rejects.toThrow();
      await expect(
        service.storeThematicDirections(null, mockDirections)
      ).rejects.toThrow();
    });

    test('should throw error if directions array is invalid', async () => {
      const conceptId = 'concept-123';
      await expect(
        service.storeThematicDirections(conceptId, null)
      ).rejects.toThrow();
      await expect(
        service.storeThematicDirections(conceptId, 'not-array')
      ).rejects.toThrow();
    });
  });

  describe('getThematicDirections', () => {
    beforeEach(async () => {
      mockDatabase.initialize.mockResolvedValue();
      await service.initialize();
    });

    test('should successfully retrieve thematic directions', async () => {
      const conceptId = 'concept-123';
      const mockDirections = [
        {
          id: 'direction-1',
          conceptId,
          title: "The Hero's Journey",
          description: 'Classic heroic arc',
        },
      ];

      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue(
        mockDirections
      );

      const result = await service.getThematicDirections(conceptId);

      expect(result).toEqual(mockDirections);
      expect(
        mockDatabase.getThematicDirectionsByConceptId
      ).toHaveBeenCalledWith(conceptId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved thematic directions'),
        expect.objectContaining({
          conceptId,
          directionCount: mockDirections.length,
        })
      );
    });

    test('should return empty array if no directions found', async () => {
      const conceptId = 'concept-123';
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue([]);

      const result = await service.getThematicDirections(conceptId);

      expect(result).toEqual([]);
      expect(
        mockDatabase.getThematicDirectionsByConceptId
      ).toHaveBeenCalledWith(conceptId);
    });

    test('should handle database retrieval errors', async () => {
      const conceptId = 'concept-123';
      const retrievalError = new Error('Database connection failed');
      mockDatabase.getThematicDirectionsByConceptId.mockRejectedValue(
        retrievalError
      );

      await expect(service.getThematicDirections(conceptId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get thematic directions'),
        expect.any(Error)
      );
    });

    test('should throw error if conceptId is invalid', async () => {
      await expect(service.getThematicDirections('')).rejects.toThrow();
      await expect(service.getThematicDirections(null)).rejects.toThrow();
      await expect(service.getThematicDirections(undefined)).rejects.toThrow();
    });
  });
});
