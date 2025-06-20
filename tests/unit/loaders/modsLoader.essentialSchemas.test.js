/**
 * @file Test suite to ensure essential schemas are always loaded.
 * @see tests/loaders/modsLoader.essentialSchemas.test.js
 */

import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// --- The new Test Setup Factory ---
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';

// --- SUT Dependencies & Errors ---
import ESSENTIAL_SCHEMA_TYPES from '../../../src/constants/essentialSchemas.js';
import MissingSchemaError from '../../../src/errors/missingSchemaError.js';
import ModsLoaderError from '../../../src/errors/modsLoaderError.js';

// --- Type‑only JSDoc imports for Mocks and SUT ---
/** @typedef {import('../../common/loaders/modsLoader.test-setup.js').TestEnvironment} TestEnvironment */

describe('ModsLoader Essential Schema Checking (Refactored)', () => {
  /** @type {TestEnvironment} */
  let env;

  const ALL_ESSENTIAL_SCHEMA_IDS = ESSENTIAL_SCHEMA_TYPES.reduce(
    (acc, type) => {
      acc[type] = `http://example.com/schemas/${type}.schema.json`;
      return acc;
    },
    {}
  );

  beforeEach(() => {
    // 1. Get the standard environment from the factory
    env = createTestEnvironment();

    // 2. Configure mocks for this specific test suite's needs
    env.mockConfiguration.getContentTypeSchemaId.mockImplementation(
      (type) => ALL_ESSENTIAL_SCHEMA_IDS[type] || null
    );
    // The default from the factory is true, so this is explicit for clarity
    env.mockValidator.isSchemaLoaded.mockReturnValue(true);

    // Set default success paths for dependencies
    env.mockGameConfigLoader.loadConfig.mockResolvedValue(['core']);
    env.mockModDependencyValidator.validate.mockClear().mockReturnValue();
    env.mockModVersionValidator.mockClear().mockReturnValue();
  });

  test('should pass if all essential schemas are configured and loaded', async () => {
    // Arrange: Setup a basic valid core manifest
    const coreManifest = {
      id: 'core',
      name: 'Core',
      version: '1.0.0',
      gameVersion: '1.0.0',
      dependencies: {},
      conflicts: {},
    };
    env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      new Map([['core', coreManifest]])
    );

    // Action & Assert
    await expect(
      env.modsLoader.loadWorld('testWorld')
    ).resolves.toBeUndefined();

    expect(env.mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringMatching(/Essential schema missing|CRITICAL load failure/i)
    );
    expect(env.mockModDependencyValidator.validate).toHaveBeenCalled();
    expect(env.mockModVersionValidator).toHaveBeenCalled();
  });

  test('should throw ModsLoaderError if an essential schema type is not configured (getContentTypeSchemaId returns null)', async () => {
    // Arrange
    const missingType = 'game'; // An example of a type that might not be configured
    const expectedErrorMessageFromCheck = `ModsLoader: Essential schema type '${missingType}' is not configured (no schema ID found).`;
    const expectedMissingSchemaErrorMsg = `Essential schema type '${missingType}' is not configured (no schema ID found).`;

    env.mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => {
      if (type === missingType) return null;
      return ALL_ESSENTIAL_SCHEMA_IDS[type] || null;
    });

    // Action & Assert
    await expect(env.modsLoader.loadWorld('testWorld')).rejects.toThrow(
      ModsLoaderError
    );

    try {
      await env.modsLoader.loadWorld('testWorld');
    } catch (e) {
      expect(e).toBeInstanceOf(ModsLoaderError);
      expect(e.message).toContain(
        `ModsLoader failed during essential schema check – aborting world load. Original error: ${expectedMissingSchemaErrorMsg}`
      );
      expect(e.cause).toBeInstanceOf(MissingSchemaError);
      expect(e.cause.message).toBe(expectedMissingSchemaErrorMsg);
      expect(e.cause.schemaId).toBeNull();
      expect(e.cause.contentType).toBe(missingType);
    }

    // Assert Logs
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expectedErrorMessageFromCheck
    );
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'CRITICAL load failure during world/mod loading sequence.'
      ),
      expect.objectContaining({ error: expect.any(MissingSchemaError) })
    );
  });

  test('should throw ModsLoaderError if an essential schema is configured but not loaded (isSchemaLoaded returns false)', async () => {
    // Arrange
    const notLoadedType = 'actions';
    const notLoadedSchemaId = ALL_ESSENTIAL_SCHEMA_IDS[notLoadedType];
    const expectedErrorMessageFromCheck = `ModsLoader: Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;
    const expectedMissingSchemaErrorMsg = `Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;

    env.mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      if (schemaId === notLoadedSchemaId) return false;
      return true;
    });

    // Action & Assert
    await expect(env.modsLoader.loadWorld('testWorld')).rejects.toThrow(
      ModsLoaderError
    );

    try {
      await env.modsLoader.loadWorld('testWorld');
    } catch (e) {
      expect(e).toBeInstanceOf(ModsLoaderError);
      expect(e.message).toContain(
        `ModsLoader failed during essential schema check – aborting world load. Original error: ${expectedMissingSchemaErrorMsg}`
      );
      expect(e.cause).toBeInstanceOf(MissingSchemaError);
      expect(e.cause.message).toBe(expectedMissingSchemaErrorMsg);
      expect(e.cause.schemaId).toBe(notLoadedSchemaId);
      expect(e.cause.contentType).toBe(notLoadedType);
    }

    // Assert Logs
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expectedErrorMessageFromCheck
    );
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'CRITICAL load failure during world/mod loading sequence.'
      ),
      expect.objectContaining({ error: expect.any(MissingSchemaError) })
    );
  });

  test('should correctly identify the type key in log when a schema ID is not configured', async () => {
    // Arrange
    const unconfiguredType = 'entityDefinitions';
    const expectedLogMessage = `ModsLoader: Essential schema type '${unconfiguredType}' is not configured (no schema ID found).`;

    env.mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => {
      if (type === unconfiguredType) return undefined; // Simulate not configured
      return ALL_ESSENTIAL_SCHEMA_IDS[type] || null;
    });

    // Action & Assert
    try {
      await env.modsLoader.loadWorld('testWorld');
    } catch (e) {
      // We expect it to throw, this is fine.
      expect(e).toBeInstanceOf(ModsLoaderError);
      expect(e.cause).toBeInstanceOf(MissingSchemaError);
      expect(e.cause.contentType).toBe(unconfiguredType);
    }

    // Assert Logs
    expect(env.mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
  });
});
