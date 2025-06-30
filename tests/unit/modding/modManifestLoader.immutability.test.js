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

describe('ModManifestLoader immutability', () => {
  let loader;
  let deps;

  beforeEach(() => {
    const built = buildLoader();
    loader = built.loader;
    deps = built.deps;
    deps.pathResolver.resolveModManifestPath.mockImplementation(
      (id) => `mods/${id}/mod-manifest.json`
    );
    deps.dataFetcher.fetch.mockResolvedValue({
      id: 'modA',
      name: 'A',
      version: '1.0.0',
    });
  });

  test('getLoadedManifests returns a frozen map', async () => {
    const result = await loader.loadRequestedManifests(['modA']);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.get('modA'))).toBe(true);

    expect(() => result.set('other', {})).toThrow(TypeError);
    expect(() => {
      const manifest = result.get('modA');
      // @ts-ignore intentional mutation attempt for test
      manifest.name = 'B';
    }).toThrow(TypeError);
  });
});
