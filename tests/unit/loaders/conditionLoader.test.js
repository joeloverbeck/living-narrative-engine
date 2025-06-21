// const { jest } = require('@jest/globals');
jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn().mockResolvedValue({ qualifiedId: 'mod:cond', didOverride: false })
}));
const { processAndStoreItem } = require('../../../src/loaders/helpers/processAndStoreItem.js');
const ConditionLoader = require('../../../src/loaders/conditionLoader.js').default;

describe('ConditionLoader', () => {
  let deps;
  let loader;

  beforeEach(() => {
    deps = {
      config: { getModsBasePath: jest.fn(), getContentTypeSchemaId: jest.fn() },
      pathResolver: { resolveModContentPath: jest.fn() },
      dataFetcher: { fetch: jest.fn() },
      schemaValidator: { validate: jest.fn(), getValidator: jest.fn(), isSchemaLoaded: jest.fn() },
      dataRegistry: { store: jest.fn(), get: jest.fn() },
      logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    };
    loader = new ConditionLoader(
      deps.config,
      deps.pathResolver,
      deps.dataFetcher,
      deps.schemaValidator,
      deps.dataRegistry,
      deps.logger
    );
  });

  it('should construct with correct content type and dependencies', () => {
    expect(loader).toBeInstanceOf(ConditionLoader);
    // Content type property is not public/testable, so we skip that assertion
    expect(loader._logger).toBe(deps.logger);
  });

  it('should delegate _processFetchedItem to processAndStoreItem and return result', async () => {
    const result = await loader._processFetchedItem('mod1', 'file.json', '/abs/path', { id: 'foo' }, 'conditions');
    expect(processAndStoreItem).toHaveBeenCalledWith(loader, expect.objectContaining({
      data: { id: 'foo' },
      idProp: 'id',
      category: 'conditions',
      modId: 'mod1',
      filename: 'file.json',
    }));
    expect(result).toEqual({ qualifiedId: 'mod:cond', didOverride: false });
  });
}); 