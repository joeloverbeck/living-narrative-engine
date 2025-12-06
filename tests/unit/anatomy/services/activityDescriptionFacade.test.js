import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ActivityDescriptionFacade from '../../../../src/anatomy/services/activityDescriptionFacade.js';

describe('ActivityDescriptionFacade', () => {
  let facade;
  let mockLogger;
  let mockEntityManager;
  let mockAnatomyFormattingService;
  let mockCacheManager;
  let mockIndexManager;
  let mockMetadataCollectionSystem;
  let mockNLGSystem;
  let mockGroupingSystem;
  let mockContextBuildingSystem;
  let mockFilteringSystem;
  let mockEventBus;
  let cacheStorage;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn((id) => ({
        id,
        componentTypeIds: ['core:actor'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: `Entity_${id}` };
          }
          return undefined;
        }),
      })),
    };

    mockAnatomyFormattingService = {
      getActivityIntegrationConfig: jest.fn(() => ({
        enabled: true,
        maxActivities: 5,
        includeRelatedActivities: true,
      })),
    };

    // Create cache storage for testing
    cacheStorage = new Map();

    mockCacheManager = {
      registerCache: jest.fn(),
      get: jest.fn((cacheName, key) => {
        const cache = cacheStorage.get(cacheName);
        if (!cache) return null;
        const entry = cache.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          cache.delete(key);
          return null;
        }
        return entry.value;
      }),
      set: jest.fn((cacheName, key, value, ttl) => {
        if (!cacheStorage.has(cacheName)) {
          cacheStorage.set(cacheName, new Map());
        }
        const cache = cacheStorage.get(cacheName);
        const entry = {
          value,
          expiresAt: ttl ? Date.now() + ttl : null,
        };
        cache.set(key, entry);
      }),
      invalidate: jest.fn((cacheName, key) => {
        const cache = cacheStorage.get(cacheName);
        if (cache) {
          cache.delete(key);
        }
      }),
      clearAll: jest.fn(() => {
        cacheStorage.clear();
      }),
      destroy: jest.fn(),
      _getInternalCacheForTesting: jest.fn((cacheName) => {
        return cacheStorage.get(cacheName);
      }),
    };

    mockIndexManager = {
      buildIndex: jest.fn((activities) => ({
        byTarget: new Map(),
        byPriority: [...activities].sort(
          (a, b) => (b.priority || 0) - (a.priority || 0)
        ),
        byGroupKey: new Map(),
        all: activities,
      })),
    };

    mockMetadataCollectionSystem = {
      collectActivityMetadata: jest.fn(() => []),
    };

    mockNLGSystem = {
      formatActivityDescription: jest.fn(() => ''),
      getTestHooks: jest.fn(() => ({})),
    };

    mockGroupingSystem = {
      groupActivities: jest.fn((activities) =>
        activities.map((activity) => ({
          primaryActivity: activity,
          relatedActivities: [],
        }))
      ),
      sortByPriority: jest.fn((activities) =>
        [...activities].sort((a, b) => (b.priority || 0) - (a.priority || 0))
      ),
      getTestHooks: jest.fn(() => ({})),
    };

    mockContextBuildingSystem = {
      buildActivityContext: jest.fn((groups) => groups),
      getTestHooks: jest.fn(() => ({})),
    };

    mockFilteringSystem = {
      filterByConditions: jest.fn((activities) => activities),
      getTestHooks: jest.fn(() => ({})),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => jest.fn()),
      unsubscribe: jest.fn(),
    };

    facade = new ActivityDescriptionFacade({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockAnatomyFormattingService,
      cacheManager: mockCacheManager,
      indexManager: mockIndexManager,
      metadataCollectionSystem: mockMetadataCollectionSystem,
      nlgSystem: mockNLGSystem,
      groupingSystem: mockGroupingSystem,
      contextBuildingSystem: mockContextBuildingSystem,
      filteringSystem: mockFilteringSystem,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    if (facade) {
      facade.destroy();
    }
  });

  describe('Constructor', () => {
    it('should accept null logger and create fallback', () => {
      expect(
        () =>
          new ActivityDescriptionFacade({
            logger: null,
            entityManager: mockEntityManager,
            anatomyFormattingService: mockAnatomyFormattingService,
            cacheManager: mockCacheManager,
            indexManager: mockIndexManager,
            metadataCollectionSystem: mockMetadataCollectionSystem,
            nlgSystem: mockNLGSystem,
            groupingSystem: mockGroupingSystem,
            contextBuildingSystem: mockContextBuildingSystem,
            filteringSystem: mockFilteringSystem,
          })
      ).not.toThrow();
    });

    it('should validate entityManager dependency', () => {
      expect(
        () =>
          new ActivityDescriptionFacade({
            logger: mockLogger,
            entityManager: null,
            anatomyFormattingService: mockAnatomyFormattingService,
            cacheManager: mockCacheManager,
            indexManager: mockIndexManager,
            metadataCollectionSystem: mockMetadataCollectionSystem,
            nlgSystem: mockNLGSystem,
            groupingSystem: mockGroupingSystem,
            contextBuildingSystem: mockContextBuildingSystem,
            filteringSystem: mockFilteringSystem,
          })
      ).toThrow(/IEntityManager/);
    });

    it('should validate anatomyFormattingService dependency', () => {
      expect(
        () =>
          new ActivityDescriptionFacade({
            logger: mockLogger,
            entityManager: mockEntityManager,
            anatomyFormattingService: null,
            cacheManager: mockCacheManager,
            indexManager: mockIndexManager,
            metadataCollectionSystem: mockMetadataCollectionSystem,
            nlgSystem: mockNLGSystem,
            groupingSystem: mockGroupingSystem,
            contextBuildingSystem: mockContextBuildingSystem,
            filteringSystem: mockFilteringSystem,
          })
      ).toThrow(/AnatomyFormattingService/);
    });

    it('should validate cacheManager dependency', () => {
      expect(
        () =>
          new ActivityDescriptionFacade({
            logger: mockLogger,
            entityManager: mockEntityManager,
            anatomyFormattingService: mockAnatomyFormattingService,
            cacheManager: null,
            indexManager: mockIndexManager,
            metadataCollectionSystem: mockMetadataCollectionSystem,
            nlgSystem: mockNLGSystem,
            groupingSystem: mockGroupingSystem,
            contextBuildingSystem: mockContextBuildingSystem,
            filteringSystem: mockFilteringSystem,
          })
      ).toThrow(/IActivityCacheManager/);
    });

    it('should validate all service dependencies', () => {
      const requiredServices = [
        'indexManager',
        'metadataCollectionSystem',
        'nlgSystem',
        'groupingSystem',
        'contextBuildingSystem',
        'filteringSystem',
      ];

      requiredServices.forEach((serviceName) => {
        const config = {
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyFormattingService: mockAnatomyFormattingService,
          cacheManager: mockCacheManager,
          indexManager: mockIndexManager,
          metadataCollectionSystem: mockMetadataCollectionSystem,
          nlgSystem: mockNLGSystem,
          groupingSystem: mockGroupingSystem,
          contextBuildingSystem: mockContextBuildingSystem,
          filteringSystem: mockFilteringSystem,
        };

        config[serviceName] = null;

        expect(() => new ActivityDescriptionFacade(config)).toThrow();
      });
    });

    it('should register required caches', () => {
      expect(mockCacheManager.registerCache).toHaveBeenCalledWith(
        'entityName',
        expect.any(Object)
      );
      expect(mockCacheManager.registerCache).toHaveBeenCalledWith(
        'gender',
        expect.any(Object)
      );
      expect(mockCacheManager.registerCache).toHaveBeenCalledWith(
        'activityIndex',
        expect.any(Object)
      );
      expect(mockCacheManager.registerCache).toHaveBeenCalledWith(
        'closeness',
        expect.any(Object)
      );
    });

    it('should handle optional eventBus parameter', () => {
      const facadeWithoutEventBus = new ActivityDescriptionFacade({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        cacheManager: mockCacheManager,
        indexManager: mockIndexManager,
        metadataCollectionSystem: mockMetadataCollectionSystem,
        nlgSystem: mockNLGSystem,
        groupingSystem: mockGroupingSystem,
        contextBuildingSystem: mockContextBuildingSystem,
        filteringSystem: mockFilteringSystem,
        eventBus: null,
      });

      expect(facadeWithoutEventBus).toBeDefined();
      facadeWithoutEventBus.destroy();
    });
  });

  describe('generateActivityDescription', () => {
    it('should return empty string when no metadata collected', async () => {
      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue([]);

      const entity = { id: 'entity_1' };
      const result = await facade.generateActivityDescription(entity);

      expect(result).toBe('');
    });

    it('should return empty string when all activities filtered out', async () => {
      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        { id: '1', verb: 'walks' },
      ]);
      mockFilteringSystem.filterByConditions.mockReturnValue([]);

      const entity = { id: 'entity_1' };
      const result = await facade.generateActivityDescription(entity);

      expect(result).toBe('');
    });

    it('should return empty string when no activities after grouping', async () => {
      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        { id: '1', verb: 'walks' },
      ]);
      mockFilteringSystem.filterByConditions.mockReturnValue([
        { id: '1', verb: 'walks' },
      ]);
      mockGroupingSystem.groupActivities.mockReturnValue([]);

      const entity = { id: 'entity_1' };
      const result = await facade.generateActivityDescription(entity);

      expect(result).toBe('');
    });

    it('should orchestrate all services in correct order', async () => {
      const callOrder = [];

      mockMetadataCollectionSystem.collectActivityMetadata.mockImplementation(
        () => {
          callOrder.push('collectMetadata');
          return [{ id: '1', verb: 'walks' }];
        }
      );

      mockFilteringSystem.filterByConditions.mockImplementation(
        (activities) => {
          callOrder.push('filter');
          return activities;
        }
      );

      mockGroupingSystem.groupActivities.mockImplementation((activities) => {
        callOrder.push('group');
        return activities.map((a) => ({
          primaryActivity: a,
          relatedActivities: [],
        }));
      });

      mockContextBuildingSystem.buildActivityContext.mockImplementation(
        (groups) => {
          callOrder.push('buildContext');
          return groups;
        }
      );

      mockNLGSystem.formatActivityDescription.mockImplementation(() => {
        callOrder.push('format');
        return 'Description';
      });

      const entity = { id: 'entity_1' };
      const result = await facade.generateActivityDescription(entity);

      expect(callOrder).toEqual([
        'collectMetadata',
        'filter',
        'group',
        'buildContext',
        'format',
      ]);
      expect(result).toBe('Description');
    });

    it('should pass entity to metadata collection', async () => {
      const entity = { id: 'entity_1', componentTypeIds: ['core:actor'] };

      await facade.generateActivityDescription(entity);

      expect(
        mockMetadataCollectionSystem.collectActivityMetadata
      ).toHaveBeenCalledWith(entity);
    });

    it('should pass activities and entity to filtering', async () => {
      const activities = [{ id: '1', verb: 'walks' }];
      const entity = { id: 'entity_1' };

      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue(
        activities
      );

      await facade.generateActivityDescription(entity);

      expect(mockFilteringSystem.filterByConditions).toHaveBeenCalledWith(
        activities,
        entity
      );
    });

    it('should pass filtered activities to grouping', async () => {
      const filteredActivities = [{ id: '1', verb: 'walks' }];

      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue(
        filteredActivities
      );
      mockFilteringSystem.filterByConditions.mockReturnValue(
        filteredActivities
      );

      const entity = { id: 'entity_1' };
      await facade.generateActivityDescription(entity);

      expect(mockGroupingSystem.groupActivities).toHaveBeenCalledWith(
        filteredActivities
      );
    });

    it('should pass grouped activities and entity to context building', async () => {
      const groups = [
        { primaryActivity: { id: '1', verb: 'walks' }, relatedActivities: [] },
      ];
      const entity = { id: 'entity_1' };

      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        groups[0].primaryActivity,
      ]);
      mockGroupingSystem.groupActivities.mockReturnValue(groups);

      await facade.generateActivityDescription(entity);

      expect(
        mockContextBuildingSystem.buildActivityContext
      ).toHaveBeenCalledWith(groups, entity);
    });

    it('should pass activities with context, entity, and config to NLG', async () => {
      const activitiesWithContext = [
        {
          primaryActivity: { id: '1', verb: 'walks' },
          relatedActivities: [],
          tone: 'neutral',
        },
      ];
      const entity = { id: 'entity_1' };
      const config = { enabled: true, maxActivities: 5 };

      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        activitiesWithContext[0].primaryActivity,
      ]);
      mockGroupingSystem.groupActivities.mockReturnValue(activitiesWithContext);
      mockContextBuildingSystem.buildActivityContext.mockReturnValue(
        activitiesWithContext
      );
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
        config
      );

      await facade.generateActivityDescription(entity);

      expect(mockNLGSystem.formatActivityDescription).toHaveBeenCalledWith(
        activitiesWithContext,
        entity,
        config
      );
    });

    it('should handle errors gracefully and return empty string', async () => {
      mockMetadataCollectionSystem.collectActivityMetadata.mockImplementation(
        () => {
          throw new Error('Collection failed');
        }
      );

      const entity = { id: 'entity_1' };
      const result = await facade.generateActivityDescription(entity);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate activity description',
        expect.any(Error)
      );
      expect(result).toBe('');
    });

    it('should dispatch error event when eventBus is available', async () => {
      mockMetadataCollectionSystem.collectActivityMetadata.mockImplementation(
        () => {
          throw new Error('Collection failed');
        }
      );

      const entity = { id: 'entity_1' };
      await facade.generateActivityDescription(entity);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'SYSTEM_ERROR_OCCURRED',
        payload: expect.objectContaining({
          errorType: 'ACTIVITY_DESCRIPTION_GENERATION_FAILED',
          message: 'Collection failed',
        }),
      });
    });

    it('should not dispatch error event when event bus is unavailable', async () => {
      mockMetadataCollectionSystem.collectActivityMetadata.mockImplementationOnce(
        () => {
          throw new Error('Collection failed');
        }
      );

      const facadeWithoutEventBus = new ActivityDescriptionFacade({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        cacheManager: mockCacheManager,
        indexManager: mockIndexManager,
        metadataCollectionSystem: mockMetadataCollectionSystem,
        nlgSystem: mockNLGSystem,
        groupingSystem: mockGroupingSystem,
        contextBuildingSystem: mockContextBuildingSystem,
        filteringSystem: mockFilteringSystem,
        eventBus: undefined,
      });

      const entity = { id: 'entity_1' };
      await facadeWithoutEventBus.generateActivityDescription(entity);

      expect(mockEventBus.dispatch).not.toHaveBeenCalled();

      facadeWithoutEventBus.destroy();
    });

    it('should warn when error dispatch fails', async () => {
      const dispatchError = new Error('Dispatch failed');
      mockEventBus.dispatch.mockImplementation(() => {
        throw dispatchError;
      });
      mockMetadataCollectionSystem.collectActivityMetadata.mockImplementation(
        () => {
          throw new Error('Collection failed');
        }
      );

      const entity = { id: 'entity_1' };
      await facade.generateActivityDescription(entity);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to dispatch error event',
        dispatchError
      );
    });

    it('should use default config when getActivityIntegrationConfig fails', async () => {
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockImplementation(
        () => {
          throw new Error('Config error');
        }
      );

      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        { id: '1', verb: 'walks' },
      ]);
      mockGroupingSystem.groupActivities.mockReturnValue([
        { primaryActivity: { id: '1', verb: 'walks' }, relatedActivities: [] },
      ]);

      const entity = { id: 'entity_1' };
      await facade.generateActivityDescription(entity);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to retrieve activity integration config, using defaults',
        expect.any(Error)
      );
      expect(mockNLGSystem.formatActivityDescription).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          enabled: true,
          maxActivities: 5,
          includeRelatedActivities: true,
        })
      );
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      facade.clearAllCaches();

      expect(mockCacheManager.clearAll).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'All activity description caches cleared'
      );
    });

    it('should handle clearAll errors gracefully', () => {
      mockCacheManager.clearAll.mockImplementation(() => {
        throw new Error('Clear failed');
      });

      facade.clearAllCaches();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to clear caches',
        expect.any(Error)
      );
    });

    it('should invalidate cache for specific entity', () => {
      facade.invalidateCache('entity_1');

      expect(mockCacheManager.invalidate).toHaveBeenCalledWith(
        'entityName',
        'entity_1'
      );
      expect(mockCacheManager.invalidate).toHaveBeenCalledWith(
        'gender',
        'entity_1'
      );
      expect(mockCacheManager.invalidate).toHaveBeenCalledWith(
        'activityIndex',
        'entity_1'
      );
      expect(mockCacheManager.invalidate).toHaveBeenCalledWith(
        'closeness',
        'entity_1'
      );
    });

    it('should log debug message when invalidating entity cache', () => {
      facade.invalidateCache('entity_1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache invalidated for entity: entity_1'
      );
    });

    it('should handle missing entityId in invalidateCache', () => {
      facade.invalidateCache('');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot invalidate cache: entityId is required'
      );
      expect(mockCacheManager.invalidate).not.toHaveBeenCalled();
    });

    it('should handle invalidation errors', () => {
      mockCacheManager.invalidate.mockImplementation(() => {
        throw new Error('Invalidation failed');
      });

      facade.invalidateCache('entity_1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to invalidate cache for entity_1',
        expect.any(Error)
      );
    });

    it('should invalidate multiple entities', () => {
      facade.invalidateEntities(['entity_1', 'entity_2', 'entity_3']);

      expect(mockCacheManager.invalidate).toHaveBeenCalledTimes(12); // 4 caches × 3 entities
    });

    it('should handle empty array in invalidateEntities', () => {
      facade.invalidateEntities([]);

      expect(mockCacheManager.invalidate).not.toHaveBeenCalled();
    });

    it('should handle null in invalidateEntities', () => {
      facade.invalidateEntities(null);

      expect(mockCacheManager.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('Test Hooks', () => {
    it('should expose test hooks from all services', () => {
      const hooks = facade.getTestHooks();

      expect(hooks).toBeDefined();
      expect(typeof hooks).toBe('object');
    });

    it('should expose clearAllCaches hook', () => {
      const hooks = facade.getTestHooks();

      expect(hooks.clearAllCaches).toBeDefined();
      expect(typeof hooks.clearAllCaches).toBe('function');

      hooks.clearAllCaches();
      expect(mockCacheManager.clearAll).toHaveBeenCalled();
    });

    it('should expose invalidateCache hook', () => {
      const hooks = facade.getTestHooks();

      expect(hooks.invalidateCache).toBeDefined();
      expect(typeof hooks.invalidateCache).toBe('function');

      hooks.invalidateCache('entity_1');
      expect(mockCacheManager.invalidate).toHaveBeenCalled();
    });

    it('should expose invalidateEntities hook', () => {
      const hooks = facade.getTestHooks();

      expect(hooks.invalidateEntities).toBeDefined();
      expect(typeof hooks.invalidateEntities).toBe('function');

      mockCacheManager.invalidate.mockClear();
      hooks.invalidateEntities(['entity_1']);
      expect(mockCacheManager.invalidate).toHaveBeenCalledWith(
        'entityName',
        'entity_1'
      );
    });

    it('should expose getActivityIntegrationConfig hook', () => {
      const hooks = facade.getTestHooks();

      expect(hooks.getActivityIntegrationConfig).toBeDefined();
      expect(typeof hooks.getActivityIntegrationConfig).toBe('function');

      const config = hooks.getActivityIntegrationConfig();
      expect(config).toEqual({
        enabled: true,
        maxActivities: 5,
        includeRelatedActivities: true,
      });
    });

    it('should merge test hooks from all services', () => {
      mockNLGSystem.getTestHooks.mockReturnValue({ nlgHook: jest.fn() });
      mockGroupingSystem.getTestHooks.mockReturnValue({ groupHook: jest.fn() });
      mockContextBuildingSystem.getTestHooks.mockReturnValue({
        contextHook: jest.fn(),
      });
      mockFilteringSystem.getTestHooks.mockReturnValue({
        filterHook: jest.fn(),
      });
      mockMetadataCollectionSystem.getTestHooks = jest.fn(() => ({
        metadataHook: jest.fn(),
      }));

      const newFacade = new ActivityDescriptionFacade({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        cacheManager: mockCacheManager,
        indexManager: mockIndexManager,
        metadataCollectionSystem: mockMetadataCollectionSystem,
        nlgSystem: mockNLGSystem,
        groupingSystem: mockGroupingSystem,
        contextBuildingSystem: mockContextBuildingSystem,
        filteringSystem: mockFilteringSystem,
      });

      const hooks = newFacade.getTestHooks();

      expect(hooks.nlgHook).toBeDefined();
      expect(hooks.groupHook).toBeDefined();
      expect(hooks.contextHook).toBeDefined();
      expect(hooks.filterHook).toBeDefined();
      expect(hooks.metadataHook).toBeDefined();

      newFacade.destroy();
    });
  });

  describe('Destroy', () => {
    it('should destroy cache manager', () => {
      facade.destroy();

      expect(mockCacheManager.destroy).toHaveBeenCalled();
    });

    it('should log info message on destroy', () => {
      facade.destroy();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActivityDescriptionFacade destroyed'
      );
    });

    it('should handle destroy errors gracefully', () => {
      mockCacheManager.destroy.mockImplementation(() => {
        throw new Error('Destroy failed');
      });

      facade.destroy();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during facade destruction',
        expect.any(Error)
      );
    });

    it('should handle missing destroy method in cache manager', () => {
      const facadeWithNullCacheDestroy = new ActivityDescriptionFacade({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        cacheManager: { ...mockCacheManager, destroy: undefined },
        indexManager: mockIndexManager,
        metadataCollectionSystem: mockMetadataCollectionSystem,
        nlgSystem: mockNLGSystem,
        groupingSystem: mockGroupingSystem,
        contextBuildingSystem: mockContextBuildingSystem,
        filteringSystem: mockFilteringSystem,
      });

      expect(() => facadeWithNullCacheDestroy.destroy()).not.toThrow();
    });

    it('should warn when an event unsubscriber throws during destroy', () => {
      const hooks = facade.getTestHooks();
      const unsubscribeError = new Error('unsubscribe failure');

      hooks.registerEventUnsubscriber(() => {
        throw unsubscribeError;
      });

      facade.destroy();
      facade = null;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to unsubscribe from event',
        unsubscribeError
      );
    });

    it('should unsubscribe from events on destroy when eventBus is provided', () => {
      const unsubscribeFn = jest.fn();
      mockEventBus.subscribe.mockReturnValue(unsubscribeFn);

      const facadeWithEvents = new ActivityDescriptionFacade({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        cacheManager: mockCacheManager,
        indexManager: mockIndexManager,
        metadataCollectionSystem: mockMetadataCollectionSystem,
        nlgSystem: mockNLGSystem,
        groupingSystem: mockGroupingSystem,
        contextBuildingSystem: mockContextBuildingSystem,
        filteringSystem: mockFilteringSystem,
        eventBus: mockEventBus,
      });

      facadeWithEvents.destroy();

      // Event unsubscribers are cleared
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActivityDescriptionFacade destroyed'
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow with all services', async () => {
      const rawMetadata = [
        { id: '1', verb: 'walks', priority: 5 },
        { id: '2', verb: 'talks', priority: 3 },
      ];

      const filteredMetadata = [rawMetadata[0]]; // Filter keeps only highest priority

      const groupedActivities = [
        { primaryActivity: filteredMetadata[0], relatedActivities: [] },
      ];

      const activitiesWithContext = [
        { ...groupedActivities[0], tone: 'neutral', intensity: 'moderate' },
      ];

      const finalDescription = 'Entity_entity_1 walks confidently';

      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue(
        rawMetadata
      );
      mockFilteringSystem.filterByConditions.mockReturnValue(filteredMetadata);
      mockGroupingSystem.groupActivities.mockReturnValue(groupedActivities);
      mockContextBuildingSystem.buildActivityContext.mockReturnValue(
        activitiesWithContext
      );
      mockNLGSystem.formatActivityDescription.mockReturnValue(finalDescription);

      const entity = { id: 'entity_1' };
      const result = await facade.generateActivityDescription(entity);

      expect(result).toBe(finalDescription);
      expect(
        mockMetadataCollectionSystem.collectActivityMetadata
      ).toHaveBeenCalledWith(entity);
      expect(mockFilteringSystem.filterByConditions).toHaveBeenCalledWith(
        rawMetadata,
        entity
      );
      expect(mockGroupingSystem.groupActivities).toHaveBeenCalledWith(
        filteredMetadata
      );
      expect(
        mockContextBuildingSystem.buildActivityContext
      ).toHaveBeenCalledWith(groupedActivities, entity);
      expect(mockNLGSystem.formatActivityDescription).toHaveBeenCalled();
    });

    it('should handle service orchestration with empty results at each stage', async () => {
      // Test that facade handles empty arrays correctly at each stage
      mockMetadataCollectionSystem.collectActivityMetadata.mockReturnValue([]);

      const entity = { id: 'entity_1' };
      const result = await facade.generateActivityDescription(entity);

      expect(result).toBe('');
      expect(mockFilteringSystem.filterByConditions).not.toHaveBeenCalled(); // Short-circuit
    });
  });
});
