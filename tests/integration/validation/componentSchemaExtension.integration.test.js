/**
 * @file Integration tests for component schema extension with validationRules
 * @description Tests backward compatibility and real-world usage of validationRules
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

/**
 * Create a recording logger for tests
 *
 * @returns {object} Logger with recorded messages
 */
function createRecordingLogger() {
  const logs = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const record = (level, message, ...rest) => {
    const parts = [message, ...rest].map((item) => {
      if (item instanceof Error) {
        return item.message;
      }
      if (typeof item === 'string') {
        return item;
      }
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    });
    logs[level].push(parts.join(' '));
  };

  return {
    logs,
    debug: (...args) => record('debug', ...args),
    info: (...args) => record('info', ...args),
    warn: (...args) => record('warn', ...args),
    error: (...args) => record('error', ...args),
  };
}

/**
 * Load a schema from the schemas directory
 *
 * @param {string} relativePath - Relative path to schema file
 * @returns {Promise<object>} Parsed schema
 */
async function loadSchema(relativePath) {
  const filePath = path.join('data', 'schemas', relativePath);
  const fileContents = await readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
}

/**
 * Load a component schema from a file path
 *
 * @param {string} filePath - Full path to component schema file
 * @returns {Promise<object>} Parsed component schema
 */
async function loadComponentSchema(filePath) {
  const fileContents = await readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
}

