/**
 * @file Test suite to ensure essential schemas are always loaded.
 * @see tests/loaders/worldLoader.essentialSchemas.test.js
 */

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import WorldLoader from '../../src/loaders/worldLoader.js';
import ESSENTIAL_SCHEMA_TYPES from '../../src/constants/essentialSchemas.js';
import MissingSchemaError from '../../src/errors/missingSchemaError.js';
import WorldLoaderError from '../../src/errors/worldLoaderError.js';

// Mock minimal dependencies for WorldLoader
const mockMinimalDeps = () => ({
  registry: { store: jest.fn(), get: jest.fn(), clear: jest.fn() },
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), dump: jest.fn() },
  schemaLoader: { loadAndCompileAllSchemas: jest.fn() },
  componentLoader: { loadItemsForMod: jest.fn() },
  conditionLoader: { loadItemsForMod: jest.fn() },
  ruleLoader: { loadItemsForMod: jest.fn() },
  actionLoader: { loadItemsForMod: jest.fn() },
  eventLoader: { loadItemsForMod: jest.fn() },
  entityLoader: { loadItemsForMod: jest.fn() },
  entityInstanceLoader: { loadItemsForMod: jest.fn().mockResolvedValue({ count: 0, overrides: 0, errors: 0 }) },
  validator: { isSchemaLoaded: jest.fn(), getValidator: jest.fn(), addSchema: jest.fn() },
  configuration: { getContentTypeSchemaId: jest.fn(), getModsBasePath: jest.fn(() => 'data/mods') },
  gameConfigLoader: { loadConfig: jest.fn().mockResolvedValue(['core']) },
  promptTextLoader: { loadPromptText: jest.fn() },
  modManifestLoader: { loadRequestedManifests: jest.fn().mockResolvedValue(new Map()) },
  validatedEventDispatcher: { dispatch: jest.fn() },
  modDependencyValidator: { validate: jest.fn() },
  modVersionValidator: jest.fn(),
  modLoadOrderResolver: { resolveOrder: jest.fn(ids => ids) }
});


describe('WorldLoader Essential Schema Checking', () => {
  let mockConfiguration;
  let mockValidator;
  let mockLogger;
  let worldLoader;
  let deps;

  const ALL_ESSENTIAL_SCHEMA_IDS = ESSENTIAL_SCHEMA_TYPES.reduce((acc, type) => {
    acc[type] = `http://example.com/schemas/${type}.schema.json`;
    return acc;
  }, {});

  beforeEach(() => {
    deps = mockMinimalDeps();
    mockConfiguration = deps.configuration;
    mockValidator = deps.validator;
    mockLogger = deps.logger;

    mockConfiguration.getContentTypeSchemaId.mockImplementation(
      (type) => ALL_ESSENTIAL_SCHEMA_IDS[type] || null
    );
    mockValidator.isSchemaLoaded.mockReturnValue(true);
    
    deps.modDependencyValidator.validate.mockClear().mockReturnValue();
    deps.modVersionValidator.mockClear().mockReturnValue();
    
    worldLoader = new WorldLoader(deps);
  });

  test('should pass if all essential schemas are configured and loaded', async () => {
    const coreManifest = { name: 'Core', version: '1.0.0', engineVersion: '1.0.0', dependencies: {}, conflicts: {} };
    deps.modManifestLoader.loadRequestedManifests.mockResolvedValue(new Map([['core', coreManifest]]));
    
    await expect(worldLoader.loadWorld('testWorld')).resolves.toBeUndefined();

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringMatching(/Essential schema missing|CRITICAL load failure/i),
      // expect.any(Error) // This was too broad; specific checks are better if an error is expected
    );
    expect(deps.modDependencyValidator.validate).toHaveBeenCalled();
    expect(deps.modVersionValidator).toHaveBeenCalled();
  });

  test('should throw WorldLoaderError if an essential schema type is not configured (getContentTypeSchemaId returns null)', async () => {
    const missingType = 'game'; // An example of a type that might not be configured
    const expectedErrorMessageFromCheck = `WorldLoader: Essential schema type '${missingType}' is not configured (no schema ID found).`;
    const expectedMissingSchemaErrorMsg = `Essential schema type '${missingType}' is not configured (no schema ID found).`;

    mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => {
      if (type === missingType) return null;
      return ALL_ESSENTIAL_SCHEMA_IDS[type] || null;
    });
    
    await expect(worldLoader.loadWorld('testWorld')).rejects.toThrow(WorldLoaderError);
    
    try {
      await worldLoader.loadWorld('testWorld');
    } catch (e) {
      expect(e).toBeInstanceOf(WorldLoaderError);
      expect(e.message).toContain(`WorldLoader failed during essential schema check – aborting world load. Original error: ${expectedMissingSchemaErrorMsg}`);
      expect(e.cause).toBeInstanceOf(MissingSchemaError);
      expect(e.cause.message).toBe(expectedMissingSchemaErrorMsg);
      expect(e.cause.schemaId).toBeNull();
      expect(e.cause.contentType).toBe(missingType);
    }

    // Check the log from #checkEssentialSchemas
    expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessageFromCheck);

    // Check the CRITICAL load failure log from loadWorld catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL load failure during world/mod loading sequence.'),
      expect.objectContaining({ error: expect.any(MissingSchemaError) })
    );
  });

  test('should throw WorldLoaderError if an essential schema is configured but not loaded (isSchemaLoaded returns false)', async () => {
    const notLoadedType = 'actions';
    const notLoadedSchemaId = ALL_ESSENTIAL_SCHEMA_IDS[notLoadedType];
    const expectedErrorMessageFromCheck = `WorldLoader: Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;
    const expectedMissingSchemaErrorMsg = `Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;

    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      if (schemaId === notLoadedSchemaId) return false;
      return true;
    });
    
    await expect(worldLoader.loadWorld('testWorld')).rejects.toThrow(WorldLoaderError);
    
    try {
      await worldLoader.loadWorld('testWorld');
    } catch (e) {
      expect(e).toBeInstanceOf(WorldLoaderError);
      expect(e.message).toContain(`WorldLoader failed during essential schema check – aborting world load. Original error: ${expectedMissingSchemaErrorMsg}`);
      expect(e.cause).toBeInstanceOf(MissingSchemaError);
      expect(e.cause.message).toBe(expectedMissingSchemaErrorMsg);
      expect(e.cause.schemaId).toBe(notLoadedSchemaId);
      expect(e.cause.contentType).toBe(notLoadedType);
    }

    // Check the log from #checkEssentialSchemas
    expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessageFromCheck);

    // Check the CRITICAL load failure log from loadWorld catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL load failure during world/mod loading sequence.'),
        expect.objectContaining({ error: expect.any(MissingSchemaError) })
    );
  });

  test('should correctly identify the type key in log when a schema ID is not configured', async () => {
    const unconfiguredType = 'entityDefinitions'; 
    const expectedLogMessage = `WorldLoader: Essential schema type '${unconfiguredType}' is not configured (no schema ID found).`;

    mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => {
      if (type === unconfiguredType) return undefined; // Simulate not configured
      return ALL_ESSENTIAL_SCHEMA_IDS[type] || null;
    });
    
    try {
      await worldLoader.loadWorld('testWorld');
    } catch (e) {
      // We expect it to throw, this is fine.
      expect(e).toBeInstanceOf(WorldLoaderError);
      expect(e.cause).toBeInstanceOf(MissingSchemaError);
      expect(e.cause.contentType).toBe(unconfiguredType);
    }

    // Check that the specific error message from #checkEssentialSchemas was logged
    expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
  });
});
