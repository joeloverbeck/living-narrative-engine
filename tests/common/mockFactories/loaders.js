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
 * Wraps a mock factory and configures a method to resolve with a specified value.
 *
 * @param {Function} factory - Factory creating the mock object.
 * @param {string} method - Method name on the mock to set.
 * @param {any} value - Value that the method should resolve to.
 * @returns {object} The configured mock.
 */
export function withResolvedValue(factory, method, value) {
  const mock = factory();
  mock[method].mockResolvedValue(value);
  return mock;
}

/**
 * Creates a generic content loader mock.
 *
 * @returns {{ loadItemsForMod: jest.Mock }} Loader mock
 */
export function createMockContentLoader() {
  return withResolvedValue(
    baseFactories.createMockContentLoader,
    'loadItemsForMod',
    { count: 0, overrides: 0, errors: 0 }
  );
}

/**
 * Creates a mock SchemaLoader.
 *
 * @returns {{ loadAndCompileAllSchemas: jest.Mock }} Loader mock
 */
export function createMockSchemaLoader() {
  return withResolvedValue(
    baseFactories.createMockSchemaLoader,
    'loadAndCompileAllSchemas',
    undefined
  );
}

/**
 * Creates a mock GameConfigLoader.
 *
 * @returns {{ loadConfig: jest.Mock }} Loader mock
 */
export function createMockGameConfigLoader() {
  return withResolvedValue(
    baseFactories.createMockGameConfigLoader,
    'loadConfig',
    []
  );
}

/**
 * Creates a mock ModManifestLoader.
 *
 * @returns {{ loadRequestedManifests: jest.Mock }} Loader mock
 */
export function createMockModManifestLoader() {
  return withResolvedValue(
    baseFactories.createMockModManifestLoader,
    'loadRequestedManifests',
    new Map()
  );
}

/**
 * Creates a mock WorldLoader.
 *
 * @returns {{ loadWorlds: jest.Mock }} Loader mock
 */
export function createMockWorldLoader() {
  return withResolvedValue(
    baseFactories.createMockWorldLoader,
    'loadWorlds',
    undefined
  );
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
