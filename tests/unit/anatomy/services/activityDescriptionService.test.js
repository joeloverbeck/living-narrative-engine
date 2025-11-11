import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ActivityDescriptionService from '../../../../src/anatomy/services/activityDescriptionService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

const createMockDependencies = () => {
  const caches = new Map();

  const registerCache = jest.fn((cacheName) => {
    if (!caches.has(cacheName)) {
      caches.set(cacheName, new Map());
    }
  });

  const get = jest.fn((cacheName, key) => {
    const cache = caches.get(cacheName);
    if (!cache) {
      return undefined;
    }
    return cache.get(key);
  });

  const set = jest.fn((cacheName, key, value) => {
    if (!caches.has(cacheName)) {
      caches.set(cacheName, new Map());
    }
    caches.get(cacheName).set(key, value);
  });

  const invalidate = jest.fn((cacheName, key) => {
    const cache = caches.get(cacheName);
    if (cache) {
      cache.delete(key);
    }
  });

  const invalidateAll = jest.fn((entityId) => {
    caches.forEach((cache) => {
      for (const key of Array.from(cache.keys())) {
        if (key.includes(entityId)) {
          cache.delete(key);
        }
      }
    });
  });

  const clearAll = jest.fn(() => {
    caches.forEach((cache) => cache.clear());
  });

  const destroy = jest.fn(() => {
    caches.clear();
  });

  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    entityManager: {
      getEntityInstance: jest.fn((id) => ({
        id,
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn(() => null),
      })),
      getAllEntities: jest.fn(() => []),
    },
    anatomyFormattingService: {
      getActivityIntegrationConfig: jest.fn(() => ({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '.',
        separator: '. ',
        maxActivities: 5,
        deduplicateActivities: true,
        enableContextAwareness: true,
        maxDescriptionLength: 200,
        nameResolution: {
          usePronounsWhenAvailable: true,
          preferReflexivePronouns: true,
        },
      })),
    },
    jsonLogicEvaluationService: {
      evaluate: jest.fn(() => true),
      apply: jest.fn(() => true),
    },
    cacheManager: {
      registerCache,
      get,
      set,
      invalidate,
      invalidateAll,
      clearAll,
      destroy,
      _getInternalCacheForTesting: jest.fn((cacheName) => caches.get(cacheName) ?? new Map()),
    },
    indexManager: {
      buildIndex: jest.fn(),
      buildActivityIndex: jest.fn((activities) => ({
        byTarget: new Map(),
        byPriority: [...activities].sort(
          (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
        ),
        byGroupKey: new Map(),
        all: activities,
      })),
      getActivityIndex: jest.fn((activities) => ({
        fromCache: false,
        payload: activities,
      })),
      buildActivityIndexCacheKey: jest.fn((namespace, entityId) => `${namespace}:${entityId}`),
    },
    metadataCollectionSystem: {
      collectActivityMetadata: jest.fn((entityId) => [
        {
          id: `activity-${entityId}`,
          verb: 'observes',
          priority: 75,
          sourceComponent: 'testing:observer',
          relatedActivities: [
            {
              conjunction: 'and',
              activity: {
                id: `activity-related-${entityId}`,
                verb: 'notes',
                sourceComponent: 'testing:observer',
              },
            },
          ],
        },
        {
          id: `activity-secondary-${entityId}`,
          verb: 'reflects',
          priority: 50,
          sourceComponent: 'testing:observer',
          relatedActivities: [],
        },
      ]),
      deduplicateActivitiesBySignature: jest.fn((activities) => activities),
    },
    groupingSystem: {
      groupActivities: jest.fn((activities) =>
        activities.map((activity) => ({
          primaryActivity: activity,
          relatedActivities: activity.relatedActivities ?? [],
        }))
      ),
      sortByPriority: jest.fn((activities) =>
        [...activities].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      ),
    },
    nlgSystem: {
      formatActivityDescription: jest.fn(),
      resolveEntityName: jest.fn((actorId) =>
        actorId ? `Entity ${actorId}` : 'Unknown Entity'
      ),
      detectEntityGender: jest.fn(() => 'neutral'),
      getPronounSet: jest.fn(() => ({
        subject: 'they',
        object: 'them',
        possessiveAdjective: 'their',
        reflexive: 'themselves',
      })),
      generateActivityPhrase: jest.fn((actorReference, activity) => ({
        fullPhrase: `${actorReference ?? 'Unknown'} ${activity?.verb ?? 'does something'}`.trim(),
        verbPhrase: activity?.verb ?? 'does something',
      })),
      buildRelatedActivityFragment: jest.fn(
        (conjunction, components) => `${conjunction ?? 'and'} ${components.verbPhrase ?? ''}`.trim()
      ),
      truncateDescription: jest.fn((description) => description),
      mergeAdverb: jest.fn((current, injected) => `${current ?? ''} ${injected}`.trim()),
      injectSoftener: jest.fn((template, descriptor) => `${template ?? ''} ${descriptor}`.trim()),
      getPronoun: jest.fn(() => 'they'),
    },
    filteringSystem: {
      filterByConditions: jest.fn((activities) => activities),
    },
    contextBuildingSystem: {
      buildActivityContext: jest.fn(() => ({
        targetId: null,
        intensity: 'casual',
        relationshipTone: 'neutral',
      })),
      applyContextualTone: jest.fn((activity) => ({
        ...activity,
        contextualTone: 'neutral',
      })),
      invalidateClosenessCache: jest.fn(),
    },
    activityIndex: null,
    eventBus: null,
  };
};

