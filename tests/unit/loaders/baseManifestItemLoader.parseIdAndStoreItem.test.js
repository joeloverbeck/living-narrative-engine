import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';
import { parseAndValidateId } from '../../../src/utils/idUtils.js';

jest.mock('../../../src/utils/idUtils.js', () => {
  const actual = jest.requireActual('../../../src/utils/idUtils.js');
  return { ...actual, parseAndValidateId: jest.fn() };
});

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn().mockReturnValue('schema'),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getContentBasePath: jest.fn((t) => `./data/${t}`),
  ...overrides,
});
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(),
  resolveContentPath: jest.fn(),
  resolveSchemaPath: jest.fn(),
  resolveModManifestPath: jest.fn(),
  resolveGameConfigPath: jest.fn(),
  resolveRulePath: jest.fn(),
  ...overrides,
});
const createMockDataFetcher = () => ({ fetch: jest.fn() });
const createMockSchemaValidator = () => ({
  validate: jest.fn(),
  getValidator: jest.fn(),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  isSchemaLoaded: jest.fn(),
});
const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  ...overrides,
});
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class TestableLoader extends BaseManifestItemLoader {
  publicParseAndStore(data, idProp, category, modId, filename, options) {
    return this._parseIdAndStoreItem(
      data,
      idProp,
      category,
      modId,
      filename,
      options
    );
  }
  async _processFetchedItem() {
    return { qualifiedId: '', didOverride: false };
  }
}

describe('BaseManifestItemLoader._parseIdAndStoreItem', () => {
  const modId = 'testMod';
  const filename = 'item.json';
  const category = 'actions';
  let loader;
  let mockRegistry;
  beforeEach(() => {
    const config = createMockConfiguration();
    const resolver = createMockPathResolver();
    const fetcher = createMockDataFetcher();
    const validator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockRegistry.store.mockReturnValue(false);
    const logger = createMockLogger();
    loader = new TestableLoader(
      'test',
      config,
      resolver,
      fetcher,
      validator,
      mockRegistry,
      logger
    );
    jest.clearAllMocks();
  });

  it('parses ID and stores item, returning result', () => {
    const data = { id: 'test' };
    parseAndValidateId.mockReturnValue({
      fullId: `${modId}:test`,
      baseId: 'test',
    });
    mockRegistry.get.mockReturnValue(undefined);

    const result = loader.publicParseAndStore(
      data,
      'id',
      category,
      modId,
      filename
    );

    expect(parseAndValidateId).toHaveBeenCalledWith(
      data,
      'id',
      modId,
      filename,
      loader._logger,
      {}
    );
    expect(mockRegistry.store).toHaveBeenCalledWith(
      category,
      `${modId}:test`,
      expect.objectContaining({
        ...data,
        id: 'test',
        _fullId: `${modId}:test`,
        modId: modId,
        _sourceFile: filename,
      })
    );
    expect(result).toEqual({
      qualifiedId: `${modId}:test`,
      didOverride: false,
    });
  });

  it('throws when parse fails and does not store', () => {
    const data = { id: 'bad' };
    const err = new Error('bad');
    parseAndValidateId.mockImplementation(() => {
      throw err;
    });
    expect(() =>
      loader.publicParseAndStore(data, 'id', category, modId, filename)
    ).toThrow(err);
    expect(mockRegistry.store).not.toHaveBeenCalled();
  });
});
