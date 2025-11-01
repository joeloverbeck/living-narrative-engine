/**
 * @file Memory tests for ActivityDescriptionService
 * @description Tests memory usage patterns and leak detection for activity description generation
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

describe('ActivityDescriptionService - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

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

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();

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
          activities.forEach((activity) => {
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
          activities.forEach((activity) => {
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
          activities.forEach((activity) => {
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
      groupActivities: jest
        .fn()
        .mockReturnValue({ groups: [], simultaneousActivities: [] }),
      sortByPriority: jest.fn((activities) => activities),
    };

    mockNlgSystem = {
      generateNaturalLanguage: jest.fn((groups) => []),
      formatActivityDescription: jest.fn((groups) => ''),
    };

    activityIndex = {
      findActivitiesForEntity: jest.fn((entityId) => {
        const entity = entities.get(entityId);
        return entity?.activities ?? [];
      }),
    };

    service = createService();
  });

  afterEach(async () => {
    service.destroy();
    entities.clear();
    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  const registerEntity = (entity) => {
    entities.set(entity.id, entity);
    return entity;
  };

  describe('Memory leak detection', () => {
    it('should not leak memory with repeated activity description generations', async () => {
      const jon = registerEntity(createEntity('jon', 'male'));
      addActivity(jon, '{actor} is waving', null, 75);

      const iterations = global.memoryTestUtils.isCI() ? 800 : 1000;

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Generate activity descriptions many times to detect memory leaks
      for (let i = 0; i < iterations; i++) {
        await service.generateActivityDescription(jon.id);
      }

      // Allow memory to stabilize with extended time
      await new Promise((resolve) => setTimeout(resolve, 200));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage(8);

      // Clear references and force cleanup
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(8);

      // Calculate memory metrics
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);
      const memoryPerOperation = memoryGrowth / iterations;

      // Memory efficiency assertions - adjusted based on observed behavior
      const maxMemoryGrowthMB = global.memoryTestUtils.isCI() ? 15 : 12; // Reasonable growth for 1000 operations
      const maxMemoryLeakageMB = global.memoryTestUtils.isCI() ? 3 : 2; // Memory that doesn't get cleaned up
      const maxMemoryPerOperationBytes = global.memoryTestUtils.isCI()
        ? 15000
        : 12000; // Per operation overhead including mock accumulation

      expect(memoryGrowth).toBeLessThan(maxMemoryGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxMemoryLeakageMB * 1024 * 1024);
      expect(memoryPerOperation).toBeLessThan(maxMemoryPerOperationBytes);

      console.log(
        `Activity description generation memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Leakage: ${(memoryLeakage / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Operation: ${memoryPerOperation.toFixed(2)} bytes, ` +
          `Iterations: ${iterations}`
      );
    });
  });
});
