/**
 * @file Factory helpers for loader-related mocks used in tests.
 * @see tests/common/mockFactories/loaders.js
 */

import { jest } from '@jest/globals';

/**
 * Generic content-loader mock (ActionLoader, ComponentLoader, …).
 *
 * @param {object} [defaultLoadResult]
 * @returns {{ loadItemsForMod: jest.Mock }} Loader mock
 */
export const createMockContentLoader = (
  defaultLoadResult = { count: 0, overrides: 0, errors: 0 }
) => ({
  loadItemsForMod: jest.fn().mockResolvedValue(defaultLoadResult),
});

/**
 * Creates a mock SchemaLoader.
 *
 * @returns {{ loadAndCompileAllSchemas: jest.Mock }} Loader mock
 */
export const createMockSchemaLoader = () => ({
  loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock GameConfigLoader.
 *
 * @returns {{ loadConfig: jest.Mock }} Loader mock
 */
export const createMockGameConfigLoader = () => ({
  loadConfig: jest.fn().mockResolvedValue([]),
});

/**
 * Creates a mock ModManifestLoader.
 *
 * @returns {{ loadRequestedManifests: jest.Mock }} Loader mock
 */
export const createMockModManifestLoader = () => ({
  loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
});

/**
 * Creates a mock WorldLoader.
 *
 * @returns {{ loadWorlds: jest.Mock }} Loader mock
 */
export const createMockWorldLoader = () => ({
  loadWorlds: jest.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock ModDependencyValidator.
 *
 * @returns {{ validate: jest.Mock }} Validator mock
 */
export const createMockModDependencyValidator = () => ({
  validate: jest.fn(),
});

/**
 * Creates a mock for the mod version validator that can be used as a function
 * or via a `.validate` method.
 *
 * @returns {jest.Mock & { validate: jest.Mock }} Mock validator
 */
export const createMockModVersionValidator = () => {
  const fn = jest.fn();
  fn.validate = fn;
  return fn;
};

/**
 * Creates a mock for the mod load order resolver.
 *
 * @returns {{ resolve: jest.Mock, resolveOrder: jest.Mock }} Resolver mock
 */
export const createMockModLoadOrderResolver = () => {
  const resolveFn = jest.fn((reqIds) => reqIds);
  return {
    resolve: resolveFn,
    resolveOrder: resolveFn,
  };
};
