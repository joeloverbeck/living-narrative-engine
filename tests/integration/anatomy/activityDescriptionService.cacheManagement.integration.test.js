import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import ActivityIndexManager from '../../../src/anatomy/services/activityIndexManager.js';
import ActivityMetadataCollectionSystem from '../../../src/anatomy/services/activityMetadataCollectionSystem.js';
import ActivityGroupingSystem from '../../../src/anatomy/services/grouping/activityGroupingSystem.js';
import ActivityNLGSystem from '../../../src/anatomy/services/activityNLGSystem.js';
import ActivityContextBuildingSystem from '../../../src/anatomy/services/context/activityContextBuildingSystem.js';

class InstrumentedContextBuildingSystem extends ActivityContextBuildingSystem {
  constructor(deps) {
    super(deps);
    this.invalidations = [];
  }

  invalidateClosenessCache(actorId) {
    this.invalidations.push(actorId);
    super.invalidateClosenessCache(actorId);
  }
}

describe('ActivityDescriptionService cache management integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  const createService = ({ contextFactory } = {}) => {
    const jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    const cacheManager = new ActivityCacheManager({
      logger: testBed.mocks.logger,
      eventBus: null,
    });
    const indexManager = new ActivityIndexManager({
      cacheManager,
      logger: testBed.mocks.logger,
    });
    const metadataCollectionSystem = new ActivityMetadataCollectionSystem({
      entityManager: testBed.entityManager,
      logger: testBed.mocks.logger,
      activityIndex: null,
    });
    const groupingSystem = new ActivityGroupingSystem({
      indexManager,
      logger: testBed.mocks.logger,
    });
    const nlgSystem = new ActivityNLGSystem({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
      cacheManager,
    });

    const contextBuildingSystem = contextFactory
      ? contextFactory({
          entityManager: testBed.entityManager,
          logger: testBed.mocks.logger,
          nlgSystem,
        })
      : undefined;

    const service = new ActivityDescriptionService({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
      jsonLogicEvaluationService,
      cacheManager,
      indexManager,
      metadataCollectionSystem,
      groupingSystem,
      nlgSystem,
      ...(contextBuildingSystem ? { contextBuildingSystem } : {}),
    });

    return {
      service,
      cacheManager,
      indexManager,
      metadataCollectionSystem,
      groupingSystem,
      nlgSystem,
      contextBuildingSystem:
        contextBuildingSystem ?? service?.contextBuildingSystem,
    };
  };

  const registerClosenessComponent = () => {
    testBed.loadComponents({
      'personal-space-states:closeness': {
        id: 'personal-space-states:closeness',
        dataSchema: {
          type: 'object',
          properties: {
            partners: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    });
  };

  it('exposes cache manipulation hooks backed by ActivityCacheManager', () => {
    const { service } = createService();
    const testHooks = service.getTestHooks();

    testHooks.setEntityNameCacheEntry('jon', 'Jon Ureña');
    testHooks.setGenderCacheEntry('jon', 'male');
    testHooks.setActivityIndexCacheEntry('jon', {
      signature: 'sig-123',
      index: { all: [] },
    });
    testHooks.setClosenessCacheEntry('jon', ['ane']);

    const legacyEntry = { value: 'Legacy Name', expiresAt: Date.now() + 5000 };
    testHooks.setEntityNameCacheRawEntry('legacy', legacyEntry);

    const snapshot = testHooks.getCacheSnapshot();

    expect(snapshot.entityName.get('jon').value).toBe('Jon Ureña');
    expect(snapshot.gender.get('jon').value).toBe('male');
    expect(snapshot.activityIndex.get('jon').value).toEqual({
      signature: 'sig-123',
      index: { all: [] },
    });
    expect(snapshot.closeness.get('jon').value).toEqual(['ane']);
    expect(snapshot.entityName.get('legacy').value).toBe('Legacy Name');

    expect(testHooks.getCacheValue('entityName', 'jon')).toBe('Jon Ureña');

    service.destroy();

    expect(testHooks.getCacheValue('entityName', 'jon')).toBeNull();
  });

  it('invalidates caches for entity collections and clears context closeness state', async () => {
    registerClosenessComponent();

    const { service, contextBuildingSystem } = createService({
      contextFactory: (deps) => new InstrumentedContextBuildingSystem(deps),
    });
    const testHooks = service.getTestHooks();

    const jon = await testBed.entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    await testBed.entityManager.createEntityInstance('core:actor', {
      instanceId: 'ane',
    });
    testBed.entityManager.addComponent(jon.id, 'personal-space-states:closeness', {
      partners: ['ane'],
    });

    testHooks.setEntityNameCacheEntry('jon', 'Jon');
    testHooks.setGenderCacheEntry('jon', 'male');
    testHooks.setActivityIndexCacheEntry('jon', {
      signature: 'sig',
      index: { all: [] },
    });
    testHooks.setClosenessCacheEntry('jon', ['ane']);

    contextBuildingSystem.buildActivityContext('jon', {
      targetEntityId: 'ane',
      priority: 95,
    });

    testBed.mocks.logger.warn.mockClear();
    testBed.mocks.logger.debug.mockClear();

    service.invalidateEntities('invalid-input');
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalidateEntities called with non-array')
    );

    testBed.mocks.logger.warn.mockClear();
    testBed.mocks.logger.debug.mockClear();

    service.invalidateEntities(['jon', ' ', null]);

    expect(contextBuildingSystem.invalidations).toEqual(['jon']);

    const clearedSnapshot = testHooks.getCacheSnapshot();
    expect(clearedSnapshot.entityName.has('jon')).toBe(false);
    expect(clearedSnapshot.gender.has('jon')).toBe(false);
    expect(clearedSnapshot.activityIndex.has('jon')).toBe(false);
    expect(clearedSnapshot.closeness.has('jon')).toBe(false);

    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Invalidated caches for 3 entities')
    );

    service.destroy();
  });

  it('supports targeted cache invalidation paths with fallback warnings', async () => {
    registerClosenessComponent();

    const { service, contextBuildingSystem } = createService({
      contextFactory: (deps) => new InstrumentedContextBuildingSystem(deps),
    });
    const testHooks = service.getTestHooks();

    await testBed.entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    await testBed.entityManager.createEntityInstance('core:actor', {
      instanceId: 'ane',
    });

    testHooks.setEntityNameCacheEntry('jon', 'Jon');
    testHooks.setGenderCacheEntry('jon', 'male');
    testHooks.setActivityIndexCacheEntry('jon', {
      signature: 'sig',
      index: { all: [] },
    });
    testHooks.setClosenessCacheEntry('jon', ['ane']);

    contextBuildingSystem.buildActivityContext('jon', {
      targetEntityId: 'ane',
      priority: 80,
    });

    const expectCacheEmpty = (cacheName) => {
      const snapshot = testHooks.getCacheSnapshot();
      expect(snapshot[cacheName].has('jon')).toBe(false);
    };

    service.invalidateCache('jon', 'name');
    expectCacheEmpty('entityName');
    testHooks.setEntityNameCacheEntry('jon', 'Jon');

    service.invalidateCache('jon', 'gender');
    expectCacheEmpty('gender');
    testHooks.setGenderCacheEntry('jon', 'male');

    service.invalidateCache('jon', 'activity');
    expectCacheEmpty('activityIndex');
    testHooks.setActivityIndexCacheEntry('jon', {
      signature: 'sig',
      index: { all: [] },
    });

    service.invalidateCache('jon', 'closeness');
    expectCacheEmpty('closeness');
    expect(contextBuildingSystem.invalidations).toContain('jon');
    testHooks.setClosenessCacheEntry('jon', ['ane']);

    service.invalidateCache('jon');
    const finalSnapshot = testHooks.getCacheSnapshot();
    expect(finalSnapshot.entityName.has('jon')).toBe(false);
    expect(finalSnapshot.gender.has('jon')).toBe(false);
    expect(finalSnapshot.activityIndex.has('jon')).toBe(false);
    expect(finalSnapshot.closeness.has('jon')).toBe(false);
    expect(
      contextBuildingSystem.invalidations.filter((id) => id === 'jon').length
    ).toBeGreaterThanOrEqual(2);

    testBed.mocks.logger.warn.mockClear();
    service.invalidateCache('jon', 'unknown-type');
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown cache type')
    );

    service.destroy();
  });
});
