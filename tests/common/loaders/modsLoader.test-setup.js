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
  createMockContentLoader,
  createMockModDependencyValidator,
  createMockModVersionValidator,
  createMockModLoadOrderResolver,
  createMockWorldLoader, // ← NEW import
} from '../mockFactories.js';

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
  jest.clearAllMocks();

  /* ── Core-service mocks ─────────────────────────────────────────────── */
  const mockRegistry = createStatefulMockDataRegistry();
  const mockLogger = createMockLogger();
  const mockSchemaLoader = createMockSchemaLoader();
  const mockValidator = createMockSchemaValidator();
  const mockConfiguration = createMockConfiguration();
  const mockGameConfigLoader = createMockGameConfigLoader();
  const mockModManifestLoader = createMockModManifestLoader();
  const mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

  /* ── Content-loader mocks ───────────────────────────────────────────── */
  const loaders = {};
  for (const type of loaderTypes) {
    loaders[`mock${type}Loader`] = createMockContentLoader();
  }

  /* ── Modding-helper mocks ───────────────────────────────────────────── */
  const mockModDependencyValidator = createMockModDependencyValidator();
  const mockModVersionValidator = createMockModVersionValidator();
  const mockModLoadOrderResolver = createMockModLoadOrderResolver();

  /* ── **WorldLoader mock** (new) ─────────────────────────────────────── */
  const mockWorldLoader = createMockWorldLoader();

  /* ── Default success behaviour overrides ───────────────────────────── */
  mockValidator.isSchemaLoaded.mockImplementation((id) =>
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
  mockModDependencyValidator.validate.mockImplementation(() => {});
  mockModVersionValidator.mockImplementation(() => {});
  mockModLoadOrderResolver.resolveOrder.mockImplementation((ids) => ids);

  /* ── Instantiate system-under-test ──────────────────────────────────── */
  const modsLoader = new ModsLoader({
    registry: mockRegistry,
    logger: mockLogger,
    schemaLoader: mockSchemaLoader,
    componentLoader: loaders.mockComponentLoader,
    conditionLoader: loaders.mockConditionLoader,
    ruleLoader: loaders.mockRuleLoader,
    actionLoader: loaders.mockActionLoader,
    eventLoader: loaders.mockEventLoader,
    entityLoader: loaders.mockEntityLoader,
    validator: mockValidator,
    configuration: mockConfiguration,
    gameConfigLoader: mockGameConfigLoader,
    promptTextLoader: { loadPromptText: jest.fn() },
    modManifestLoader: mockModManifestLoader,
    validatedEventDispatcher: mockValidatedEventDispatcher,
    modDependencyValidator: mockModDependencyValidator,
    modVersionValidator: mockModVersionValidator,
    modLoadOrderResolver: mockModLoadOrderResolver,
    worldLoader: mockWorldLoader, // ← injected here
    contentLoadersConfig: null,
  });

  /* ── Return the assembled environment ──────────────────────────────── */
  return {
    modsLoader,
    mockRegistry,
    mockLogger,
    mockSchemaLoader,
    ...loaders,
    mockValidator,
    mockConfiguration,
    mockGameConfigLoader,
    mockModManifestLoader,
    mockValidatedEventDispatcher,
    mockModDependencyValidator,
    mockModVersionValidator,
    mockModLoadOrderResolver,
    mockWorldLoader, // ← exposed for assertions
    // Handy aliases for deeply nested jest fns
    mockedModDependencyValidator: mockModDependencyValidator.validate,
    mockedValidateModEngineVersions: mockModVersionValidator,
    mockedResolveOrder: mockModLoadOrderResolver.resolveOrder,
  };
}
