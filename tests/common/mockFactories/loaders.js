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
 * Specification describing how each loader factory should behave.
 *
 * @type {Record<string, { method: string, value: any }>}
 */
const loaderSpecs = {
  createMockContentLoader: {
    method: 'loadItemsForMod',
    value: { count: 0, overrides: 0, errors: 0 },
  },
  createMockSchemaLoader: {
    method: 'loadAndCompileAllSchemas',
    value: undefined,
  },
  createMockGameConfigLoader: { method: 'loadConfig', value: [] },
  createMockModManifestLoader: {
    method: 'loadRequestedManifests',
    value: new Map(),
  },
  createMockWorldLoader: { method: 'loadWorlds', value: undefined },
};

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
 * Builds a loader factory using a base factory and resolved value spec.
 *
 * @param {string} name - Key of the base factory in `baseFactories`.
 * @param {string} method - Method to configure on the mock.
 * @param {any} value - Value the method should resolve with.
 * @returns {() => object} Loader factory.
 */
function makeLoaderFactory(name, method, value) {
  return () => withResolvedValue(baseFactories[name], method, value);
}

const generated = {};
for (const [name, { method, value }] of Object.entries(loaderSpecs)) {
  generated[name] = makeLoaderFactory(name, method, value);
}

export const {
  createMockContentLoader,
  createMockSchemaLoader,
  createMockGameConfigLoader,
  createMockModManifestLoader,
  createMockWorldLoader,
} = generated;

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
