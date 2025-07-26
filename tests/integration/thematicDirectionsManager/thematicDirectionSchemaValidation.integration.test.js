/**
 * @file Integration tests for Thematic Direction Schema Validation Fix
 * @description Tests that verify the schema validation fix for thematic directions
 * Focuses on testing that the correct schema ID is used for validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import path from 'path';
import fs from 'fs';

describe('Thematic Direction Schema Validation Fix Integration Tests', () => {
  let schemaValidator;
  let logger;

  // Valid test thematic direction based on actual schema
  const validThematicDirection = {
    id: '12345678-1234-1234-1234-123456789abc',
    conceptId: '87654321-4321-4321-4321-abcdef123456',
    title: 'Test Direction Title',
    description:
      'This is a valid test description that meets the minimum length requirement for thematic directions.',
    coreTension: 'This represents a valid core tension description.',
    uniqueTwist: 'This is a unique twist that meets length requirements.',
    narrativePotential:
      'This describes the narrative potential in sufficient detail.',
    createdAt: new Date().toISOString(),
    llmMetadata: {
      modelId: 'test-model',
      promptTokens: 100,
      responseTokens: 200,
      processingTime: 1000,
    },
  };

  beforeEach(async () => {
    // Create logger with reduced noise for tests
    logger = new ConsoleLogger('error');

    // Create schema validator using the same pattern as production
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load the actual thematic-direction schema from file system
    const schemaPath = path.resolve(
      'data/schemas/thematic-direction.schema.json'
    );
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    // Add schema with full URI (as SchemaLoader does in production)
    await schemaValidator.addSchema(schema, schema.$id);
  });

  describe('Schema Loading Verification', () => {
    it('should have thematic-direction schema loaded with full URI', () => {
      const fullSchemaId =
        'schema://living-narrative-engine/thematic-direction.schema.json';
      expect(schemaValidator.isSchemaLoaded(fullSchemaId)).toBe(true);
    });

    it('should validate thematic direction using full schema URI', () => {
      const fullSchemaId =
        'schema://living-narrative-engine/thematic-direction.schema.json';
      const isValid = schemaValidator.validateAgainstSchema(
        validThematicDirection,
        fullSchemaId
      );
      expect(isValid).toBe(true);
    });

    it('should reject invalid thematic direction using full schema URI', () => {
      const fullSchemaId =
        'schema://living-narrative-engine/thematic-direction.schema.json';
      const invalidDirection = { ...validThematicDirection };
      delete invalidDirection.title; // Remove required field

      const isValid = schemaValidator.validateAgainstSchema(
        invalidDirection,
        fullSchemaId
      );
      expect(isValid).toBe(false);
    });
  });

  describe('Direct Schema Validation Tests', () => {
    it('should validate multiple thematic directions correctly', () => {
      const fullSchemaId =
        'schema://living-narrative-engine/thematic-direction.schema.json';

      const directions = [
        validThematicDirection,
        {
          ...validThematicDirection,
          id: '87654321-4321-4321-4321-123456789def',
          title: 'Another Valid Direction',
        },
      ];

      // Both should validate successfully
      directions.forEach((direction) => {
        const isValid = schemaValidator.validateAgainstSchema(
          direction,
          fullSchemaId
        );
        expect(isValid).toBe(true);
      });
    });

    it('should provide meaningful error messages for validation failures', () => {
      const fullSchemaId =
        'schema://living-narrative-engine/thematic-direction.schema.json';

      // Create invalid direction missing required field
      const invalidDirection = { ...validThematicDirection };
      delete invalidDirection.description; // Remove required field

      const isValid = schemaValidator.validateAgainstSchema(
        invalidDirection,
        fullSchemaId
      );
      expect(isValid).toBe(false);

      // Should have formatted error messages available
      const errorMsg = schemaValidator.formatAjvErrors();
      expect(errorMsg).toBeTruthy();
      expect(errorMsg.length).toBeGreaterThan(10);
    });
  });

  describe('Regression Prevention', () => {
    it('should use correct schema ID format consistently', () => {
      // Verify we are using the full schema URI, not the short name
      const fullSchemaId =
        'schema://living-narrative-engine/thematic-direction.schema.json';
      const shortSchemaId = 'thematic-direction';

      // Full URI should work
      expect(schemaValidator.isSchemaLoaded(fullSchemaId)).toBe(true);

      // Short name should not work (unless explicitly added)
      expect(schemaValidator.isSchemaLoaded(shortSchemaId)).toBe(false);
    });

    it('should validate using full schema URI prevents the original error', () => {
      // This test verifies that using the full URI prevents the
      // "Schema 'thematic-direction' not loaded" error
      const fullSchemaId =
        'schema://living-narrative-engine/thematic-direction.schema.json';

      // Validation should work with the full URI
      const isValid = schemaValidator.validateAgainstSchema(
        validThematicDirection,
        fullSchemaId
      );
      expect(isValid).toBe(true);

      // This should NOT throw the "Schema not loaded" error like it did before the fix
      expect(() => {
        schemaValidator.validateAgainstSchema(
          validThematicDirection,
          fullSchemaId
        );
      }).not.toThrow(/Schema.*not loaded/);
    });
  });
});
