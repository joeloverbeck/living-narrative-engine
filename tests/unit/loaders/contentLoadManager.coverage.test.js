import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';
import { ContentLoadStatus } from '../../../src/loaders/types.js';

/** @typedef {import('../../../src/loaders/LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

// Mock loader that can be configured to behave differently
class MockLoader {
  constructor(config = {}) {
    this.config = config;
    this.loadItemsForMod = jest.fn(async () => {
      if (this.config.shouldThrow) {
        throw new Error(this.config.errorMessage || 'Loader error');
      }
      return (
        this.config.result || {
          count: 0,
          overrides: 0,
          errors: 0,
          failures: [],
        }
      );
    });

    // Add finalize method if configured
    if (this.config.hasFinalize) {
      this.finalize = jest.fn(async () => {
        if (this.config.finalizeThrows) {
          throw new Error(this.config.finalizeError || 'Finalize error');
        }
      });
    }
  }
}

describe('ContentLoadManager - Coverage Tests', () => {
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

  // Test for line 51: Constructor validation
  it('should throw error when aggregatorFactory is not provided', () => {
    expect(() => {
      new ContentLoadManager({
        logger,
        validatedEventDispatcher: dispatcher,
        contentLoadersConfig: [],
        // aggregatorFactory is missing
      });
    }).toThrow('aggregatorFactory must be provided');
  });

  it('should throw error when aggregatorFactory is not a function', () => {
    expect(() => {
      new ContentLoadManager({
        logger,
        validatedEventDispatcher: dispatcher,
        contentLoadersConfig: [],
        aggregatorFactory: 'not a function', // Invalid type
      });
    }).toThrow('aggregatorFactory must be provided');
  });

  // Test for line 123: Skipped status in combined results
  it('should return SKIPPED status when mod has no content for any phase', async () => {
    const loader = new MockLoader({
      result: { count: 0, overrides: 0, errors: 0, failures: [] },
    });

    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: [
        {
          loader,
          contentKey: 'items',
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'definitions',
        },
        {
          loader,
          contentKey: 'items',
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'instances',
        },
      ],
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });

    const finalModOrder = ['modWithNoContent'];
    const manifests = new Map([
      ['modwithnocontent', { id: 'modWithNoContent', content: {} }], // Empty content
    ]);
    /** @type {TotalResultsSummary} */
    const totals = {};

    const { results, updatedTotals } = await manager.loadContent(
      finalModOrder,
      manifests,
      totals
    );

    // The mod should be marked as SKIPPED since it has no content for any phase
    expect(results).toEqual({
      modWithNoContent: ContentLoadStatus.SKIPPED,
    });
  });

  // Test for lines 186-191: Error handling in loadContentForPhase
  it('should handle errors during processMod and continue with other mods', async () => {
    // Create loaders
    const successLoader = new MockLoader({
      result: { count: 1, overrides: 0, errors: 0, failures: [] },
    });

    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: [
        {
          loader: successLoader,
          contentKey: 'items',
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'definitions',
        },
      ],
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });

    // Override processMod to throw for specific mod
    const originalProcessMod = manager.processMod;
    manager.processMod = jest.fn(
      async (modId, manifest, totalCounts, phaseLoaders, phase) => {
        if (modId === 'errorMod') {
          throw new Error('ProcessMod internal error');
        }
        return originalProcessMod.call(
          manager,
          modId,
          manifest,
          totalCounts,
          phaseLoaders,
          phase
        );
      }
    );

    const finalModOrder = ['errorMod', 'successMod'];
    const manifests = new Map([
      ['errormod', { id: 'errorMod', content: { items: ['a.json'] } }],
      ['successmod', { id: 'successMod', content: { items: ['b.json'] } }],
    ]);
    /** @type {TotalResultsSummary} */
    const totals = {};

    const { results } = await manager.loadContent(
      finalModOrder,
      manifests,
      totals
    );

    // Check that error was logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'ContentLoadManager: Error during processMod for errorMod'
      ),
      expect.objectContaining({
        modId: 'errorMod',
        phase: 'definitions',
        error: 'ProcessMod internal error',
      }),
      expect.any(Error)
    );

    // Verify that errorMod is marked as failed but successMod is processed successfully
    expect(results).toEqual({
      errorMod: ContentLoadStatus.FAILED,
      successMod: ContentLoadStatus.SUCCESS, // Success in definitions phase
    });
  });

  // Test for lines 250-256: Error handling in loader finalization
  it('should handle errors during loader finalization and continue with other loaders', async () => {
    const loaderWithFailingFinalize = new MockLoader({
      hasFinalize: true,
      finalizeThrows: true,
      finalizeError: 'Finalize failed',
    });

    const loaderWithSuccessfulFinalize = new MockLoader({
      hasFinalize: true,
      finalizeThrows: false,
    });

    const loaderWithoutFinalize = new MockLoader({
      hasFinalize: false,
    });

    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: [
        {
          loader: loaderWithFailingFinalize,
          contentKey: 'items',
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'definitions',
        },
        {
          loader: loaderWithSuccessfulFinalize,
          contentKey: 'components',
          diskFolder: 'components',
          registryKey: 'components',
          phase: 'definitions',
        },
        {
          loader: loaderWithoutFinalize,
          contentKey: 'events',
          diskFolder: 'events',
          registryKey: 'events',
          phase: 'definitions',
        },
      ],
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });

    const finalModOrder = ['testMod'];
    const manifests = new Map([['testmod', { id: 'testMod', content: {} }]]);
    /** @type {TotalResultsSummary} */
    const totals = {};

    // loadContent calls #finalizeLoaders internally
    await manager.loadContent(finalModOrder, manifests, totals);

    // Verify that error was logged for the failing finalize
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'ContentLoadManager: Error finalizing loader MockLoader'
      ),
      expect.any(Error)
    );

    // Verify that the successful finalize was called
    expect(loaderWithSuccessfulFinalize.finalize).toHaveBeenCalled();

    // Verify that finalization completed despite the error
    expect(logger.debug).toHaveBeenCalledWith(
      'ContentLoadManager: Loader finalization complete.'
    );
  });

  // Test for lines 108-109: Branch coverage for missing results
  it('should handle mods that appear in finalModOrder but have no loader results', async () => {
    const loader = new MockLoader({
      result: { count: 1, overrides: 0, errors: 0, failures: [] },
    });

    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: [
        {
          loader,
          contentKey: 'items',
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'definitions',
        },
      ],
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });

    // Override loadContentForPhase to simulate a mod that doesn't get results
    manager.loadContentForPhase = jest.fn(
      async (finalModOrder, manifests, totalCounts, phase) => {
        const results = {};
        // Only add results for modA, not modB - simulating modB being skipped entirely
        if (phase === 'definitions') {
          results.modA = ContentLoadStatus.SUCCESS;
          // modB is intentionally not added to results
        }
        return { results, updatedTotals: totalCounts };
      }
    );

    const finalModOrder = ['modA', 'modB']; // modB is in order but won't have results
    const manifests = new Map([
      ['moda', { id: 'modA', content: { items: ['a.json'] } }],
      ['modb', { id: 'modB', content: {} }],
    ]);
    /** @type {TotalResultsSummary} */
    const totals = {};

    const { results } = await manager.loadContent(
      finalModOrder,
      manifests,
      totals
    );

    // Verify that modB gets SKIPPED status when it has no results in any phase
    expect(results).toEqual({
      modA: ContentLoadStatus.SUCCESS,
      modB: ContentLoadStatus.SKIPPED,
    });
  });

  // Additional test to ensure proper handling of loaders with the same instance
  it('should only finalize each unique loader once', async () => {
    const sharedLoader = new MockLoader({
      hasFinalize: true,
      finalizeThrows: false,
    });

    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: [
        {
          loader: sharedLoader, // Same loader instance
          contentKey: 'items',
          diskFolder: 'items',
          registryKey: 'items',
          phase: 'definitions',
        },
        {
          loader: sharedLoader, // Same loader instance used again
          contentKey: 'components',
          diskFolder: 'components',
          registryKey: 'components',
          phase: 'instances',
        },
      ],
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });

    const finalModOrder = ['testMod'];
    const manifests = new Map([['testmod', { id: 'testMod', content: {} }]]);
    /** @type {TotalResultsSummary} */
    const totals = {};

    await manager.loadContent(finalModOrder, manifests, totals);

    // Verify that finalize was called only once despite loader being used twice
    expect(sharedLoader.finalize).toHaveBeenCalledTimes(1);
  });
});
