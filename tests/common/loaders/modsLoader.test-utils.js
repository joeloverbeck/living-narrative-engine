/**
 * @file Utility helpers for ModsLoader tests.
 * @see tests/common/loaders/modsLoader.test-utils.js
 */

import { createMockContentLoader } from '../mockFactories';

/**
 * Sets up manifest-related mocks for a ModsLoader test environment.
 *
 * @param {object} env - Test environment returned by createTestEnvironment.
 * @param {Map<string, object>} manifestMap - Map of mod IDs to manifests.
 * @param {string[]} finalModOrder - Final mod load order.
 * @returns {void}
 */
export function setupManifests(env, manifestMap, finalModOrder) {
  env.mockGameConfigLoader.loadConfig.mockResolvedValue({
    mods: finalModOrder,
    world: 'testWorldSimple',
  });
  env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
    manifestMap
  );
  env.mockedResolveOrder.mockReturnValue(finalModOrder);

  const defaultGet = (type, id) => env.mockRegistry._internalStore[type]?.[id];

  env.mockRegistry.get.mockImplementation((type, id) => {
    if (type === 'mod_manifests') {
      const manifest = manifestMap.get(id.toLowerCase());
      if (manifest) {
        return manifest;
      }
    }
    return defaultGet(type, id);
  });
}

/**
 * Concatenates all info log messages into a single string.
 *
 * @param {object} logger - Logger with a jest.fn `info` method.
 * @returns {string} Summary text from logger.info calls.
 */
export function getSummaryText(logger) {
  return logger.info.mock.calls.map((c) => c[0]).join('\n');
}

/**
 * Generates mock loader objects for the given content types.
 *
 * @description Iterates over the supplied type names and returns an
 *   object containing `{ mock${type}Loader: createMockContentLoader() }`
 *   entries for each.
 * @param {string[]} types - Content loader type names.
 * @returns {Record<string, { loadItemsForMod: jest.Mock }>} Mapping of
 *   mock loader names to loader mocks.
 */
export function createLoaderMocks(types) {
  const loaders = {};
  for (const type of types) {
    loaders[`mock${type}Loader`] = createMockContentLoader();
  }
  return loaders;
}
