/**
 * @file Integration test to verify movement components load correctly after fix
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('Movement Components - Fixed validation', () => {
  let validator;
  let mockLogger;
  let componentSchema;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(ajvInstance);

    validator = new AjvSchemaValidator({
      logger: mockLogger,
      ajvInstance: ajvInstance,
      preloadSchemas: [],
    });

    // Load the actual component schema and common schema (for $ref resolution)
    const componentSchemaPath = join(
      process.cwd(),
      'data',
      'schemas',
      'component.schema.json'
    );
    componentSchema = JSON.parse(readFileSync(componentSchemaPath, 'utf8'));

    const commonSchemaPath = join(
      process.cwd(),
      'data',
      'schemas',
      'common.schema.json'
    );
    const commonSchema = JSON.parse(readFileSync(commonSchemaPath, 'utf8'));

    // Register schemas using the correct method (addSchema is called internally)
    validator.preloadSchemas([
      {
        id: commonSchema.$id,
        schema: commonSchema,
      },
      {
        id: componentSchema.$id,
        schema: componentSchema,
      },
    ]);
  });

  describe('Fixed movement components', () => {
    it('should validate exits.component.json without metadata field', () => {
      // Load the actual fixed file
      const componentPath = join(
        process.cwd(),
        'data',
        'mods',
        'movement',
        'components',
        'exits.component.json'
      );
      const componentData = JSON.parse(readFileSync(componentPath, 'utf8'));

      // Validate against schema
      const result = validator.validate(componentSchema.$id, componentData);

      // Log errors if validation fails (for debugging)
      if (!result.isValid) {
        console.log(
          'Validation errors for exits.component.json:',
          result.errors
        );
      }

      expect(result.isValid).toBe(true);
      expect(result.errors || []).toEqual([]);
      expect(componentData.metadata).toBeUndefined();
      expect(componentData.id).toBe('movement:exits');
    });

    it('should validate movement.component.json without metadata field', () => {
      // Load the actual fixed file
      const componentPath = join(
        process.cwd(),
        'data',
        'mods',
        'movement',
        'components',
        'movement.component.json'
      );
      const componentData = JSON.parse(readFileSync(componentPath, 'utf8'));

      // Validate against schema
      const result = validator.validate(componentSchema.$id, componentData);

      expect(result.isValid).toBe(true);
      expect(result.errors || []).toEqual([]);
      expect(componentData.metadata).toBeUndefined();
      expect(componentData.id).toBe('movement:movement');
    });
  });

  describe('Fixed goals component', () => {
    it('should have correct namespace core:goals', () => {
      // Load the actual fixed file
      const componentPath = join(
        process.cwd(),
        'data',
        'mods',
        'core',
        'components',
        'goals.component.json'
      );
      const componentData = JSON.parse(readFileSync(componentPath, 'utf8'));

      // Validate correct namespace
      expect(componentData.id).toBe('core:goals');

      // Validate against schema
      const result = validator.validate(componentSchema.$id, componentData);
      expect(result.isValid).toBe(true);
      expect(result.errors || []).toEqual([]);
    });
  });

  // Test case 'should reference core:goals not movement:goals in isekai sidekick' removed as the mod has been deleted.

});
