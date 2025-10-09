/**
 * @file Integration test to verify all schemas load without reference errors
 * Ensures schema references remain valid and prevent runtime validation errors
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';

describe('Schema Loading Integrity', () => {
  let schemaLoader;
  let validator;
  let config;
  let logger;

  beforeAll(async () => {
    config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    logger = new ConsoleLogger('ERROR');
    validator = new AjvSchemaValidator({ logger });

    const fetcher = {
      async fetch(path) {
        const data = await readFile(path, { encoding: 'utf-8' });
        return JSON.parse(data);
      },
    };

    schemaLoader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      validator,
      logger
    );

    // Load all schemas
    await schemaLoader.loadAndCompileAllSchemas();
  });

  it('should load all schemas without reference errors', () => {
    const schemaFiles = config.getSchemaFiles();

    // Check that all schemas are loaded AND can be compiled (no unresolved refs)
    schemaFiles.forEach((schemaFile) => {
      const schemaId = `schema://living-narrative-engine/${schemaFile}`;
      const isLoaded = validator.isSchemaLoaded(schemaId);

      if (!isLoaded) {
        console.error(`Schema not loaded or has unresolved refs: ${schemaId}`);
        // Also check if it can validate refs to help with debugging
        const canValidateRefs = validator.validateSchemaRefs(schemaId);
        if (!canValidateRefs) {
          console.error(`Schema ${schemaId} has unresolved $refs`);
        }
      }

      expect(isLoaded).toBe(true);

      // Additionally verify the schema can actually be used for validation
      const canGetValidator = !!validator.getValidator(schemaId);
      if (!canGetValidator) {
        console.error(`Cannot get validator for schema: ${schemaId}`);
      }
      expect(canGetValidator).toBe(true);
    });
  });

  it('should specifically verify operation.schema.json has all refs resolved', () => {
    const operationSchemaId =
      'schema://living-narrative-engine/operation.schema.json';

    expect(validator.isSchemaLoaded(operationSchemaId)).toBe(true);

    // Validate that the schema can be used (will fail if refs are unresolved)
    const testOperation = {
      type: 'unequipClothing',
      params: {
        actorId: 'test-actor',
        itemId: 'test-item',
      },
    };

    const result = validator.validate(operationSchemaId, testOperation);

    // Even if validation fails due to params, it shouldn't fail due to unresolved refs
    // Unresolved refs would cause a different error
    if (!result.isValid && result.errors) {
      const hasRefError = result.errors.some(
        (err) =>
          err.message &&
          (err.message.includes("can't resolve reference") ||
            err.message.includes('unresolved'))
      );
      expect(hasRefError).toBe(false);
    }
  });

  it('should verify rule.schema.json can reference operation schemas', () => {
    const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';

    expect(validator.isSchemaLoaded(ruleSchemaId)).toBe(true);

    // Test a rule with an operation that uses unequipClothing
    const testRule = {
      id: 'test:unequip_rule',
      description: 'Test rule for unequipping',
      conditions: [],
      operations: [
        {
          type: 'unequipClothing',
          params: {
            actorId: { scope: 'actor' },
            itemId: { var: 'itemToUnequip' },
          },
        },
      ],
    };

    const result = validator.validate(ruleSchemaId, testRule);

    // Check for ref errors specifically
    if (!result.isValid && result.errors) {
      const hasRefError = result.errors.some(
        (err) =>
          err.message &&
          (err.message.includes("can't resolve reference") ||
            err.message.includes('unresolved'))
      );
      expect(hasRefError).toBe(false);
    }
  });

  it('should verify macro.schema.json can reference operation schemas', () => {
    const macroSchemaId = 'schema://living-narrative-engine/macro.schema.json';

    expect(validator.isSchemaLoaded(macroSchemaId)).toBe(true);

    // Test a macro with operations including unequipClothing
    const testMacro = {
      id: 'test:unequip_macro',
      description: 'Test macro for unequipping',
      operations: [
        {
          type: 'unequipClothing',
          params: {
            actorId: 'test-actor',
            itemId: 'test-item',
          },
        },
      ],
    };

    const result = validator.validate(macroSchemaId, testMacro);

    // Check for ref errors specifically
    if (!result.isValid && result.errors) {
      const hasRefError = result.errors.some(
        (err) =>
          err.message &&
          (err.message.includes("can't resolve reference") ||
            err.message.includes('unresolved'))
      );
      expect(hasRefError).toBe(false);
    }
  });

  it('should load unequipClothing schema specifically', () => {
    const unequipSchemaId =
      'schema://living-narrative-engine/operations/unequipClothing.schema.json';

    expect(validator.isSchemaLoaded(unequipSchemaId)).toBe(true);

    // Test the schema directly
    const validUnequipOp = {
      type: 'UNEQUIP_CLOTHING',
      parameters: {
        entity_ref: 'test-actor',
        clothing_item_id: 'test-item',
      },
    };

    const result = validator.validate(unequipSchemaId, validUnequipOp);
    expect(result.isValid).toBe(true);
  });
});
