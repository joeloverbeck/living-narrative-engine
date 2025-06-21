import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import GoalLoader from '../../../src/loaders/goalLoader.js';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';

/**
 * Creates minimal mock dependencies required for GoalLoader.
 * @returns {object} mocks
 */
function createMocks() {
  const config = {
    getModsBasePath: jest.fn(),
    getContentTypeSchemaId: jest.fn().mockReturnValue('goal.schema.json'),
  };
  const pathResolver = { resolveModContentPath: jest.fn() };
  const dataFetcher = { fetch: jest.fn() };
  const schemaValidator = {
    validate: jest.fn(),
    getValidator: jest.fn(),
    isSchemaLoaded: jest.fn(),
  };
  const dataRegistry = { store: jest.fn(), get: jest.fn() };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger,
  };
}

describe('GoalLoader._processFetchedItem', () => {
  let mocks;
  let loader;

  beforeEach(() => {
    mocks = createMocks();
    loader = new GoalLoader(
      mocks.config,
      mocks.pathResolver,
      mocks.dataFetcher,
      mocks.schemaValidator,
      mocks.dataRegistry,
      mocks.logger
    );
  });

  it('calls _parseIdAndStoreItem with correct arguments and returns result', async () => {
    const parseSpy = jest
      .spyOn(BaseManifestItemLoader.prototype, '_parseIdAndStoreItem')
      .mockReturnValue({ qualifiedId: 'test:goal', didOverride: false });

    const data = { id: 'goal' };
    // FIX: Updated call to match the 5-argument signature of _processFetchedItem.
    // The 'resolvedPath' and 'typeName' arguments are added.
    const result = await loader._processFetchedItem(
      'test',
      'goal.json',
      'test/goals/goal.json',
      data,
      'goals'
    );

    expect(parseSpy).toHaveBeenCalledWith(
      data,
      'id',
      'goals',
      'test',
      'goal.json'
    );
    expect(result).toEqual({ qualifiedId: 'test:goal', didOverride: false });
    parseSpy.mockRestore();
  });

  it('propagates didOverride flag from _parseIdAndStoreItem', async () => {
    const parseSpy = jest
      .spyOn(BaseManifestItemLoader.prototype, '_parseIdAndStoreItem')
      .mockReturnValue({ qualifiedId: 'mod:goal2', didOverride: true });

    const data = { id: 'goal2' };
    // FIX: Updated call to match the 5-argument signature.
    const result = await loader._processFetchedItem(
      'mod',
      'goal2.json',
      'mod/goals/goal2.json',
      data,
      'goals'
    );

    expect(result).toEqual({ qualifiedId: 'mod:goal2', didOverride: true });
    parseSpy.mockRestore();
  });

  it('rethrows errors from _parseIdAndStoreItem', async () => {
    const error = new Error('parse failed');
    const parseSpy = jest
      .spyOn(BaseManifestItemLoader.prototype, '_parseIdAndStoreItem')
      .mockImplementation(() => {
        throw error;
      });

    const data = { id: 'bad' };
    // FIX: Updated call to match the 5-argument signature.
    await expect(
      loader._processFetchedItem(
        'badmod',
        'bad.json',
        'badmod/goals/bad.json',
        data,
        'goals'
      )
    ).rejects.toThrow(error);
    parseSpy.mockRestore();
  });
});