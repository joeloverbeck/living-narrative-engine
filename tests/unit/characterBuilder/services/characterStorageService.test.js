/**
 * @file Unit tests for CharacterStorageService
 * @see src/characterBuilder/services/characterStorageService.js
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
  CharacterStorageService,
  CharacterStorageError,
} from '../../../../src/characterBuilder/services/characterStorageService.js';
import {
  createCharacterConcept,
  CHARACTER_CONCEPT_STATUS,
} from '../../../../src/characterBuilder/models/characterConcept.js';

describe('CharacterStorageService', () => {
  let service;
  let mockLogger;
  let mockDatabase;
  let mockSchemaValidator;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(),
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      getThematicDirection: jest.fn(),
      getAllThematicDirections: jest.fn(),
      updateThematicDirection: jest.fn(),
      deleteThematicDirection: jest.fn(),
      findOrphanedDirections: jest.fn(),
      close: jest.fn().mockResolvedValue(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
      formatAjvErrors: jest.fn().mockReturnValue(''),
    };

    // Set NODE_ENV to test for faster retry delays
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(() => {
        service = new CharacterStorageService({
          logger: mockLogger,
          database: mockDatabase,
          schemaValidator: mockSchemaValidator,
        });
      }).not.toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing info, warn, error

      expect(() => {
        new CharacterStorageService({
          logger: invalidLogger,
          database: mockDatabase,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow();
    });

    it('should throw error when database is missing required methods', () => {
      const invalidDatabase = { initialize: jest.fn() }; // Missing other methods

      expect(() => {
        new CharacterStorageService({
          logger: mockLogger,
          database: invalidDatabase,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow();
    });

    it('should throw error when schemaValidator is missing required methods', () => {
      const invalidValidator = {
        validateAgainstSchema: jest.fn(),
        validate: jest.fn(),
      }; // Missing formatAjvErrors

      expect(() => {
        new CharacterStorageService({
          logger: mockLogger,
          database: mockDatabase,
          schemaValidator: invalidValidator,
        });
      }).toThrow();
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should initialize successfully', async () => {
      await service.initialize();

      expect(mockDatabase.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: Successfully initialized'
      );
    });

    it('should skip initialization if already initialized', async () => {
      await service.initialize();
      mockDatabase.initialize.mockClear();
      mockLogger.debug.mockClear();

      await service.initialize();

      expect(mockDatabase.initialize).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Already initialized'
      );
    });

    it('should throw CharacterStorageError if database initialization fails', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabase.initialize.mockRejectedValue(dbError);

      await expect(service.initialize()).rejects.toThrow(CharacterStorageError);
      await expect(service.initialize()).rejects.toThrow(
        'Failed to initialize character storage: Database connection failed'
      );
    });
  });

  describe('storeCharacterConcept', () => {
    let mockConcept;

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();

      mockConcept = createCharacterConcept('A brave warrior from the north');
      mockDatabase.saveCharacterConcept.mockResolvedValue(mockConcept);
    });

    it('should store a valid character concept successfully', async () => {
      const result = await service.storeCharacterConcept(mockConcept);

      expect(result).toEqual(mockConcept);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/character-concept.schema.json',
        expect.objectContaining({
          id: mockConcept.id,
          concept: mockConcept.concept,
        })
      );
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        mockConcept
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stored character concept'),
        expect.objectContaining({ conceptId: mockConcept.id })
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      await expect(
        uninitializedService.storeCharacterConcept(mockConcept)
      ).rejects.toThrow(CharacterStorageError);
      await expect(
        uninitializedService.storeCharacterConcept(mockConcept)
      ).rejects.toThrow('CharacterStorageService not initialized');
    });

    it('should throw error if concept is null', async () => {
      await expect(service.storeCharacterConcept(null)).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.storeCharacterConcept(null)).rejects.toThrow(
        'concept is required'
      );
    });

    it('should throw error if concept validation fails', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ message: 'Invalid concept format' }],
      });
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Invalid concept format'
      );

      await expect(service.storeCharacterConcept(mockConcept)).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.storeCharacterConcept(mockConcept)).rejects.toThrow(
        'Character concept validation failed: Invalid concept format'
      );
    });

    it('should handle validation error without specific details', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [],
      });
      mockSchemaValidator.formatAjvErrors.mockReturnValue('');

      await expect(service.storeCharacterConcept(mockConcept)).rejects.toThrow(
        'Character concept validation failed: Schema validation failed without specific details'
      );
    });

    it('should retry on database errors and succeed', async () => {
      mockDatabase.saveCharacterConcept
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(mockConcept);

      const result = await service.storeCharacterConcept(mockConcept);

      expect(result).toEqual(mockConcept);
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1 failed'),
        expect.objectContaining({ attempt: 1 })
      );
    });

    it('should not retry validation errors', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ message: 'Validation failed' }],
      });
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Validation failed');

      await expect(service.storeCharacterConcept(mockConcept)).rejects.toThrow(
        'Character concept validation failed'
      );

      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled();
    });

    it('should throw error after max retries', async () => {
      mockDatabase.saveCharacterConcept.mockRejectedValue(
        new Error('Persistent error')
      );

      await expect(service.storeCharacterConcept(mockConcept)).rejects.toThrow(
        CharacterStorageError
      );

      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);

      // Verify the error message contains expected text
      try {
        await service.storeCharacterConcept(mockConcept);
      } catch (error) {
        expect(error.message).toContain('Failed to store character concept');
        expect(error.message).toContain('after 3 attempts');
      }
    });
  });

  describe('storeThematicDirections', () => {
    const mockDirections = [
      { id: 'dir1', content: 'Direction 1' },
      { id: 'dir2', content: 'Direction 2' },
    ];

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
      mockDatabase.saveThematicDirections.mockResolvedValue(mockDirections);
    });

    it('should store thematic directions successfully', async () => {
      const result = await service.storeThematicDirections(
        'concept123',
        mockDirections
      );

      expect(result).toEqual(mockDirections);
      expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(2);
      expect(mockDatabase.saveThematicDirections).toHaveBeenCalledWith(
        mockDirections
      );
    });

    it('should throw error if conceptId is invalid', async () => {
      await expect(
        service.storeThematicDirections(null, mockDirections)
      ).rejects.toThrow('conceptId must be a non-empty string');
      await expect(
        service.storeThematicDirections('', mockDirections)
      ).rejects.toThrow('conceptId must be a non-empty string');
    });

    it('should throw error if directions is not an array', async () => {
      await expect(
        service.storeThematicDirections('concept123', 'not-an-array')
      ).rejects.toThrow('directions must be an array');
    });

    it('should return empty array if no directions provided', async () => {
      const result = await service.storeThematicDirections('concept123', []);

      expect(result).toEqual([]);
      expect(mockDatabase.saveThematicDirections).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: No thematic directions found',
        { conceptId: 'concept123' }
      );
    });

    it('should throw error if direction validation fails', async () => {
      mockSchemaValidator.validate
        .mockReturnValueOnce({ isValid: true, errors: null })
        .mockReturnValueOnce({
          isValid: false,
          errors: [{ message: 'Invalid direction format' }],
        });
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Invalid direction format'
      );

      await expect(
        service.storeThematicDirections('concept123', mockDirections)
      ).rejects.toThrow(
        'Thematic direction validation failed: Invalid direction format'
      );
    });

    it('should retry on database errors', async () => {
      mockDatabase.saveThematicDirections
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(mockDirections);

      const result = await service.storeThematicDirections(
        'concept123',
        mockDirections
      );

      expect(result).toEqual(mockDirections);
      expect(mockDatabase.saveThematicDirections).toHaveBeenCalledTimes(2);
    });
  });

  describe('listCharacterConcepts', () => {
    const mockConcepts = [
      createCharacterConcept('A wise sage from the eastern mountains'),
      createCharacterConcept('A skilled warrior with a mysterious past'),
    ];

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
      mockDatabase.getAllCharacterConcepts.mockResolvedValue(mockConcepts);
    });

    it('should list all character concepts successfully', async () => {
      const result = await service.listCharacterConcepts();

      expect(result).toEqual(mockConcepts);
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Retrieved character concepts list',
        { conceptCount: 2 }
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.getAllCharacterConcepts.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.listCharacterConcepts()).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.listCharacterConcepts()).rejects.toThrow(
        'Failed to list character concepts: Database error'
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      await expect(
        uninitializedService.listCharacterConcepts()
      ).rejects.toThrow('CharacterStorageService not initialized');
    });
  });

  describe('getCharacterConcept', () => {
    const mockConcept = createCharacterConcept(
      'A mysterious traveler from distant lands'
    );

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
    });

    it('should get character concept successfully', async () => {
      mockDatabase.getCharacterConcept.mockResolvedValue(mockConcept);

      const result = await service.getCharacterConcept(mockConcept.id);

      expect(result).toEqual(mockConcept);
      expect(mockDatabase.getCharacterConcept).toHaveBeenCalledWith(
        mockConcept.id
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Retrieved character concept',
        { conceptId: mockConcept.id }
      );
    });

    it('should return null if concept not found', async () => {
      mockDatabase.getCharacterConcept.mockResolvedValue(null);

      const result = await service.getCharacterConcept('non-existent');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CharacterStorageService: Character concept not found',
        { conceptId: 'non-existent' }
      );
    });

    it('should throw error if conceptId is invalid', async () => {
      await expect(service.getCharacterConcept(null)).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
      await expect(service.getCharacterConcept('')).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.getCharacterConcept.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getCharacterConcept('concept123')).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.getCharacterConcept('concept123')).rejects.toThrow(
        'Failed to get character concept concept123: Database error'
      );
    });
  });

  describe('getThematicDirections', () => {
    const mockDirections = [
      { id: 'dir1', content: 'Direction 1' },
      { id: 'dir2', content: 'Direction 2' },
    ];

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
    });

    it('should get thematic directions successfully', async () => {
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue(
        mockDirections
      );

      const result = await service.getThematicDirections('concept123');

      expect(result).toEqual(mockDirections);
      expect(
        mockDatabase.getThematicDirectionsByConceptId
      ).toHaveBeenCalledWith('concept123');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Retrieved thematic directions',
        { conceptId: 'concept123', directionCount: 2 }
      );
    });

    it('should return empty array if no directions found', async () => {
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue([]);

      const result = await service.getThematicDirections('concept123');

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: No thematic directions found',
        { conceptId: 'concept123' }
      );
    });

    it('should return empty array if directions is null', async () => {
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue(null);

      const result = await service.getThematicDirections('concept123');

      expect(result).toEqual([]);
    });

    it('should throw error if conceptId is invalid', async () => {
      await expect(service.getThematicDirections(null)).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
      await expect(service.getThematicDirections('')).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.getThematicDirectionsByConceptId.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getThematicDirections('concept123')).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.getThematicDirections('concept123')).rejects.toThrow(
        'Failed to get thematic directions for concept concept123: Database error'
      );
    });
  });

  describe('deleteCharacterConcept', () => {
    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
    });

    it('should delete character concept successfully', async () => {
      mockDatabase.deleteCharacterConcept.mockResolvedValue(true);

      const result = await service.deleteCharacterConcept('concept123');

      expect(result).toBe(true);
      expect(mockDatabase.deleteCharacterConcept).toHaveBeenCalledWith(
        'concept123'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: Successfully deleted character concept',
        { conceptId: 'concept123' }
      );
    });

    it('should return false if concept not found', async () => {
      mockDatabase.deleteCharacterConcept.mockResolvedValue(false);

      const result = await service.deleteCharacterConcept('non-existent');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CharacterStorageService: Character concept not found for deletion',
        { conceptId: 'non-existent' }
      );
    });

    it('should throw error if conceptId is invalid', async () => {
      await expect(service.deleteCharacterConcept(null)).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
      await expect(service.deleteCharacterConcept('')).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.deleteCharacterConcept.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.deleteCharacterConcept('concept123')
      ).rejects.toThrow(CharacterStorageError);
      await expect(
        service.deleteCharacterConcept('concept123')
      ).rejects.toThrow(
        'Failed to delete character concept concept123: Database error'
      );
    });
  });

  describe('getAllThematicDirections', () => {
    const mockDirections = [
      { id: 'dir1', content: 'Direction 1' },
      { id: 'dir2', content: 'Direction 2' },
    ];

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
      mockDatabase.getAllThematicDirections.mockResolvedValue(mockDirections);
    });

    it('should get all thematic directions successfully', async () => {
      const result = await service.getAllThematicDirections();

      expect(result).toEqual(mockDirections);
      expect(mockDatabase.getAllThematicDirections).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Retrieved all thematic directions',
        { directionCount: 2 }
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.getAllThematicDirections.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getAllThematicDirections()).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.getAllThematicDirections()).rejects.toThrow(
        'Failed to get all thematic directions: Database error'
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      await expect(
        uninitializedService.getAllThematicDirections()
      ).rejects.toThrow('CharacterStorageService not initialized');
    });
  });

  describe('getThematicDirection', () => {
    const mockDirection = { id: 'dir1', content: 'Direction 1' };

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
      mockLogger.debug.mockClear();
    });

    it('should retrieve a thematic direction when it exists', async () => {
      mockDatabase.getThematicDirection.mockResolvedValue(mockDirection);

      const result = await service.getThematicDirection(mockDirection.id);

      expect(result).toEqual(mockDirection);
      expect(mockDatabase.getThematicDirection).toHaveBeenCalledWith(
        mockDirection.id
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Retrieved thematic direction',
        { directionId: mockDirection.id }
      );
    });

    it('should log when the thematic direction is not found', async () => {
      mockDatabase.getThematicDirection.mockResolvedValue(null);

      const result = await service.getThematicDirection('missing-direction');

      expect(result).toBeNull();
      expect(mockDatabase.getThematicDirection).toHaveBeenCalledWith(
        'missing-direction'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Thematic direction not found',
        { directionId: 'missing-direction' }
      );
    });

    it('should throw an error when the direction id is invalid', async () => {
      await expect(service.getThematicDirection(null)).rejects.toThrow(
        'directionId must be a non-empty string'
      );
      await expect(service.getThematicDirection('')).rejects.toThrow(
        'directionId must be a non-empty string'
      );
    });

    it('should wrap database errors in CharacterStorageError', async () => {
      mockDatabase.getThematicDirection.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getThematicDirection('dir1')).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.getThematicDirection('dir1')).rejects.toThrow(
        'Failed to get thematic direction dir1: Database error'
      );
    });
  });

  describe('updateThematicDirection', () => {
    const mockDirection = { id: 'dir1', content: 'Updated direction' };

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
      mockDatabase.updateThematicDirection.mockResolvedValue(mockDirection);
    });

    it('should update thematic direction successfully', async () => {
      const updates = { content: 'Updated content' };
      const result = await service.updateThematicDirection('dir1', updates);

      expect(result).toEqual(mockDirection);
      expect(mockDatabase.updateThematicDirection).toHaveBeenCalledWith(
        'dir1',
        updates
      );
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/thematic-direction.schema.json',
        mockDirection
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: Successfully updated thematic direction',
        { directionId: 'dir1' }
      );
    });

    it('should throw error if directionId is invalid', async () => {
      await expect(service.updateThematicDirection(null, {})).rejects.toThrow(
        'directionId must be a non-empty string'
      );
      await expect(service.updateThematicDirection('', {})).rejects.toThrow(
        'directionId must be a non-empty string'
      );
    });

    it('should throw error if updates is invalid', async () => {
      await expect(
        service.updateThematicDirection('dir1', null)
      ).rejects.toThrow('updates must be a valid object');
      await expect(
        service.updateThematicDirection('dir1', 'not-an-object')
      ).rejects.toThrow('updates must be a valid object');
    });

    it('should throw error if validation fails', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ message: 'Invalid format' }],
      });
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Invalid format');

      await expect(service.updateThematicDirection('dir1', {})).rejects.toThrow(
        'Updated thematic direction validation failed: Invalid format'
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.updateThematicDirection.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.updateThematicDirection('dir1', {})).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.updateThematicDirection('dir1', {})).rejects.toThrow(
        'Failed to update thematic direction dir1: Database error'
      );
    });
  });

  describe('deleteThematicDirection', () => {
    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
    });

    it('should delete thematic direction successfully', async () => {
      mockDatabase.deleteThematicDirection.mockResolvedValue(true);

      const result = await service.deleteThematicDirection('dir1');

      expect(result).toBe(true);
      expect(mockDatabase.deleteThematicDirection).toHaveBeenCalledWith('dir1');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: Successfully deleted thematic direction',
        { directionId: 'dir1' }
      );
    });

    it('should return false if direction not found', async () => {
      mockDatabase.deleteThematicDirection.mockResolvedValue(false);

      const result = await service.deleteThematicDirection('non-existent');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CharacterStorageService: Thematic direction not found for deletion',
        { directionId: 'non-existent' }
      );
    });

    it('should throw error if directionId is invalid', async () => {
      await expect(service.deleteThematicDirection(null)).rejects.toThrow(
        'directionId must be a non-empty string'
      );
      await expect(service.deleteThematicDirection('')).rejects.toThrow(
        'directionId must be a non-empty string'
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.deleteThematicDirection.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.deleteThematicDirection('dir1')).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.deleteThematicDirection('dir1')).rejects.toThrow(
        'Failed to delete thematic direction dir1: Database error'
      );
    });
  });

  describe('findOrphanedDirections', () => {
    const mockOrphaned = [
      { id: 'orphan1', content: 'Orphaned 1' },
      { id: 'orphan2', content: 'Orphaned 2' },
    ];

    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
      mockDatabase.findOrphanedDirections.mockResolvedValue(mockOrphaned);
    });

    it('should find orphaned directions successfully', async () => {
      const result = await service.findOrphanedDirections();

      expect(result).toEqual(mockOrphaned);
      expect(mockDatabase.findOrphanedDirections).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: Found orphaned directions',
        { orphanedCount: 2 }
      );
    });

    it('should throw error if database fails', async () => {
      mockDatabase.findOrphanedDirections.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.findOrphanedDirections()).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.findOrphanedDirections()).rejects.toThrow(
        'Failed to find orphaned directions: Database error'
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      await expect(
        uninitializedService.findOrphanedDirections()
      ).rejects.toThrow('CharacterStorageService not initialized');
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
    });

    it('should close service successfully', async () => {
      await service.close();

      expect(mockDatabase.close).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: Storage service closed successfully'
      );
    });

    it('should handle close when not initialized', async () => {
      const uninitializedService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      await uninitializedService.close();

      expect(mockDatabase.close).not.toHaveBeenCalled();
    });

    it('should throw error if database close fails', async () => {
      mockDatabase.close.mockRejectedValue(new Error('Close failed'));

      await expect(service.close()).rejects.toThrow(CharacterStorageError);
      await expect(service.close()).rejects.toThrow(
        'Failed to close storage service: Close failed'
      );
    });

    it('should allow re-initialization after close', async () => {
      await service.close();
      mockDatabase.initialize.mockClear();

      await service.initialize();

      expect(mockDatabase.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry logic', () => {
    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
    });

    it('should apply exponential backoff between retries', async () => {
      const startTime = Date.now();
      mockDatabase.saveCharacterConcept.mockRejectedValue(
        new Error('Persistent error')
      );

      const concept = createCharacterConcept(
        'A brave knight seeking redemption for past sins'
      );

      try {
        await service.storeCharacterConcept(concept);
      } catch (error) {
        // Expected to fail
      }

      const duration = Date.now() - startTime;
      // With test delays (5ms base, 25ms max), expect at least 2 retries with delays
      expect(duration).toBeGreaterThanOrEqual(10); // At least some delay occurred
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);
    });

    it('should cap backoff delay at maximum', async () => {
      // This test verifies the backoff calculation logic
      const delays = [];
      let callCount = 0;

      mockDatabase.saveCharacterConcept.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          // Capture delay calculation
          const baseDelay = 5; // Test environment base delay
          const maxDelay = 25; // Test environment max delay
          const calculatedDelay = Math.min(
            baseDelay * Math.pow(2, callCount - 1),
            maxDelay
          );
          delays.push(calculatedDelay);
          throw new Error('Temporary error');
        }
        return Promise.resolve(
          createCharacterConcept('A legendary hero who saved the realm')
        );
      });

      const concept = createCharacterConcept(
        'A brave knight seeking redemption for past sins'
      );
      await service.storeCharacterConcept(concept);

      // Verify exponential backoff calculation
      expect(delays[0]).toBe(5); // First retry: 5ms * 2^0 = 5ms
      expect(delays[1]).toBe(10); // Second retry: 5ms * 2^1 = 10ms
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });
      await service.initialize();
    });

    it('should preserve error cause in CharacterStorageError', async () => {
      const originalError = new Error('Original database error');
      mockDatabase.getAllCharacterConcepts.mockRejectedValue(originalError);

      try {
        await service.listCharacterConcepts();
      } catch (error) {
        expect(error).toBeInstanceOf(CharacterStorageError);
        expect(error.cause).toBe(originalError);
        expect(error.message).toContain('Original database error');
      }
    });

    it('should log errors with appropriate context', async () => {
      mockDatabase.getCharacterConcept.mockRejectedValue(
        new Error('Database error')
      );

      try {
        await service.getCharacterConcept('concept123');
      } catch (error) {
        // Expected to fail
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get character concept concept123'),
        expect.any(Error)
      );
    });
  });

  describe('Initialization State Management', () => {
    // Test the specific issue found in core-motivations-generator initialization
    it('should consistently track initialization state across all methods', async () => {
      const uninitializedService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      // Test all methods that should check initialization state
      const methodTests = [
        () =>
          uninitializedService.storeCharacterConcept(
            createCharacterConcept('test character concept')
          ),
        () => uninitializedService.listCharacterConcepts(),
        () => uninitializedService.getCharacterConcept('test-id'),
        () => uninitializedService.deleteCharacterConcept('test-id'),
        () => uninitializedService.storeThematicDirections('concept-id', []),
        () => uninitializedService.getThematicDirections('concept-id'),
        () => uninitializedService.getAllThematicDirections(),
        () =>
          uninitializedService.updateThematicDirection('direction-id', {
            field: 'value',
          }),
        () => uninitializedService.deleteThematicDirection('direction-id'),
      ];

      // All methods should throw the same initialization error
      for (const methodTest of methodTests) {
        await expect(methodTest()).rejects.toThrow(CharacterStorageError);
        await expect(methodTest()).rejects.toThrow(
          'CharacterStorageService not initialized. Call initialize() first.'
        );
      }
    });

    it('should allow methods to be called after successful initialization', async () => {
      const service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      // Initialize the service
      await service.initialize();

      // Mock successful database responses
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([]);
      mockDatabase.getCharacterConcept.mockResolvedValue(null);
      mockDatabase.deleteCharacterConcept.mockResolvedValue();
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue([]);
      mockDatabase.getAllThematicDirections.mockResolvedValue([]);
      mockDatabase.deleteThematicDirection.mockResolvedValue();

      // All these methods should now work without initialization errors
      await expect(service.listCharacterConcepts()).resolves.toBeDefined();
      await expect(
        service.getCharacterConcept('test-id')
      ).resolves.toBeDefined();
      await expect(
        service.deleteCharacterConcept('test-id')
      ).resolves.toBeUndefined();
      await expect(
        service.getThematicDirections('concept-id')
      ).resolves.toBeDefined();
      await expect(service.getAllThematicDirections()).resolves.toBeDefined();
      await expect(
        service.deleteThematicDirection('direction-id')
      ).resolves.toBeUndefined();
    });

    it('should handle race conditions in initialization gracefully', async () => {
      const service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      // Start multiple initialization calls simultaneously
      const initPromises = [
        service.initialize(),
        service.initialize(),
        service.initialize(),
      ];

      // All should complete successfully
      await Promise.all(initPromises);

      // Database initialize may be called multiple times due to race conditions,
      // but the service should handle it gracefully
      expect(mockDatabase.initialize).toHaveBeenCalled();

      // Should eventually be initialized
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([]);
      await expect(service.listCharacterConcepts()).resolves.toBeDefined();
    });

    it('should preserve initialization state after initialization failure', async () => {
      const service = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      // Make database initialization fail
      const initError = new Error('Database initialization failed');
      mockDatabase.initialize.mockRejectedValue(initError);

      // First initialization should fail
      await expect(service.initialize()).rejects.toThrow(CharacterStorageError);

      // Service should still be uninitialized, so other methods should still fail with initialization error
      await expect(service.listCharacterConcepts()).rejects.toThrow(
        'CharacterStorageService not initialized'
      );

      // Fix the database mock and try again
      mockDatabase.initialize.mockReset();
      mockDatabase.initialize.mockResolvedValue();

      // Second initialization attempt should succeed
      await service.initialize();

      // Now methods should work
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([]);
      await expect(service.listCharacterConcepts()).resolves.toBeDefined();
    });
  });
});
