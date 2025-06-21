/**
 * @file Factory helpers for loader-related mocks used in tests.
 * @see tests/common/mockFactories/loaders.js
 */

import { jest } from '@jest/globals';
import { generateFactories } from './coreServices.js';

const baseFactories = generateFactories({
  createMockContentLoader: ['loadItemsForMod'],
  createMockSchemaLoader: ['loadAndCompileAllSchemas'],
  createMockGameConfigLoader: ['loadConfig'],
  createMockModManifestLoader: ['loadRequestedManifests'],
  createMockWorldLoader: ['loadWorlds'],
  createMockModDependencyValidator: ['validate'],
  createMockModLoadOrderResolver: ['resolve', 'resolveOrder'],
});

/**
 * Creates a generic content loader mock.
 *
 * @returns {{ loadItemsForMod: jest.Mock }} Loader mock
 */
export function createMockContentLoader() {
  const mock = baseFactories.createMockContentLoader();
  mock.loadItemsForMod.mockResolvedValue({ count: 0, overrides: 0, errors: 0 });
  return mock;
}

/**
 * Creates a mock SchemaLoader.
 *
 * @returns {{ loadAndCompileAllSchemas: jest.Mock }} Loader mock
 */
export function createMockSchemaLoader() {
  const mock = baseFactories.createMockSchemaLoader();
  mock.loadAndCompileAllSchemas.mockResolvedValue(undefined);
  return mock;
}

/**
 * Creates a mock GameConfigLoader.
 *
 * @returns {{ loadConfig: jest.Mock }} Loader mock
 */
export function createMockGameConfigLoader() {
  const mock = baseFactories.createMockGameConfigLoader();
  mock.loadConfig.mockResolvedValue([]);
  return mock;
}

/**
 * Creates a mock ModManifestLoader.
 *
 * @returns {{ loadRequestedManifests: jest.Mock }} Loader mock
 */
export function createMockModManifestLoader() {
  const mock = baseFactories.createMockModManifestLoader();
  mock.loadRequestedManifests.mockResolvedValue(new Map());
  return mock;
}

/**
 * Creates a mock WorldLoader.
 *
 * @returns {{ loadWorlds: jest.Mock }} Loader mock
 */
export function createMockWorldLoader() {
  const mock = baseFactories.createMockWorldLoader();
  mock.loadWorlds.mockResolvedValue(undefined);
  return mock;
}

/**
 * Creates a mock ModDependencyValidator.
 *
 * @returns {{ validate: jest.Mock }} Validator mock
 */
export function createMockModDependencyValidator() {
  return baseFactories.createMockModDependencyValidator();
}

/**
 * Creates a mock ModLoadOrderResolver.
 *
 * @returns {{ resolve: jest.Mock, resolveOrder: jest.Mock }} Resolver mock
 */
export function createMockModLoadOrderResolver() {
  const mock = baseFactories.createMockModLoadOrderResolver();
  mock.resolve.mockImplementation((reqIds) => reqIds);
  mock.resolveOrder.mockImplementation((reqIds) => reqIds);
  return mock;
}

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
