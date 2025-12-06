/**
 * @file Integration tests for SpatialIndexManager covering sequential and batch interactions.
 * @jest-environment node
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import SpatialIndexManager from '../../../src/entities/spatialIndexManager.js';
import BatchSpatialIndexManager from '../../../src/entities/operations/BatchSpatialIndexManager.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  initializeGlobalConfig,
  resetGlobalConfig,
} from '../../../src/entities/utils/configUtils.js';

class CollectingLogger {
  constructor() {
    /** @type {Array<{ level: string, message: any, meta?: any }>} */
    this.records = [];
  }

  info(message, meta) {
    this.records.push({ level: 'info', message, meta });
  }

  warn(message, meta) {
    this.records.push({ level: 'warn', message, meta });
  }

  error(message, meta) {
    this.records.push({ level: 'error', message, meta });
  }

  debug(message, meta) {
    this.records.push({ level: 'debug', message, meta });
  }

  get warnings() {
    return this.records.filter((record) => record.level === 'warn');
  }

  get errors() {
    return this.records.filter((record) => record.level === 'error');
  }
}

/**
 * Creates a simple entity-like object exposing the position component.
 *
 * @param {string} id - Entity identifier.
 * @param {string | null | undefined} locationId - Location identifier for the entity.
 * @returns {{ id: string, getComponentData: (componentId: string) => { locationId: string | null | undefined } | undefined }}
 */
function createEntity(id, locationId) {
  return {
    id,
    getComponentData(componentId) {
      if (componentId === POSITION_COMPONENT_ID) {
        return { locationId };
      }
      return undefined;
    },
  };
}

