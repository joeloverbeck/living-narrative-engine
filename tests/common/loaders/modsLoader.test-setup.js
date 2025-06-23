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
import { createServiceTestEnvironment } from '../mockEnvironment.js';
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

const serviceFactory = (mockContainer, m) =>
  new ModsLoader({
    logger: m.mockLogger,
    cache: { clear: jest.fn(), snapshot: jest.fn(), restore: jest.fn() },
    session: { run: jest.fn().mockResolvedValue({}) },
  });

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

  const env = createServiceTestEnvironment({
    factoryMap,
    tokenMap: {},
    build: serviceFactory,
    setupMocks: adjustMocks,
  });

  /* ── Return the assembled environment ──────────────────────────────── */
  return {
    ...env,
    ...loaders,
    modsLoader: env.instance,
    mockWorldLoader: env.mocks.mockWorldLoader, // ← exposed for assertions
    // Handy aliases for deeply nested jest fns
    mockedModDependencyValidator: env.mocks.mockModDependencyValidator.validate,
    mockedValidateModEngineVersions: env.mocks.mockModVersionValidator,
    mockedResolveOrder: env.mocks.mockModLoadOrderResolver.resolve,
  };
}
