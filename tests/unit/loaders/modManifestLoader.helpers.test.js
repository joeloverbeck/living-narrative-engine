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

describe('ModManifestLoader internal workflow', () => {
  let loader;
  let deps;

  beforeEach(() => {
    const built = buildLoader();
    loader = built.loader;
    deps = built.deps;
  });

  test('_validateAndCheckIds throws on rejected fetch', () => {
    const jobs = [{ modId: 'a', path: 'p', job: Promise.resolve() }];
    const settled = [{ status: 'rejected', reason: new Error('fail') }];
    const validator = jest.fn();
    expect(() => loader._validateAndCheckIds(jobs, settled, validator)).toThrow(
      'could not fetch manifest'
    );
  });

  test('_storeValidatedManifests stores data', () => {
    const validated = [{ modId: 'a', data: { id: 'a' }, path: 'p' }];
    const stored = loader._storeValidatedManifests(validated);
    expect(stored.get('a')).toEqual({ id: 'a' });
    expect(deps.dataRegistry.store).toHaveBeenCalledWith('mod_manifests', 'a', {
      id: 'a',
    });
  });

  test('_fetchManifests resolves paths and fetch results', async () => {
    deps.pathResolver.resolveModManifestPath.mockImplementation(
      (id) => `mods/${id}/manifest.json`
    );
    deps.dataFetcher.fetch
      .mockResolvedValueOnce({ hello: 'a' })
      .mockRejectedValueOnce(new Error('nope'));

    const { fetchJobs, settled } = await loader._fetchManifests(['a', 'b']);

    expect(fetchJobs).toEqual([
      { modId: 'a', path: 'mods/a/manifest.json', job: expect.any(Promise) },
      { modId: 'b', path: 'mods/b/manifest.json', job: expect.any(Promise) },
    ]);
    expect(settled[0].status).toBe('fulfilled');
    expect(settled[0].value).toEqual({ hello: 'a' });
    expect(settled[1].status).toBe('rejected');
    expect(settled[1].reason).toEqual(new Error('nope'));
  });
});
