import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';

const HERO_ID = 'entity:hero';

const buildLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
});

const buildEntityManager = ({
  equipment,
  wearable = {},
  blocksRemoval = {},
  hasBlocksRemoval = new Set(),
  coverageMappingErrorIds = new Set()
}) => {
  return {
    getComponentData: jest.fn((entityId, componentId) => {
      if (componentId === 'clothing:equipment') {
        if (entityId === HERO_ID) {
          return equipment;
        }
        return null;
      }

      if (componentId === 'clothing:wearable') {
        return wearable[entityId] || null;
      }

      if (componentId === 'clothing:blocks_removal') {
        return blocksRemoval[entityId] || null;
      }

      if (componentId === 'clothing:coverage_mapping') {
        if (coverageMappingErrorIds.has(entityId)) {
          throw new Error('no coverage data');
        }
        return null;
      }

      return null;
    }),
    hasComponent: jest.fn((entityId, componentId) => {
      if (componentId === 'clothing:blocks_removal') {
        return hasBlocksRemoval.has(entityId);
      }
      return false;
    })
  };
};

const defaultEquipment = {
  equipped: {
    torso_upper: {
      outer: 'item:coat',
      base: 'item:shirt'
    },
    waist: {
      accessories: 'item:belt'
    },
    legs: {
      base: 'item:pants'
    }
  }
};

const defaultWearables = {
  'item:coat': { equipmentSlots: { primary: 'torso_upper' }, layer: 'outer' },
  'item:shirt': { equipmentSlots: { primary: 'torso_upper' }, layer: 'base' },
  'item:belt': { equipmentSlots: { primary: 'waist' }, layer: 'accessories' },
  'item:pants': { equipmentSlots: { primary: 'legs' }, layer: 'base' }
};

