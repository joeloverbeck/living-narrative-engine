// Filename: tests/unit/loaders/modsLoader.essentialSchemas.test.js

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
    env.mockGameConfigLoader.loadConfig.mockResolvedValue({ mods: ['core'] });
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
    const expectedMissingSchemaErrorMsg = `Essential schema type '${missingType}' is not configured (no schema ID found).`;

    env.mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => {
      if (type === missingType) return null;
      return ALL_ESSENTIAL_SCHEMA_IDS[type] || null;
    });

    // Action & Assert
    let caughtError;
    try {
      await env.modsLoader.loadWorld('testWorld');
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(ModsLoaderError);
    const expectedFinalMessage = `ModsLoader: CRITICAL failure during essential schema check. Original error: ${expectedMissingSchemaErrorMsg}`;
    expect(caughtError.message).toBe(expectedFinalMessage);
    expect(caughtError.cause).toBeInstanceOf(MissingSchemaError);
    expect(caughtError.cause.message).toBe(expectedMissingSchemaErrorMsg);
    expect(caughtError.cause.schemaId).toBeNull();
    expect(caughtError.cause.contentType).toBe(missingType);


    // Assert Logs
    expect(env.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expectedFinalMessage,
      caughtError.cause
    );
  });

  test('should throw ModsLoaderError if an essential schema is configured but not loaded (isSchemaLoaded returns false)', async () => {
    // Arrange
    const notLoadedType = 'actions';
    const notLoadedSchemaId = ALL_ESSENTIAL_SCHEMA_IDS[notLoadedType];
    const expectedMissingSchemaErrorMsg = `Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;

    env.mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      if (schemaId === notLoadedSchemaId) return false;
      return true;
    });

    // Action & Assert
    let caughtError;
    try {
      await env.modsLoader.loadWorld('testWorld');
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(ModsLoaderError);
    const expectedFinalMessage = `ModsLoader: CRITICAL failure during essential schema check. Original error: ${expectedMissingSchemaErrorMsg}`;
    expect(caughtError.message).toBe(expectedFinalMessage);
    expect(caughtError.cause).toBeInstanceOf(MissingSchemaError);
    expect(caughtError.cause.message).toBe(expectedMissingSchemaErrorMsg);
    expect(caughtError.cause.schemaId).toBe(notLoadedSchemaId);
    expect(caughtError.cause.contentType).toBe(notLoadedType);


    // Assert Logs
    expect(env.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expectedFinalMessage,
      caughtError.cause
    );
  });

  test('should correctly identify the type key in log when a schema ID is not configured', async () => {
    // Arrange
    const unconfiguredType = 'entityDefinitions';
    // This is the raw message from the MissingSchemaError
    const expectedOriginalErrorMessage = `Essential schema type '${unconfiguredType}' is not configured (no schema ID found).`;

    env.mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => {
      if (type === unconfiguredType) return undefined; // Simulate not configured
      return ALL_ESSENTIAL_SCHEMA_IDS[type] || null;
    });

    // Action & Assert
    let caughtError;
    try {
      await env.modsLoader.loadWorld('testWorld');
    } catch (e) {
      caughtError = e;
    }

    // --- Assertions ---
    expect(caughtError).toBeInstanceOf(ModsLoaderError);
    // This is the final message from the wrapping ModsLoaderError
    const expectedCaughtErrorMessage = `ModsLoader: CRITICAL failure during essential schema check. Original error: ${expectedOriginalErrorMessage}`;
    expect(caughtError.message).toBe(expectedCaughtErrorMessage);
    expect(caughtError.code).toBe('essential_schema_failure');
    expect(caughtError.cause).toBeInstanceOf(MissingSchemaError);
    expect(caughtError.cause.contentType).toBe(unconfiguredType);

    // Verify logging
    expect(env.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expectedCaughtErrorMessage,
      caughtError.cause
    );
  });
});