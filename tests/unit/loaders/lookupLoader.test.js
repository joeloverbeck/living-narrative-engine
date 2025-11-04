/**
 * @file Unit tests for LookupLoader.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest
    .fn()
    .mockResolvedValue({ qualifiedId: 'mod:lookup', didOverride: false }),
}));

const {
  processAndStoreItem,
} = require('../../../src/loaders/helpers/processAndStoreItem.js');
const LookupLoader = require('../../../src/loaders/lookupLoader.js').default;

describe('LookupLoader', () => {
  let deps;
  let loader;

  beforeEach(() => {
    deps = {
      config: { getModsBasePath: jest.fn(), getContentTypeSchemaId: jest.fn() },
      pathResolver: { resolveModContentPath: jest.fn() },
      dataFetcher: { fetch: jest.fn() },
      schemaValidator: {
        validate: jest.fn(),
        getValidator: jest.fn(),
        isSchemaLoaded: jest.fn(),
      },
      dataRegistry: { store: jest.fn(), get: jest.fn() },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
    loader = new LookupLoader(
      deps.config,
      deps.pathResolver,
      deps.dataFetcher,
      deps.schemaValidator,
      deps.dataRegistry,
      deps.logger
    );
  });

  it('should construct with correct content type and dependencies', () => {
    expect(loader).toBeInstanceOf(LookupLoader);
    expect(loader._logger).toBe(deps.logger);
  });

  it('should delegate _processFetchedItem to processAndStoreItem and return result', async () => {
    const lookupData = {
      id: 'test_mod:test_lookup',
      description: 'Test lookup table',
      dataSchema: { type: 'object' },
      entries: { key1: { value: 1 } },
    };

    const result = await loader._processFetchedItem(
      'test_mod',
      'test_lookup.lookup.json',
      '/abs/path',
      lookupData,
      'lookups'
    );

    expect(processAndStoreItem).toHaveBeenCalledWith(
      loader,
      expect.objectContaining({
        data: lookupData,
        idProp: 'id',
        category: 'lookups',
        modId: 'test_mod',
        filename: 'test_lookup.lookup.json',
      })
    );
    expect(result).toEqual({ qualifiedId: 'mod:lookup', didOverride: false });
  });

  it('should handle lookup with multiple entries', async () => {
    const lookupData = {
      id: 'test_mod:moods',
      description: 'Mood descriptors',
      dataSchema: {
        type: 'object',
        properties: {
          adj: { type: 'string' },
          noun: { type: 'string' },
        },
      },
      entries: {
        cheerful: { adj: 'bright', noun: 'bouncy' },
        solemn: { adj: 'grave', noun: 'grave' },
        mournful: { adj: 'aching', noun: 'woeful' },
      },
    };

    await loader._processFetchedItem(
      'test_mod',
      'moods.lookup.json',
      '/abs/path',
      lookupData,
      'lookups'
    );

    expect(processAndStoreItem).toHaveBeenCalledWith(
      loader,
      expect.objectContaining({
        data: lookupData,
        category: 'lookups',
      })
    );
  });

  it('should propagate errors from processAndStoreItem', async () => {
    const error = new Error('Failed to store lookup');
    processAndStoreItem.mockRejectedValueOnce(error);

    await expect(
      loader._processFetchedItem(
        'test_mod',
        'bad.lookup.json',
        '/abs/path',
        { id: 'test_mod:bad' },
        'lookups'
      )
    ).rejects.toBe(error);
  });
});
