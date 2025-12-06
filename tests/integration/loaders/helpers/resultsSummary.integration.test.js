import { describe, it, expect, beforeEach } from '@jest/globals';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { summarizeSettledResults } from '../../../../src/loaders/helpers/resultsSummary.js';
import { processAndStoreItem } from '../../../../src/loaders/helpers/processAndStoreItem.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class RegistryBackedLoader {
  constructor(registry, logger) {
    this._registry = registry;
    this._logger = logger;
  }

  _storeItemInRegistry(category, modId, baseId, data, filename) {
    const registryKey = `${category}.${modId}`;
    const didOverride = this._registry.store(registryKey, baseId, {
      ...data,
      modId,
      filename,
    });

    this._logger.debug(
      `Registry write: ${registryKey}:${baseId} from ${filename} (override=${didOverride})`
    );

    return { qualifiedId: `${modId}:${baseId}`, didOverride };
  }
}

describe('summarizeSettledResults integration', () => {
  let logger;
  let registry;
  let loader;

  beforeEach(() => {
    logger = createMockLogger();
    registry = new InMemoryDataRegistry({ logger });
    loader = new RegistryBackedLoader(registry, logger);
  });

  it('aggregates mixed outcomes from real item processing', async () => {
    // Seed existing content to force an override when the new payload is written.
    loader._storeItemInRegistry(
      'actions',
      'testMod',
      'beta-action',
      { id: 'testMod:beta-action', payload: { damage: 1 } },
      'seed.json'
    );

    const operations = [
      processAndStoreItem(loader, {
        data: { id: 'testMod:alpha-action', payload: { damage: 5 } },
        idProp: 'id',
        category: 'actions',
        modId: 'testMod',
        filename: 'alpha.json',
      }),
      processAndStoreItem(loader, {
        data: { id: 'testMod:beta-action', payload: { damage: 9 } },
        idProp: 'id',
        category: 'actions',
        modId: 'testMod',
        filename: 'beta.json',
      }),
      processAndStoreItem(loader, {
        data: { payload: { damage: 99 } },
        idProp: 'id',
        category: 'actions',
        modId: 'testMod',
        filename: 'broken.json',
      }),
    ];

    const settledResults = await Promise.allSettled(operations);
    const filenames = ['alpha.json', 'beta.json', 'broken.json'];

    const summary = summarizeSettledResults(
      logger,
      settledResults,
      filenames,
      'testMod',
      'actions',
      operations.length
    );

    expect(summary.processedCount).toBe(2);
    expect(summary.overrideCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]).toMatchObject({
      file: 'broken.json',
      error: expect.any(Error),
    });

    // Ensure that successful writes persisted real data in the registry.
    expect(registry.get('actions.testMod', 'alpha-action')).toMatchObject({
      payload: { damage: 5 },
    });
    expect(registry.get('actions.testMod', 'beta-action')).toMatchObject({
      payload: { damage: 9 },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Processed 2/3 actions items.')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Failure recorded for broken.json')
    );
  });

  it('reports clean batches without overrides or failures', async () => {
    const operations = [
      processAndStoreItem(loader, {
        data: { id: 'testMod:gamma', payload: { stamina: 3 } },
        idProp: 'id',
        category: 'actions',
        modId: 'testMod',
        filename: 'gamma.json',
      }),
      processAndStoreItem(loader, {
        data: { id: 'testMod:delta', payload: { stamina: 7 } },
        idProp: 'id',
        category: 'actions',
        modId: 'testMod',
        filename: 'delta.json',
      }),
    ];

    const settledResults = await Promise.allSettled(operations);
    const summary = summarizeSettledResults(
      logger,
      settledResults,
      ['gamma.json', 'delta.json'],
      'testMod',
      'actions',
      operations.length
    );

    expect(summary).toEqual({
      processedCount: 2,
      overrideCount: 0,
      failedCount: 0,
      failures: [],
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Mod [testMod] - Processed 2/2 actions items.'
    );
  });
});