const instantiateService = (setupFn) => {
  const dependencies = createMockDependencies();
  if (typeof setupFn === 'function') {
    setupFn(dependencies);
  }
  const service = new ActivityDescriptionService(dependencies);
  return { service, dependencies };
};

describe('ActivityDescriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers caches and configures fallback systems when optional dependencies are not provided', () => {
    const dependencies = createMockDependencies();
    delete dependencies.filteringSystem;
    delete dependencies.contextBuildingSystem;

    const service = new ActivityDescriptionService(dependencies);
    const hooks = service.getTestHooks();

    expect(dependencies.cacheManager.registerCache).toHaveBeenCalledTimes(4);
    expect(() => hooks.filterByConditions([], { id: 'entity-1' })).not.toThrow();
    expect(typeof hooks.formatActivityDescription).toBe('function');
  });

  it('defaults optional cache and event dependencies when omitted entirely', () => {
    const dependencies = createMockDependencies();
    delete dependencies.activityIndex;
    delete dependencies.eventBus;

    const service = new ActivityDescriptionService(dependencies);
    const hooks = service.getTestHooks();

    expect(hooks.dispatchError('NO_BUS', { reason: 'missing bus' })).toBeUndefined();
    expect(dependencies.cacheManager.registerCache).toHaveBeenCalledTimes(4);
  });

  it('uses provided filtering and context building systems when supplied', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.filteringSystem.filterByConditions = jest.fn(() => [{ id: 'kept' }]);
      deps.contextBuildingSystem.buildActivityContext = jest.fn(() => ({
        targetId: null,
        intensity: 'casual',
        relationshipTone: 'neutral',
      }));
      deps.contextBuildingSystem.applyContextualTone = jest.fn((activity) => activity);
    });

    const hooks = service.getTestHooks();
    const filtered = hooks.filterByConditions([{ id: 'activity' }], { id: 'entity-1' });
    expect(filtered).toEqual([{ id: 'kept' }]);
    const description = hooks.formatActivityDescription([
      {
        verb: 'scouts',
        priority: 80,
        relatedActivities: [],
      },
    ], { id: 'entity-1' }, 'cache:entity-1');

    expect(typeof description).toBe('string');
    expect(dependencies.filteringSystem.filterByConditions).toHaveBeenCalledWith(
      [{ id: 'activity' }],
      { id: 'entity-1' }
    );
    expect(dependencies.contextBuildingSystem.buildActivityContext).toHaveBeenCalled();
  });

  it('throws when generateActivityDescription receives a blank entity id', async () => {
    const { service } = instantiateService();

    await expect(service.generateActivityDescription('   ')).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
  });

  it('handles entity lookup errors gracefully', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.entityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('lookup failure');
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(123);
    const result = await service.generateActivityDescription('entity-1');

    expect(result).toBe('');
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to retrieve entity instance'),
      expect.any(Error)
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'ENTITY_LOOKUP_FAILED',
        entityId: 'entity-1',
        timestamp: 123,
      }),
    });
    dateSpy.mockRestore();
  });

  it('falls back to a generic lookup error reason when the thrown error has no message', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.entityManager.getEntityInstance.mockImplementation(() => {
        throw { message: undefined };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(321);
    const result = await service.generateActivityDescription('entity-lookup-generic');

    expect(result).toBe('');
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'ENTITY_LOOKUP_FAILED',
        entityId: 'entity-lookup-generic',
        reason: 'Entity lookup threw an error',
        timestamp: 321,
      }),
    });
    dateSpy.mockRestore();
  });

  it('handles missing entity responses', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.entityManager.getEntityInstance.mockReturnValue(null);
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-2');

    expect(result).toBe('');
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'No entity found for activity description: entity-2'
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'ENTITY_NOT_FOUND',
        entityId: 'entity-2',
      }),
    });
  });

  it('logs a warning when componentTypeIds accessor throws', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      const entity = {
        id: 'entity-components',
        get componentTypeIds() {
          throw new Error('component access failure');
        },
        getComponentData: jest.fn(() => null),
      };
      deps.entityManager.getEntityInstance.mockReturnValue(entity);
    });

    const result = await service.generateActivityDescription('entity-components');

    expect(result).toBe('Activity: Entity entity-components observes and notes. they reflects.');
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to inspect componentTypeIds for entity entity-components'),
      expect.any(Error)
    );
  });

  it('handles non-array componentTypeIds without logging a warning', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      const entity = {
        id: 'entity-non-array',
        componentTypeIds: 'not-an-array',
        getComponentData: jest.fn(() => null),
      };
      deps.entityManager.getEntityInstance.mockReturnValue(entity);
    });

    const result = await service.generateActivityDescription('entity-non-array');

    expect(result).toBe('Activity: Entity entity-non-array observes and notes. they reflects.');
    expect(
      dependencies.logger.warn
    ).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to inspect componentTypeIds for entity entity-non-array'),
      expect.any(Error)
    );
  });

  it('returns an empty string when no activities are collected', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.metadataCollectionSystem.collectActivityMetadata.mockReturnValue([]);
    });

    const result = await service.generateActivityDescription('entity-3');

    expect(result).toBe('');
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No activities found for entity: entity-3')
    );
  });

  it('returns an empty string when filtering removes all activities', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.filteringSystem.filterByConditions = jest.fn(() => []);
    });

    const result = await service.generateActivityDescription('entity-4');

    expect(result).toBe('');
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No visible activities available after filtering')
    );
  });

  it('skips deduplication when the configuration disables it explicitly', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.anatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '.',
        separator: '. ',
        maxActivities: 5,
        deduplicateActivities: false,
        enableContextAwareness: true,
        maxDescriptionLength: 200,
        nameResolution: {
          usePronounsWhenAvailable: true,
          preferReflexivePronouns: true,
        },
      });
    });

    const description = await service.generateActivityDescription('entity-no-dedupe');

    expect(description.startsWith('Activity:')).toBe(true);
    expect(
      dependencies.metadataCollectionSystem.deduplicateActivitiesBySignature
    ).not.toHaveBeenCalled();
  });

  it('returns an empty string when deduplication removes every activity', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.metadataCollectionSystem.deduplicateActivitiesBySignature = jest
        .fn(() => []);
    });

    const result = await service.generateActivityDescription('entity-5');

    expect(result).toBe('');
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No activities remaining after deduplication')
    );
  });

  it('falls back to the requested entity id when the entity lacks an identifier', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      const entity = {
        id: undefined,
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn(() => null),
      };
      deps.entityManager.getEntityInstance.mockReturnValue(entity);
    });

    const result = await service.generateActivityDescription('entity-no-id');

    expect(result.startsWith('Activity:')).toBe(true);
    expect(dependencies.indexManager.buildActivityIndexCacheKey).toHaveBeenCalledWith(
      'priority',
      'entity-no-id'
    );
    expect(dependencies.indexManager.buildActivityIndexCacheKey).toHaveBeenCalledWith(
      'group',
      'entity-no-id'
    );
  });

  it('handles metadata collection errors via the top-level error handler', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.metadataCollectionSystem.collectActivityMetadata.mockImplementation(() => {
        throw new Error('collection failure');
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-collect');

    expect(result).toBe('');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to generate activity description for entity entity-collect',
      expect.any(Error)
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'ACTIVITY_DESCRIPTION_ERROR',
        entityId: 'entity-collect',
      }),
    });
  });

  it('falls back to an unknown error reason when top-level failures lack a message', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.metadataCollectionSystem.collectActivityMetadata.mockImplementation(() => {
        throw { message: undefined };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-collect-generic');

    expect(result).toBe('');
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        entityId: 'entity-collect-generic',
        reason: 'Unknown error',
      }),
    });
  });

  it('returns an empty string when grouping fails', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockImplementation(() => {
        throw new Error('group failure');
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-6');

    expect(result).toBe('');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to group activities for formatting',
      expect.any(Error)
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'GROUP_ACTIVITIES_FAILED',
        entityId: 'entity-6',
      }),
    });
  });

  it('uses a generic grouping error reason when the thrown error has no message', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockImplementation(() => {
        throw { message: undefined };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    await service.generateActivityDescription('entity-grouping-generic');

    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'GROUP_ACTIVITIES_FAILED',
        reason: 'Grouping error',
      }),
    });
  });

  it('dispatches grouping failures with an unknown entity id when the actor id is missing', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.entityManager.getEntityInstance.mockReturnValue({
        id: undefined,
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn(() => null),
      });
      deps.groupingSystem.groupActivities.mockImplementation(() => {
        throw new Error('group failure');
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    await service.generateActivityDescription('entity-missing-actor');

    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'GROUP_ACTIVITIES_FAILED',
        entityId: 'unknown',
        timestamp: expect.any(Number),
      }),
    });
  });

  it('returns an empty string when the primary phrase generation fails', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      let firstCall = true;
      deps.nlgSystem.generateActivityPhrase.mockImplementation(() => {
        if (firstCall) {
          firstCall = false;
          throw new Error('primary failure');
        }
        return { fullPhrase: 'fallback', verbPhrase: 'fallback' };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
      deps.metadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        {
          id: 'single-activity',
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ]);
    });

    const result = await service.generateActivityDescription('entity-7');

    expect(result).toBe('');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to generate primary activity phrase',
      expect.any(Error)
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'PRIMARY_ACTIVITY_FORMATTING_FAILED',
        entityId: 'entity-7',
      }),
    });
  });

  it('uses a default primary phrase error reason when the thrown error has no message', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.nlgSystem.generateActivityPhrase.mockImplementation(() => {
        throw { message: undefined };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
      deps.metadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        {
          id: 'single-activity',
          verb: 'observe',
          priority: 10,
          sourceComponent: 'testing:observer',
          relatedActivities: [],
        },
      ]);
    });

    await service.generateActivityDescription('entity-primary-generic');

    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'PRIMARY_ACTIVITY_FORMATTING_FAILED',
        reason: 'Primary phrase error',
      }),
    });
  });

  it('dispatches primary phrase failures with an unknown entity id when the actor id is missing', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.entityManager.getEntityInstance.mockReturnValue({
        id: undefined,
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn(() => null),
      });
      let firstCall = true;
      deps.nlgSystem.generateActivityPhrase.mockImplementation(() => {
        if (firstCall) {
          firstCall = false;
          throw new Error('primary failure');
        }
        return { fullPhrase: 'fallback', verbPhrase: 'fallback' };
      });
      deps.metadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        {
          id: 'single-activity',
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ]);
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-primary-unknown');

    expect(result).toBe('');
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'PRIMARY_ACTIVITY_FORMATTING_FAILED',
        entityId: 'unknown',
        timestamp: expect.any(Number),
      }),
    });
  });

  it('skips groups whose generated phrases omit full phrase content', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.metadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        {
          id: 'activity-without-full-phrase',
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ]);
      deps.nlgSystem.generateActivityPhrase.mockReturnValue({
        verbPhrase: 'observes',
      });
    });

    const description = await service.generateActivityDescription('entity-empty-primary');

    expect(description).toBe('');
    expect(dependencies.nlgSystem.generateActivityPhrase).toHaveBeenCalledTimes(1);
  });

  it('continues description generation when related phrase creation fails', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      let callCount = 0;
      deps.nlgSystem.generateActivityPhrase.mockImplementation((actorReference, activity) => {
        if (callCount === 1) {
          callCount += 1;
          throw new Error('related failure');
        }
        callCount += 1;
        return {
          fullPhrase: `${actorReference} ${activity.verb}`.trim(),
          verbPhrase: activity.verb,
        };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-8');

    expect(result).toMatch(/^Activity: Entity entity-8 /);
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to generate related activity phrase',
      expect.any(Error)
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FORMATTING_FAILED',
        entityId: 'entity-8',
      }),
    });
  });

  it('uses a default related phrase error reason when the thrown error has no message', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      let callCount = 0;
      deps.nlgSystem.generateActivityPhrase.mockImplementation((actorReference, activity) => {
        if (callCount === 1) {
          callCount += 1;
          throw { message: undefined };
        }
        callCount += 1;
        return {
          fullPhrase: `${actorReference} ${activity?.verb ?? ''}`.trim(),
          verbPhrase: activity?.verb ?? '',
        };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
      deps.metadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        {
          id: 'primary',
          verb: 'observe',
          priority: 10,
          relatedActivities: [
            {
              conjunction: 'and',
              activity: { id: 'related', verb: 'notes' },
            },
          ],
        },
      ]);
    });

    await service.generateActivityDescription('entity-related-generic');

    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FORMATTING_FAILED',
        reason: 'Related phrase error',
      }),
    });
  });

  it('dispatches related phrase failures with an unknown entity id when the actor id is missing', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.entityManager.getEntityInstance.mockReturnValue({
        id: undefined,
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn(() => null),
      });
      let callCount = 0;
      deps.nlgSystem.generateActivityPhrase.mockImplementation((actorReference, activity) => {
        if (callCount === 0) {
          callCount += 1;
          return {
            fullPhrase: `${actorReference ?? ''} ${activity?.verb ?? ''}`.trim(),
            verbPhrase: activity?.verb ?? '',
          };
        }
        callCount += 1;
        throw new Error('related failure');
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    await service.generateActivityDescription('entity-related-unknown');

    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FORMATTING_FAILED',
        entityId: 'unknown',
        timestamp: expect.any(Number),
      }),
    });
  });

  it('continues when related fragment construction fails', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.nlgSystem.buildRelatedActivityFragment.mockImplementation(() => {
        throw new Error('fragment failure');
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-9');

    expect(result).toBe('Activity: Entity entity-9 observes. they reflects.');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to build related activity fragment',
      expect.any(Error)
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FRAGMENT_FAILED',
        entityId: 'entity-9',
      }),
    });
  });

  it('dispatches related fragment failures with an unknown entity id when the actor id is missing', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.entityManager.getEntityInstance.mockReturnValue({
        id: undefined,
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn(() => null),
      });
      deps.nlgSystem.generateActivityPhrase.mockImplementation((actorReference, activity) => ({
        fullPhrase: `${actorReference ?? ''} ${activity?.verb ?? ''}`.trim(),
        verbPhrase: activity?.verb ?? '',
      }));
      deps.nlgSystem.buildRelatedActivityFragment.mockImplementation(() => {
        throw new Error('fragment failure');
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    });

    const result = await service.generateActivityDescription('entity-fragment-unknown');

    expect(result).toBe('Activity: Unknown Entity observes. they reflects.');
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FRAGMENT_FAILED',
        entityId: 'unknown',
        timestamp: expect.any(Number),
      }),
    });
  });

  it('uses a default fragment error reason when the thrown error has no message', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.nlgSystem.buildRelatedActivityFragment.mockImplementation(() => {
        throw { message: undefined };
      });
      deps.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
      deps.metadataCollectionSystem.collectActivityMetadata.mockReturnValue([
        {
          id: 'primary',
          verb: 'observe',
          priority: 10,
          relatedActivities: [
            {
              conjunction: 'and',
              activity: { id: 'related', verb: 'notes' },
            },
          ],
        },
      ]);
    });

    await service.generateActivityDescription('entity-fragment-generic');

    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FRAGMENT_FAILED',
        reason: 'Fragment error',
      }),
    });
  });

  it('produces a formatted activity description with pronouns for subsequent groups', async () => {
    const { service, dependencies } = instantiateService();

    const result = await service.generateActivityDescription('entity-10');

    expect(result).toBe('Activity: Entity entity-10 observes and notes. they reflects.');

    const pronounCall = dependencies.nlgSystem.generateActivityPhrase.mock.calls.find(
      ([, , usePronoun, options]) => usePronoun === true && options?.omitActor !== true
    );
    expect(pronounCall?.[0]).toBe('they');
    expect(dependencies.contextBuildingSystem.buildActivityContext).toHaveBeenCalled();
  });

  it('returns an empty string when formatted description is blank', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockReturnValue([
        { primaryActivity: { verb: '  ' }, relatedActivities: [] },
      ]);
      deps.nlgSystem.generateActivityPhrase.mockReturnValue({ fullPhrase: '   ', verbPhrase: '' });
    });

    const result = await service.generateActivityDescription('entity-11');

    expect(result).toBe('');
  });

  it('returns an empty string when formatting is disabled via configuration', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.anatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: false,
      });
    });

    const hooks = service.getTestHooks();
    const description = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-disabled' },
      'cache:entity-disabled'
    );

    expect(description).toBe('');
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      'Activity description formatting disabled via configuration'
    );
  });

  it('returns an empty string when formatting receives a non-array payload', () => {
    const { service } = instantiateService();
    const hooks = service.getTestHooks();

    const result = hooks.formatActivityDescription(null, { id: 'entity-invalid' }, 'cache:invalid');

    expect(result).toBe('');
  });

  it('falls back to the default cache key when none is supplied during formatting', () => {
    const { service } = instantiateService();
    const hooks = service.getTestHooks();

    const result = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-default-cache' }
    );

    expect(result.startsWith('Activity:')).toBe(true);
  });

  it('uses fallback formatting options when configuration values are undefined or disabled', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.anatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
        prefix: undefined,
        suffix: undefined,
        separator: undefined,
        maxActivities: null,
        deduplicateActivities: true,
        enableContextAwareness: false,
        maxDescriptionLength: undefined,
        nameResolution: {
          usePronounsWhenAvailable: false,
          preferReflexivePronouns: true,
        },
      });
    });

    const hooks = service.getTestHooks();
    const result = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
        {
          verb: 'reflects',
          priority: 5,
          relatedActivities: [],
        },
      ],
      { id: 'entity-fallback-formatting' }
    );

    expect(result.startsWith('Entity')).toBe(true);
    expect(dependencies.nlgSystem.truncateDescription).toHaveBeenCalledWith(
      expect.any(String),
      500
    );
    expect(dependencies.contextBuildingSystem.buildActivityContext).not.toHaveBeenCalled();
  });

  it('logs a warning when contextual tone application fails', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.contextBuildingSystem.applyContextualTone.mockImplementation(() => {
        throw new Error('context failure');
      });
    });

    const hooks = service.getTestHooks();
    const description = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-context' },
      'cache:entity-context'
    );

    expect(description.startsWith('Activity:')).toBe(true);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'Failed to apply contextual tone to activity',
      expect.any(Error)
    );
  });

  it('falls back to the original activity when contextual tone returns null', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.contextBuildingSystem.applyContextualTone.mockReturnValue(null);
    });

    const hooks = service.getTestHooks();
    const description = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-context-null' },
      'cache:entity-context-null'
    );

    expect(description.startsWith('Activity:')).toBe(true);
    expect(dependencies.contextBuildingSystem.applyContextualTone).toHaveBeenCalled();
  });

  it('supports iterable grouping results and warns on unexpected responses', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities
        .mockReturnValueOnce(new Set([
          {
            primaryActivity: { verb: 'observe', sourceComponent: 'testing:observer' },
            relatedActivities: [],
          },
        ]))
        .mockReturnValueOnce({ unexpected: true });
    });

    const hooks = service.getTestHooks();
    const firstDescription = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-set' },
      'cache:entity-set'
    );

    expect(firstDescription.startsWith('Activity:')).toBe(true);

    const secondDescription = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-warn' },
      'cache:entity-warn'
    );

    expect(secondDescription).toBe('');
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'Grouping activities returned unexpected data; ignoring result'
    );
  });

  it('accepts grouping results delivered as Set iterables', () => {
    const { service } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockReturnValue(
        new Set([
          {
            primaryActivity: { verb: 'observe', sourceComponent: 'testing:observer' },
            relatedActivities: [],
          },
        ])
      );
    });

    const description = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: [],
          },
        ],
        { id: 'entity-set-only' },
        'cache:entity-set-only'
      );

    expect(description.startsWith('Activity:')).toBe(true);
  });

  it('handles grouping results that resolve to null without logging warnings', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockReturnValue(null);
    });

    const result = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: [],
          },
        ],
        { id: 'entity-null-group' },
        'cache:entity-null-group'
      );

    expect(result).toBe('');
    expect(dependencies.logger.warn).not.toHaveBeenCalledWith(
      'Grouping activities returned unexpected data; ignoring result'
    );
  });

  it('accepts string primary phrases returned by the NLG system', () => {
    const { service } = instantiateService((deps) => {
      deps.nlgSystem.generateActivityPhrase.mockImplementation((actorReference, activity) => {
        if (activity?.verb === 'observe') {
          return `${actorReference ?? 'Unknown'} observes`;
        }
        return { fullPhrase: `${actorReference} ${activity?.verb ?? ''}`.trim(), verbPhrase: activity?.verb ?? '' };
      });
    });

    const description = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: [],
          },
        ],
        { id: 'entity-string-primary' },
        'cache:entity-string-primary'
      );

    expect(description).toBe('Activity: Entity entity-string-primary observes.');
  });

  it('uses fullPhrase output when the NLG system returns phrase components', () => {
    const { service } = instantiateService((deps) => {
      deps.nlgSystem.generateActivityPhrase.mockReturnValue({
        fullPhrase: 'Entity entity-object observes',
        verbPhrase: 'observes',
      });
    });

    const description = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: [],
          },
        ],
        { id: 'entity-object' },
        'cache:entity-object'
      );

    expect(description).toBe('Activity: Entity entity-object observes.');
  });

  it('skips groups when string phrases are blank after trimming', () => {
    const { service } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockReturnValue([
        { primaryActivity: { verb: 'observe', sourceComponent: 'testing:observer' }, relatedActivities: [] },
      ]);
      deps.nlgSystem.generateActivityPhrase.mockReturnValue('   ');
    });

    const result = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: [],
          },
        ],
        { id: 'entity-string-empty' },
        'cache:entity-string-empty'
      );

    expect(result).toBe('');
  });

  it('skips falsy groups and related activities during formatting', () => {
    const { service } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockReturnValue([
        null,
        {
          primaryActivity: { verb: 'observe', sourceComponent: 'testing:observer' },
          relatedActivities: [
            null,
            {
              conjunction: 'and',
              activity: { verb: 'smiles', sourceComponent: 'testing:observer' },
            },
          ],
        },
      ]);
      deps.anatomyFormattingService.getActivityIntegrationConfig = jest.fn(() => ({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '.',
        separator: '. ',
        maxActivities: 5,
        deduplicateActivities: true,
        enableContextAwareness: true,
        maxDescriptionLength: 200,
        nameResolution: {
          usePronounsWhenAvailable: false,
          preferReflexivePronouns: true,
        },
      }));
    });

    const description = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: [
              null,
              {
                conjunction: 'and',
                activity: { verb: 'smiles', sourceComponent: 'testing:observer' },
              },
            ],
          },
        ],
        { id: 'entity-skip' },
        'cache:entity-skip'
      );

    expect(description).toBe('Activity: Entity entity-skip observe and smiles.');
  });

  it('does not append related fragments when the builder returns an empty string', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.nlgSystem.buildRelatedActivityFragment.mockReturnValue('');
    });

    const result = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: [
              {
                conjunction: 'and',
                activity: { verb: 'smiles', sourceComponent: 'testing:observer' },
              },
            ],
          },
        ],
        { id: 'entity-empty-fragment' },
        'cache:entity-empty-fragment'
      );

    expect(result).toBe('Activity: Entity entity-empty-fragment observe.');
    expect(dependencies.nlgSystem.buildRelatedActivityFragment).toHaveBeenCalled();
  });

  it('treats non-array related activities as empty collections', () => {
    const { service } = instantiateService((deps) => {
      deps.groupingSystem.groupActivities.mockImplementation(() => [
        {
          primaryActivity: { verb: 'observe', sourceComponent: 'testing:observer' },
          relatedActivities: null,
        },
      ]);
    });

    const description = service
      .getTestHooks()
      .formatActivityDescription(
        [
          {
            verb: 'observe',
            priority: 10,
            relatedActivities: null,
          },
        ],
        { id: 'entity-no-related' },
        'cache:entity-no-related'
      );

    expect(description).toBe('Activity: Entity entity-no-related observe.');
  });

  it('uses default configuration when formatting service getter is missing', () => {
    const dependencies = createMockDependencies();
    dependencies.anatomyFormattingService = {};
    const service = new ActivityDescriptionService(dependencies);

    const hooks = service.getTestHooks();
    const description = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-12' },
      'cache:entity-12'
    );

    expect(description.startsWith('Activity:')).toBe(true);
  });

  it('falls back to defaults when configuration getter returns invalid data', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.anatomyFormattingService.getActivityIntegrationConfig.mockReturnValue('invalid');
    });

    const hooks = service.getTestHooks();
    const description = hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-13' },
      'cache:entity-13'
    );

    expect(description.startsWith('Activity:')).toBe(true);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'Activity integration config missing or invalid; using defaults'
    );
  });

  it('logs a warning when configuration retrieval throws', () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.anatomyFormattingService.getActivityIntegrationConfig.mockImplementation(() => {
        throw new Error('config failure');
      });
    });

    const hooks = service.getTestHooks();
    hooks.formatActivityDescription(
      [
        {
          verb: 'observe',
          priority: 10,
          relatedActivities: [],
        },
      ],
      { id: 'entity-14' },
      'cache:entity-14'
    );

    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'Failed to get activity integration config',
      expect.any(Error)
    );
  });

  it('invalidates gender cache before generating descriptions', async () => {
    const { service, dependencies } = instantiateService();

    await service.generateActivityDescription('entity-15');

    expect(dependencies.cacheManager.invalidate).toHaveBeenCalledWith(
      'gender',
      'entity-15'
    );
  });

  it('exposes cache manipulation hooks for testing', () => {
    const { service, dependencies } = instantiateService();
    const hooks = service.getTestHooks();

    hooks.dispatchError('ONLY_TYPE');
    hooks.dispatchError('NO_BUS', { context: 'absent' });
    hooks.setEntityNameCacheEntry('entity:16', 'Name');
    hooks.setGenderCacheEntry('entity:16', 'nonbinary');
    hooks.setActivityIndexCacheEntry('entity:16', { payload: [] });
    hooks.setClosenessCacheEntry('entity:16', ['partner']);
    hooks.setEntityNameCacheRawEntry('entity:raw', { value: 'Legacy' });
    hooks.cleanupCaches();

    const snapshot = hooks.getCacheSnapshot();

    expect(snapshot.entityName.get('entity:16')).toBe('Name');
    expect(snapshot.entityName.get('entity:raw')).toBe('Legacy');
    expect(snapshot.gender.get('entity:16')).toBe('nonbinary');
    expect(snapshot.activityIndex.get('entity:16')).toEqual({ payload: [] });
    expect(snapshot.closeness.get('entity:16')).toEqual(['partner']);
    expect(dependencies.cacheManager.set).toHaveBeenCalled();

    expect(hooks.getCacheValue('entityName', 'entity:16')).toBe('Name');

    const activities = [
      {
        verb: 'observe',
        priority: 10,
        relatedActivities: [],
      },
    ];
    hooks.buildActivityIndex(activities);
    hooks.getActivityIndex(activities);
    hooks.getActivityIndex(activities, 'hook-cache');
    const cacheKey = hooks.buildActivityIndexCacheKey('priority', 'entity:16');

    expect(cacheKey).toBe('priority:entity:16');
    expect(dependencies.indexManager.buildActivityIndex).toHaveBeenCalledWith(activities);
    expect(dependencies.indexManager.getActivityIndex).toHaveBeenCalledWith(
      activities,
      'hook-cache'
    );
    expect(dependencies.indexManager.buildActivityIndexCacheKey).toHaveBeenCalledWith(
      'priority',
      'entity:16'
    );

    hooks.subscribeToInvalidationEvents();

    const eventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    hooks.setEventBus(eventBus);
    hooks.dispatchError('HOOK_ERROR', { foo: 'bar' });
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'HOOK_ERROR',
        foo: 'bar',
      }),
    });
  });

  it('skips storing legacy cache entries when value is null', () => {
    const { service, dependencies } = instantiateService();
    const hooks = service.getTestHooks();

    hooks.setEntityNameCacheRawEntry('entity:null', null);

    const snapshot = hooks.getCacheSnapshot();
    expect(snapshot.entityName.has('entity:null')).toBe(false);
    expect(dependencies.cacheManager.set).not.toHaveBeenCalledWith(
      'entityName',
      'entity:null',
      null
    );
  });

  it('returns null for missing cache entries while the cache manager is active', () => {
    const { service } = instantiateService();
    const hooks = service.getTestHooks();

    expect(hooks.getCacheValue('entityName', 'missing-entity')).toBeNull();
  });

  it('gracefully no-ops cache hooks after destroy', () => {
    const { service, dependencies } = instantiateService();
    const hooks = service.getTestHooks();

    service.destroy();
    dependencies.cacheManager.set.mockClear();
    dependencies.cacheManager.invalidate.mockClear();

    hooks.setEntityNameCacheRawEntry('entity:post', 'value');
    hooks.setEntityNameCacheEntry('entity:post', 'value');

    expect(dependencies.cacheManager.set).not.toHaveBeenCalled();

    const snapshot = hooks.getCacheSnapshot();
    expect(snapshot.entityName).toBeInstanceOf(Map);
    expect(snapshot.entityName.size).toBe(0);
    expect(hooks.getCacheValue('entityName', 'entity:post')).toBeNull();

    service.invalidateCache('entity:post', 'name');
    expect(dependencies.cacheManager.invalidate).not.toHaveBeenCalled();
  });

  it('continues generating descriptions after destroy without touching caches', async () => {
    const { service, dependencies } = instantiateService();

    service.destroy();
    dependencies.cacheManager.invalidate.mockClear();

    const description = await service.generateActivityDescription('entity-after-destroy');

    expect(description.startsWith('Activity:')).toBe(true);
    expect(dependencies.cacheManager.invalidate).not.toHaveBeenCalledWith(
      'gender',
      'entity-after-destroy'
    );
  });

  it('logs a warning when event unsubscriber cleanup fails during destroy', () => {
    const { service, dependencies } = instantiateService();
    const hooks = service.getTestHooks();

    hooks.addEventUnsubscriber('not-a-function');
    const successfulUnsub = jest.fn();
    const failingUnsub = jest.fn(() => {
      throw new Error('unsubscribe failure');
    });

    hooks.addEventUnsubscriber(successfulUnsub);
    hooks.addEventUnsubscriber(failingUnsub);

    service.destroy();

    expect(successfulUnsub).toHaveBeenCalled();
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'ActivityDescriptionService: Failed to unsubscribe event handler',
      expect.any(Error)
    );
  });

  it('dispatches errors even when the event bus handler throws', async () => {
    const { service, dependencies } = instantiateService((deps) => {
      deps.eventBus = {
        dispatch: jest.fn(() => {
          throw new Error('dispatch failure');
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
      deps.groupingSystem.groupActivities.mockImplementation(() => {
        throw new Error('group failure');
      });
    });

    await service.generateActivityDescription('entity-17');

    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to dispatch activity description error event',
      expect.any(Error)
    );
  });

  it('warns when invalidateEntities receives a non-array value', () => {
    const { service, dependencies } = instantiateService();

    service.invalidateEntities('not-an-array');

    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'ActivityDescriptionService: invalidateEntities called with non-array'
    );
  });

  it('invalidates caches for each entity when invalidateEntities is called with an array', () => {
    const { service, dependencies } = instantiateService();

    service.invalidateEntities(['entity-18', 'entity-19']);

    expect(dependencies.cacheManager.invalidateAll).toHaveBeenCalledTimes(2);
    expect(dependencies.cacheManager.invalidateAll).toHaveBeenCalledWith('entity-18');
    expect(dependencies.cacheManager.invalidateAll).toHaveBeenCalledWith('entity-19');
    expect(dependencies.contextBuildingSystem.invalidateClosenessCache).toHaveBeenCalledTimes(2);
  });

  it('skips invalid or blank identifiers during batch cache invalidation', () => {
    const { service, dependencies } = instantiateService();

    service.invalidateEntities(['entity-21', '', '  ', null, undefined]);

    expect(dependencies.cacheManager.invalidateAll).toHaveBeenCalledTimes(1);
    expect(dependencies.cacheManager.invalidateAll).toHaveBeenCalledWith('entity-21');
  });

  it('skips cache manager calls when invalidating after destroy', () => {
    const { service, dependencies } = instantiateService();

    service.destroy();
    dependencies.cacheManager.invalidateAll.mockClear();
    dependencies.contextBuildingSystem.invalidateClosenessCache.mockClear();

    service.invalidateEntities(['entity-post-destroy']);

    expect(dependencies.cacheManager.invalidateAll).not.toHaveBeenCalled();
    expect(dependencies.contextBuildingSystem.invalidateClosenessCache).toHaveBeenCalledWith(
      'entity-post-destroy'
    );
  });

  it('invalidates caches based on cache type', () => {
    const { service, dependencies } = instantiateService();

    service.invalidateCache('entity-20');
    service.invalidateCache('entity-20', 'name');
    service.invalidateCache('entity-20', 'gender');
    service.invalidateCache('entity-20', 'activity');
    service.invalidateCache('entity-20', 'closeness');
    service.invalidateCache('entity-20', 'all');
    service.invalidateCache('entity-20', 'unknown');

    expect(dependencies.cacheManager.invalidate).toHaveBeenCalledWith(
      'entityName',
      'entity-20'
    );
    expect(dependencies.cacheManager.invalidate).toHaveBeenCalledWith('gender', 'entity-20');
    expect(dependencies.cacheManager.invalidate).toHaveBeenCalledWith(
      'activityIndex',
      'entity-20'
    );
    expect(dependencies.contextBuildingSystem.invalidateClosenessCache).toHaveBeenCalledWith(
      'entity-20'
    );
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      'ActivityDescriptionService: Unknown cache type: unknown'
    );
  });

  it('clears all caches through the cache manager', () => {
    const { service, dependencies } = instantiateService();

    service.clearAllCaches();

    expect(dependencies.cacheManager.clearAll).toHaveBeenCalledTimes(1);
    expect(dependencies.logger.info).toHaveBeenCalledWith(
      'ActivityDescriptionService: Cleared all caches'
    );
  });

  it('destroys service resources', () => {
    const { service, dependencies } = instantiateService();

    service.destroy();

    expect(dependencies.cacheManager.destroy).toHaveBeenCalledTimes(1);
    expect(dependencies.logger.info).toHaveBeenCalledWith(
      'ActivityDescriptionService: Service destroyed'
    );
  });

  it('allows destroy to be called multiple times without cache manager access', () => {
    const { service, dependencies } = instantiateService();

    service.destroy();
    dependencies.cacheManager.destroy.mockClear();

    service.destroy();

    expect(dependencies.cacheManager.destroy).not.toHaveBeenCalled();
  });
});