describe('SpatialIndexManager integration', () => {
  /** @type {CollectingLogger} */
  let logger;

  beforeEach(() => {
    resetGlobalConfig();
    logger = new CollectingLogger();
    initializeGlobalConfig(logger, {});
  });

  afterEach(() => {
    resetGlobalConfig();
  });

  it('builds an index from real entity data and handles lifecycle operations', () => {
    const spatialIndexManager = new SpatialIndexManager({ logger });

    spatialIndexManager.buildIndex(null);
    expect(logger.errors[0].message).toContain(
      'Invalid entityManager provided'
    );

    const entityManager = {
      entities: new Set([
        createEntity('entity-1', 'location-a'),
        createEntity('entity-2', 'location-b'),
        createEntity('entity-3', null),
        { id: 'entity-4' },
        null,
      ]),
    };

    spatialIndexManager.buildIndex(entityManager);

    expect(spatialIndexManager.size).toBe(2);
    expect(spatialIndexManager.getEntitiesAtLocation('location-a')).toEqual([
      'entity-1',
    ]);
    expect(
      spatialIndexManager.getEntitiesAtLocation('missing-location')
    ).toEqual([]);

    const entitiesAtA = spatialIndexManager.getEntitiesInLocation('location-a');
    expect(entitiesAtA.has('entity-1')).toBe(true);
    entitiesAtA.add('mutated');
    expect(
      spatialIndexManager.getEntitiesInLocation('location-a').has('mutated')
    ).toBe(false);

    expect(spatialIndexManager.getEntitiesInLocation('   ').size).toBe(0);
    expect(spatialIndexManager.getEntitiesInLocation(null).size).toBe(0);

    spatialIndexManager.updateEntityLocation(
      'entity-1',
      'location-a',
      'location-c'
    );
    expect(spatialIndexManager.getEntitiesAtLocation('location-c')).toEqual([
      'entity-1',
    ]);

    spatialIndexManager.updateEntityLocation('entity-1', 'location-c', '');
    expect(spatialIndexManager.getEntitiesAtLocation('location-c')).toEqual([]);

    spatialIndexManager.addEntity('   ', 'location-d');
    spatialIndexManager.addEntity('entity-2', null);
    spatialIndexManager.removeEntity('entity-2', 'location-b');
    spatialIndexManager.removeEntity('entity-2', 'location-b');
    spatialIndexManager.removeEntity('entity-2', null);
    spatialIndexManager.updateEntityLocation('   ', 'location-b', 'location-e');

    spatialIndexManager.clearIndex();
    expect(spatialIndexManager.size).toBe(0);

    expect(logger.warnings.length).toBeGreaterThan(0);
  });

  it('executes sequential batch fallbacks when batch operations are disabled', async () => {
    const spatialIndexManager = new SpatialIndexManager({ logger });
    spatialIndexManager.addEntity('existing-1', 'fallback-origin');
    spatialIndexManager.addEntity('existing-2', 'fallback-origin');

    const addResult = await spatialIndexManager.batchAdd(
      [
        { entityId: 'fallback-1', locationId: 'fallback-a' },
        { entityId: 'fallback-2', locationId: 'fallback-b' },
        { entityId: 'fallback-3', locationId: '' },
      ],
      { stopOnError: true }
    );

    expect(addResult.totalProcessed).toBe(3);
    expect(addResult.successful).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: 'fallback-1', operation: 'add' }),
        expect.objectContaining({ entityId: 'fallback-2', operation: 'add' }),
        expect.objectContaining({ entityId: 'fallback-3', operation: 'add' }),
      ])
    );
    expect(spatialIndexManager.getEntitiesAtLocation('fallback-a')).toEqual([
      'fallback-1',
    ]);
    expect(spatialIndexManager.getEntitiesAtLocation('fallback-b')).toEqual([
      'fallback-2',
    ]);
    expect(spatialIndexManager.getEntitiesAtLocation('')).toEqual([]);

    const removeResult = await spatialIndexManager.batchRemove([
      'fallback-1',
      'missing-entity',
    ]);
    expect(removeResult.totalProcessed).toBe(2);
    expect(removeResult.successful).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: 'fallback-1', removed: true }),
        expect.objectContaining({ entityId: 'missing-entity', removed: false }),
      ])
    );

    const moveResult = await spatialIndexManager.batchMove([
      {
        entityId: 'existing-2',
        oldLocationId: 'fallback-origin',
        newLocationId: 'fallback-destination',
      },
      {
        entityId: 'existing-1',
        oldLocationId: 'fallback-origin',
        newLocationId: 'fallback-secondary',
      },
    ]);

    expect(moveResult.totalProcessed).toBe(2);
    expect(
      spatialIndexManager.getEntitiesAtLocation('fallback-destination')
    ).toEqual(['existing-2']);

    const rebuildResult = await spatialIndexManager.rebuild([
      { entityId: 'rebuilt-1', locationId: 'rebuilt-a' },
      { entityId: 'rebuilt-2', locationId: 'rebuilt-b' },
    ]);

    expect(rebuildResult.totalProcessed).toBe(2);
    expect(spatialIndexManager.getEntitiesAtLocation('rebuilt-a')).toEqual([
      'rebuilt-1',
    ]);
    expect(spatialIndexManager.size).toBe(2);
  });

  it('delegates to BatchSpatialIndexManager when enabled', async () => {
    const spatialIndexManager = new SpatialIndexManager({
      logger,
      enableBatchOperations: true,
    });

    const batchManager = new BatchSpatialIndexManager({
      spatialIndex: spatialIndexManager,
      logger,
      defaultBatchSize: 10,
    });

    spatialIndexManager.setBatchSpatialIndexManager(batchManager);

    const addSpy = jest.spyOn(batchManager, 'batchAdd');
    const addResult = await spatialIndexManager.batchAdd([
      { entityId: 'batch-1', locationId: 'batch-a' },
      { entityId: 'batch-2', locationId: 'batch-b' },
    ]);

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addResult.totalProcessed).toBe(2);
    expect(spatialIndexManager.getEntitiesAtLocation('batch-a')).toEqual([
      'batch-1',
    ]);

    const moveSpy = jest.spyOn(batchManager, 'batchMove');
    await spatialIndexManager.batchMove([
      {
        entityId: 'batch-1',
        oldLocationId: 'batch-a',
        newLocationId: 'batch-c',
      },
    ]);
    expect(moveSpy).toHaveBeenCalledTimes(1);
    expect(spatialIndexManager.getEntitiesAtLocation('batch-c')).toEqual([
      'batch-1',
    ]);

    const removeSpy = jest.spyOn(batchManager, 'batchRemove');
    const removeResult = await spatialIndexManager.batchRemove([
      'batch-2',
      'unknown',
    ]);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeResult.totalProcessed).toBe(2);
    expect(spatialIndexManager.getEntitiesAtLocation('batch-b')).toEqual([]);

    const rebuildSpy = jest.spyOn(batchManager, 'rebuild');
    const rebuildResult = await spatialIndexManager.rebuild([
      { entityId: 'rebuild-1', locationId: 'rebuild-a' },
      { entityId: 'rebuild-2', locationId: 'rebuild-b' },
    ]);

    expect(rebuildSpy).toHaveBeenCalledTimes(1);
    expect(rebuildResult.totalProcessed).toBe(2);
    expect(spatialIndexManager.getEntitiesAtLocation('rebuild-a')).toEqual([
      'rebuild-1',
    ]);

    spatialIndexManager.clear();
    expect(spatialIndexManager.size).toBe(0);
  });
});
