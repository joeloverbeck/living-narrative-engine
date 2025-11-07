/**
 * @file Schema Loader Diagnostic Test
 * @description Diagnoses why AJV loadSchema cannot resolve json-logic.schema.json reference
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

describe('Schema Loader Diagnostic', () => {
  it('should diagnose json-logic.schema.json resolution issue', async () => {
    const ajv = new Ajv({
      allErrors: true,
      strictTypes: false,
      strict: false,
      validateFormats: false,
      allowUnionTypes: true,
      verbose: true,
      loadSchema: async (uri) => {
        console.log(`\n🔍 loadSchema called with URI: ${uri}`);

        // Handle relative schema references
        if (uri.startsWith('./') || uri.startsWith('../')) {
          let normalizedReference = uri;
          while (normalizedReference.startsWith('./')) {
            normalizedReference = normalizedReference.slice(2);
          }
          while (normalizedReference.startsWith('../')) {
            normalizedReference = normalizedReference.slice(3);
          }

          console.log(`   Normalized to: ${normalizedReference}`);

          const absoluteSchemaId = `schema://living-narrative-engine/${normalizedReference}`;
          console.log(`   Absolute ID: ${absoluteSchemaId}`);

          // Try to find in loaded schemas
          const loadedIds = Object.keys(ajv.schemas || {});
          console.log(`   Loaded schemas count: ${loadedIds.length}`);

          const matchingId = loadedIds.find((id) => id === absoluteSchemaId);
          console.log(`   Direct match found: ${!!matchingId}`);

          if (matchingId) {
            const schema = ajv.getSchema(matchingId);
            console.log(`   Schema retrieved: ${!!schema}`);
            if (schema) {
              return schema.schema;
            }
          }

          // Try loading from file system
          const schemaPath = join(
            currentDirPath,
            `../../../data/schemas/${normalizedReference}`
          );
          console.log(`   Trying file path: ${schemaPath}`);

          try {
            const schemaContent = readFileSync(schemaPath, 'utf-8');
            const parsedSchema = JSON.parse(schemaContent);
            console.log(`   ✅ Loaded from file: ${parsedSchema.$id}`);
            return parsedSchema;
          } catch (error) {
            console.log(`   ❌ File load failed: ${error.message}`);
            throw new Error(
              `Cannot resolve schema reference: ${uri} (tried ${schemaPath})`
            );
          }
        }

        throw new Error(`Cannot resolve schema reference: ${uri}`);
      },
    });
    addFormats(ajv);

    // Step 1: Load common.schema.json
    console.log('\n📦 Step 1: Loading common.schema.json');
    const commonPath = join(
      currentDirPath,
      '../../../data/schemas/common.schema.json'
    );
    const commonContent = readFileSync(commonPath, 'utf-8');
    const commonSchema = JSON.parse(commonContent);
    ajv.addSchema(commonSchema, commonSchema.$id);
    console.log(`   Added: ${commonSchema.$id}`);

    // Step 2: Load json-logic.schema.json
    console.log('\n📦 Step 2: Loading json-logic.schema.json');
    const jsonLogicPath = join(
      currentDirPath,
      '../../../data/schemas/json-logic.schema.json'
    );
    const jsonLogicContent = readFileSync(jsonLogicPath, 'utf-8');
    const jsonLogicSchema = JSON.parse(jsonLogicContent);
    ajv.addSchema(jsonLogicSchema, jsonLogicSchema.$id);
    console.log(`   Added: ${jsonLogicSchema.$id}`);

    // Step 3: Load condition-container.schema.json (references json-logic and common)
    console.log('\n📦 Step 3: Loading condition-container.schema.json');
    const conditionPath = join(
      currentDirPath,
      '../../../data/schemas/condition-container.schema.json'
    );
    const conditionContent = readFileSync(conditionPath, 'utf-8');
    const conditionSchema = JSON.parse(conditionContent);
    ajv.addSchema(conditionSchema, conditionSchema.$id);
    console.log(`   Added: ${conditionSchema.$id}`);

    // Step 4: Try to compile condition-container.schema.json
    console.log('\n🔨 Step 4: Attempting to compile condition-container.schema.json');
    let conditionValidator;
    let compilationError = null;

    try {
      conditionValidator = ajv.getSchema(conditionSchema.$id);
      console.log(`   ✅ Compilation successful`);
    } catch (error) {
      compilationError = error;
      console.log(`   ❌ Compilation failed: ${error.message}`);
    }

    // Step 5: Load base-operation.schema.json (references condition-container)
    console.log('\n📦 Step 5: Loading base-operation.schema.json');
    const basePath = join(
      currentDirPath,
      '../../../data/schemas/base-operation.schema.json'
    );
    const baseContent = readFileSync(basePath, 'utf-8');
    const baseSchema = JSON.parse(baseContent);
    ajv.addSchema(baseSchema, baseSchema.$id);
    console.log(`   Added: ${baseSchema.$id}`);

    // Step 6: Try to compile base-operation.schema.json
    console.log('\n🔨 Step 6: Attempting to compile base-operation.schema.json');
    let baseValidator;

    try {
      baseValidator = ajv.getSchema(baseSchema.$id);
      console.log(`   ✅ Compilation successful`);
    } catch (error) {
      console.log(`   ❌ Compilation failed: ${error.message}`);
    }

    // Step 7: Load drinkFrom.schema.json (references base-operation)
    console.log('\n📦 Step 7: Loading drinkFrom.schema.json');
    const drinkFromPath = join(
      currentDirPath,
      '../../../data/schemas/operations/drinkFrom.schema.json'
    );
    const drinkFromContent = readFileSync(drinkFromPath, 'utf-8');
    const drinkFromSchema = JSON.parse(drinkFromContent);
    ajv.addSchema(drinkFromSchema, drinkFromSchema.$id);
    console.log(`   Added: ${drinkFromSchema.$id}`);

    // Step 8: Try to compile drinkFrom.schema.json
    console.log('\n🔨 Step 8: Attempting to compile drinkFrom.schema.json');
    let drinkFromValidator;

    try {
      drinkFromValidator = ajv.getSchema(drinkFromSchema.$id);
      console.log(`   ✅ Compilation successful`);
    } catch (error) {
      console.log(`   ❌ Compilation failed: ${error.message}`);
    }

    // Report final status
    console.log('\n📊 Final Status:');
    console.log(`   json-logic compiled: ${!!ajv.getSchema(jsonLogicSchema.$id)}`);
    console.log(`   condition-container compiled: ${!!conditionValidator}`);
    console.log(`   base-operation compiled: ${!!baseValidator}`);
    console.log(`   drinkFrom compiled: ${!!drinkFromValidator}`);

    expect(drinkFromValidator).toBeDefined();
  });
});
