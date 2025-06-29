// Filename: src/tests/dependencyInjection/registrations/loadersRegistrations.test.js
// ****** CORRECTED FILE ******
/* eslint-disable no-unused-vars */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ITextDataFetcher} ITextDataFetcher */
/** @typedef {import('../../../../src/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../../../src/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../../../src/loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../../../src/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../../../src/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../../../src/loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../../../src/loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../../../src/loaders/entityDefinitionLoader.js').default} EntityLoader */ // Corrected path
/** @typedef {any} AppContainer */

// --- Jest Imports ---
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

// --- Class Under Test ---
import { registerLoaders } from '../../../../src/dependencyInjection/registrations/loadersRegistrations.js'; // Corrected path

// --- Dependencies ---
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import SchemaLoader from '../../../../src/loaders/schemaLoader.js'; // Import actual class
// Import other actual loader classes if needed for instanceof checks
import RuleLoader from '../../../../src/loaders/ruleLoader.js';
import ComponentLoader from '../../../../src/loaders/componentLoader.js';
import GameConfigLoader from '../../../../src/loaders/gameConfigLoader.js';
import ModManifestLoader from '../../../../src/modding/modManifestLoader.js';
import ActionLoader from '../../../../src/loaders/actionLoader.js';
import EventLoader from '../../../../src/loaders/eventLoader.js';
import EntityDefinitionLoader from '../../../../src/loaders/entityDefinitionLoader.js';
import StaticConfiguration from '../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../src/pathing/defaultPathResolver.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import WorkspaceDataFetcher from '../../../../src/data/workspaceDataFetcher.js';
import { MockContainer } from '../../../common/mockFactories/index.js';

