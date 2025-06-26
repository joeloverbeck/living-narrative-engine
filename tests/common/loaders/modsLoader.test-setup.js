/**
 * @file Common setup for ModsLoader integration tests.
 * @see tests/common/loaders/modsLoader.test-setup.js
 */

import { jest } from '@jest/globals';
import ModsLoader from '../../../src/loaders/modsLoader.js';
import {
  createStatefulMockDataRegistry,
  createMockLogger,
  createMockSchemaLoader,
  createMockSchemaValidator,
  createMockConfiguration,
  createMockGameConfigLoader,
  createMockModManifestLoader,
  createMockValidatedEventDispatcher,
  createMockModDependencyValidator,
  createMockModVersionValidator,
  createMockModLoadOrderResolver,
  createMockWorldLoader, // ← NEW import
  createLoaderMocks,
} from '../mockFactories';
import { buildServiceEnvironment } from '../mockEnvironment.js'; // Changed import
import { DEFAULT_LOADER_TYPES } from './loaderConstants.js';

/**
 * List of loader types used when generating mock loaders.
 *
 * @type {string[]}
 */
const loaderTypes = DEFAULT_LOADER_TYPES;

const factoryMap = {
  mockRegistry: createStatefulMockDataRegistry,
  mockLogger: createMockLogger,
  mockSchemaLoader: createMockSchemaLoader,
  mockValidator: createMockSchemaValidator,
  mockConfiguration: createMockConfiguration,
  mockGameConfigLoader: createMockGameConfigLoader,
  mockModManifestLoader: createMockModManifestLoader,
  mockValidatedEventDispatcher: createMockValidatedEventDispatcher,
  mockModDependencyValidator: createMockModDependencyValidator,
  mockModVersionValidator: createMockModVersionValidator,
  mockModLoadOrderResolver: createMockModLoadOrderResolver,
  mockWorldLoader: createMockWorldLoader,
};

// tokenMap is not used by ModsLoader constructor directly, but buildServiceEnvironment expects it.
const tokenMap = {};

const adjustMocks = (m) => {
  m.mockValidator.isSchemaLoaded.mockImplementation((id) =>
    [
      'schema:game',
      'schema:components',
      'schema:mod-manifest',
      'schema:entityDefinitions',
      'schema:actions',
      'schema:events',
      'schema:rules',
      'schema:conditions',
      'schema:entityInstances',
      'schema:goals',
    ].includes(id)
  );
  m.mockModDependencyValidator.validate.mockImplementation(() => {});
  m.mockModVersionValidator.mockImplementation(() => {});
  m.mockModLoadOrderResolver.resolve.mockImplementation((ids) => ids);
};

/**
 * Builds a fully mocked environment for ModsLoader tests.
 *
 * @description Creates and returns a collection of mock loaders and
 *   dependencies used by ModsLoader integration tests.
 * @returns {object} Test environment utilities and mocks.
 */
export function createTestEnvironment() {
  /* ── Content-loader mocks ───────────────────────────────────────────── */
  const loaders = createLoaderMocks(loaderTypes);

  // Adapter class for ModsLoader constructor
  class ModsLoaderAdapter {
    constructor({ mocks }) { // container is not directly used by ModsLoader constructor
      return new ModsLoader({
        logger: mocks.mockLogger,
        cache: { clear: jest.fn(), snapshot: jest.fn(), restore: jest.fn() },
        session: { run: jest.fn().mockResolvedValue({}) },
      });
    }
  }

  const env = buildServiceEnvironment(
    factoryMap,
    tokenMap, // Pass the empty tokenMap
    ModsLoaderAdapter, // Use the adapter
    {}, // No overrides in this specific setup
    adjustMocks // Pass setupMocks function
  );

  /* ── Return the assembled environment ──────────────────────────────── */
  return {
    ...env.mocks, // Spread all individual mocks from the factoryMap
    mockContainer: env.mockContainer,
    modsLoader: env.service, // This is the ModsLoader instance from buildServiceEnvironment
    createInstance: env.createInstance, // To create new ModsLoader instances
    cleanup: env.cleanup,
    ...loaders, // Merge other loader mocks
    mockWorldLoader: env.mocks.mockWorldLoader, // Ensure this points to the correct mock
    // Handy aliases for deeply nested jest fns
    mockedModDependencyValidator: env.mocks.mockModDependencyValidator.validate,
    mockedValidateModEngineVersions: env.mocks.mockModVersionValidator,
    mockedResolveOrder: env.mocks.mockModLoadOrderResolver.resolve,
  };
}
