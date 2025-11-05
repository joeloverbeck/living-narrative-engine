/**
 * @file Integration test for mod-manifest schema validation with lookups property.
 * Reproduces issue where music mod manifest with lookups fails validation.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';

describe('Mod Manifest Schema - Lookups Support', () => {
  let schemaValidator;
  let config;
  let logger;

  beforeAll(async () => {
    config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    logger = new ConsoleLogger('ERROR');
    schemaValidator = new AjvSchemaValidator({ logger });

    const fetcher = {
      async fetch(path) {
        const data = await readFile(path, { encoding: 'utf-8' });
        return JSON.parse(data);
      },
    };

    const schemaLoader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      schemaValidator,
      logger
    );

    // Load all schemas
    await schemaLoader.loadAndCompileAllSchemas();
  });

  it('should accept manifest with lookups array in content section', () => {
    // Arrange
    const manifest = {
      id: 'test-mod',
      version: '1.0.0',
      name: 'Test Mod',
      description: 'Test mod with lookups',
      dependencies: [{ id: 'core', version: '^1.0.0' }],
      content: {
        components: ['test.component.json'],
        lookups: ['test_lookup.lookup.json'],
      },
    };

    // Act
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/mod-manifest.schema.json',
      manifest
    );

    // Assert
    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      console.error('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
  });

  it('should accept music mod manifest with mood_lexicon lookup', () => {
    // Arrange - Simplified version of actual music mod manifest
    const musicManifest = {
      id: 'music',
      version: '1.0.0',
      name: 'Music Performance System',
      description: 'Musical performance capabilities with instruments and emotional moods',
      dependencies: [
        { id: 'positioning', version: '^1.0.0' },
        { id: 'core', version: '^1.0.0' },
      ],
      content: {
        components: [
          'is_instrument.component.json',
          'is_musician.component.json',
          'performance_mood.component.json',
          'playing_music.component.json',
        ],
        actions: ['set_cheerful_mood_on_instrument.action.json'],
        rules: ['handle_set_cheerful_mood.rule.json'],
        conditions: ['event-is-action-set-cheerful-mood.condition.json'],
        scopes: [],
        lookups: ['mood_lexicon.lookup.json'],
      },
    };

    // Act
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/mod-manifest.schema.json',
      musicManifest
    );

    // Assert
    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      console.error('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
  });

  it('should reject lookups with invalid file extensions', () => {
    // Arrange
    const manifest = {
      id: 'test-mod',
      version: '1.0.0',
      name: 'Test Mod',
      content: {
        lookups: ['invalid.txt'], // Should be .json
      },
    };

    // Act
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/mod-manifest.schema.json',
      manifest
    );

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject lookups with absolute paths', () => {
    // Arrange
    const manifest = {
      id: 'test-mod',
      version: '1.0.0',
      name: 'Test Mod',
      content: {
        lookups: ['/absolute/path/lookup.lookup.json'],
      },
    };

    // Act
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/mod-manifest.schema.json',
      manifest
    );

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject lookups with parent directory references', () => {
    // Arrange
    const manifest = {
      id: 'test-mod',
      version: '1.0.0',
      name: 'Test Mod',
      content: {
        lookups: ['../parent/lookup.lookup.json'],
      },
    };

    // Act
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/mod-manifest.schema.json',
      manifest
    );

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should accept empty lookups array', () => {
    // Arrange
    const manifest = {
      id: 'test-mod',
      version: '1.0.0',
      name: 'Test Mod',
      content: {
        lookups: [],
      },
    };

    // Act
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/mod-manifest.schema.json',
      manifest
    );

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should accept manifest without lookups property', () => {
    // Arrange
    const manifest = {
      id: 'test-mod',
      version: '1.0.0',
      name: 'Test Mod',
      content: {
        components: ['test.component.json'],
      },
    };

    // Act
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/mod-manifest.schema.json',
      manifest
    );

    // Assert
    expect(result.isValid).toBe(true);
  });
});
