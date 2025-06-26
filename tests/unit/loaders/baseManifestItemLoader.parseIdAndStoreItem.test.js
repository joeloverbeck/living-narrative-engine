import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';
import { parseAndValidateId } from '../../../src/utils/idUtils.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

jest.mock('../../../src/utils/idUtils.js', () => {
  const actual = jest.requireActual('../../../src/utils/idUtils.js');
  return { ...actual, parseAndValidateId: jest.fn() };
});

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
  getContentTypeSchemaId: jest.fn(() => 'testSchema'),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getContentBasePath: jest.fn((t) => `./data/${t}`),
  ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  loadSchema: jest.fn(),
  getSchema: jest.fn(),
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  ...overrides,
});

const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
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
    jest.clearAllMocks();

    const config = createMockConfiguration();
    const resolver = createMockPathResolver();
    const fetcher = createMockDataFetcher();
    const validator = createMockSchemaValidator({
      getValidator: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      loadSchema: jest.fn(),
      getSchema: jest.fn(),
    });
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

    jest.spyOn(loader, '_storeItemInRegistry').mockImplementation(
      (categoryArg, modIdArg, baseIdArg, dataToStoreArg, sourceFilenameArg) => {
        const qualifiedIdInternal = `${modIdArg}:${baseIdArg}`;
        let finalIdInternal = baseIdArg;
        if (['actions', 'scopes', 'entityDefinitions', 'entityInstances'].includes(categoryArg)) {
          finalIdInternal = qualifiedIdInternal;
        }

        const dataWithMetadataInternal = {
          ...dataToStoreArg,
          _modId: modIdArg,
          _sourceFile: sourceFilenameArg,
          _fullId: qualifiedIdInternal,
          id: finalIdInternal,
        };

        mockRegistry.store(categoryArg, qualifiedIdInternal, dataWithMetadataInternal);
        return { qualifiedId: qualifiedIdInternal, didOverride: false };
      }
    );
  });

  it('parses ID and stores item, returning result', () => {
    const originalData = { id: 'test', name: 'Test Item Name' };
    parseAndValidateId.mockReturnValue({
      fullId: `${modId}:test`,
      baseId: 'test',
    });
    mockRegistry.get.mockReturnValue(undefined);

    const result = loader.publicParseAndStore(
      originalData,
      'id',
      category,
      modId,
      filename,
      {}
    );

    expect(parseAndValidateId).toHaveBeenCalledWith(
      originalData,
      'id',
      modId,
      filename,
      loader._logger,
      {}
    );
    expect(mockRegistry.store).toHaveBeenCalledTimes(1);
    expect(loader._storeItemInRegistry).toHaveBeenCalledTimes(1);

    const storeItemInRegistryCallArgs = loader._storeItemInRegistry.mock.calls[0];
    const dataParamReceivedBySpy = storeItemInRegistryCallArgs[3];

    expect(dataParamReceivedBySpy).toBeDefined();
    expect(dataParamReceivedBySpy.name).toBe('Test Item Name');
    expect(dataParamReceivedBySpy.id).toBe('test');

    const storeCallArgs = mockRegistry.store.mock.calls[0];
    const storedObject = storeCallArgs[2];

    expect(storedObject).toBeDefined();
    expect(storedObject.id).toBe(`${modId}:test`);
    expect(storedObject._fullId).toBe(`${modId}:test`);
    expect(storedObject._modId).toBe(modId);
    expect(storedObject._sourceFile).toBe(filename);
    expect(storedObject.name).toBe('Test Item Name');

    expect(result).toEqual({
      didOverride: false,
      qualifiedId: 'testMod:test',
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