describe('Component Schema Extension - Integration Tests', () => {
  let logger;
  let validator;

  beforeEach(async () => {
    logger = createRecordingLogger();
    validator = new AjvSchemaValidator({ logger });

    // Load component schema with validationRules support
    const componentSchema = await loadSchema('component.schema.json');
    await validator.addSchema(
      componentSchema,
      'schema://living-narrative-engine/component.schema.json'
    );

    // Load common schema for references
    const commonSchema = await loadSchema('common.schema.json');
    await validator.addSchema(
      commonSchema,
      commonSchema.$id || 'schema://living-narrative-engine/common.schema.json'
    );
  });

  describe('Backward Compatibility', () => {
    it('should validate all existing component schemas without validationRules', async () => {
      // Find all component schema files
      const componentFiles = await glob(
        'data/mods/**/components/*.component.json'
      );

      // Should have many component files
      expect(componentFiles.length).toBeGreaterThan(0);

      const failedComponents = [];

      for (const filePath of componentFiles) {
        try {
          const component = await loadComponentSchema(filePath);

          // Validate against component schema
          const result = validator.validate(
            'schema://living-narrative-engine/component.schema.json',
            component
          );

          if (!result.isValid) {
            failedComponents.push({
              file: path.basename(filePath),
              errors: result.errors,
            });
          }
        } catch (error) {
          failedComponents.push({
            file: path.basename(filePath),
            errors: [{ message: error.message }],
          });
        }
      }

      // Report any failures
      if (failedComponents.length > 0) {
        const errorReport = failedComponents
          .map(
            (fc) =>
              `${fc.file}: ${fc.errors.map((e) => e.message || e.schemaPath).join(', ')}`
          )
          .join('\n');
        throw new Error(
          `${failedComponents.length} components failed validation:\n${errorReport}`
        );
      }

      expect(failedComponents).toHaveLength(0);
    });

    it('should not require validationRules property in component schemas', async () => {
      const componentWithoutRules = {
        id: 'test:simple-component',
        description: 'Simple component without validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithoutRules
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should still validate required fields (id, description, dataSchema)', async () => {
      const componentMissingRequired = {
        id: 'test:incomplete',
        // Missing description
        dataSchema: {
          type: 'object',
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentMissingRequired
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.message?.includes('description'))
      ).toBe(true);
    });
  });

  describe('Example Schema with validationRules', () => {
    it('should validate the texture-with-validation example component', async () => {
      const exampleFilePath =
        'data/mods/descriptors/components/texture-with-validation.component.json';

      let exampleComponent;
      try {
        exampleComponent = await loadComponentSchema(exampleFilePath);
      } catch (error) {
        throw new Error(`Could not load example component: ${error.message}`);
      }

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        exampleComponent
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should have validationRules with expected structure in example', async () => {
      const exampleFilePath =
        'data/mods/descriptors/components/texture-with-validation.component.json';

      const exampleComponent = await loadComponentSchema(exampleFilePath);

      expect(exampleComponent.validationRules).toBeDefined();
      expect(exampleComponent.validationRules.generateValidator).toBe(true);
      expect(exampleComponent.validationRules.errorMessages).toBeDefined();
      expect(exampleComponent.validationRules.suggestions).toBeDefined();
    });
  });

  describe('Schema Loader Integration', () => {
    it('should handle component schemas with validationRules via schema loader', async () => {
      // Create a valid JSON Schema (not a component definition)
      // This represents what would be in a component's dataSchema
      const schemaWithRules = {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
        // Note: validationRules is custom metadata, not standard JSON Schema
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid status: {{value}}',
          },
        },
      };

      // Add schema using addSchema method
      const schemaId = 'test://schema-with-rules';
      await validator.addSchema(schemaWithRules, schemaId);

      // Verify schema is loaded
      expect(validator.isSchemaLoaded(schemaId)).toBe(true);

      // Get validator for the schema
      const schemaValidator = validator.getValidator(schemaId);
      expect(schemaValidator).toBeDefined();
    });
  });

  describe('Error Reporting', () => {
    it('should provide clear error messages for invalid validationRules', async () => {
      const componentWithInvalidRules = {
        id: 'test:invalid-rules',
        description: 'Component with invalid validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          unknownProperty: 'not-allowed',
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithInvalidRules
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Check that error message mentions the invalid property
      const errorMessages = result.errors
        .map((e) => e.message || e.schemaPath)
        .join(' ');
      expect(errorMessages).toContain('additional properties');
    });

    it('should provide clear error messages for invalid errorMessages structure', async () => {
      const componentWithInvalidErrorMessages = {
        id: 'test:invalid-errors',
        description: 'Component with invalid error messages',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          errorMessages: {
            invalidEnum: 123, // Should be string
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithInvalidErrorMessages
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide clear error messages for invalid suggestions configuration', async () => {
      const componentWithInvalidSuggestions = {
        id: 'test:invalid-suggestions',
        description: 'Component with invalid suggestions',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          suggestions: {
            maxDistance: 'five', // Should be integer
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithInvalidSuggestions
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should support component with generateValidator only', async () => {
      const component = {
        id: 'test:minimal-rules',
        description: 'Component with minimal validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
          },
        },
        validationRules: {
          generateValidator: true,
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        component
      );

      expect(result.isValid).toBe(true);
    });

    it('should support component with custom error messages only', async () => {
      const component = {
        id: 'test:custom-errors',
        description: 'Component with custom error messages',
        dataSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['read', 'write', 'execute'] },
          },
        },
        validationRules: {
          errorMessages: {
            invalidEnum: 'Invalid mode {{value}}. Choose: {{validValues}}',
            missingRequired: 'The {{field}} field is required',
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        component
      );

      expect(result.isValid).toBe(true);
    });

    it('should support component with suggestions configuration only', async () => {
      const component = {
        id: 'test:suggestions-only',
        description: 'Component with suggestions configuration',
        dataSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['alpha', 'beta', 'gamma'] },
          },
        },
        validationRules: {
          suggestions: {
            enableSimilarity: true,
            maxDistance: 2,
            maxSuggestions: 5,
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        component
      );

      expect(result.isValid).toBe(true);
    });

    it('should support component with all validationRules properties', async () => {
      const component = {
        id: 'test:complete-rules',
        description: 'Component with complete validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid priority: {{value}}',
            missingRequired: 'Priority is required',
            invalidType: 'Priority must be a string',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 2,
            maxSuggestions: 3,
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        component
      );

      expect(result.isValid).toBe(true);
    });
  });
});
