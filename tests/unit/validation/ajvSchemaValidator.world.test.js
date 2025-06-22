/**
 * @file Focused test for AjvSchemaValidator to diagnose world schema validation issues.
 * @description Tests the specific issue where world schema validation fails with
 * "must NOT have additional properties" error.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import fs from 'fs';
import path from 'path';

describe('AjvSchemaValidator World Schema Tests', () => {
  let schemaValidator;
  let logger;

  beforeEach(() => {
    logger = new ConsoleLogger();
    schemaValidator = new AjvSchemaValidator(logger);
  });

  describe('World Schema Validation', () => {
    it('should load and validate world schema correctly', async () => {
      // Arrange - Load schemas manually
      const schemasDir = path.join(process.cwd(), 'data', 'schemas');

      // Load schemas in dependency order
      const commonSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'common.schema.json'), 'utf8')
      );
      const entityInstanceSchema = JSON.parse(
        fs.readFileSync(
          path.join(schemasDir, 'entity-instance.schema.json'),
          'utf8'
        )
      );
      const worldSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'world.schema.json'), 'utf8')
      );

      // Add schemas to validator
      await schemaValidator.addSchema(commonSchema, commonSchema.$id);
      await schemaValidator.addSchema(
        entityInstanceSchema,
        entityInstanceSchema.$id
      );
      await schemaValidator.addSchema(worldSchema, worldSchema.$id);

      // Act - Test with valid world data
      const validWorldData = {
        id: 'test:world',
        name: 'Test World',
        description: 'A test world',
        instances: [
          {
            instanceId: 'test:instance1',
            definitionId: 'test:definition1',
          },
          {
            instanceId: 'test:instance2',
            definitionId: 'test:definition2',
          },
        ],
      };

      const result = schemaValidator.validate(worldSchema.$id, validWorldData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate the actual isekai world file', async () => {
      // Arrange - Load schemas manually
      const schemasDir = path.join(process.cwd(), 'data', 'schemas');

      // Load schemas in dependency order
      const commonSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'common.schema.json'), 'utf8')
      );
      const entityInstanceSchema = JSON.parse(
        fs.readFileSync(
          path.join(schemasDir, 'entity-instance.schema.json'),
          'utf8'
        )
      );
      const worldSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'world.schema.json'), 'utf8')
      );

      // Add schemas to validator
      await schemaValidator.addSchema(commonSchema, commonSchema.$id);
      await schemaValidator.addSchema(
        entityInstanceSchema,
        entityInstanceSchema.$id
      );
      await schemaValidator.addSchema(worldSchema, worldSchema.$id);

      // Load the actual isekai world file
      const isekaiWorldPath = path.join(
        process.cwd(),
        'data',
        'mods',
        'isekai',
        'worlds',
        'isekai.world.json'
      );
      const isekaiWorldData = JSON.parse(
        fs.readFileSync(isekaiWorldPath, 'utf8')
      );

      // Act
      const result = schemaValidator.validate(worldSchema.$id, isekaiWorldData);

      // Debug: Log the validation result
      if (!result.isValid) {
        console.log('Isekai world validation failed:');
        console.log(
          'Isekai world data:',
          JSON.stringify(isekaiWorldData, null, 2)
        );
        console.log(
          'Validation errors:',
          JSON.stringify(result.errors, null, 2)
        );
      }

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should provide detailed error information for invalid world files', async () => {
      // Arrange - Load schemas manually
      const schemasDir = path.join(process.cwd(), 'data', 'schemas');

      const commonSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'common.schema.json'), 'utf8')
      );
      const entityInstanceSchema = JSON.parse(
        fs.readFileSync(
          path.join(schemasDir, 'entity-instance.schema.json'),
          'utf8'
        )
      );
      const worldSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'world.schema.json'), 'utf8')
      );

      await schemaValidator.addSchema(commonSchema, commonSchema.$id);
      await schemaValidator.addSchema(
        entityInstanceSchema,
        entityInstanceSchema.$id
      );
      await schemaValidator.addSchema(worldSchema, worldSchema.$id);

      // Test with invalid world data (missing required fields)
      const invalidWorldData = {
        id: 'test:world',
        name: 'Test World',
        // Missing required 'instances' array
        description: 'A test world',
      };

      // Act
      const result = schemaValidator.validate(
        worldSchema.$id,
        invalidWorldData
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);

      // Log the errors for debugging
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));

      // Check that the error is about missing 'instances'
      const errorMessages = result.errors.map((e) => e.message).join(' ');
      expect(errorMessages).toContain('instances');
    });

    it('should validate entity instances correctly', async () => {
      // Arrange - Load schemas manually
      const schemasDir = path.join(process.cwd(), 'data', 'schemas');

      const commonSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'common.schema.json'), 'utf8')
      );
      const entityInstanceSchema = JSON.parse(
        fs.readFileSync(
          path.join(schemasDir, 'entity-instance.schema.json'),
          'utf8'
        )
      );

      await schemaValidator.addSchema(commonSchema, commonSchema.$id);
      await schemaValidator.addSchema(
        entityInstanceSchema,
        entityInstanceSchema.$id
      );

      // Test with valid instance
      const validInstance = {
        instanceId: 'test:instance',
        definitionId: 'test:definition',
      };

      // Test with invalid instance (extra property)
      const invalidInstance = {
        instanceId: 'test:instance',
        definitionId: 'test:definition',
        extraProperty: 'should not be allowed',
      };

      // Act
      const validResult = schemaValidator.validate(
        entityInstanceSchema.$id,
        validInstance
      );
      const invalidResult = schemaValidator.validate(
        entityInstanceSchema.$id,
        invalidInstance
      );

      // Assert
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toBeNull();

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
      expect(invalidResult.errors.length).toBeGreaterThan(0);

      // Log the errors for debugging
      console.log(
        'Invalid instance errors:',
        JSON.stringify(invalidResult.errors, null, 2)
      );

      // Check that the error is about additional properties
      const errorMessages = invalidResult.errors
        .map((e) => e.message)
        .join(' ');
      expect(errorMessages).toContain('additional properties');
    });

    it('should check schema loading status', async () => {
      // Arrange - Load schemas manually
      const schemasDir = path.join(process.cwd(), 'data', 'schemas');

      const commonSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'common.schema.json'), 'utf8')
      );
      const entityInstanceSchema = JSON.parse(
        fs.readFileSync(
          path.join(schemasDir, 'entity-instance.schema.json'),
          'utf8'
        )
      );
      const worldSchema = JSON.parse(
        fs.readFileSync(path.join(schemasDir, 'world.schema.json'), 'utf8')
      );

      // Act & Assert - Check before loading
      expect(schemaValidator.isSchemaLoaded(commonSchema.$id)).toBe(false);
      expect(schemaValidator.isSchemaLoaded(entityInstanceSchema.$id)).toBe(
        false
      );
      expect(schemaValidator.isSchemaLoaded(worldSchema.$id)).toBe(false);

      // Load schemas
      await schemaValidator.addSchema(commonSchema, commonSchema.$id);
      await schemaValidator.addSchema(
        entityInstanceSchema,
        entityInstanceSchema.$id
      );
      await schemaValidator.addSchema(worldSchema, worldSchema.$id);

      // Check after loading
      expect(schemaValidator.isSchemaLoaded(commonSchema.$id)).toBe(true);
      expect(schemaValidator.isSchemaLoaded(entityInstanceSchema.$id)).toBe(
        true
      );
      expect(schemaValidator.isSchemaLoaded(worldSchema.$id)).toBe(true);
    });
  });
});
