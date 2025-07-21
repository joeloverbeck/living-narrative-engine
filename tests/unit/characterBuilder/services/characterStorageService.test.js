/**
 * @file Unit tests for CharacterStorageService
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
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
      storeConcept: jest.fn(),
      retrieveConcept: jest.fn(),
      listConcepts: jest.fn(),
      deleteConcept: jest.fn(),
      storeDirections: jest.fn(),
      retrieveDirections: jest.fn(),
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
      }).toThrow('Missing required dependency: logger.');
    });

    test('should throw error if database is invalid', () => {
      expect(() => {
        new CharacterStorageService({
          logger: mockLogger,
          database: null,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow('Missing required dependency: database.');
    });

    test('should throw error if schemaValidator is invalid', () => {
      expect(() => {
        new CharacterStorageService({
          logger: mockLogger,
          database: mockDatabase,
          schemaValidator: null,
        });
      }).toThrow('Missing required dependency: schemaValidator.');
    });
  });

  describe('storeCharacterConcept', () => {
    const validConceptData = {
      name: 'Test Hero',
      description: 'A brave adventurer with a mysterious past',
      background: 'Noble',
      personality: 'Courageous but impulsive',
    };

    beforeEach(() => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
    });

    test('should successfully store character concept', async () => {
      const mockStoredConcept = {
        id: 'generated-uuid-123',
        ...validConceptData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDatabase.storeConcept.mockResolvedValue(mockStoredConcept);

      const result = await service.storeCharacterConcept(validConceptData);

      expect(result).toEqual(mockStoredConcept);
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        validConceptData,
        'character-concept.schema.json'
      );
      expect(mockDatabase.storeConcept).toHaveBeenCalledWith(validConceptData);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Storing character concept'),
        expect.any(Object)
      );
    });

    test('should throw error if concept data is invalid', async () => {
      const invalidData = { name: '' }; // Invalid - empty name
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Name is required');

      await expect(service.storeCharacterConcept(invalidData)).rejects.toThrow();
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        invalidData,
        'character-concept.schema.json'
      );
      expect(mockDatabase.storeConcept).not.toHaveBeenCalled();
    });

    test('should handle database storage errors', async () => {
      const storageError = new Error('Database connection failed');
      mockDatabase.storeConcept.mockRejectedValue(storageError);

      await expect(service.storeCharacterConcept(validConceptData)).rejects.toThrow();
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
        'character-concept.schema.json'
      );
    });
  });

  describe('retrieveCharacterConcept', () => {
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

      mockDatabase.retrieveConcept.mockResolvedValue(mockConcept);

      const result = await service.retrieveCharacterConcept(conceptId);

      expect(result).toEqual(mockConcept);
      expect(mockDatabase.retrieveConcept).toHaveBeenCalledWith(conceptId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved character concept'),
        expect.objectContaining({ conceptId })
      );
    });

    test('should return null if concept not found', async () => {
      const conceptId = 'non-existent-concept';
      mockDatabase.retrieveConcept.mockResolvedValue(null);

      const result = await service.retrieveCharacterConcept(conceptId);

      expect(result).toBeNull();
      expect(mockDatabase.retrieveConcept).toHaveBeenCalledWith(conceptId);
    });

    test('should handle database retrieval errors', async () => {
      const conceptId = 'test-concept-123';
      const retrievalError = new Error('Database connection failed');
      mockDatabase.retrieveConcept.mockRejectedValue(retrievalError);

      await expect(service.retrieveCharacterConcept(conceptId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve character concept'),
        expect.any(Object)
      );
    });

    test('should throw error if conceptId is invalid', async () => {
      await expect(service.retrieveCharacterConcept('')).rejects.toThrow();
      await expect(service.retrieveCharacterConcept(null)).rejects.toThrow();
      await expect(service.retrieveCharacterConcept(undefined)).rejects.toThrow();
    });
  });

  describe('listCharacterConcepts', () => {
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

      mockDatabase.listConcepts.mockResolvedValue(mockConcepts);

      const result = await service.listCharacterConcepts();

      expect(result).toEqual(mockConcepts);
      expect(mockDatabase.listConcepts).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Listed character concepts'),
        expect.objectContaining({ count: mockConcepts.length })
      );
    });

    test('should return empty array if no concepts exist', async () => {
      mockDatabase.listConcepts.mockResolvedValue([]);

      const result = await service.listCharacterConcepts();

      expect(result).toEqual([]);
      expect(mockDatabase.listConcepts).toHaveBeenCalled();
    });

    test('should handle database listing errors', async () => {
      const listingError = new Error('Database connection failed');
      mockDatabase.listConcepts.mockRejectedValue(listingError);

      await expect(service.listCharacterConcepts()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to list character concepts'),
        expect.any(Object)
      );
    });
  });

  describe('deleteCharacterConcept', () => {
    test('should successfully delete character concept', async () => {
      const conceptId = 'test-concept-123';
      mockDatabase.deleteConcept.mockResolvedValue(true);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(true);
      expect(mockDatabase.deleteConcept).toHaveBeenCalledWith(conceptId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Deleted character concept'),
        expect.objectContaining({ conceptId })
      );
    });

    test('should return false if concept not found', async () => {
      const conceptId = 'non-existent-concept';
      mockDatabase.deleteConcept.mockResolvedValue(false);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(false);
      expect(mockDatabase.deleteConcept).toHaveBeenCalledWith(conceptId);
    });

    test('should handle database deletion errors', async () => {
      const conceptId = 'test-concept-123';
      const deletionError = new Error('Database connection failed');
      mockDatabase.deleteConcept.mockRejectedValue(deletionError);

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
    const mockDirections = [
      {
        id: 'direction-1',
        conceptId: 'concept-123',
        title: 'The Hero\'s Journey',
        description: 'Classic heroic arc',
        coreTension: 'Duty vs. personal desires',
        uniqueTwist: 'Hidden nobility',
        narrativePotential: 'Epic adventures',
      },
    ];

    beforeEach(() => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
    });

    test('should successfully store thematic directions', async () => {
      const conceptId = 'concept-123';
      mockDatabase.storeDirections.mockResolvedValue(mockDirections);

      const result = await service.storeThematicDirections(conceptId, mockDirections);

      expect(result).toEqual(mockDirections);
      expect(mockDatabase.storeDirections).toHaveBeenCalledWith(conceptId, mockDirections);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Stored thematic directions'),
        expect.objectContaining({ conceptId, count: mockDirections.length })
      );
    });

    test('should validate each direction against schema', async () => {
      const conceptId = 'concept-123';
      await service.storeThematicDirections(conceptId, mockDirections);

      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        mockDirections[0],
        'thematic-direction.schema.json'
      );
    });

    test('should throw error if validation fails', async () => {
      const conceptId = 'concept-123';
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Invalid direction structure');

      await expect(
        service.storeThematicDirections(conceptId, mockDirections)
      ).rejects.toThrow();
      expect(mockDatabase.storeDirections).not.toHaveBeenCalled();
    });

    test('should handle database storage errors', async () => {
      const conceptId = 'concept-123';
      const storageError = new Error('Database connection failed');
      mockDatabase.storeDirections.mockRejectedValue(storageError);

      await expect(
        service.storeThematicDirections(conceptId, mockDirections)
      ).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store thematic directions'),
        expect.any(Object)
      );
    });

    test('should throw error if conceptId is invalid', async () => {
      await expect(service.storeThematicDirections('', mockDirections)).rejects.toThrow();
      await expect(service.storeThematicDirections(null, mockDirections)).rejects.toThrow();
    });

    test('should throw error if directions array is invalid', async () => {
      const conceptId = 'concept-123';
      await expect(service.storeThematicDirections(conceptId, null)).rejects.toThrow();
      await expect(service.storeThematicDirections(conceptId, 'not-array')).rejects.toThrow();
    });
  });

  describe('retrieveThematicDirections', () => {
    test('should successfully retrieve thematic directions', async () => {
      const conceptId = 'concept-123';
      const mockDirections = [
        {
          id: 'direction-1',
          conceptId,
          title: 'The Hero\'s Journey',
          description: 'Classic heroic arc',
        },
      ];

      mockDatabase.retrieveDirections.mockResolvedValue(mockDirections);

      const result = await service.retrieveThematicDirections(conceptId);

      expect(result).toEqual(mockDirections);
      expect(mockDatabase.retrieveDirections).toHaveBeenCalledWith(conceptId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved thematic directions'),
        expect.objectContaining({ conceptId, count: mockDirections.length })
      );
    });

    test('should return empty array if no directions found', async () => {
      const conceptId = 'concept-123';
      mockDatabase.retrieveDirections.mockResolvedValue([]);

      const result = await service.retrieveThematicDirections(conceptId);

      expect(result).toEqual([]);
      expect(mockDatabase.retrieveDirections).toHaveBeenCalledWith(conceptId);
    });

    test('should handle database retrieval errors', async () => {
      const conceptId = 'concept-123';
      const retrievalError = new Error('Database connection failed');
      mockDatabase.retrieveDirections.mockRejectedValue(retrievalError);

      await expect(service.retrieveThematicDirections(conceptId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve thematic directions'),
        expect.any(Object)
      );
    });

    test('should throw error if conceptId is invalid', async () => {
      await expect(service.retrieveThematicDirections('')).rejects.toThrow();
      await expect(service.retrieveThematicDirections(null)).rejects.toThrow();
      await expect(service.retrieveThematicDirections(undefined)).rejects.toThrow();
    });
  });
});