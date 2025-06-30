import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import ModManifestLoader from '../../../src/modding/modManifestLoader.js';

// Helper builder for loader and mocks
const buildLoader = () => {
  const deps = {
    configuration: { getContentTypeSchemaId: jest.fn(() => 'schema') },
    pathResolver: { resolveModManifestPath: jest.fn() },
    dataFetcher: { fetch: jest.fn() },
    schemaValidator: {
      getValidator: jest.fn(() => jest.fn(() => ({ isValid: true }))),
    },
    dataRegistry: { store: jest.fn() },
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
  return {
    loader: new ModManifestLoader(
      deps.configuration,
      deps.pathResolver,
      deps.dataFetcher,
      deps.schemaValidator,
      deps.dataRegistry,
      deps.logger
    ),
    deps,
  };
};

describe('ModManifestLoader additional helper methods', () => {
  let loader;
  let deps;

  beforeEach(() => {
    ({ loader, deps } = buildLoader());
    jest.clearAllMocks();
  });

  test('_validateAndCheckIds returns validated list on success', () => {
    const jobs = [{ modId: 'a', path: 'p/a', job: Promise.resolve() }];
    const manifest = { id: 'a', version: '1.0.0' };
    const settled = [{ status: 'fulfilled', value: manifest }];
    const validator = jest.fn(() => ({ isValid: true }));
    const out = loader._validateAndCheckIds(jobs, settled, validator);
    expect(out).toEqual([{ modId: 'a', data: manifest, path: 'p/a' }]);
  });

  test('_storeValidatedManifests throws on registry failure', () => {
    const validated = [{ modId: 'a', data: { id: 'a' }, path: 'p/a' }];
    deps.dataRegistry.store.mockImplementation(() => {
      throw new Error('fail');
    });
    expect(() => loader._storeValidatedManifests(validated)).toThrow(
      "failed to store manifest 'a'"
    );
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("failed to store manifest 'a'"),
      expect.objectContaining({ modId: 'a', path: 'p/a' })
    );
  });
});