describe('ClothingAccessibilityService cache and fallback integration', () => {
  let logger;

  beforeEach(() => {
    logger = buildLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('warns and disables coverage analyzer when initialization fails', () => {
    const entityManager = buildEntityManager({
      equipment: defaultEquipment,
      wearable: defaultWearables
    });

    const coverageAnalyzerFactory = () => {
      throw new Error('factory failure');
    };

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: { getComponentData: jest.fn() },
      coverageAnalyzerFactory,
      priorityConfig: { enableCaching: false }
    });

    const items = service.getAccessibleItems(HERO_ID, { mode: 'all', sortByPriority: false });

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to initialize coverage analyzer',
      expect.objectContaining({ error: 'factory failure' })
    );
    expect(items).toEqual(expect.arrayContaining(['item:coat', 'item:shirt', 'item:pants', 'item:belt']));
  });

  it('uses enhanced gateway fallback when entity lookup fails inside coverage analyzer', () => {
    const entityManager = buildEntityManager({
      equipment: defaultEquipment,
      wearable: defaultWearables
    });

    const failingGateway = {
      getComponentData: jest.fn(() => {
        throw new Error('boom');
      })
    };

    const coverageAnalyzerFactory = jest.fn(({ entitiesGateway }) => ({
      analyzeCoverageBlocking: jest.fn(() => {
        entitiesGateway.getComponentData('item:coat', 'clothing:coverage_mapping');
        return {
          isAccessible: jest.fn(() => true),
          getBlockingItems: jest.fn(() => [])
        };
      })
    }));

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: failingGateway,
      coverageAnalyzerFactory
    });

    const items = service.getAccessibleItems(HERO_ID, { mode: 'topmost' });

    expect(items).toEqual(expect.arrayContaining(['item:coat', 'item:belt', 'item:pants']));
    expect(items).toHaveLength(3);
    expect(coverageAnalyzerFactory).toHaveBeenCalled();
    const fallbackLog = logger.debug.mock.calls.find(
      ([message]) => message === 'Entity instance lookup failed, trying definition fallback'
    );
    expect(fallbackLog).toBeDefined();
    expect(fallbackLog?.[1]).toEqual(
      expect.objectContaining({
        entityId: 'item:coat',
        componentId: 'clothing:coverage_mapping',
        error: 'boom'
      })
    );
  });

  it('warns and returns items when coverage analysis fails during retrieval', () => {
    const entityManager = buildEntityManager({
      equipment: defaultEquipment,
      wearable: defaultWearables
    });

    const coverageAnalyzerFactory = () => ({
      analyzeCoverageBlocking: () => {
        throw new Error('analysis failed');
      }
    });

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: { getComponentData: jest.fn() },
      coverageAnalyzerFactory
    });

    const items = service.getAccessibleItems(HERO_ID, { mode: 'topmost' });

    expect(logger.warn).toHaveBeenCalledWith(
      'Coverage analysis failed, returning all items',
      expect.objectContaining({ entityId: HERO_ID, error: 'analysis failed' })
    );
    expect(items).toEqual(expect.arrayContaining(['item:coat', 'item:pants', 'item:belt']));
    expect(items).toHaveLength(3);
  });

  it('removes items blocked explicitly and logs diagnostic information', () => {
    const entityManager = buildEntityManager({
      equipment: defaultEquipment,
      wearable: defaultWearables,
      blocksRemoval: {
        'item:belt': {
          blocksRemovalOf: ['item:pants']
        }
      },
      hasBlocksRemoval: new Set(['item:belt'])
    });

    const coverageAnalyzerFactory = () => ({
      analyzeCoverageBlocking: () => ({
        isAccessible: () => true,
        getBlockingItems: () => []
      })
    });

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: { getComponentData: jest.fn() },
      coverageAnalyzerFactory
    });

    const items = service.getAccessibleItems(HERO_ID, { mode: 'all', sortByPriority: false });

    expect(items).toEqual(expect.arrayContaining(['item:coat', 'item:shirt', 'item:belt']));
    expect(items).not.toContain('item:pants');
    expect(logger.debug.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'Filtering explicitly blocked item from accessible items',
          expect.objectContaining({
            targetItemId: 'item:pants',
            blockedBy: 'item:belt',
            reason: 'explicit_id_blocking'
          })
        ]
      ])
    );

    const outerOnly = service.getAccessibleItems(HERO_ID, {
      mode: 'all',
      layer: 'outer',
      sortByPriority: false
    });
    expect(outerOnly).toEqual(['item:coat']);
  });

  it('falls back to layer priority when coverage mapping retrieval fails', () => {
    const entityManager = buildEntityManager({
      equipment: defaultEquipment,
      wearable: defaultWearables,
      coverageMappingErrorIds: new Set(['item:coat', 'item:shirt'])
    });

    const coverageAnalyzerFactory = () => ({
      analyzeCoverageBlocking: () => ({
        isAccessible: () => true,
        getBlockingItems: () => []
      })
    });

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: { getComponentData: jest.fn() },
      coverageAnalyzerFactory
    });

    const items = service.getAccessibleItems(HERO_ID, { mode: 'topmost', context: 'removal' });

    expect(logger.debug.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'Could not get coverage mapping',
          expect.objectContaining({ itemId: 'item:coat', error: 'no coverage data' })
        ]
      ])
    );
    expect(items[0]).toBe('item:coat');
  });

  it('manages caches and context modifiers across multiple queries', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z').getTime());

    const entityManager = buildEntityManager({
      equipment: defaultEquipment,
      wearable: defaultWearables
    });

    const coverageAnalyzerFactory = () => ({
      analyzeCoverageBlocking: () => ({
        isAccessible: () => true,
        getBlockingItems: () => []
      })
    });

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: { getComponentData: jest.fn() },
      coverageAnalyzerFactory,
      priorityConfig: { enableCaching: true, maxCacheSize: 1 },
      maxCacheSize: 1
    });

    const removalItems = service.getAccessibleItems(HERO_ID, { mode: 'all', context: 'removal' });
    expect(removalItems).toEqual(
      expect.arrayContaining(['item:coat', 'item:shirt', 'item:belt', 'item:pants'])
    );
    expect(removalItems).toHaveLength(4);

    jest.advanceTimersByTime(6000);

    const equippingItems = service.getAccessibleItems(HERO_ID, {
      mode: 'all',
      context: 'equipping'
    });
    expect(equippingItems).toEqual(
      expect.arrayContaining(['item:coat', 'item:shirt', 'item:belt', 'item:pants'])
    );
    expect(equippingItems).toHaveLength(4);

    const inspectionItems = service.getAccessibleItems(HERO_ID, {
      mode: 'all',
      context: 'inspection'
    });
    expect(inspectionItems).toEqual(
      expect.arrayContaining(['item:coat', 'item:shirt', 'item:belt', 'item:pants'])
    );
    expect(inspectionItems).toHaveLength(4);
  });

  it('warns when accessibility check fails and assumes accessibility', () => {
    const entityManager = buildEntityManager({
      equipment: defaultEquipment,
      wearable: defaultWearables
    });

    const coverageAnalyzerFactory = () => ({
      analyzeCoverageBlocking: () => {
        throw new Error('coverage crash');
      }
    });

    const service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: { getComponentData: jest.fn() },
      coverageAnalyzerFactory
    });

    const result = service.isItemAccessible(HERO_ID, 'item:coat');

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to check accessibility',
      expect.objectContaining({ entityId: HERO_ID, itemId: 'item:coat', error: 'coverage crash' })
    );
    expect(result).toEqual({
      accessible: true,
      reason: 'Coverage check failed, assuming accessible',
      blockingItems: []
    });
  });
});
