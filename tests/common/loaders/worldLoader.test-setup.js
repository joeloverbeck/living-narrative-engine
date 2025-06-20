/**
 * @file Setup in common for WorldLoader tests.
 * @see tests/common/loaders/worldLoader.test-setup.js
 */

import { jest } from '@jest/globals';
import WorldLoader from '../../../src/loaders/worldLoader.js';
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
} from '../mockFactories.js';

// --- Type‑only JSDoc imports (UNCHANGED) ---
// JSDoc comments remain the same...

/**
 * Creates a complete, mocked test environment for WorldLoader integration tests.
 *
 * This factory handles the instantiation of WorldLoader and all its dependencies,
 * providing default mock implementations for successful execution paths.
 *
 * @returns {{
 * worldLoader: WorldLoader,
 * mockRegistry: jest.Mocked<import('../../../src/interfaces/coreServices.js').IDataRegistry>,
 * mockLogger: jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>,
 * mockSchemaLoader: jest.Mocked<import('../../../src/loaders/schemaLoader.js').default>,
 * mockComponentLoader: jest.Mocked<import('../../../src/loaders/componentLoader.js').default>,
 * mockConditionLoader: jest.Mocked<import('../../../src/loaders/conditionLoader.js').default>,
 * mockRuleLoader: jest.Mocked<import('../../../src/loaders/ruleLoader.js').default>,
 * mockActionLoader: jest.Mocked<import('../../../src/loaders/actionLoader.js').default>,
 * mockEventLoader: jest.Mocked<import('../../../src/loaders/eventLoader.js').default>,
 * mockEntityLoader: jest.Mocked<import('../../../src/loaders/entityDefinitionLoader.js').default>,
 * mockValidator: jest.Mocked<import('../../../src/interfaces/coreServices.js').ISchemaValidator>,
 * mockConfiguration: jest.Mocked<import('../../../src/interfaces/coreServices.js').IConfiguration>,
 * mockGameConfigLoader: jest.Mocked<import('../../../src/loaders/gameConfigLoader.js').default>,
 * mockModManifestLoader: jest.Mocked<import('../../../src/modding/modManifestLoader.js').default>,
 * mockValidatedEventDispatcher: jest.Mocked<import('../../services/validatedEventDispatcher.js').default>,
 * mockModDependencyValidator: { validate: jest.Mock<any, any>},
 * mockModVersionValidator: jest.Mock<any, any>,
 * mockModLoadOrderResolver: { resolveOrder: jest.Mock<any, any>},
 * mockedModDependencyValidator: jest.Mock<any, any>,
 * mockedValidateModEngineVersions: jest.Mock<any, any>,
 * mockedResolveOrder: jest.Mock<any, any>
 * }}
 */
export function createTestEnvironment() {
  jest.clearAllMocks();

  // --- Create Mocks using Factories ---
  const mockRegistry = createStatefulMockDataRegistry();
  const mockLogger = createMockLogger();
  const mockSchemaLoader = createMockSchemaLoader();
  const mockValidator = createMockSchemaValidator();
  const mockConfiguration = createMockConfiguration();
  const mockGameConfigLoader = createMockGameConfigLoader();
  const mockModManifestLoader = createMockModManifestLoader();
  const mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

  // Content Loaders
  const mockActionLoader = createMockContentLoader();
  const mockComponentLoader = createMockContentLoader();
  const mockConditionLoader = createMockContentLoader();
  const mockEventLoader = createMockContentLoader();
  const mockRuleLoader = createMockContentLoader();
  const mockEntityLoader = createMockContentLoader();

  // Modding Helpers
  const mockModDependencyValidator = createMockModDependencyValidator();
  const mockModVersionValidator = createMockModVersionValidator();
  const mockModLoadOrderResolver = createMockModLoadOrderResolver();

  // --- Configure Specific Mock Behaviors (Success Paths) ---
  mockValidator.isSchemaLoaded.mockImplementation((schemaId) =>
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
    ].includes(schemaId)
  );
  mockModDependencyValidator.validate.mockImplementation(() => {});
  mockModVersionValidator.mockImplementation(() => {});
  mockModLoadOrderResolver.resolveOrder.mockImplementation((reqIds) => reqIds);

  // --- Instantiate SUT ---
  const worldLoader = new WorldLoader({
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
    // FIX: Changed from property shorthand to explicit key-value pairs
    modDependencyValidator: mockModDependencyValidator,
    modVersionValidator: mockModVersionValidator,
    modLoadOrderResolver: mockModLoadOrderResolver,
    contentLoadersConfig: null,
  });

  return {
    worldLoader,
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
    // Convenience accessors for inner jest functions
    mockedModDependencyValidator: mockModDependencyValidator.validate,
    mockedValidateModEngineVersions: mockModVersionValidator,
    mockedResolveOrder: mockModLoadOrderResolver.resolveOrder,
  };
}