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
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';

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
      'entityDefinitions', // MODIFIED to camelCase
      'entityInstances', // The schema that was missing
      'llm-configs',
      'prompt-text', // Added to ensure prompt text validation works
      'world', // Added to ensure world validation works
      'lookups', // Added to ensure lookup validation works
    ];

    // 3. Assert: Check that each essential type returns a valid schema ID.
    for (const registryKey of essentialTypes) {
      const schemaId = configService.getContentTypeSchemaId(registryKey);

      // Assert that a schema ID is configured for the type
      // CORRECTED: Replaced .withContext(...).not.toBeUndefined() with .toBeDefined() for Jest compatibility.
      expect(schemaId).toBeDefined();

      // Assert that the ID is a non-empty string
      // CORRECTED: Removed .withContext()
      expect(typeof schemaId).toBe('string');
      expect(schemaId.length).toBeGreaterThan(0);

      // Assert that it's a valid-looking URI
      // CORRECTED: Removed .withContext()
      expect(schemaId).toMatch(/^schema:\/\/living-narrative-engine\//);

      // Focused assertion for llm-configs schema ID
      if (registryKey === 'llm-configs') {
        expect(schemaId).toBe(
          'schema://living-narrative-engine/llm-configs.schema.json'
        );
      }

      // Focused assertion for prompt-text schema ID
      if (registryKey === 'prompt-text') {
        expect(schemaId).toBe(
          'schema://living-narrative-engine/prompt-text.schema.json'
        );
      }

      // Focused assertion for world schema ID
      if (registryKey === 'world') {
        expect(schemaId).toBe(
          'schema://living-narrative-engine/world.schema.json'
        );
      }

      // Optional: Log on success for visibility during test runs
      console.log(
        `[OK] Essential type '${registryKey}' is configured with schema ID: ${schemaId}`
      );
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

  it('should include prompt-text schema in the schema files list', () => {
    // 1. Arrange
    const configService = new StaticConfiguration();

    // 2. Act
    const schemaFiles = configService.getSchemaFiles();

    // 3. Assert
    expect(schemaFiles).toContain('prompt-text.schema.json');
  });

  it('should include world schema in the schema files list', () => {
    // 1. Arrange
    const configService = new StaticConfiguration();

    // 2. Act
    const schemaFiles = configService.getSchemaFiles();

    // 3. Assert
    expect(schemaFiles).toContain('world.schema.json');
  });

  it('should include lookup schema in the schema files list', () => {
    // 1. Arrange
    const configService = new StaticConfiguration();

    // 2. Act
    const schemaFiles = configService.getSchemaFiles();

    // 3. Assert
    expect(schemaFiles).toContain('lookup.schema.json');
  });

  it('should provide schema ID for lookups content type', () => {
    // 1. Arrange
    const configService = new StaticConfiguration();

    // 2. Act
    const schemaId = configService.getContentTypeSchemaId('lookups');

    // 3. Assert
    expect(schemaId).toBeDefined();
    expect(schemaId).toBe(
      'schema://living-narrative-engine/lookup.schema.json'
    );
  });

  describe('Operation Schema Files', () => {
    let configService;

    beforeEach(() => {
      configService = new StaticConfiguration();
    });

    it('should include all operation schemas that are referenced in operation.schema.json', () => {
      // These are all the operations referenced in operation.schema.json
      const expectedOperationSchemas = [
        'operations/queryComponent.schema.json',
        'operations/queryComponents.schema.json',
        'operations/modifyComponent.schema.json',
        'operations/addComponent.schema.json',
        'operations/removeComponent.schema.json',
        'operations/dispatchEvent.schema.json',
        'operations/dispatchPerceptibleEvent.schema.json',
        'operations/dispatchSpeech.schema.json',
        'operations/endTurn.schema.json',
        'operations/if.schema.json',
        'operations/forEach.schema.json',
        'operations/log.schema.json',
        'operations/setVariable.schema.json',
        'operations/getTimestamp.schema.json',
        'operations/getName.schema.json',
        'operations/resolveDirection.schema.json',
        'operations/systemMoveEntity.schema.json',
        'operations/rebuildLeaderListCache.schema.json',
        'operations/checkFollowCycle.schema.json',
        'operations/establishFollowRelation.schema.json',
        'operations/breakFollowRelation.schema.json',
        'operations/addPerceptionLogEntry.schema.json',
        'operations/hasComponent.schema.json',
        'operations/queryEntities.schema.json',
        'operations/modifyArrayField.schema.json',
        'operations/ifCoLocated.schema.json',
        'operations/math.schema.json',
        'operations/modifyContextArray.schema.json',
        'operations/autoMoveFollowers.schema.json',
        'operations/removeFromClosenessCircle.schema.json',
        'operations/mergeClosenessCircle.schema.json',
        'operations/unequipClothing.schema.json',
        'operations/lockMovement.schema.json',
        'operations/unlockMovement.schema.json', // This was missing!
      ];

      const schemaFiles = configService.getSchemaFiles();

      // Check each expected operation schema is included
      expectedOperationSchemas.forEach((operationSchema) => {
        expect(schemaFiles).toContain(operationSchema);
      });
    });
  });

  describe('Path and Filename Methods', () => {
    let configService;

    beforeEach(() => {
      configService = new StaticConfiguration();
    });

    it('should return the base data path', () => {
      const basePath = configService.getBaseDataPath();
      expect(basePath).toBe('./data');
    });

    it('should return the schema base path', () => {
      const schemaPath = configService.getSchemaBasePath();
      expect(schemaPath).toBe('schemas');
    });

    it('should return the content base path for a given registry key', () => {
      // Test with various registry keys
      expect(configService.getContentBasePath('components')).toBe('components');
      expect(configService.getContentBasePath('actions')).toBe('actions');
      expect(configService.getContentBasePath('rules')).toBe('rules');
      expect(configService.getContentBasePath('anyKey')).toBe('anyKey');
    });

    it('should return the rule base path', () => {
      const rulePath = configService.getRuleBasePath();
      expect(rulePath).toBe('rules');
    });

    it('should return the game config filename', () => {
      const filename = configService.getGameConfigFilename();
      expect(filename).toBe('game.json');
    });

    it('should return the mod manifest filename', () => {
      const filename = configService.getModManifestFilename();
      expect(filename).toBe('mod-manifest.json');
    });

    it('should return the mods base path', () => {
      const modsPath = configService.getModsBasePath();
      expect(modsPath).toBe('mods');
    });

    it('should return the rule schema ID', () => {
      const ruleSchemaId = configService.getRuleSchemaId();
      expect(ruleSchemaId).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });
  });
});
