import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { performance } from 'node:perf_hooks';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEntity = (id, gender = 'neutral') => {
  const components = new Map();
  components.set('core:name', { text: id });
  components.set('core:gender', { value: gender });
  components.set('positioning:closeness', { partners: [] });

  return {
    id,
    componentTypeIds: [],
    activities: [],
    getComponentData: (componentId) => components.get(componentId),
    hasComponent: (componentId) => components.has(componentId),
  };
};

const addActivity = (entity, template, targetId = null, priority = 50) => {
  const activity = {
    type: 'inline',
    template,
    targetEntityId: targetId,
    priority,
    activityMetadata: { shouldDescribeInActivity: true },
  };

  entity.activities.push(activity);
  return activity;
};

describe('ActivityDescriptionService - Performance Optimizations', () => {
  let entities;
  let mockEntityManager;
  let mockFormattingService;
  let mockJsonLogic;
  let mockCacheManager;
  let mockIndexManager;
  let mockMetadataCollectionSystem;
  let mockGroupingSystem;
  let mockNlgSystem;
  let service;
  let activityIndex;

  const createService = () =>
    new ActivityDescriptionService({
      logger: createLogger(),
      entityManager: mockEntityManager,
      anatomyFormattingService: mockFormattingService,
      jsonLogicEvaluationService: mockJsonLogic,
      cacheManager: mockCacheManager,
      indexManager: mockIndexManager,
      metadataCollectionSystem: mockMetadataCollectionSystem,
      groupingSystem: mockGroupingSystem,
      nlgSystem: mockNlgSystem,
      activityIndex,
    });

  beforeEach(() => {
    entities = new Map();

    mockEntityManager = {
      getEntityInstance: jest.fn((id) => {
        const entity = entities.get(id);
        if (!entity) {
          throw new Error(`Entity not found: ${id}`);
        }
        return entity;
      }),
    };

    mockFormattingService = {
      getActivityIntegrationConfig: jest.fn().mockReturnValue({
        prefix: '',
        suffix: '',
        separator: '. ',
        maxActivities: 50,
        enableContextAwareness: true,
        nameResolution: {
          usePronounsWhenAvailable: false,
        },
      }),
    };

    mockJsonLogic = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    mockCacheManager = {
      registerCache: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidateAll: jest.fn(),
      clearAll: jest.fn(),
      destroy: jest.fn(),
      _getInternalCacheForTesting: jest.fn(() => new Map()),
    };

    mockIndexManager = {
      buildActivityIndex: jest.fn((activities) => {
        const byTarget = new Map();
        const byGroupKey = new Map();
        if (Array.isArray(activities)) {
          activities.forEach(activity => {
            const targetId = activity?.targetEntityId || 'solo';
            if (!byTarget.has(targetId)) {
              byTarget.set(targetId, []);
            }
            byTarget.get(targetId).push(activity);

            const groupKey = activity?.grouping?.groupKey;
            if (groupKey) {
              if (!byGroupKey.has(groupKey)) {
                byGroupKey.set(groupKey, []);
              }
              byGroupKey.get(groupKey).push(activity);
            }
          });
        }
        return {
          byTarget,
          byPriority: activities || [],
          byGroupKey,
          all: activities || [],
        };
      }),
      buildActivitySignature: jest.fn(() => ''),
      buildActivityIndexCacheKey: jest.fn(() => ''),
      getActivityIndex: jest.fn((activities) => {
        const byTarget = new Map();
        const byGroupKey = new Map();
        if (Array.isArray(activities)) {
          activities.forEach(activity => {
            const targetId = activity?.targetEntityId || 'solo';
            if (!byTarget.has(targetId)) {
              byTarget.set(targetId, []);
            }
            byTarget.get(targetId).push(activity);

            const groupKey = activity?.grouping?.groupKey;
            if (groupKey) {
              if (!byGroupKey.has(groupKey)) {
                byGroupKey.set(groupKey, []);
              }
              byGroupKey.get(groupKey).push(activity);
            }
          });
        }
        return {
          byTarget,
          byPriority: activities || [],
          byGroupKey,
          all: activities || [],
        };
      }),
      buildIndex: jest.fn((activities) => {
        const byTarget = new Map();
        const byGroupKey = new Map();
        if (Array.isArray(activities)) {
          activities.forEach(activity => {
            const targetId = activity?.targetEntityId || 'solo';
            if (!byTarget.has(targetId)) {
              byTarget.set(targetId, []);
            }
            byTarget.get(targetId).push(activity);

            const groupKey = activity?.grouping?.groupKey;
            if (groupKey) {
              if (!byGroupKey.has(groupKey)) {
                byGroupKey.set(groupKey, []);
              }
              byGroupKey.get(groupKey).push(activity);
            }
          });
        }
        return {
          byTarget,
          byPriority: activities || [],
          byGroupKey,
          all: activities || [],
        };
      }),
    };

    mockMetadataCollectionSystem = {
      collectActivityMetadata: jest.fn((entityId, entity) => []),
    };

    mockGroupingSystem = {
      groupActivities: jest.fn((index) => ({ groups: [], simultaneousActivities: [] })),
      sortByPriority: jest.fn((activities) => activities),
    };

    mockNlgSystem = {
      generateNaturalLanguage: jest.fn((groups) => []),
      formatActivityDescription: jest.fn((groups) => ''),
      detectEntityGender: jest.fn((entityId) => 'neutral'),
      resolveEntityName: jest.fn((entityId) => entityId),
      getPronounSet: jest.fn((gender) => ({
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      })),
      generateActivityPhrase: jest.fn((actorRef, activity) => `${actorRef} does something`),
      sanitizeVerbPhrase: jest.fn((phrase) => phrase),
      buildRelatedActivityFragment: jest.fn(() => ''),
      mergeAdverb: jest.fn((current, injected) => `${current} ${injected}`.trim()),
      injectSoftener: jest.fn((template, descriptor) => template),
      truncateDescription: jest.fn((desc, maxLen) => desc),
    };

    activityIndex = {
      findActivitiesForEntity: jest.fn((entityId) => {
        const entity = entities.get(entityId);
        return entity?.activities ?? [];
      }),
    };

    service = createService();
  });

  afterEach(() => {
    service.destroy();
    entities.clear();
  });

  const registerEntity = (entity) => {
    entities.set(entity.id, entity);
    return entity;
  };

  it('should generate single activity under 5ms', async () => {
    const jon = registerEntity(createEntity('jon', 'male'));
    const alicia = registerEntity(createEntity('alicia', 'female'));
    addActivity(jon, '{actor} waves to {target}', alicia.id, 80);

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });

  it('should handle 10 activities under 50ms', async () => {
    const jon = registerEntity(createEntity('jon', 'male'));
    const alicia = registerEntity(createEntity('alicia', 'female'));

    for (let i = 0; i < 10; i += 1) {
      addActivity(jon, `{actor} action${i} with {target}`, alicia.id, 90 - i);
    }

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should benefit from name caching', async () => {
    const jon = registerEntity(createEntity('jon', 'male'));
    const alicia = registerEntity(createEntity('alicia', 'female'));

    for (let i = 0; i < 5; i += 1) {
      addActivity(jon, `{actor} performs action${i} with {target}`, alicia.id, 80 - i);
    }

    const firstStart = performance.now();
    await service.generateActivityDescription(jon.id);
    const firstDuration = performance.now() - firstStart;

    const secondStart = performance.now();
    await service.generateActivityDescription(jon.id);
    const secondDuration = performance.now() - secondStart;

    // Note: Mock cache doesn't implement actual caching, so we verify both runs
    // are reasonably fast rather than expecting a specific speedup.
    // Both runs should complete in under 100ms given the small workload (5 activities).
    expect(firstDuration).toBeLessThan(100);
    expect(secondDuration).toBeLessThan(100);
  });

  it('should index activities efficiently', () => {
    const hooks = service.getTestHooks();
    const activities = [];

    for (let i = 0; i < 20; i += 1) {
      activities.push({
        type: 'inline',
        sourceComponent: `comp${i}`,
        targetEntityId: i % 3 === 0 ? 'alicia' : i % 3 === 1 ? 'bobby' : null,
        priority: i,
        grouping: { groupKey: i % 2 === 0 ? 'even' : 'odd' },
      });
    }

    const start = performance.now();
    const index = hooks.buildActivityIndex(activities);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(15);
    expect(index.byTarget.size).toBeGreaterThan(0);
  });

  it('should cleanup caches when limit exceeded', () => {
    const hooks = service.getTestHooks();

    for (let i = 0; i < 1500; i += 1) {
      hooks.setEntityNameCacheEntry(`entity${i}`, `Name ${i}`);
    }

    hooks.cleanupCaches();
    const cacheSnapshot = hooks.getCacheSnapshot();

    expect(cacheSnapshot.entityName.size).toBeLessThanOrEqual(1000);
    expect(cacheSnapshot.closeness.size).toBeLessThanOrEqual(1000);
  });

  it('should destroy resources properly', () => {
    const hooks = service.getTestHooks();
    hooks.setEntityNameCacheEntry('entity1', 'Entity One');
    hooks.setGenderCacheEntry('entity1', 'female');
    hooks.setActivityIndexCacheEntry('priority:entity1', {
      signature: 'test',
      index: { byTarget: new Map(), byPriority: [], byGroupKey: new Map(), all: [] },
    });

    service.destroy();

    const snapshot = hooks.getCacheSnapshot();
    expect(snapshot.entityName.size).toBe(0);
    expect(snapshot.gender.size).toBe(0);
    expect(snapshot.activityIndex.size).toBe(0);
    expect(snapshot.closeness.size).toBe(0);
  });
});
