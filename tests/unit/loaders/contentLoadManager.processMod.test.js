import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';

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
    const loader = new MockLoader({ count: 1, overrides: 0, errors: 0 });
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
    });
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    const status = await manager.processMod(
      'testMod',
      null,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(status).toBe('skipped');
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
    });
    const manifest = { content: { items: ['a.json'] } };
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    const status = await manager.processMod(
      'testMod',
      manifest,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(status).toBe('failed');
    expect(totals.items.errors).toBe(1);
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
    const loader = new MockLoader({ count: 1, overrides: 0, errors: 0 });
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
    });
    const manifest = { content: { items: ['a.json'] } };
    /** @type {TotalResultsSummary} */ const totals = {};
    const phase = 'definitions';

    const status = await manager.processMod(
      'testMod',
      manifest,
      totals,
      phaseLoadersConfig,
      phase
    );

    expect(status).toBe('success');
    expect(totals.items.count).toBe(1);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});
