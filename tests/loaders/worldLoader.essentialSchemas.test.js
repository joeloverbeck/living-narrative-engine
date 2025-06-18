/**
 * @file Test suite to ensure essential schemas are always loaded.
 * @see tests/loaders/worldLoader.essentialSchemas.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldLoader from '../../src/loaders/worldLoader.js';
import WorldLoaderError from '../../src/errors/worldLoaderError.js';

// Minimal mocks for all WorldLoader dependencies
const mockRegistry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockSchemaLoader = {
  loadAndCompileAllSchemas: jest.fn().mockResolvedValue(),
};
const mockComponentLoader = { loadItemsForMod: jest.fn() };
const mockConditionLoader = { loadItemsForMod: jest.fn() };
const mockRuleLoader = { loadItemsForMod: jest.fn() };
const mockMacroLoader = { loadItemsForMod: jest.fn() };
const mockActionLoader = { loadItemsForMod: jest.fn() };
const mockEventLoader = { loadItemsForMod: jest.fn() };
const mockEntityDefinitionLoader = { loadItemsForMod: jest.fn() };
const mockEntityInstanceLoader = { loadItemsForMod: jest.fn() };
const mockGameConfigLoader = {
  loadConfig: jest.fn().mockResolvedValue(['core']),
};
const mockPromptTextLoader = { loadPromptText: jest.fn().mockResolvedValue() };
const mockModManifestLoader = {
  loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
};
const mockValidatedEventDispatcher = {
  dispatch: jest.fn().mockResolvedValue(),
};
const mockModDependencyValidator = { validate: jest.fn() };
const mockModVersionValidator = jest.fn();
const mockModLoadOrderResolver = { resolveOrder: jest.fn() };

// Mocks for the specific services under test
let mockConfiguration;
let mockValidator;

describe('WorldLoader Essential Schema Validation', () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    jest.clearAllMocks();
    mockModDependencyValidator.validate.mockReset();
    mockModDependencyValidator.validate.mockReturnValue();
    mockModVersionValidator.mockReset();
    mockModVersionValidator.mockReturnValue();
    mockModLoadOrderResolver.resolveOrder.mockReset();
    mockModLoadOrderResolver.resolveOrder.mockReturnValue([]);

    // Define schema IDs for a successful run, reflecting the fix
    const schemaIds = {
      game: 'http://example.com/schemas/game.schema.json',
      components: 'http://example.com/schemas/component.schema.json',
      'mod-manifest': 'http://example.com/schemas/mod.manifest.schema.json',
      entityDefinitions:
        'http://example.com/schemas/entity-definition.schema.json',
      entityInstances: 'http://example.com/schemas/entity-instance.schema.json',
      actions: 'http://example.com/schemas/action.schema.json',
      events: 'http://example.com/schemas/event.schema.json',
      rules: 'http://example.com/schemas/rule.schema.json',
      conditions: 'http://example.com/schemas/condition.schema.json',
    };

    mockConfiguration = {
      getContentTypeSchemaId: jest.fn((typeName) => schemaIds[typeName]),
    };

    mockValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };
  });

  /**
   * Helper function to create a new WorldLoader instance with the current mocks.
   *
   * @returns {WorldLoader}
   */
  const createWorldLoaderInstance = () => {
    return new WorldLoader({
      registry: mockRegistry,
      logger: mockLogger,
      schemaLoader: mockSchemaLoader,
      componentLoader: mockComponentLoader,
      conditionLoader: mockConditionLoader,
      ruleLoader: mockRuleLoader,
      macroLoader: mockMacroLoader,
      actionLoader: mockActionLoader,
      eventLoader: mockEventLoader,
      entityLoader: mockEntityDefinitionLoader,
      entityInstanceLoader: mockEntityInstanceLoader,
      validator: mockValidator,
      configuration: mockConfiguration,
      gameConfigLoader: mockGameConfigLoader,
      promptTextLoader: mockPromptTextLoader,
      modManifestLoader: mockModManifestLoader,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      modDependencyValidator: mockModDependencyValidator,
      modVersionValidator: mockModVersionValidator,
      modLoadOrderResolver: mockModLoadOrderResolver,
      contentLoadersConfig: null,
    });
  };

  it('should pass validation when all essential schemas are configured and loaded', async () => {
    const worldLoader = createWorldLoaderInstance();
    // We expect loadWorld not to throw an error related to essential schemas.
    // It might fail later for other reasons (like no manifests), but that's fine for this test.
    // We just need to ensure it gets past the essential schema check.
    await expect(worldLoader.loadWorld('test-world')).resolves.toBeUndefined();

    // Verify logger was not called with an error about missing schemas
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Essential schema missing or not configured')
    );
  });

  it('should throw WorldLoaderError if a schema ID is not configured (returns undefined)', async () => {
    // Simulate the original error: 'actions' schema is not configured.
    mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
      if (typeName === 'actions') {
        return undefined;
      }
      // Provide a valid ID for all other types.
      const schemaIds = {
        game: 'http://example.com/schemas/game.schema.json',
        components: 'http://example.com/schemas/component.schema.json',
        'mod-manifest': 'http://example.com/schemas/mod.manifest.schema.json',
        entityDefinitions:
          'http://example.com/schemas/entity-definition.schema.json',
        entityInstances:
          'http://example.com/schemas/entity-instance.schema.json',
        events: 'http://example.com/schemas/event.schema.json',
        rules: 'http://example.com/schemas/rule.schema.json',
        conditions: 'http://example.com/schemas/condition.schema.json',
      };
      return schemaIds[typeName];
    });

    const worldLoader = createWorldLoaderInstance();

    // The promise should be rejected with a specific error type and message.
    await expect(worldLoader.loadWorld('test-world')).rejects.toThrow(
      WorldLoaderError
    );
    await expect(worldLoader.loadWorld('test-world')).rejects.toThrow(
      "WorldLoader failed: Essential schema 'Unknown Essential Schema ID' missing or check failed – aborting world load. Original error: Missing essential schema: Unknown Essential Schema ID"
    );

    // Check that the specific internal error was logged.
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: Essential schema missing or not configured: Unknown Essential Schema ID'
    );
  });

  it('should throw WorldLoaderError if a schema is configured but not loaded', async () => {
    const missingSchemaId = 'http://example.com/schemas/action.schema.json';

    // Simulate that the validator does not have the 'actions' schema loaded.
    mockValidator.isSchemaLoaded.mockImplementation((id) => {
      return id !== missingSchemaId;
    });

    const worldLoader = createWorldLoaderInstance();

    // --- CORRECTED ASSERTION ---
    // Use a try/catch block to inspect the thrown error's type and message separately.
    // This avoids the 'cause' property mismatch when comparing error instances.
    let caughtError;
    try {
      await worldLoader.loadWorld('test-world');
      // This line should not be reached; if it is, the test fails.
      throw new Error(
        'Test failed: worldLoader.loadWorld did not throw an error as expected.'
      );
    } catch (error) {
      caughtError = error;
    }

    // 1. Assert the error is of the correct custom type.
    expect(caughtError).toBeInstanceOf(WorldLoaderError);

    // 2. Assert the error has the exact expected message.
    expect(caughtError.message).toBe(
      `WorldLoader failed: Essential schema '${missingSchemaId}' missing or check failed – aborting world load. Original error: Missing essential schema: ${missingSchemaId}`
    );
    // --- END CORRECTION ---

    // Check that the specific internal error was logged.
    expect(mockLogger.error).toHaveBeenCalledWith(
      `WorldLoader: Essential schema missing or not configured: ${missingSchemaId}`
    );
  });
});
