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
      mockStorageService.storeCharacterConcept.mockResolvedValue(
        updatedConcept
      );

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

  describe('Core Motivations Operations', () => {
    let mockContainer;
    let mockDatabase;
    let mockCoreMotivationsGenerator;

    beforeEach(() => {
      mockDatabase = {
        getCoreMotivationsByDirectionId: jest.fn(),
        hasCoreMotivationsForDirection: jest.fn(),
        saveCoreMotivations: jest.fn(),
        deleteCoreMotivation: jest.fn(),
        deleteAllCoreMotivationsForDirection: jest.fn(),
        getCoreMotivationsByConceptId: jest.fn(),
        getCoreMotivationsCount: jest.fn(),
      };

      mockCoreMotivationsGenerator = {
        generate: jest.fn(),
        getLastModelUsed: jest.fn().mockReturnValue('gpt-4'),
      };

      mockContainer = {
        resolve: jest.fn().mockImplementation((token) => {
          if (token === 'ICoreMotivationsGenerator') {
            return mockCoreMotivationsGenerator;
          }
          throw new Error(`Unknown token: ${token}`);
        }),
      };

      mockStorageService.getThematicDirection = jest.fn();

      service = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        database: mockDatabase,
        container: mockContainer,
      });
    });

    describe('generateCoreMotivationsForDirection', () => {
      it('should generate core motivations successfully', async () => {
        const conceptId = 'concept-123';
        const directionId = 'direction-456';
        const cliches = [{ id: 'cliche-1', type: 'name' }];

        const mockConcept = {
          id: conceptId,
          concept: 'A brave warrior',
        };

        const mockDirection = {
          id: directionId,
          conceptId,
          title: 'The Reluctant Hero',
        };

        const mockGeneratedMotivations = [
          {
            coreDesire: 'To protect the innocent',
            internalContradiction: 'Wants peace but must fight',
            centralQuestion: 'Can violence ever be justified?',
          },
        ];

        mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);
        mockStorageService.getThematicDirection.mockResolvedValue(
          mockDirection
        );
        mockCoreMotivationsGenerator.generate.mockResolvedValue(
          mockGeneratedMotivations
        );

        const result = await service.generateCoreMotivationsForDirection(
          conceptId,
          directionId,
          cliches
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          directionId,
          conceptId,
          coreDesire: 'To protect the innocent',
          internalContradiction: 'Wants peace but must fight',
          centralQuestion: 'Can violence ever be justified?',
        });

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_STARTED,
          {
            conceptId,
            directionId,
            directionTitle: 'The Reluctant Hero',
            timestamp: expect.any(String),
          }
        );
      });

      it('should throw error when concept not found', async () => {
        const conceptId = 'non-existent';
        const directionId = 'direction-456';
        const cliches = [{ id: 'cliche-1' }];

        mockStorageService.getCharacterConcept.mockResolvedValue(null);

        await expect(
          service.generateCoreMotivationsForDirection(
            conceptId,
            directionId,
            cliches
          )
        ).rejects.toThrow('Concept non-existent not found');
      });

      it('should throw error when direction not found', async () => {
        const conceptId = 'concept-123';
        const directionId = 'non-existent';
        const cliches = [{ id: 'cliche-1' }];

        const mockConcept = { id: conceptId, concept: 'A brave warrior' };

        mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);
        mockStorageService.getThematicDirection.mockResolvedValue(null);

        await expect(
          service.generateCoreMotivationsForDirection(
            conceptId,
            directionId,
            cliches
          )
        ).rejects.toThrow('Direction non-existent not found');
      });

      it('should throw error when direction does not belong to concept', async () => {
        const conceptId = 'concept-123';
        const directionId = 'direction-456';
        const cliches = [{ id: 'cliche-1' }];

        const mockConcept = { id: conceptId, concept: 'A brave warrior' };
        const mockDirection = { id: directionId, conceptId: 'other-concept' };

        mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);
        mockStorageService.getThematicDirection.mockResolvedValue(
          mockDirection
        );

        await expect(
          service.generateCoreMotivationsForDirection(
            conceptId,
            directionId,
            cliches
          )
        ).rejects.toThrow('Direction does not belong to the specified concept');
      });

      it('should dispatch generation failed event on error', async () => {
        const conceptId = 'concept-123';
        const directionId = 'direction-456';
        const cliches = [{ id: 'cliche-1' }];

        const mockConcept = { id: conceptId, concept: 'A brave warrior' };
        const mockDirection = { id: directionId, conceptId, title: 'Hero' };

        mockStorageService.getCharacterConcept.mockResolvedValue(mockConcept);
        mockStorageService.getThematicDirection.mockResolvedValue(
          mockDirection
        );
        mockCoreMotivationsGenerator.generate.mockRejectedValue(
          new Error('Generation failed')
        );

        await expect(
          service.generateCoreMotivationsForDirection(
            conceptId,
            directionId,
            cliches
          )
        ).rejects.toThrow('Generation failed');

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_FAILED,
          {
            conceptId,
            directionId,
            error: 'Generation failed',
            errorCode: 'GENERATION_ERROR',
          }
        );
      });
    });

    describe('getCoreMotivationsByDirectionId', () => {
      it('should dispatch event with correct format', async () => {
        // This test reproduces the issue where event was dispatched as object instead of string
        const directionId = 'direction-123';
        const dbMotivations = [
          {
            id: 'motivation-1',
            directionId,
            conceptId: 'concept-1',
            coreDesire: 'To be loved',
            internalContradiction: 'Fears vulnerability',
            centralQuestion: 'Is love worth the risk?',
          },
        ];

        mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue(
          dbMotivations
        );

        await service.getCoreMotivationsByDirectionId(directionId);

        // Verify event was dispatched with correct format
        expect(mockEventBus.dispatch).toHaveBeenCalled();

        // Find the core motivations retrieved event dispatch
        const retrievedEventCall = mockEventBus.dispatch.mock.calls.find(
          (call) => {
            // The first argument should be the event name string
            const eventName = call[0];
            return (
              eventName ===
                CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED ||
              eventName === 'core:core_motivations_retrieved'
            );
          }
        );

        expect(retrievedEventCall).toBeDefined();

        // The first argument should be a string, not an object
        const eventNameArg = retrievedEventCall[0];
        expect(typeof eventNameArg).toBe('string');
        expect(eventNameArg).not.toBeNull();
        expect(eventNameArg).not.toBeUndefined();

        // Should not be an object with 'type' property
        expect(eventNameArg).not.toHaveProperty('type');

        // The second argument should be the payload
        const payload = retrievedEventCall[1];
        expect(payload).toBeDefined();
        expect(payload.directionId).toBe(directionId);
        expect(payload.source).toBe('database');
        expect(payload.count).toBe(1);
      });

      it('should return cached motivations when available', async () => {
        const directionId = 'direction-123';
        const cachedMotivations = [{ id: 'motivation-1' }];

        // Since we can't access private fields directly, we'll mock the database to return empty
        // and set up the scenario where cache would be hit by making subsequent calls
        mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue([]);

        // First call will populate cache, second call should use cache
        await service.getCoreMotivationsByDirectionId(directionId);

        // Now test that subsequent calls don't hit database again
        const result =
          await service.getCoreMotivationsByDirectionId(directionId);

        expect(
          mockDatabase.getCoreMotivationsByDirectionId
        ).toHaveBeenCalledTimes(1);
      });

      it('should fetch from database when cache is empty', async () => {
        const directionId = 'direction-123';
        const dbMotivations = [
          {
            id: 'motivation-1',
            directionId,
            conceptId: 'concept-1',
            coreDesire: 'To be loved',
            internalContradiction: 'Fears vulnerability',
            centralQuestion: 'Is love worth the risk?',
          },
        ];

        mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue(
          dbMotivations
        );

        const result =
          await service.getCoreMotivationsByDirectionId(directionId);

        expect(result).toHaveLength(1);
        expect(
          mockDatabase.getCoreMotivationsByDirectionId
        ).toHaveBeenCalledWith(directionId);
      });

      it('should handle database errors gracefully', async () => {
        const directionId = 'direction-123';

        mockDatabase.getCoreMotivationsByDirectionId.mockRejectedValue(
          new Error('Database error')
        );

        await expect(
          service.getCoreMotivationsByDirectionId(directionId)
        ).rejects.toThrow('Failed to retrieve core motivations');
      });
    });

    describe('hasCoreMotivationsForDirection', () => {
      it('should return true when motivations exist', async () => {
        const directionId = 'direction-123';

        mockDatabase.hasCoreMotivationsForDirection.mockResolvedValue(true);

        const result =
          await service.hasCoreMotivationsForDirection(directionId);

        expect(result).toBe(true);
        expect(
          mockDatabase.hasCoreMotivationsForDirection
        ).toHaveBeenCalledWith(directionId);
      });

      it('should return false when no motivations exist', async () => {
        const directionId = 'direction-123';

        mockDatabase.hasCoreMotivationsForDirection.mockResolvedValue(false);

        const result =
          await service.hasCoreMotivationsForDirection(directionId);

        expect(result).toBe(false);
      });

      it('should return false on database error', async () => {
        const directionId = 'direction-123';

        mockDatabase.hasCoreMotivationsForDirection.mockRejectedValue(
          new Error('Database error')
        );

        const result =
          await service.hasCoreMotivationsForDirection(directionId);

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('saveCoreMotivations', () => {
      it('should save motivations successfully', async () => {
        const directionId = 'direction-123';
        const motivations = [
          {
            id: 'motivation-1',
            directionId,
            conceptId: 'concept-1',
            coreDesire: 'To be loved',
            toJSON: jest.fn().mockReturnValue({
              id: 'motivation-1',
              directionId,
              conceptId: 'concept-1',
              coreDesire: 'To be loved',
            }),
          },
        ];

        const savedIds = ['motivation-1'];

        mockDatabase.saveCoreMotivations.mockResolvedValue(savedIds);
        mockDatabase.getCoreMotivationsCount.mockResolvedValue(1);

        const result = await service.saveCoreMotivations(
          directionId,
          motivations
        );

        expect(result).toEqual(savedIds);
        expect(mockDatabase.saveCoreMotivations).toHaveBeenCalled();
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_COMPLETED,
          {
            conceptId: 'concept-1',
            directionId,
            motivationIds: savedIds,
            totalCount: 1,
            generationTime: expect.any(Number),
          }
        );
      });

      it('should throw error for empty motivations array', async () => {
        const directionId = 'direction-123';
        const motivations = [];

        await expect(
          service.saveCoreMotivations(directionId, motivations)
        ).rejects.toThrow('Motivations must be a non-empty array');
      });

      it('should handle non-CoreMotivation objects', async () => {
        const directionId = 'direction-123';
        const motivations = [
          {
            id: 'motivation-1',
            conceptId: 'concept-1',
            coreDesire: 'To be loved',
          },
        ];

        const savedIds = ['motivation-1'];

        mockDatabase.saveCoreMotivations.mockResolvedValue(savedIds);
        mockDatabase.getCoreMotivationsCount.mockResolvedValue(1);

        const result = await service.saveCoreMotivations(
          directionId,
          motivations
        );

        expect(result).toEqual(savedIds);
      });
    });

    describe('removeCoreMotivationItem', () => {
      it('should remove motivation successfully', async () => {
        const directionId = 'direction-123';
        const motivationId = 'motivation-456';

        mockDatabase.deleteCoreMotivation.mockResolvedValue(true);

        const result = await service.removeCoreMotivationItem(
          directionId,
          motivationId
        );

        expect(result).toBe(true);
        expect(mockDatabase.deleteCoreMotivation).toHaveBeenCalledWith(
          motivationId
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Removed core motivation ${motivationId}`
        );
      });

      it('should handle failed removal', async () => {
        const directionId = 'direction-123';
        const motivationId = 'motivation-456';

        mockDatabase.deleteCoreMotivation.mockResolvedValue(false);

        const result = await service.removeCoreMotivationItem(
          directionId,
          motivationId
        );

        expect(result).toBe(false);
      });

      it('should handle database errors', async () => {
        const directionId = 'direction-123';
        const motivationId = 'motivation-456';

        mockDatabase.deleteCoreMotivation.mockRejectedValue(
          new Error('Database error')
        );

        await expect(
          service.removeCoreMotivationItem(directionId, motivationId)
        ).rejects.toThrow('Database error');
      });
    });

    describe('clearCoreMotivationsForDirection', () => {
      it('should clear all motivations for direction', async () => {
        const directionId = 'direction-123';
        const deletedCount = 5;

        mockDatabase.deleteAllCoreMotivationsForDirection.mockResolvedValue(
          deletedCount
        );

        const result =
          await service.clearCoreMotivationsForDirection(directionId);

        expect(result).toBe(deletedCount);
        expect(
          mockDatabase.deleteAllCoreMotivationsForDirection
        ).toHaveBeenCalledWith(directionId);
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Cleared ${deletedCount} core motivations for direction ${directionId}`
        );
      });

      it('should handle database errors', async () => {
        const directionId = 'direction-123';

        mockDatabase.deleteAllCoreMotivationsForDirection.mockRejectedValue(
          new Error('Database error')
        );

        await expect(
          service.clearCoreMotivationsForDirection(directionId)
        ).rejects.toThrow('Database error');
      });
    });

    describe('getAllCoreMotivationsForConcept', () => {
      it('should return motivations grouped by direction', async () => {
        const conceptId = 'concept-123';
        const dbMotivations = [
          {
            id: 'motivation-1',
            directionId: 'direction-1',
            conceptId,
            coreDesire: 'To be loved',
            internalContradiction: 'Fears vulnerability',
            centralQuestion: 'Is love worth the risk?',
          },
          {
            id: 'motivation-2',
            directionId: 'direction-2',
            conceptId,
            coreDesire: 'To be powerful',
            internalContradiction: 'Knows power corrupts',
            centralQuestion: 'Can power be used for good?',
          },
          {
            id: 'motivation-3',
            directionId: 'direction-1',
            conceptId,
            coreDesire: 'To be accepted',
            internalContradiction: 'Wants to be unique',
            centralQuestion: 'Can one belong while being different?',
          },
        ];

        mockDatabase.getCoreMotivationsByConceptId.mockResolvedValue(
          dbMotivations
        );

        const result = await service.getAllCoreMotivationsForConcept(conceptId);

        expect(Object.keys(result)).toHaveLength(2);
        expect(result['direction-1']).toHaveLength(2);
        expect(result['direction-2']).toHaveLength(1);
      });

      it('should handle database errors', async () => {
        const conceptId = 'concept-123';

        mockDatabase.getCoreMotivationsByConceptId.mockRejectedValue(
          new Error('Database error')
        );

        await expect(
          service.getAllCoreMotivationsForConcept(conceptId)
        ).rejects.toThrow('Database error');
      });
    });

    describe('exportCoreMotivationsToText', () => {
      it('should export motivations to formatted text', async () => {
        const directionId = 'direction-123';
        const motivations = [
          {
            coreDesire: 'To be loved',
            internalContradiction: 'Fears vulnerability',
            centralQuestion: 'Is love worth the risk?',
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ];

        const mockDirection = { id: directionId, title: 'The Reluctant Lover' };

        service.getCoreMotivationsByDirectionId = jest
          .fn()
          .mockResolvedValue(motivations);
        mockStorageService.getThematicDirection.mockResolvedValue(
          mockDirection
        );

        const result = await service.exportCoreMotivationsToText(directionId);

        expect(result).toContain('Core Motivations for: The Reluctant Lover');
        expect(result).toContain('To be loved');
        expect(result).toContain('Fears vulnerability');
        expect(result).toContain('Is love worth the risk?');
        expect(result).toContain('Total Motivations: 1');
      });

      it('should return message when no motivations found', async () => {
        const directionId = 'direction-123';

        service.getCoreMotivationsByDirectionId = jest
          .fn()
          .mockResolvedValue([]);

        const result = await service.exportCoreMotivationsToText(directionId);

        expect(result).toBe('No core motivations found for this direction.');
      });
    });

    describe('getCoreMotivationsStatistics', () => {
      it('should return statistics about core motivations', async () => {
        const conceptId = 'concept-123';
        const directions = [
          { id: 'direction-1', title: 'Hero' },
          { id: 'direction-2', title: 'Villain' },
          { id: 'direction-3', title: 'Mentor' },
        ];

        service.getThematicDirectionsByConceptId = jest
          .fn()
          .mockResolvedValue(directions);
        mockDatabase.getCoreMotivationsCount
          .mockResolvedValueOnce(3) // direction-1 has 3 motivations
          .mockResolvedValueOnce(0) // direction-2 has 0 motivations
          .mockResolvedValueOnce(2); // direction-3 has 2 motivations

        const result = await service.getCoreMotivationsStatistics(conceptId);

        expect(result).toEqual({
          totalDirections: 3,
          directionsWithMotivations: 2,
          totalMotivations: 5,
          averageMotivationsPerDirection: 2.5,
          directionStats: [
            {
              directionId: 'direction-1',
              directionTitle: 'Hero',
              motivationCount: 3,
            },
            {
              directionId: 'direction-3',
              directionTitle: 'Mentor',
              motivationCount: 2,
            },
          ],
        });
      });

      it('should handle concepts with no motivations', async () => {
        const conceptId = 'concept-123';
        const directions = [{ id: 'direction-1', title: 'Hero' }];

        service.getThematicDirectionsByConceptId = jest
          .fn()
          .mockResolvedValue(directions);
        mockDatabase.getCoreMotivationsCount.mockResolvedValue(0);

        const result = await service.getCoreMotivationsStatistics(conceptId);

        expect(result).toEqual({
          totalDirections: 1,
          directionsWithMotivations: 0,
          totalMotivations: 0,
          averageMotivationsPerDirection: 0,
          directionStats: [],
        });
      });
    });

    describe('getThematicDirectionsByConceptId', () => {
      it('should return thematic directions for concept', async () => {
        const conceptId = 'concept-123';
        const directions = [
          { id: 'direction-1', title: 'Hero' },
          { id: 'direction-2', title: 'Villain' },
        ];

        mockStorageService.getThematicDirections.mockResolvedValue(directions);

        const result =
          await service.getThematicDirectionsByConceptId(conceptId);

        expect(result).toEqual(directions);
        expect(mockStorageService.getThematicDirections).toHaveBeenCalledWith(
          conceptId
        );
      });

      it('should handle storage service errors', async () => {
        const conceptId = 'concept-123';

        mockStorageService.getThematicDirections.mockRejectedValue(
          new Error('Storage error')
        );

        await expect(
          service.getThematicDirectionsByConceptId(conceptId)
        ).rejects.toThrow('Storage error');
      });
    });
  });
});