// --- Mock Implementations (Core Services) ---
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockConfiguration = {
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getSchemaFiles: jest
    .fn()
    .mockReturnValue([
      'common.schema.json',
      'entity-definition.schema.json',
      'entity-instance.schema.json',
    ]),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    const map = {
      /* map based on actual dependencyInjection if needed */
      components: 'http://example.com/schemas/component.schema.json',
      actions: 'http://example.com/schemas/action.schema.json',
      events: 'http://example.com/schemas/component.schema.json',
      entities: 'http://example.com/schemas/entity-definition.schema.json',
      rules: 'http://example.com/schemas/rule.schema.json',
      game: 'http://example.com/schemas/game.schema.json',
      'mod-manifest': 'http://example.com/schemas/mod-manifest.schema.json',
    };
    return map[registryKey];
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('./data/schemas'),
  getContentBasePath: jest.fn((registryKey) => `./data/${registryKey}`),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModsBasePath: jest.fn().mockReturnValue('mods'), // Needed for ModManifestLoader etc.
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'), // Needed
  getRuleBasePath: jest.fn().mockReturnValue('./data/system-rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
};

// Provide all methods used by ANY loader being registered
const mockPathResolver = {
  resolveSchemaPath: jest.fn((filename) => `resolved/schemas/${filename}`),
  resolveModContentPath: jest.fn(
    (modId, registryKey, filename) =>
      `resolved/mods/${modId}/${registryKey}/${filename}`
  ),
  resolveModManifestPath: jest.fn(
    (modId) => `resolved/mods/${modId}/mod-manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => 'resolved/game.json'),
  resolveRulePath: jest.fn((filename) => `resolved/rules/${filename}`),
  // Add other methods if necessary
};

// Provide all methods used by ANY loader being registered
const mockSchemaValidator = {
  validate: jest.fn().mockReturnValue({ isValid: true }),
  addSchema: jest.fn(),
  isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume schemas are loaded for resolver tests
  getValidator: jest.fn((schemaId) => {
    // Return a mock validator function
    const mockValidateFn = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: null });
    // Ajv attaches errors to the function itself
    mockValidateFn.errors = null;
    return mockValidateFn;
  }),
  removeSchema: jest.fn().mockReturnValue(true), // Needed by ComponentLoader
};

// Provide all methods used by ANY loader being registered
const mockDataFetcher = {
  fetch: jest.fn().mockResolvedValue({
    $id: 'http://example.com/schemas/common.schema.json', // Default for schema load
    id: 'test-id', // Default for content load
    dataSchema: {}, // Default for component load
  }),
};

const mockDataRegistry = {
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined), // Default to not finding existing items
  getAll: jest.fn().mockReturnValue([]),
  // Add other methods if necessary
};

// --- Mock Custom DI Container ---
describe('registerLoaders (with Mock DI Container)', () => {
  /** @type {MockContainer} */
  let mockContainer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContainer = new MockContainer();

    // Register the logger BEFORE calling the function under test
    // Use internalOptions here for the mock's logic
    mockContainer.register(tokens.ILogger, mockLogger, {
      lifecycle: 'singleton',
    }); // Register with original options

    // Clear mocks for dependencies that might be called during registration
    Object.values(mockPathResolver).forEach(
      (mockFn) => typeof mockFn?.mockClear === 'function' && mockFn.mockClear()
    );
    Object.values(mockSchemaValidator).forEach(
      (mockFn) => typeof mockFn?.mockClear === 'function' && mockFn.mockClear()
    );
    Object.values(mockDataFetcher).forEach(
      (mockFn) => typeof mockFn?.mockClear === 'function' && mockFn.mockClear()
    );
    Object.values(mockDataRegistry).forEach(
      (mockFn) => typeof mockFn?.mockClear === 'function' && mockFn.mockClear()
    );
    Object.values(mockConfiguration).forEach(
      (mockFn) => typeof mockFn?.mockClear === 'function' && mockFn.mockClear()
    );
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    mockContainer.resolve.mockClear();
    // Keep register mock history
  });

  it('should register all 37 services/loaders (+ ILogger) as singletons', () => {
    // Arrange: Logger is already registered in beforeEach

    // Act: Register the loaders
    registerLoaders(mockContainer);

    // Assert
    const expectedTokens = [
      // Infrastructure Interfaces
      tokens.IConfiguration,
      tokens.IPathResolver,
      tokens.ISchemaValidator,
      tokens.IDataRegistry,
      tokens.IDataFetcher,
      tokens.ITextDataFetcher,
      tokens.ProxyUrl,
      tokens.ILoadCache,
      // Specific Loaders
      tokens.SchemaLoader,
      tokens.ConditionLoader,
      tokens.RuleLoader,
      tokens.ComponentLoader,
      tokens.GameConfigLoader,
      tokens.ModManifestLoader,
      tokens.ActionLoader,
      tokens.EventLoader,
      tokens.MacroLoader,
      tokens.EntityLoader, // Maps to EntityDefinitionLoader
      tokens.PromptTextLoader,
      tokens.WorldLoader,
      tokens.EntityInstanceLoader,
      tokens.GoalLoader,
      tokens.ScopeLoader,
      tokens.ModsLoader,
      tokens.AnatomyRecipeLoader,
      tokens.AnatomyBlueprintLoader,
      tokens.AnatomyPartLoader,
      tokens.AnatomyFormattingLoader,
      // Phase-related services and processors
      tokens.ModLoadOrderResolver,
      tokens.ModManifestProcessor,
      tokens.ContentLoadManager,
      tokens.WorldLoadSummaryLogger,
      tokens.SchemaPhase,
      tokens.GameConfigPhase,
      tokens.ManifestPhase,
      tokens.ContentPhase,
      tokens.WorldPhase,
      tokens.SummaryPhase,
    ];
    const expectedRegistrationCount = expectedTokens.length; // Includes ProxyUrl

    // Expect 1 (ILogger from beforeEach) + all from registerLoaders
    expect(mockContainer.register).toHaveBeenCalledTimes(
      expectedRegistrationCount + 1
    );

    // Check that each expected token was registered with a factory
    expectedTokens.forEach((token) => {
      if (!token) {
        throw new Error(
          `Undefined token found in expectedTokens array. Check tokens.js.`
        );
      }
      expect(mockContainer.register).toHaveBeenCalledWith(
        token,
        expect.any(Function),
        expect.any(Object)
      );
    });

    // Check the ILogger registration from beforeEach separately
    expect(mockContainer.register.mock.calls[0][0]).toBe(tokens.ILogger);
    expect(mockContainer.register.mock.calls[0][1]).toBe(mockLogger);
    expect(mockContainer.register.mock.calls[0][2]).toEqual({
      lifecycle: 'singleton',
    });

    // Verify logger calls within registerLoaders
    // Only 1 debug log for 'Starting...'
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });

  it('should resolve SchemaLoader successfully (happy path) and respect singleton lifecycle', () => {
    // Arrange
    registerLoaders(mockContainer);

    // Act: Resolve SchemaLoader twice
    const loader1 = mockContainer.resolve(tokens.SchemaLoader);
    const loader2 = mockContainer.resolve(tokens.SchemaLoader);

    // Assert
    expect(loader1).toBeDefined();
    expect(loader1).toBeInstanceOf(SchemaLoader);
    // This should now pass because the mock resolve handles singletonFactory correctly
    expect(loader1).toBe(loader2); // Singleton check

    // Verify dependencies were resolved by the factory during the *first* resolve call.
    const callsToResolve = mockContainer.resolve.mock.calls;
    const resolvedTokens = new Set(callsToResolve.map((call) => call[0]));

    // Check dependencies needed for SchemaLoader factory were resolved at least once
    expect(resolvedTokens).toContain(tokens.IConfiguration);
    expect(resolvedTokens).toContain(tokens.IPathResolver);
    expect(resolvedTokens).toContain(tokens.IDataFetcher);
    expect(resolvedTokens).toContain(tokens.ISchemaValidator);
    expect(resolvedTokens).toContain(tokens.ILogger); // Resolved by registerLoaders AND factory

    // Check SchemaLoader itself was resolved twice
    expect(
      callsToResolve.filter((call) => call[0] === tokens.SchemaLoader).length
    ).toBe(2);
  });

  it('should resolve EntityDefinitionLoader successfully and respect singleton lifecycle', () => {
    // Arrange
    registerLoaders(mockContainer);

    // Act
    const loader1 = mockContainer.resolve(tokens.EntityLoader);
    const loader2 = mockContainer.resolve(tokens.EntityLoader);

    // Assert
    expect(loader1).toBeDefined();
    expect(loader1).toBeInstanceOf(EntityDefinitionLoader);
    // This should now pass because the mock resolve handles singletonFactory correctly
    expect(loader1).toBe(loader2); // Singleton check

    // Verify dependencies were resolved
    const resolvedTokens = new Set(
      mockContainer.resolve.mock.calls.map((call) => call[0])
    );
    expect(resolvedTokens).toContain(tokens.IConfiguration);
    expect(resolvedTokens).toContain(tokens.IPathResolver);
    expect(resolvedTokens).toContain(tokens.IDataFetcher);
    expect(resolvedTokens).toContain(tokens.ISchemaValidator);
    expect(resolvedTokens).toContain(tokens.IDataRegistry);
    expect(resolvedTokens).toContain(tokens.ILogger);

    // Check EntityDefinitionLoader itself was resolved twice
    expect(
      mockContainer.resolve.mock.calls.filter(
        (call) => call[0] === tokens.EntityLoader
      ).length
    ).toBe(2);
  });
});
