/**
 * @file Integration tests for CharacterBuilderService cache integration
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
} from '../../../../src/characterBuilder/services/characterBuilderService.js';
import CoreMotivationsCacheManager from '../../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('CharacterBuilderService Cache Integration', () => {
  let service;
  let cacheManager;
  let mockLogger;
  let mockEventBus;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockDatabase;
  let mockSchemaValidator;
  let eventCaptured;

  beforeEach(() => {
    mockLogger = createMockLogger();

    eventCaptured = [];
    mockEventBus = {
      dispatch: jest.fn().mockImplementation((eventTypeOrObject, payload) => {
        // Handle both dispatch patterns used in the codebase
        if (typeof eventTypeOrObject === 'string' && payload) {
          // Two-argument pattern (used by CharacterBuilderService)
          eventCaptured.push({
            type: eventTypeOrObject,
            payload: payload
          });
        } else if (typeof eventTypeOrObject === 'object') {
          // Single-argument pattern (used by CoreMotivationsCacheManager)
          eventCaptured.push(eventTypeOrObject);
        } else {
          // Fallback for other patterns
          eventCaptured.push({ type: eventTypeOrObject });
        }
      }),
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

    mockDatabase = {
      getCoreMotivationsByDirectionId: jest.fn(),
      saveCoreMotivations: jest.fn(),
      deleteCoreMotivation: jest.fn(),
      getCoreMotivationsCount: jest.fn().mockResolvedValue(0),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
    };

    // Create cache manager
    cacheManager = new CoreMotivationsCacheManager({
      logger: mockLogger,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });

    // Create service with cache manager
    service = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
      cacheManager: cacheManager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    eventCaptured = [];
  });

  describe('cache integration initialization', () => {
    it('should initialize with cache manager properly', () => {
      expect(service).toBeDefined();

      // Should have dispatched cache initialization event
      const cacheInitEvent = eventCaptured.find(
        (e) => e.type === CHARACTER_BUILDER_EVENTS.CACHE_INITIALIZED
      );
      expect(cacheInitEvent).toBeDefined();
    });

    it('should work without cache manager (fallback mode)', () => {
      const serviceWithoutCache = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      expect(serviceWithoutCache).toBeDefined();
    });
  });

  describe('getCoreMotivationsByDirectionId with cache', () => {
    const directionId = 'test-direction-123';
    const conceptId = 'test-concept-456';
    const mockMotivations = [
      {
        id: 'mot-1',
        directionId,
        conceptId,
        coreDesire: 'Test desire 1',
        internalContradiction: 'Test contradiction 1',
        centralQuestion: 'Test question 1?',
        createdAt: Date.now(),
      },
      {
        id: 'mot-2',
        directionId,
        conceptId,
        coreDesire: 'Test desire 2',
        internalContradiction: 'Test contradiction 2',
        centralQuestion: 'Test question 2?',
        createdAt: Date.now(),
      },
    ];

    beforeEach(() => {
      mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockMotivations
      );
    });

    it('should fetch from database and cache the results on first call', async () => {
      const result = await service.getCoreMotivationsByDirectionId(directionId);

      // Should call database
      expect(mockDatabase.getCoreMotivationsByDirectionId).toHaveBeenCalledWith(
        directionId
      );
      expect(
        mockDatabase.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledTimes(1);

      // Should return Core Motivation models
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(CoreMotivation);
      expect(result[0].coreDesire).toBe('Test desire 1');

      // Should dispatch database retrieval event
      const dbEvent = eventCaptured.find(
        (e) =>
          e.type === CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED &&
          e.payload.source === 'database'
      );
      expect(dbEvent).toBeDefined();
      expect(dbEvent.payload.count).toBe(2);
    });

    it('should return cached results on subsequent calls', async () => {
      // First call - should hit database
      const firstResult =
        await service.getCoreMotivationsByDirectionId(directionId);

      // Clear event capture
      eventCaptured = [];

      // Second call - should hit cache
      const secondResult =
        await service.getCoreMotivationsByDirectionId(directionId);

      // Database should only have been called once
      expect(
        mockDatabase.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledTimes(1);

      // Results should be equivalent
      expect(secondResult).toEqual(firstResult);

      // Should dispatch cache hit event
      const cacheEvent = eventCaptured.find(
        (e) =>
          e.type === CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED &&
          e.payload.source === 'cache'
      );
      expect(cacheEvent).toBeDefined();
      expect(cacheEvent.payload.count).toBe(2);
    });

    it('should track cache hit statistics', async () => {
      // Generate cache hit
      await service.getCoreMotivationsByDirectionId(directionId);
      await service.getCoreMotivationsByDirectionId(directionId);

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1); // First miss, then hit
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('cache invalidation on modifications', () => {
    const directionId = 'test-direction-123';
    const conceptId = 'test-concept-456';
    const mockMotivations = [
      {
        id: 'mot-1',
        directionId,
        conceptId,
        coreDesire: 'Test desire',
        internalContradiction: 'Test contradiction',
        centralQuestion: 'Test question?',
        createdAt: Date.now(),
      },
    ];

    beforeEach(() => {
      mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockMotivations
      );
      mockDatabase.saveCoreMotivations.mockResolvedValue(['mot-1']);
      mockDatabase.deleteCoreMotivation.mockResolvedValue(true);
    });

    it('should invalidate cache when saving motivations', async () => {
      // Populate cache
      await service.getCoreMotivationsByDirectionId(directionId);
      expect(
        mockDatabase.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledTimes(1);

      // Save new motivations (should invalidate cache)
      await service.saveCoreMotivations(directionId, mockMotivations);

      // Clear event capture
      eventCaptured = [];

      // Next call should hit database again (cache was invalidated)
      await service.getCoreMotivationsByDirectionId(directionId);
      expect(
        mockDatabase.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledTimes(2);

      // Should dispatch database retrieval event (not cache)
      const dbEvent = eventCaptured.find(
        (e) =>
          e.type === CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED &&
          e.payload.source === 'database'
      );
      expect(dbEvent).toBeDefined();
    });

    it('should invalidate cache when removing motivations', async () => {
      // Populate cache
      await service.getCoreMotivationsByDirectionId(directionId);
      expect(
        mockDatabase.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledTimes(1);

      // Remove motivation (should invalidate cache)
      await service.removeCoreMotivationItem(directionId, 'mot-1');

      // Clear event capture
      eventCaptured = [];

      // Next call should hit database again (cache was invalidated)
      await service.getCoreMotivationsByDirectionId(directionId);
      expect(
        mockDatabase.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('fallback behavior without cache manager', () => {
    let serviceWithoutCache;

    beforeEach(() => {
      serviceWithoutCache = new CharacterBuilderService({
        logger: mockLogger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
        // No cacheManager provided
      });

      mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue([
        {
          id: 'mot-1',
          directionId: 'test-direction',
          conceptId: 'test-concept-fallback',
          coreDesire: 'Test desire',
          internalContradiction: 'Test contradiction',
          centralQuestion: 'Test question?',
          createdAt: Date.now(),
        },
      ]);
    });

    it('should work with fallback caching system', async () => {
      const result =
        await serviceWithoutCache.getCoreMotivationsByDirectionId(
          'test-direction'
        );

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CoreMotivation);
      expect(
        mockDatabase.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache statistics and monitoring', () => {
    it('should provide meaningful cache statistics', async () => {
      const direction1 = 'dir-1';
      const direction2 = 'dir-2';

      // Set up default mock to return appropriate data based on direction ID
      mockDatabase.getCoreMotivationsByDirectionId.mockImplementation(
        (directionId) => {
          if (directionId === direction1) {
            return Promise.resolve([
              {
                id: 'mot-1',
                directionId: direction1,
                conceptId: 'concept-1',
                coreDesire: 'Desire 1',
                internalContradiction: 'Contradiction 1',
                centralQuestion: 'Question 1?',
                createdAt: Date.now(),
              },
            ]);
          } else if (directionId === direction2) {
            return Promise.resolve([
              {
                id: 'mot-2',
                directionId: direction2,
                conceptId: 'concept-2',
                coreDesire: 'Desire 2',
                internalContradiction: 'Contradiction 2',
                centralQuestion: 'Question 2?',
                createdAt: Date.now(),
              },
            ]);
          } else {
            return Promise.resolve([]); // Return empty array for non-existent directions
          }
        }
      );

      // Generate some cache activity
      await service.getCoreMotivationsByDirectionId(direction1); // miss + set
      await service.getCoreMotivationsByDirectionId(direction1); // hit
      await service.getCoreMotivationsByDirectionId(direction2); // miss + set
      await service.getCoreMotivationsByDirectionId('non-existent'); // miss (no data)

      const stats = cacheManager.getStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.sets).toBeGreaterThan(0);
      expect(stats.hitRate).toBeDefined();
      expect(stats.byType.motivations).toBeDefined();
    });

    it('should dispatch cache events properly', async () => {
      // Set up mock to return test data
      mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue([
        {
          id: 'mot-1',
          directionId: 'test-direction',
          conceptId: 'test-concept',
          coreDesire: 'Test desire',
          internalContradiction: 'Test contradiction',
          centralQuestion: 'Test question?',
          createdAt: Date.now(),
        },
      ]);

      await service.getCoreMotivationsByDirectionId('test-direction');
      await service.getCoreMotivationsByDirectionId('test-direction');

      // Should have cache miss and hit events
      const cacheEvents = eventCaptured.filter(
        (e) =>
          e.type === CHARACTER_BUILDER_EVENTS.CACHE_HIT ||
          e.type === CHARACTER_BUILDER_EVENTS.CACHE_MISS
      );

      expect(cacheEvents.length).toBeGreaterThan(0);
    });
  });

  describe('error handling with cache', () => {
    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockDatabase.getCoreMotivationsByDirectionId.mockRejectedValue(error);

      await expect(
        service.getCoreMotivationsByDirectionId('test-direction')
      ).rejects.toThrow('Failed to retrieve core motivations');

      // Cache should remain clean
      const stats = cacheManager.getStats();
      expect(stats.size).toBe(0);
    });

    it('should handle cache manager errors gracefully', async () => {
      // Mock cache manager to throw errors
      jest.spyOn(cacheManager, 'get').mockImplementation(() => {
        throw new Error('Cache error');
      });

      mockDatabase.getCoreMotivationsByDirectionId.mockResolvedValue([
        {
          id: 'mot-1',
          directionId: 'test',
          conceptId: 'test-concept',
          coreDesire: 'desire',
          internalContradiction: 'contradiction',
          centralQuestion: 'question?',
          createdAt: Date.now(),
        },
      ]);

      // Should still work by falling back to database
      const result =
        await service.getCoreMotivationsByDirectionId('test-direction');
      expect(result).toHaveLength(1);
    });
  });
});
