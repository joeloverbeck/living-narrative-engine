/**
 * @file Unit tests for CharacterBuilderService - Cliché Operations
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
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';

describe('CharacterBuilderService - Cliché Operations', () => {
  let service;
  let mockLogger;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;
  let mockDatabase;
  let mockSchemaValidator;
  let mockClicheGenerator;

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

    mockDatabase = {
      getClicheByDirectionId: jest.fn(),
      saveCliche: jest.fn(),
      deleteCliche: jest.fn(),
      addMetadata: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
      formatAjvErrors: jest.fn().mockReturnValue(''),
    };

    mockClicheGenerator = {
      generateCliches: jest.fn(),
    };

    service = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
      clicheGenerator: mockClicheGenerator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getClichesByDirectionId', () => {
    const mockClicheData = {
      id: 'cliche-1',
      directionId: 'dir-1',
      conceptId: 'concept-1',
      categories: {
        names: ['John', 'Jane'],
        physicalDescriptions: ['tall, dark, handsome'],
        personalityTraits: ['brooding', 'mysterious'],
        skillsAbilities: ['sword fighting'],
        typicalLikes: ['justice'],
        typicalDislikes: ['evil'],
        commonFears: ['heights'],
        genericGoals: ['save the world'],
        backgroundElements: ['tragic backstory'],
        overusedSecrets: ['secret royal heritage'],
        speechPatterns: ['witty one-liners'],
      },
      tropesAndStereotypes: ['The Chosen One', 'Dark Past'],
      createdAt: '2023-01-01T00:00:00.000Z',
      llmMetadata: {
        model: 'gpt-4',
        temperature: 0.7,
        tokens: 1000,
        responseTime: 2000,
      },
    };

    it('should retrieve clichés from database', async () => {
      mockDatabase.getClicheByDirectionId.mockResolvedValue(mockClicheData);

      const result = await service.getClichesByDirectionId('dir-1');

      expect(result).toBeInstanceOf(Cliche);
      expect(result.directionId).toBe('dir-1');
      expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledWith('dir-1');
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED,
        payload: {
          directionId: 'dir-1',
          clicheId: 'cliche-1',
          categoryStats: expect.any(Object),
        },
      });
    });

    it('should return cached clichés on second call', async () => {
      mockDatabase.getClicheByDirectionId.mockResolvedValue(mockClicheData);

      // First call - hits database
      await service.getClichesByDirectionId('dir-1');
      expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      await service.getClichesByDirectionId('dir-1');
      expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache hit for clichés: dir-1'
      );
    });

    it('should return null for non-existent clichés', async () => {
      mockDatabase.getClicheByDirectionId.mockResolvedValue(null);

      const result = await service.getClichesByDirectionId('dir-999');

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No clichés found for direction: dir-999'
      );
    });

    it('should handle database errors', async () => {
      mockDatabase.getClicheByDirectionId.mockRejectedValue(
        new Error('DB Error')
      );

      await expect(service.getClichesByDirectionId('dir-1')).rejects.toThrow(
        CharacterBuilderError
      );

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVAL_FAILED,
        payload: {
          directionId: 'dir-1',
          error: 'DB Error',
        },
      });
    });

    it('should handle missing database gracefully', async () => {
      const serviceWithoutDb = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        database: null,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      const result = await serviceWithoutDb.getClichesByDirectionId('dir-1');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Database not available for cliché operations'
      );
    });

    it('should throw error for invalid directionId', async () => {
      await expect(service.getClichesByDirectionId('')).rejects.toThrow();
      await expect(service.getClichesByDirectionId(null)).rejects.toThrow();
      await expect(
        service.getClichesByDirectionId(undefined)
      ).rejects.toThrow();
    });
  });

  describe('hasClichesForDirection', () => {
    it('should return true when clichés exist in database', async () => {
      mockDatabase.getClicheByDirectionId.mockResolvedValue({ id: 'cliche-1' });

      const result = await service.hasClichesForDirection('dir-1');

      expect(result).toBe(true);
      expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledWith('dir-1');
    });

    it('should return false when no clichés exist', async () => {
      mockDatabase.getClicheByDirectionId.mockResolvedValue(null);

      const result = await service.hasClichesForDirection('dir-1');

      expect(result).toBe(false);
    });

    it('should check cache first', async () => {
      // Populate cache first
      mockDatabase.getClicheByDirectionId.mockResolvedValue({
        id: 'cliche-1',
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {},
        tropesAndStereotypes: [],
        createdAt: '2023-01-01T00:00:00.000Z',
      });
      await service.getClichesByDirectionId('dir-1');

      // Clear mock calls from cache population
      mockDatabase.getClicheByDirectionId.mockClear();

      // Check existence - should use cache
      const result = await service.hasClichesForDirection('dir-1');

      expect(result).toBe(true);
      expect(mockDatabase.getClicheByDirectionId).not.toHaveBeenCalled();
    });

    it('should return false when database unavailable', async () => {
      const serviceWithoutDb = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        database: null,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      const result = await serviceWithoutDb.hasClichesForDirection('dir-1');

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.getClicheByDirectionId.mockRejectedValue(
        new Error('DB Error')
      );

      const result = await service.hasClichesForDirection('dir-1');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error for invalid directionId', async () => {
      await expect(service.hasClichesForDirection('')).rejects.toThrow();
      await expect(service.hasClichesForDirection(null)).rejects.toThrow();
      await expect(service.hasClichesForDirection(undefined)).rejects.toThrow();
    });
  });

  describe('storeCliches', () => {
    const mockClicheInput = {
      directionId: 'dir-1',
      conceptId: 'concept-1',
      categories: {
        names: ['John'],
        physicalDescriptions: [],
        personalityTraits: [],
        skillsAbilities: [],
        typicalLikes: [],
        typicalDislikes: [],
        commonFears: [],
        genericGoals: [],
        backgroundElements: [],
        overusedSecrets: [],
        speechPatterns: [],
      },
      tropesAndStereotypes: [],
    };

    beforeEach(() => {
      mockDatabase.saveCliche.mockResolvedValue(mockClicheInput);
      mockDatabase.addMetadata.mockResolvedValue();
      mockDatabase.getClicheByDirectionId.mockResolvedValue(null); // No existing clichés
    });

    it('should store new clichés', async () => {
      const result = await service.storeCliches(mockClicheInput);

      expect(result).toBeInstanceOf(Cliche);
      expect(result.directionId).toBe('dir-1');
      expect(mockDatabase.saveCliche).toHaveBeenCalled();
      expect(mockDatabase.addMetadata).toHaveBeenCalledWith({
        key: 'last_cliche_generation',
        value: expect.objectContaining({
          directionId: 'dir-1',
          timestamp: expect.any(String),
          count: expect.any(Number),
        }),
      });
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CLICHES_STORED,
        payload: expect.objectContaining({
          directionId: 'dir-1',
          conceptId: 'concept-1',
          clicheId: expect.any(String),
          totalCount: expect.any(Number),
        }),
      });
    });

    it('should accept Cliche instances', async () => {
      const cliche = new Cliche(mockClicheInput);

      const result = await service.storeCliches(cliche);

      expect(result).toBeInstanceOf(Cliche);
      expect(result.id).toBe(cliche.id);
    });

    it('should prevent duplicate clichés', async () => {
      // Mock existing clichés
      mockDatabase.getClicheByDirectionId.mockResolvedValue({ id: 'existing' });

      await expect(service.storeCliches(mockClicheInput)).rejects.toThrow(
        CharacterBuilderError
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CLICHES_STORAGE_FAILED,
        payload: expect.objectContaining({
          directionId: 'dir-1',
        }),
      });
    });

    it('should validate against schema when validator available', async () => {
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Schema validation failed'
      );

      await expect(service.storeCliches(mockClicheInput)).rejects.toThrow(
        'Invalid cliché data'
      );
    });

    it('should handle database storage errors', async () => {
      mockDatabase.saveCliche.mockRejectedValue(new Error('Storage Error'));

      await expect(service.storeCliches(mockClicheInput)).rejects.toThrow(
        CharacterBuilderError
      );
    });

    it('should throw error when database unavailable', async () => {
      const serviceWithoutDb = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        database: null,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: mockClicheGenerator,
      });

      await expect(
        serviceWithoutDb.storeCliches(mockClicheInput)
      ).rejects.toThrow('Database not available for cliché storage');
    });

    it('should throw error for invalid input', async () => {
      await expect(service.storeCliches(null)).rejects.toThrow();
      await expect(service.storeCliches(undefined)).rejects.toThrow();
    });
  });

  describe('generateClichesForDirection', () => {
    const mockConcept = {
      id: 'concept-1',
      concept: 'A hero with a mysterious past',
      text: 'A hero with a mysterious past',
    };

    const mockDirection = {
      id: 'dir-1',
      conceptId: 'concept-1',
      title: 'The Chosen One',
      description: 'A destined hero',
      coreTension: 'Power vs responsibility',
    };

    const mockGeneratedData = {
      categories: {
        names: ['Aragorn'],
        physicalDescriptions: [],
        personalityTraits: [],
        skillsAbilities: [],
        typicalLikes: [],
        typicalDislikes: [],
        commonFears: [],
        genericGoals: [],
        backgroundElements: [],
        overusedSecrets: [],
        speechPatterns: [],
      },
      tropesAndStereotypes: ['The Chosen One'],
      metadata: {
        model: 'gpt-4',
        responseTime: 1500,
      },
    };

    beforeEach(() => {
      mockDatabase.getClicheByDirectionId.mockResolvedValue(null); // No existing clichés
      mockDatabase.saveCliche.mockResolvedValue();
      mockDatabase.addMetadata.mockResolvedValue();
      mockClicheGenerator.generateCliches.mockResolvedValue(mockGeneratedData);
    });

    it('should generate and store new clichés', async () => {
      const result = await service.generateClichesForDirection(
        mockConcept,
        mockDirection
      );

      expect(result).toBeInstanceOf(Cliche);
      expect(result.directionId).toBe('dir-1');
      expect(result.conceptId).toBe('concept-1');
      expect(mockClicheGenerator.generateCliches).toHaveBeenCalledWith(
        'A hero with a mysterious past',
        {
          title: 'The Chosen One',
          description: 'A destined hero',
          coreTension: 'Power vs responsibility',
        }
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_STARTED,
        payload: expect.objectContaining({
          conceptId: 'concept-1',
          directionId: 'dir-1',
          directionTitle: 'The Chosen One',
        }),
      });
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_COMPLETED,
        payload: expect.objectContaining({
          conceptId: 'concept-1',
          directionId: 'dir-1',
          clicheId: expect.any(String),
          totalCount: expect.any(Number),
          generationTime: 1500,
        }),
      });
    });

    it('should return existing clichés without regeneration', async () => {
      const existing = new Cliche({
        id: 'existing-cliche',
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {},
        tropesAndStereotypes: [],
      });
      mockDatabase.getClicheByDirectionId.mockResolvedValue(existing.toJSON());

      const result = await service.generateClichesForDirection(
        mockConcept,
        mockDirection
      );

      expect(result).toBeInstanceOf(Cliche);
      expect(mockClicheGenerator.generateCliches).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Clichés already exist for direction dir-1'
      );
    });

    it('should validate concept-direction relationship', async () => {
      const wrongDirection = {
        ...mockDirection,
        conceptId: 'concept-999', // Wrong concept
      };

      await expect(
        service.generateClichesForDirection(mockConcept, wrongDirection)
      ).rejects.toThrow('Direction does not belong to the provided concept');
    });

    it('should handle missing cliché generator', async () => {
      const serviceWithoutGenerator = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
        clicheGenerator: null,
      });

      await expect(
        serviceWithoutGenerator.generateClichesForDirection(
          mockConcept,
          mockDirection
        )
      ).rejects.toThrow('ClicheGenerator not available');
    });

    it('should handle generation errors', async () => {
      mockClicheGenerator.generateCliches.mockRejectedValue(
        new Error('LLM Error')
      );

      await expect(
        service.generateClichesForDirection(mockConcept, mockDirection)
      ).rejects.toThrow(CharacterBuilderError);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_FAILED,
        payload: expect.objectContaining({
          conceptId: 'concept-1',
          directionId: 'dir-1',
          error: 'LLM Error',
        }),
      });
    });

    it('should throw error for invalid inputs', async () => {
      await expect(
        service.generateClichesForDirection(null, mockDirection)
      ).rejects.toThrow();
      await expect(
        service.generateClichesForDirection(mockConcept, null)
      ).rejects.toThrow();
    });
  });

  describe('Cache Management', () => {
    const mockClicheData = {
      id: 'cliche-1',
      directionId: 'dir-1',
      conceptId: 'concept-1',
      categories: {},
      tropesAndStereotypes: [],
      createdAt: '2023-01-01T00:00:00.000Z',
    };

    it('should expire cache after TTL', async () => {
      jest.useFakeTimers();

      mockDatabase.getClicheByDirectionId.mockResolvedValue(mockClicheData);

      // First call
      await service.getClichesByDirectionId('dir-1');
      expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledTimes(1);

      // Advance time past TTL (5 minutes + buffer)
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Second call - cache expired
      await service.getClichesByDirectionId('dir-1');
      expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should limit cache size', async () => {
      // Test cache size limiting logic
      for (let i = 0; i < 60; i++) {
        mockDatabase.getClicheByDirectionId.mockResolvedValue({
          id: `cliche-${i}`,
          directionId: `dir-${i}`,
          conceptId: 'concept-1',
          categories: {},
          tropesAndStereotypes: [],
          createdAt: '2023-01-01T00:00:00.000Z',
        });

        await service.getClichesByDirectionId(`dir-${i}`);
      }

      // Cache should not exceed 50 entries
      // The first entries should be evicted
      const firstResult = await service.getClichesByDirectionId('dir-0');
      expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledWith('dir-0');

      // More recent entries should be cached
      const recentResult = await service.getClichesByDirectionId('dir-59');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache hit for clichés: dir-59'
      );
    });
  });

  describe('Batch Operations', () => {
    describe('getClichesForDirections', () => {
      it('should get multiple clichés efficiently', async () => {
        const mockData1 = {
          id: 'cliche-1',
          directionId: 'dir-1',
          conceptId: 'concept-1',
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
          createdAt: '2023-01-01T00:00:00.000Z',
        };
        const mockData2 = {
          id: 'cliche-2',
          directionId: 'dir-2',
          conceptId: 'concept-2',
          categories: {
            names: [],
            physicalDescriptions: [],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
          createdAt: '2023-01-01T00:00:00.000Z',
        };

        mockDatabase.getClicheByDirectionId
          .mockResolvedValueOnce(mockData1)
          .mockResolvedValueOnce(mockData2);

        const result = await service.getClichesForDirections([
          'dir-1',
          'dir-2',
        ]);

        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(2);
        expect(result.get('dir-1')).toBeInstanceOf(Cliche);
        expect(result.get('dir-2')).toBeInstanceOf(Cliche);
      });

      it('should use cache when available', async () => {
        // Populate cache for dir-1
        mockDatabase.getClicheByDirectionId.mockResolvedValue({
          id: 'cliche-1',
          directionId: 'dir-1',
          conceptId: 'concept-1',
          categories: {},
          tropesAndStereotypes: [],
        });
        await service.getClichesByDirectionId('dir-1');

        // Clear mock for batch operation
        mockDatabase.getClicheByDirectionId.mockClear();

        const result = await service.getClichesForDirections([
          'dir-1',
          'dir-2',
        ]);

        // Should only fetch dir-2 from database
        expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledTimes(1);
        expect(mockDatabase.getClicheByDirectionId).toHaveBeenCalledWith(
          'dir-2'
        );
      });
    });

    describe('deleteClichesForDirection', () => {
      it('should delete existing clichés', async () => {
        const mockCliche = {
          id: 'cliche-1',
          directionId: 'dir-1',
          conceptId: 'concept-1',
          categories: {},
          tropesAndStereotypes: [],
        };

        mockDatabase.getClicheByDirectionId.mockResolvedValue(mockCliche);
        mockDatabase.deleteCliche.mockResolvedValue(true);

        const result = await service.deleteClichesForDirection('dir-1');

        expect(result).toBe(true);
        expect(mockDatabase.deleteCliche).toHaveBeenCalledWith('cliche-1');
        expect(mockEventBus.dispatch).toHaveBeenCalledWith({
          type: CHARACTER_BUILDER_EVENTS.CLICHES_DELETED,
          payload: {
            directionId: 'dir-1',
            clicheId: 'cliche-1',
          },
        });
      });

      it('should return false for non-existent clichés', async () => {
        mockDatabase.getClicheByDirectionId.mockResolvedValue(null);

        const result = await service.deleteClichesForDirection('dir-1');

        expect(result).toBe(false);
        expect(mockDatabase.deleteCliche).not.toHaveBeenCalled();
      });
    });
  });
});
