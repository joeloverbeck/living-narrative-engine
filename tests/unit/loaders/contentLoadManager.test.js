import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';

/** @typedef {import('../../../src/loaders/LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

class MockLoader {
  constructor(resultProvider, intendedModId, contentKey = 'items') {
    this.resultProvider = resultProvider;
    this.intendedModId = intendedModId;
    this.contentKey = contentKey;

    this.loadItemsForMod = jest.fn(
      async (
        currentModId,
        manifest,
        actualContentKey /*, diskFolder, registryKey */
      ) => {
        // Not for this mod, or manifest is missing/empty for this loader's specific contentKey
        if (
          currentModId !== this.intendedModId ||
          actualContentKey !== this.contentKey || // Check if the loader is being called for the content it handles
          !manifest ||
          !manifest.content ||
          !manifest.content[this.contentKey] ||
          manifest.content[this.contentKey].length === 0
        ) {
          return { count: 0, overrides: 0, errors: 0 };
        }

        // It's the intended mod and has content for this loader
        const result =
          typeof this.resultProvider === 'function'
            ? this.resultProvider()
            : this.resultProvider;
        if (result instanceof Error) {
          throw result;
        }
        return result;
      }
    );
  }
}

describe('ContentLoadManager.loadContent', () => {
  /** @type {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>} */
  let logger;
  /** @type {jest.Mocked<import('../../../src/events/validatedEventDispatcher.js').default>} */
  let dispatcher;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  });

  it('aggregates loader results across mods and dispatches on errors', async () => {
    const loaderA = new MockLoader(
      { count: 1, overrides: 0, errors: 0 },
      'modA',
      'items'
    ); // Will succeed for modA
    const loaderB = new MockLoader(
      new Error('Loader B failed'),
      'modB',
      'items'
    ); // Will throw for modB

    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: [
        // Both loaders are available for the 'definitions' phase
        {
          loader: loaderA,
          contentKey: 'items', // loaderA looks for 'items'
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'definitions',
        },
        {
          loader: loaderB,
          contentKey: 'items', // loaderB also looks for 'items'
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'definitions',
        },
      ],
    });

    const finalModOrder = ['modA', 'modB'];
    // Manifest keys are lowercase in the actual map in ModsLoader
    const manifests = new Map([
      ['moda', { id: 'modA', content: { items: ['a.json'] } }],
      ['modb', { id: 'modB', content: { items: ['b.json'] } }],
    ]);
    /** @type {TotalResultsSummary} */ const totals = {};

    const results = await manager.loadContent(finalModOrder, manifests, totals);

    expect(results).toEqual({ modA: 'success', modB: 'failed' });
    expect(totals.items.count).toBe(1); // Only loaderA succeeded
    expect(totals.items.errors).toBe(1); // Only loaderB failed

    // Check that dispatcher was called for loaderB's failure
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'initialization:world_loader:content_load_failed',
      expect.objectContaining({
        modId: 'modB',
        registryKey: 'items',
        error: 'Loader B failed',
        phase: 'definitions', // Ensure phase is checked
      }),
      expect.any(Object)
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);

    // Verify loaderA was called for modA, and loaderB for modB
    expect(loaderA.loadItemsForMod).toHaveBeenCalledWith(
      'modA',
      manifests.get('moda'),
      'items',
      'items',
      'items'
    );
    expect(loaderB.loadItemsForMod).toHaveBeenCalledWith(
      'modB',
      manifests.get('modb'),
      'items',
      'items',
      'items'
    );
    // Crucially, loaderA should have returned {count:0} for modB, and loaderB for modA
    expect(loaderA.loadItemsForMod).toHaveBeenCalledWith(
      'modB',
      manifests.get('modb'),
      'items',
      'items',
      'items'
    );
    expect(loaderB.loadItemsForMod).toHaveBeenCalledWith(
      'modA',
      manifests.get('moda'),
      'items',
      'items',
      'items'
    );
  });
});
