import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';
import { ContentLoadStatus } from '../../../src/loaders/types.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

/** @typedef {import('../../../src/loaders/LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

class MockLoader {
  constructor(result) {
    this.result = result;
    this.loadItemsForMod = jest.fn(async () => {
      if (this.result instanceof Error) throw this.result;
      return this.result;
    });
  }
}

describe('ContentLoadManager.processMod', () => {
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

  it('returns "skipped" when manifest is missing and dispatches mod_load_failed', async () => {
    const loader = new MockLoader({
      count: 1,
      overrides: 0,
      errors: 0,
      failures: [],
    });
    const phaseLoadersConfig = [
      {
        loader,
        contentKey: 'items',
        diskFolder: 'items',
        registryKey: 'items',
      },
    ];
    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: phaseLoadersConfig,
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    const result = await manager.processMod(
      'testMod',
      null,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(result.status).toBe(ContentLoadStatus.SKIPPED);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'initialization:world_loader:mod_load_failed',
      expect.objectContaining({ modId: 'testMod' }),
      expect.any(Object)
    );
    expect(loader.loadItemsForMod).not.toHaveBeenCalled();
  });

  it('returns "failed" when a loader throws and records failure', async () => {
    const error = new Error('boom');
    const loader = new MockLoader(error);
    const phaseLoadersConfig = [
      {
        loader,
        contentKey: 'items',
        diskFolder: 'items',
        registryKey: 'items',
      },
    ];
    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: phaseLoadersConfig,
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });
    const manifest = { content: { items: ['a.json'] } };
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    const result = await manager.processMod(
      'testMod',
      manifest,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(result.status).toBe(ContentLoadStatus.FAILED);
    expect(result.updatedTotals.items.errors).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'initialization:world_loader:content_load_failed',
      expect.objectContaining({
        modId: 'testMod',
        registryKey: 'items',
        error: 'boom',
        phase,
      }),
      expect.any(Object)
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('returns "success" when all loaders succeed', async () => {
    const loader = new MockLoader({
      count: 1,
      overrides: 0,
      errors: 0,
      failures: [],
    });
    const phaseLoadersConfig = [
      {
        loader,
        contentKey: 'items',
        diskFolder: 'items',
        registryKey: 'items',
        registryKey: 'items',
      },
    ];
    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: phaseLoadersConfig,
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });
    const manifest = { content: { items: ['a.json'] } };
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    const result = await manager.processMod(
      'testMod',
      manifest,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(result.status).toBe(ContentLoadStatus.SUCCESS);
    expect(result.updatedTotals.items.count).toBe(1);
    expectNoDispatch(dispatcher.dispatch);
  });

  it('uses injected timer for duration measurement', async () => {
    const loader = new MockLoader({
      count: 0,
      overrides: 0,
      errors: 0,
      failures: [],
    });
    const phaseLoadersConfig = [
      {
        loader,
        contentKey: 'items',
        diskFolder: 'items',
        registryKey: 'items',
      },
    ];
    const fakeTimer = jest.fn().mockReturnValueOnce(5).mockReturnValueOnce(20);
    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: phaseLoadersConfig,
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
      timer: fakeTimer,
    });
    const manifest = { content: { items: ['a.json'] } };
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    await manager.processMod(
      'testMod',
      manifest,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(fakeTimer).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Content loading loop took 15.00 ms.')
    );
  });

  it('logs dispatch errors when mod_load_failed dispatch rejects', async () => {
    const phaseLoadersConfig = [];
    dispatcher.dispatch.mockRejectedValueOnce(new Error('dispatch fail'));
    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: phaseLoadersConfig,
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    });
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    await manager.processMod(
      'testMod',
      null,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed dispatching mod_load_failed event for testMod'
      ),
      expect.any(Error)
    );
  });

  it('dispatches mod_load_failed on unexpected errors', async () => {
    const phaseLoadersConfig = [];
    const failingTimer = () => {
      throw new Error('timer fail');
    };
    dispatcher.dispatch.mockRejectedValueOnce(new Error('dispatch fail'));
    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: phaseLoadersConfig,
      aggregatorFactory: (counts) => new LoadResultAggregator(counts),
      timer: failingTimer,
    });
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    await expect(
      manager.processMod(
        'testMod',
        { content: {} },
        totals,
        phaseLoadersConfig,
        phase
      )
    ).rejects.toThrow('timer fail');

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'initialization:world_loader:mod_load_failed',
      expect.objectContaining({ modId: 'testMod' }),
      expect.any(Object)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed dispatching mod_load_failed event for testMod after unexpected error in phase definitions'
      ),
      expect.any(Error)
    );
  });
});
