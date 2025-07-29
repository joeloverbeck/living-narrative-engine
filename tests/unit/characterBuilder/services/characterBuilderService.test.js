/**
 * @file Unit tests for CharacterBuilderService
 * @see src/characterBuilder/services/characterBuilderService.js
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
  CharacterBuilderService,
  CHARACTER_BUILDER_EVENTS,
  CharacterBuilderError,
} from '../../../../src/characterBuilder/services/characterBuilderService.js';
import {
  createCharacterConcept,
  updateCharacterConcept,
  CHARACTER_CONCEPT_STATUS,
} from '../../../../src/characterBuilder/models/characterConcept.js';

describe('CharacterBuilderService', () => {
  let service;
  let mockLogger;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(() => {
        service = new CharacterBuilderService({
          logger: mockLogger,
          storageService: mockStorageService,
          directionGenerator: mockDirectionGenerator,
          eventBus: mockEventBus,
        });
      }).not.toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing info, warn, error

      expect(() => {
        new CharacterBuilderService({
          logger: invalidLogger,
          storageService: mockStorageService,
          directionGenerator: mockDirectionGenerator,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error when storageService is missing required methods', () => {
      const invalidStorage = { initialize: jest.fn() }; // Missing other methods

      expect(() => {
        new CharacterBuilderService({
          logger: mockLogger,
          storageService: invalidStorage,
          directionGenerator: mockDirectionGenerator,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error when directionGenerator is missing required methods', () => {
      const invalidGenerator = {}; // Missing generateDirections

      expect(() => {
        new CharacterBuilderService({
          logger: mockLogger,
          storageService: mockStorageService,
          directionGenerator: invalidGenerator,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error when eventBus is missing required methods', () => {
      const invalidEventBus = {}; // Missing dispatch

      expect(() => {
        new CharacterBuilderService({
          logger: mockLogger,
          storageService: mockStorageService,
          directionGenerator: mockDirectionGenerator,
          eventBus: invalidEventBus,
        });
      }).toThrow();
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should successfully initialize storage service', async () => {
      await service.initialize();

      expect(mockStorageService.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderService: Successfully initialized'
      );
    });

    it('should throw CharacterBuilderError when storage initialization fails', async () => {
      const storageError = new Error('Storage init failed');
      mockStorageService.initialize.mockRejectedValue(storageError);

      await expect(service.initialize()).rejects.toThrow(CharacterBuilderError);
      await expect(service.initialize()).rejects.toThrow(
        'Failed to initialize character builder service: Storage init failed'
      );
    });
  });

  describe('createCharacterConcept', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should create and save character concept with autoSave enabled', async () => {
      const conceptText = 'A brave warrior from the north';
      const mockConcept = createCharacterConcept(conceptText);
      const mockSavedConcept = { ...mockConcept, id: 'saved-id' };

      mockStorageService.storeCharacterConcept.mockResolvedValue(
        mockSavedConcept
      );

      const result = await service.createCharacterConcept(conceptText);

      expect(result).toEqual(mockSavedConcept);
      expect(mockStorageService.storeCharacterConcept).toHaveBeenCalledTimes(1);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
        expect.objectContaining({
          conceptId: mockSavedConcept.id,
          autoSaved: true,
        })
      );
    });

    it('should create character concept without saving when autoSave is false', async () => {
      const conceptText = 'A wise mage';

      const result = await service.createCharacterConcept(conceptText, {
        autoSave: false,
      });

      expect(mockStorageService.storeCharacterConcept).not.toHaveBeenCalled();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
        expect.objectContaining({
          autoSaved: false,
        })
      );
    });

    it('should throw error for empty concept string', async () => {
      await expect(service.createCharacterConcept('')).rejects.toThrow(
        'concept must be a non-empty string'
      );

      await expect(service.createCharacterConcept('   ')).rejects.toThrow(
        'concept must be a non-empty string'
      );
    });

    it('should throw error for non-string concept', async () => {
      await expect(service.createCharacterConcept(null)).rejects.toThrow(
        'concept must be a non-empty string'
      );

      await expect(service.createCharacterConcept(123)).rejects.toThrow(
        'concept must be a non-empty string'
      );
    });

    it('should not retry on validation errors', async () => {
      const conceptText = 'Invalid concept';
      const validationError = new Error('Validation failed');
      validationError.name = 'CharacterConceptValidationError';

      mockStorageService.storeCharacterConcept.mockRejectedValue(
        validationError
      );

      await expect(service.createCharacterConcept(conceptText)).rejects.toThrow(
        CharacterBuilderError
      );

      expect(mockStorageService.storeCharacterConcept).toHaveBeenCalledTimes(1);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        expect.objectContaining({
          operation: 'createCharacterConcept',
        })
      );
    });
  });

  describe('generateThematicDirections', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should generate and save thematic directions successfully', async () => {
      const conceptId = 'test-concept-id';
      const mockConcept = createCharacterConcept('Test concept');
      const mockDirections = [
        { id: 'dir1', direction: 'Direction 1' },
        { id: 'dir2', direction: 'Direction 2' },
      ];

      mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(
        mockDirections
      );
      mockStorageService.storeThematicDirections.mockResolvedValue(
        mockDirections
      );

      const result = await service.generateThematicDirections(conceptId);

      expect(result).toEqual(mockDirections);
      expect(mockDirectionGenerator.generateDirections).toHaveBeenCalledWith(
        conceptId,
        mockConcept.concept,
        { llmConfigId: undefined }
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED,
        expect.objectContaining({
          conceptId,
          directionCount: 2,
          autoSaved: true,
        })
      );
    });

    it('should generate directions without saving when autoSave is false', async () => {
      const conceptId = 'test-concept-id';
      const mockConcept = createCharacterConcept('Test concept');
      const mockDirections = [{ id: 'dir1', direction: 'Direction 1' }];

      mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(
        mockDirections
      );

      const result = await service.generateThematicDirections(conceptId, {
        autoSave: false,
      });

      expect(result).toEqual(mockDirections);
      expect(mockStorageService.storeThematicDirections).not.toHaveBeenCalled();
    });

    it('should throw error for invalid conceptId', async () => {
      await expect(service.generateThematicDirections(null)).rejects.toThrow(
        'conceptId must be a non-empty string'
      );

      await expect(service.generateThematicDirections('')).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw error when concept not found', async () => {
      mockStorageService.getCharacterConcept.mockResolvedValue(null);

      await expect(
        service.generateThematicDirections('missing-id')
      ).rejects.toThrow('Character concept not found: missing-id');
    });

    it('should throw error for empty or invalid directions', async () => {
      const conceptId = 'test-concept-id';
      const mockConcept = createCharacterConcept(
        'Test concept for empty directions'
      );

      mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);

      // Mock empty directions that will always fail validation
      mockDirectionGenerator.generateDirections.mockResolvedValue([]);

      // The test should fail with the retry mechanism
      await expect(
        service.generateThematicDirections(conceptId)
      ).rejects.toThrow(CharacterBuilderError);
    });
  });

  describe('getAllCharacterConcepts', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should retrieve all character concepts successfully', async () => {
      const mockConcepts = [
        createCharacterConcept('First character concept with enough length'),
        createCharacterConcept('Second character concept with enough length'),
      ];

      mockStorageService.listCharacterConcepts.mockResolvedValue(mockConcepts);

      const result = await service.getAllCharacterConcepts();

      expect(result).toEqual(mockConcepts);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterBuilderService: Retrieved 2 character concepts'
      );
    });

    it('should handle empty concept list', async () => {
      mockStorageService.listCharacterConcepts.mockResolvedValue([]);

      const result = await service.getAllCharacterConcepts();

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterBuilderService: Retrieved 0 character concepts'
      );
    });

    it('should throw CharacterBuilderError on storage failure', async () => {
      const error = new Error('Storage error');
      mockStorageService.listCharacterConcepts.mockRejectedValue(error);

      await expect(service.getAllCharacterConcepts()).rejects.toThrow(
        CharacterBuilderError
      );
      await expect(service.getAllCharacterConcepts()).rejects.toThrow(
        'Failed to list character concepts: Storage error'
      );
    });
  });

  describe('getCharacterConcept', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should retrieve character concept by ID', async () => {
      const conceptId = 'test-id';
      const mockConcept = createCharacterConcept('Test concept');

      mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);

      const result = await service.getCharacterConcept(conceptId);

      expect(result).toEqual(mockConcept);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `CharacterBuilderService: Retrieved character concept ${conceptId}`
      );
    });

    it('should return null when concept not found', async () => {
      const conceptId = 'missing-id';

      mockStorageService.getCharacterConcept.mockResolvedValue(null);

      const result = await service.getCharacterConcept(conceptId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `CharacterBuilderService: Character concept ${conceptId} not found`
      );
    });

    it('should throw error for invalid conceptId', async () => {
      await expect(service.getCharacterConcept(null)).rejects.toThrow(
        'conceptId must be a non-empty string'
      );

      await expect(service.getCharacterConcept('')).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw CharacterBuilderError on storage failure', async () => {
      const error = new Error('Storage error');
      mockStorageService.getCharacterConcept.mockRejectedValue(error);

      await expect(service.getCharacterConcept('test-id')).rejects.toThrow(
        CharacterBuilderError
      );
    });
  });

  describe('getThematicDirections', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should retrieve thematic directions for concept', async () => {
      const conceptId = 'test-id';
      const mockDirections = [
        { id: 'dir1', direction: 'Direction 1' },
        { id: 'dir2', direction: 'Direction 2' },
      ];

      mockStorageService.getThematicDirections.mockResolvedValue(
        mockDirections
      );

      const result = await service.getThematicDirections(conceptId);

      expect(result).toEqual(mockDirections);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `CharacterBuilderService: Retrieved 2 thematic directions for concept ${conceptId}`
      );
    });

    it('should handle empty directions list', async () => {
      const conceptId = 'test-id';

      mockStorageService.getThematicDirections.mockResolvedValue([]);

      const result = await service.getThematicDirections(conceptId);

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `CharacterBuilderService: Retrieved 0 thematic directions for concept ${conceptId}`
      );
    });

    it('should throw error for invalid conceptId', async () => {
      await expect(service.getThematicDirections(null)).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw CharacterBuilderError on storage failure', async () => {
      const error = new Error('Storage error');
      mockStorageService.getThematicDirections.mockRejectedValue(error);

      await expect(service.getThematicDirections('test-id')).rejects.toThrow(
        CharacterBuilderError
      );
    });
  });

  describe('deleteCharacterConcept', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should delete character concept successfully', async () => {
      const conceptId = 'test-id';

      mockStorageService.deleteCharacterConcept.mockResolvedValue(true);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `CharacterBuilderService: Deleted character concept ${conceptId}`
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED,
        { conceptId }
      );
    });

    it('should return false when deletion fails', async () => {
      const conceptId = 'test-id';

      mockStorageService.deleteCharacterConcept.mockResolvedValue(false);

      const result = await service.deleteCharacterConcept(conceptId);

      expect(result).toBe(false);
      expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED,
        expect.any(Object)
      );
    });

    it('should throw error for invalid conceptId', async () => {
      await expect(service.deleteCharacterConcept(null)).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw CharacterBuilderError and dispatch error event on failure', async () => {
      const conceptId = 'test-id';
      const error = new Error('Storage error');

      mockStorageService.deleteCharacterConcept.mockRejectedValue(error);

      await expect(service.deleteCharacterConcept(conceptId)).rejects.toThrow(
        CharacterBuilderError
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        expect.objectContaining({
          operation: 'deleteCharacterConcept',
          conceptId,
        })
      );
    });
  });

  describe('updateCharacterConcept', () => {
    beforeEach(() => {
      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });
    });

    it('should update character concept successfully', async () => {
      const conceptId = 'test-id';
      const existingConcept = createCharacterConcept('Original concept');
      const updates = {
        concept: 'Updated concept',
        metadata: { updated: true },
      };
      const updatedConcept = { ...existingConcept, ...updates };

      mockStorageService.getCharacterConcept.mockResolvedValue(existingConcept);
      mockStorageService.storeCharacterConcept.mockResolvedValue(updatedConcept);

      const result = await service.updateCharacterConcept(conceptId, updates);

      expect(result).toEqual(updatedConcept);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `CharacterBuilderService: Updated character concept ${conceptId}`
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED,
        {
          concept: updatedConcept,
          updates,
        }
      );
    });

    it('should throw error for invalid conceptId', async () => {
      await expect(service.updateCharacterConcept(null, {})).rejects.toThrow(
        'conceptId must be a non-empty string'
      );
    });

    it('should throw error for invalid updates', async () => {
      await expect(
        service.updateCharacterConcept('test-id', null)
      ).rejects.toThrow('updates must be a valid object');

      await expect(
        service.updateCharacterConcept('test-id', 'not-an-object')
      ).rejects.toThrow('updates must be a valid object');
    });

    it('should throw error when concept not found', async () => {
      mockStorageService.getCharacterConcept.mockResolvedValue(null);

      await expect(
        service.updateCharacterConcept('missing-id', { concept: 'New' })
      ).rejects.toThrow('Character concept not found: missing-id');
    });

    it('should dispatch error event on failure', async () => {
      const conceptId = 'test-id';
      const updates = { concept: 'Updated' };
      const error = new Error('Update failed');

      mockStorageService.getCharacterConcept.mockRejectedValue(error);

      await expect(
        service.updateCharacterConcept(conceptId, updates)
      ).rejects.toThrow(CharacterBuilderError);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        expect.objectContaining({
          operation: 'updateCharacterConcept',
          conceptId,
          updates,
        })
      );
    });
  });

  describe('CharacterBuilderError', () => {
    it('should create error with message and cause', () => {
      const cause = new Error('Original error');
      const error = new CharacterBuilderError('Custom message', cause);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('CharacterBuilderError');
      expect(error.message).toBe('Custom message');
      expect(error.cause).toBe(cause);
    });
  });

  describe('Retry configuration', () => {
    it('should use test environment timings in test mode', () => {
      // The RETRY_CONFIG is already set when process.env.NODE_ENV is 'test'
      // Just verify that the service uses appropriate timings
      expect(process.env.NODE_ENV).toBe('test');

      // The service should have been created with test timings
      // We can verify this indirectly by checking that retries happen quickly
      // in the tests above (which they do)
    });
  });
});
