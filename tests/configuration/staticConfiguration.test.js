/**
 * @file Test suite to ensure the application's static configuration is valid.
 * @description This test directly instantiates and validates the StaticConfiguration
 * class to ensure all essential schema IDs and schema files are correctly defined.
 * This prevents runtime errors caused by configuration mismatches after refactoring.
 * @see tests/validation/configuration.validation.test.js
 */

import { describe, it, expect } from '@jest/globals';
// Import the class we want to test directly.
// You will need to adjust this path to point to your StaticConfiguration file.
import StaticConfiguration from '../../src/configuration/staticConfiguration.js';

describe('StaticConfiguration Validation Test', () => {
  it('should provide valid schema IDs for all essential content types', () => {
    // 1. Arrange: Directly instantiate the configuration service.
    const configService = new StaticConfiguration();

    // 2. Act: Define the list of essential types the application depends on.
    const essentialTypes = [
      'game',
      'components',
      'mod-manifest',
      'actions',
      'events',
      'rules',
      'conditions',
      'entityDefinitions', // The schema that was missing
      'entityInstances', // The schema that was missing
      'llm-configs',
    ];

    // 3. Assert: Check that each essential type returns a valid schema ID.
    for (const typeName of essentialTypes) {
      const schemaId = configService.getContentTypeSchemaId(typeName);

      // Assert that a schema ID is configured for the type
      // CORRECTED: Replaced .withContext(...).not.toBeUndefined() with .toBeDefined() for Jest compatibility.
      expect(schemaId).toBeDefined();

      // Assert that the ID is a non-empty string
      // CORRECTED: Removed .withContext()
      expect(typeof schemaId).toBe('string');
      expect(schemaId.length).toBeGreaterThan(0);

      // Assert that it's a valid-looking URI
      // CORRECTED: Removed .withContext()
      expect(schemaId).toMatch(/^https?:\/\//);

      // Optional: Log on success for visibility during test runs
      console.log(`[OK] Essential type '${typeName}' is configured with schema ID: ${schemaId}`);
    }
  });

  it('should include new entity schemas and exclude the old one from the file list', () => {
    // 1. Arrange
    const configService = new StaticConfiguration();

    // 2. Act
    const schemaFiles = configService.getSchemaFiles();

    // 3. Assert
    expect(Array.isArray(schemaFiles)).toBe(true);
    expect(schemaFiles.length).toBeGreaterThan(10); // Sanity check

    // Ensure the new schemas are in the file list
    expect(schemaFiles).toContain('entity-definition.schema.json');
    expect(schemaFiles).toContain('entity-instance.schema.json');

    // Ensure the old, obsolete schema is gone
    expect(schemaFiles).not.toContain('entity.schema.json');
  });
});