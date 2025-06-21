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
} from '../mockFactories';
import { createLoaderMocks } from './modsLoader.test-utils.js';
import { buildEnvironment } from '../mockEnvironment.js';

/**
 * List of loader types used when generating mock loaders.
 *
 * @type {string[]}
 */
const loaderTypes = [
  'Action',
  'Component',
  'Condition',
  'Event',
  'Rule',
  'Entity',
];

/**
 * Builds a fully mocked environment for ModsLoader tests.
 *
 * @description Creates and returns a collection of mock loaders and
 *   dependencies used by ModsLoader integration tests.
 * @returns {object} Test environment utilities and mocks.
 */
export function createTestEnvironment() {
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

  /* ── Content-loader mocks ───────────────────────────────────────────── */
  const loaders = createLoaderMocks(loaderTypes);

  const {
    mocks,
    instance: modsLoader,
    cleanup,
  } = buildEnvironment(factoryMap, {}, {}, (mockContainer, m) => {
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
    m.mockModLoadOrderResolver.resolveOrder.mockImplementation((ids) => ids);

    return new ModsLoader({
      registry: m.mockRegistry,
      logger: m.mockLogger,
      schemaLoader: m.mockSchemaLoader,
      componentLoader: loaders.mockComponentLoader,
      conditionLoader: loaders.mockConditionLoader,
      ruleLoader: loaders.mockRuleLoader,
      actionLoader: loaders.mockActionLoader,
      eventLoader: loaders.mockEventLoader,
      entityLoader: loaders.mockEntityLoader,
      validator: m.mockValidator,
      configuration: m.mockConfiguration,
      gameConfigLoader: m.mockGameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader: m.mockModManifestLoader,
      validatedEventDispatcher: m.mockValidatedEventDispatcher,
      modDependencyValidator: m.mockModDependencyValidator,
      modVersionValidator: m.mockModVersionValidator,
      modLoadOrderResolver: m.mockModLoadOrderResolver,
      worldLoader: m.mockWorldLoader,
      contentLoadersConfig: null,
    });
  });

  /* ── Return the assembled environment ──────────────────────────────── */
  return {
    modsLoader,
    ...mocks,
    ...loaders,
    mockWorldLoader: mocks.mockWorldLoader, // ← exposed for assertions
    // Handy aliases for deeply nested jest fns
    mockedModDependencyValidator: mocks.mockModDependencyValidator.validate,
    mockedValidateModEngineVersions: mocks.mockModVersionValidator,
    mockedResolveOrder: mocks.mockModLoadOrderResolver.resolveOrder,
    cleanup,
  };
}
