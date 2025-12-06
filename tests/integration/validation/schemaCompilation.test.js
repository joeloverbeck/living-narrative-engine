/**
 * @file Schema Compilation Test
 * @description Verifies that all operation schemas can be successfully compiled by AJV.
 * This test specifically checks whether schemas with inline parameter validation
 * compile differently than schemas using $ref to common.schema.json.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

/**
 * Creates an AJV instance with loadSchema configured to handle relative references
 *
 * @returns {Ajv} Configured AJV instance
 */
function createTestAjv() {
  return new Ajv({
    allErrors: true,
    strictTypes: false,
    strict: false,
    validateFormats: false,
    allowUnionTypes: true,
    verbose: true,
    loadSchema: async (uri) => {
      // Handle relative schema references
      if (uri.startsWith('./') || uri.startsWith('../')) {
        let normalizedReference = uri;
        while (normalizedReference.startsWith('./')) {
          normalizedReference = normalizedReference.slice(2);
        }
        while (normalizedReference.startsWith('../')) {
          normalizedReference = normalizedReference.slice(3);
        }

        const schemaPath = join(
          currentDirPath,
          `../../../data/schemas/${normalizedReference}`
        );

        try {
          const schemaContent = readFileSync(schemaPath, 'utf-8');
          return JSON.parse(schemaContent);
        } catch (error) {
          throw new Error(
            `Cannot resolve schema reference: ${uri} (tried ${schemaPath}): ${error.message}`
          );
        }
      }

      throw new Error(`Cannot resolve schema reference: ${uri}`);
    },
  });
}

