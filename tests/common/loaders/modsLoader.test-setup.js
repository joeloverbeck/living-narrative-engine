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
  createMockWorldLoader,            // ← NEW import
} from '../mockFactories.js';

/**
 * Builds a fully mocked environment for ModsLoader tests.
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
  const mockActionLoader = createMockContentLoader();
  const mockComponentLoader = createMockContentLoader();
  const mockConditionLoader = createMockContentLoader();
  const mockEventLoader = createMockContentLoader();
  const mockRuleLoader = createMockContentLoader();
  const mockEntityLoader = createMockContentLoader();

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
    ].includes(id)
  );
  mockModDependencyValidator.validate.mockImplementation(() => { });
  mockModVersionValidator.mockImplementation(() => { });
  mockModLoadOrderResolver.resolveOrder.mockImplementation((ids) => ids);

  /* ── Instantiate system-under-test ──────────────────────────────────── */
  const modsLoader = new ModsLoader({
    registry: mockRegistry,
    logger: mockLogger,
    schemaLoader: mockSchemaLoader,
    componentLoader: mockComponentLoader,
    conditionLoader: mockConditionLoader,
    ruleLoader: mockRuleLoader,
    actionLoader: mockActionLoader,
    eventLoader: mockEventLoader,
    entityLoader: mockEntityLoader,
    validator: mockValidator,
    configuration: mockConfiguration,
    gameConfigLoader: mockGameConfigLoader,
    promptTextLoader: { loadPromptText: jest.fn() },
    modManifestLoader: mockModManifestLoader,
    validatedEventDispatcher: mockValidatedEventDispatcher,
    modDependencyValidator: mockModDependencyValidator,
    modVersionValidator: mockModVersionValidator,
    modLoadOrderResolver: mockModLoadOrderResolver,
    worldLoader: mockWorldLoader,   // ← injected here
    contentLoadersConfig: null,
  });

  /* ── Return the assembled environment ──────────────────────────────── */
  return {
    modsLoader,
    mockRegistry,
    mockLogger,
    mockSchemaLoader,
    mockComponentLoader,
    mockConditionLoader,
    mockRuleLoader,
    mockActionLoader,
    mockEventLoader,
    mockEntityLoader,
    mockValidator,
    mockConfiguration,
    mockGameConfigLoader,
    mockModManifestLoader,
    mockValidatedEventDispatcher,
    mockModDependencyValidator,
    mockModVersionValidator,
    mockModLoadOrderResolver,
    mockWorldLoader,                        // ← exposed for assertions
    // Handy aliases for deeply nested jest fns
    mockedModDependencyValidator: mockModDependencyValidator.validate,
    mockedValidateModEngineVersions: mockModVersionValidator,
    mockedResolveOrder: mockModLoadOrderResolver.resolveOrder,
  };
}