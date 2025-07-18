import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import ModManifestLoader from '../../../src/modding/modManifestLoader.js';

/**
 * Helper to build loader with basic mocks.
 *
 * @returns {{loader: ModManifestLoader, deps: object}} Loader and dependencies.
 */
const buildLoader = () => {
  const deps = {
    configuration: { getContentTypeSchemaId: jest.fn(() => 'schema') },
    pathResolver: { resolveModManifestPath: jest.fn() },
    dataFetcher: { fetch: jest.fn() },
    schemaValidator: { getValidator: jest.fn(() => jest.fn()) },
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

describe('ModManifestLoader helper methods', () => {
  let loader;
  let deps;

  beforeEach(() => {
    const built = buildLoader();
    loader = built.loader;
    deps = built.deps;
  });

  test('_validateRequestIds trims and validates', () => {
    const ids = loader._validateRequestIds([' a ', 'b']);
    expect(ids).toEqual(['a', 'b']);
  });

  test('_validateRequestIds throws on duplicates', () => {
    expect(() => loader._validateRequestIds(['a', 'a'])).toThrow(
      "duplicate mod-ID 'a'"
    );
  });

  test('_getManifestValidator throws when missing', () => {
    deps.schemaValidator.getValidator.mockReturnValue(undefined);
    expect(() => loader._getManifestValidator('schema')).toThrow(
      "no validator available for 'schema'"
    );
  });

  test('_fetchManifests fetches manifests using resolver and fetcher', async () => {
    deps.pathResolver.resolveModManifestPath.mockImplementation(
      (id) => `mods/${id}/manifest.json`
    );
    deps.dataFetcher.fetch
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ id: 'b' });
    const { fetchJobs, settled } = await loader._fetchManifests(['a', 'b']);
    expect(fetchJobs.map((j) => j.path)).toEqual([
      'mods/a/manifest.json',
      'mods/b/manifest.json',
    ]);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);
  });
});
