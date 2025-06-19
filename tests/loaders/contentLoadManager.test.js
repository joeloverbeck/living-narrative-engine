import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ContentLoadManager from '../../src/loaders/ContentLoadManager.js';

class MockLoader {
  constructor(responses) {
    this.responses = responses;
    this.loadItemsForMod = jest.fn(async (modId) => {
      const res = this.responses[modId];
      if (res instanceof Error) {
        throw res;
      }
      return res;
    });
  }
}

describe('ContentLoadManager.loadContent', () => {
  /** @type {jest.Mocked<any>} */
  let logger;
  /** @type {jest.Mocked<any>} */
  let dispatcher;

  beforeEach(() => {
    logger = { debug: jest.fn(), error: jest.fn() };
    dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  });

  it('aggregates loader results across mods and dispatches on errors', async () => {
    const loader = new MockLoader({
      modA: { count: 1, overrides: 0, errors: 0 },
      modB: new Error('boom'),
    });
    const manager = new ContentLoadManager({
      logger,
      validatedEventDispatcher: dispatcher,
      contentLoadersConfig: [
        {
          loader,
          contentKey: 'items',
          contentTypeDir: 'items',
          typeName: 'items',
        },
      ],
    });

    const manifests = new Map([
      ['moda', { content: { items: ['a.json'] } }],
      ['modb', { content: { items: ['b.json'] } }],
    ]);
    const totals = {};

    const results = await manager.loadContent(
      ['modA', 'modB'],
      manifests,
      totals
    );

    expect(results).toEqual({ modA: 'success', modB: 'failed' });
    expect(totals).toEqual({ items: { count: 1, overrides: 0, errors: 1 } });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'initialization:world_loader:content_load_failed',
      expect.objectContaining({ modId: 'modB', typeName: 'items' }),
      expect.any(Object)
    );
  });
});