describe('Schema Compilation', () => {
  describe('Drinking Operation Schemas', () => {
    it('should load and compile drinkFrom.schema.json', async () => {
      const ajv = createTestAjv();
      addFormats(ajv);

      // Load dependencies first (json-logic must be loaded before condition-container due to circular reference)
      const dependencies = [
        'common.schema.json',
        'json-logic.schema.json',
        'condition-container.schema.json',
        'base-operation.schema.json',
      ];

      for (const dep of dependencies) {
        const schemaPath = join(currentDirPath, `../../../data/schemas/${dep}`);
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);
        ajv.addSchema(schema, schema.$id);
      }

      // Load drinkFrom schema
      const drinkFromPath = join(
        currentDirPath,
        '../../../data/schemas/operations/drinkFrom.schema.json'
      );
      const drinkFromContent = readFileSync(drinkFromPath, 'utf-8');
      const drinkFromSchema = JSON.parse(drinkFromContent);

      // Add schema
      ajv.addSchema(drinkFromSchema, drinkFromSchema.$id);

      // Try to compile
      let validator;
      let compilationError = null;

      try {
        validator = ajv.getSchema(drinkFromSchema.$id);
      } catch (error) {
        compilationError = error;
      }

      // Report results
      console.log('\n📊 drinkFrom.schema.json compilation:');
      console.log(`  Schema ID: ${drinkFromSchema.$id}`);
      console.log(`  Validator created: ${!!validator}`);
      if (compilationError) {
        console.log(`  ❌ Compilation error: ${compilationError.message}`);
      }

      expect(validator).toBeDefined();
      expect(compilationError).toBeNull();
    });

    it('should load and compile drinkEntirely.schema.json', async () => {
      const ajv = createTestAjv();
      addFormats(ajv);

      // Load dependencies (json-logic must be loaded before condition-container due to circular reference)
      const dependencies = [
        'common.schema.json',
        'json-logic.schema.json',
        'condition-container.schema.json',
        'base-operation.schema.json',
      ];

      for (const dep of dependencies) {
        const schemaPath = join(currentDirPath, `../../../data/schemas/${dep}`);
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);
        ajv.addSchema(schema, schema.$id);
      }

      // Load drinkEntirely schema
      const drinkEntirelyPath = join(
        currentDirPath,
        '../../../data/schemas/operations/drinkEntirely.schema.json'
      );
      const drinkEntirelyContent = readFileSync(drinkEntirelyPath, 'utf-8');
      const drinkEntirelySchema = JSON.parse(drinkEntirelyContent);

      // Add schema
      ajv.addSchema(drinkEntirelySchema, drinkEntirelySchema.$id);

      // Try to compile
      let validator;
      let compilationError = null;

      try {
        validator = ajv.getSchema(drinkEntirelySchema.$id);
      } catch (error) {
        compilationError = error;
      }

      // Report results
      console.log('\n📊 drinkEntirely.schema.json compilation:');
      console.log(`  Schema ID: ${drinkEntirelySchema.$id}`);
      console.log(`  Validator created: ${!!validator}`);
      if (compilationError) {
        console.log(`  ❌ Compilation error: ${compilationError.message}`);
      }

      expect(validator).toBeDefined();
      expect(compilationError).toBeNull();
    });

    it('should compare compilation of drinkFrom vs queryComponent', async () => {
      const ajv = createTestAjv();
      addFormats(ajv);

      // Load dependencies (json-logic must be loaded before condition-container due to circular reference)
      const dependencies = [
        'common.schema.json',
        'json-logic.schema.json',
        'condition-container.schema.json',
        'base-operation.schema.json',
      ];

      for (const dep of dependencies) {
        const schemaPath = join(currentDirPath, `../../../data/schemas/${dep}`);
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);
        ajv.addSchema(schema, schema.$id);
      }

      // Load both schemas
      const drinkFromPath = join(
        currentDirPath,
        '../../../data/schemas/operations/drinkFrom.schema.json'
      );
      const queryComponentPath = join(
        currentDirPath,
        '../../../data/schemas/operations/queryComponent.schema.json'
      );

      const drinkFromContent = readFileSync(drinkFromPath, 'utf-8');
      const queryComponentContent = readFileSync(queryComponentPath, 'utf-8');

      const drinkFromSchema = JSON.parse(drinkFromContent);
      const queryComponentSchema = JSON.parse(queryComponentContent);

      // Add both schemas
      ajv.addSchema(drinkFromSchema, drinkFromSchema.$id);
      ajv.addSchema(queryComponentSchema, queryComponentSchema.$id);

      // Try to compile both
      const drinkFromValidator = ajv.getSchema(drinkFromSchema.$id);
      const queryComponentValidator = ajv.getSchema(queryComponentSchema.$id);

      // Report results
      console.log('\n📊 Schema Compilation Comparison:');
      console.log(`  drinkFrom compiled: ${!!drinkFromValidator}`);
      console.log(`  queryComponent compiled: ${!!queryComponentValidator}`);

      // If one compiles and the other doesn't, we have a clear difference
      if (queryComponentValidator && !drinkFromValidator) {
        console.error('\n⚠️  CRITICAL DIFFERENCE:');
        console.error('  - queryComponent (uses $ref) compiles successfully');
        console.error('  - drinkFrom (inline validation) fails to compile');
        console.error(
          '  - This confirms the structural difference is the root cause'
        );
      } else if (drinkFromValidator && queryComponentValidator) {
        console.log('\n✅ Both schemas compile successfully');
        console.log('  - The issue is NOT related to schema compilation');
        console.log('  - The issue must be in the validation process itself');
      }

      expect(drinkFromValidator).toBeDefined();
      expect(queryComponentValidator).toBeDefined();
    });
  });

  describe('Schema Reference Resolution', () => {
    it('should verify condition-container.schema.json resolves correctly', async () => {
      const ajv = createTestAjv();
      addFormats(ajv);

      // Load all dependencies in correct order
      const commonPath = join(
        currentDirPath,
        '../../../data/schemas/common.schema.json'
      );
      const jsonLogicPath = join(
        currentDirPath,
        '../../../data/schemas/json-logic.schema.json'
      );
      const conditionContainerPath = join(
        currentDirPath,
        '../../../data/schemas/condition-container.schema.json'
      );

      const commonContent = readFileSync(commonPath, 'utf-8');
      const jsonLogicContent = readFileSync(jsonLogicPath, 'utf-8');
      const conditionContent = readFileSync(conditionContainerPath, 'utf-8');

      const commonSchema = JSON.parse(commonContent);
      const jsonLogicSchema = JSON.parse(jsonLogicContent);
      const conditionSchema = JSON.parse(conditionContent);

      ajv.addSchema(commonSchema, commonSchema.$id);
      ajv.addSchema(jsonLogicSchema, jsonLogicSchema.$id);
      ajv.addSchema(conditionSchema, conditionSchema.$id);

      const validator = ajv.getSchema(conditionSchema.$id);

      console.log('\n📊 condition-container.schema.json resolution:');
      console.log(`  Schema ID: ${conditionSchema.$id}`);
      console.log(`  Validator created: ${!!validator}`);

      expect(validator).toBeDefined();
    });

    it('should verify base-operation.schema.json reference to condition-container resolves', async () => {
      const ajv = createTestAjv();
      addFormats(ajv);

      // Load all dependencies in correct order
      const commonPath = join(
        currentDirPath,
        '../../../data/schemas/common.schema.json'
      );
      const jsonLogicPath = join(
        currentDirPath,
        '../../../data/schemas/json-logic.schema.json'
      );
      const conditionContainerPath = join(
        currentDirPath,
        '../../../data/schemas/condition-container.schema.json'
      );
      const baseOperationPath = join(
        currentDirPath,
        '../../../data/schemas/base-operation.schema.json'
      );

      const commonContent = readFileSync(commonPath, 'utf-8');
      const jsonLogicContent = readFileSync(jsonLogicPath, 'utf-8');
      const conditionContent = readFileSync(conditionContainerPath, 'utf-8');
      const baseContent = readFileSync(baseOperationPath, 'utf-8');

      const commonSchema = JSON.parse(commonContent);
      const jsonLogicSchema = JSON.parse(jsonLogicContent);
      const conditionSchema = JSON.parse(conditionContent);
      const baseSchema = JSON.parse(baseContent);

      ajv.addSchema(commonSchema, commonSchema.$id);
      ajv.addSchema(jsonLogicSchema, jsonLogicSchema.$id);
      ajv.addSchema(conditionSchema, conditionSchema.$id);
      ajv.addSchema(baseSchema, baseSchema.$id);

      const conditionValidator = ajv.getSchema(conditionSchema.$id);
      const baseValidator = ajv.getSchema(baseSchema.$id);

      console.log('\n📊 base-operation.schema.json $ref resolution:');
      console.log(`  condition-container validator: ${!!conditionValidator}`);
      console.log(`  base-operation validator: ${!!baseValidator}`);

      expect(conditionValidator).toBeDefined();
      expect(baseValidator).toBeDefined();
    });
  });
});
