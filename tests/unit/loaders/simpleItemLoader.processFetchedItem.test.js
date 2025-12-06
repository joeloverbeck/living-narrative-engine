/**
 * @file Unit tests for SimpleItemLoader's _processFetchedItem implementation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SimpleItemLoaderDefault, {
  SimpleItemLoader,
} from '../../../src/loaders/simpleItemLoader.js';
import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';

jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn(),
}));

describe('SimpleItemLoader', () => {
  /** @type {SimpleItemLoader} */
  let loader;

  beforeEach(() => {
    loader = Object.create(SimpleItemLoader.prototype);
    processAndStoreItem.mockReset();
  });

  it('exports the loader class as both named and default export', () => {
    expect(SimpleItemLoaderDefault).toBe(SimpleItemLoader);
  });

  it('delegates processing to processAndStoreItem with normalized parameters', async () => {
    const modId = 'core';
    const filename = 'item.json';
    const resolvedPath = '/mods/core/item.json';
    const registryKey = 'items';
    const data = { id: 'core:item', value: 12 };
    const expected = { qualifiedId: 'core:item', didOverride: false };

    processAndStoreItem.mockResolvedValue(expected);

    const result = await loader._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      data,
      registryKey
    );

    expect(result).toEqual(expected);
    expect(processAndStoreItem).toHaveBeenCalledTimes(1);
    expect(processAndStoreItem).toHaveBeenCalledWith(loader, {
      data,
      idProp: 'id',
      category: registryKey,
      modId,
      filename,
    });
  });

  it('propagates errors from processAndStoreItem', async () => {
    const error = new Error('unable to store item');
    processAndStoreItem.mockRejectedValue(error);

    await expect(
      loader._processFetchedItem(
        'mod',
        'file.json',
        '/resolved',
        { id: 'mod:item' },
        'items'
      )
    ).rejects.toBe(error);
  });
});
