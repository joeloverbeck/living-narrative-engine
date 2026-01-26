/**
 * @file Integration test to verify removeEntity schema loads correctly
 * Tests that the removeEntity operation schema is properly registered and can resolve references
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';

describe('removeEntity Schema Loading', () => {
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

  describe('removeEntity schema', () => {
    it('should be listed in OPERATION_SCHEMA_FILES configuration', () => {
      const schemaFiles = config.getSchemaFiles();
      const hasRemoveEntitySchema = schemaFiles.some((file) =>
        file.includes('removeEntity.schema.json')
      );
      expect(hasRemoveEntitySchema).toBe(true);
    });

    it('should load without reference errors', () => {
      const removeEntitySchemaId =
        'schema://living-narrative-engine/operations/removeEntity.schema.json';

      expect(validator.isSchemaLoaded(removeEntitySchemaId)).toBe(true);
      expect(validator.getValidator(removeEntitySchemaId)).toBeTruthy();
    });

    it('should validate a correct REMOVE_ENTITY operation', () => {
      const removeEntitySchemaId =
        'schema://living-narrative-engine/operations/removeEntity.schema.json';

      const validOperation = {
        type: 'REMOVE_ENTITY',
        parameters: {
          entity_ref: 'test-entity',
        },
      };

      const result = validator.validate(removeEntitySchemaId, validOperation);
      expect(result.isValid).toBe(true);
    });

    it('should validate REMOVE_ENTITY with optional cleanup_inventory', () => {
      const removeEntitySchemaId =
        'schema://living-narrative-engine/operations/removeEntity.schema.json';

      const validOperation = {
        type: 'REMOVE_ENTITY',
        parameters: {
          entity_ref: 'test-entity',
          cleanup_inventory: false,
        },
      };

      const result = validator.validate(removeEntitySchemaId, validOperation);
      expect(result.isValid).toBe(true);
    });

    it('should validate REMOVE_ENTITY with optional result_variable', () => {
      const removeEntitySchemaId =
        'schema://living-narrative-engine/operations/removeEntity.schema.json';

      const validOperation = {
        type: 'REMOVE_ENTITY',
        parameters: {
          entity_ref: 'test-entity',
          result_variable: 'removeResult',
        },
      };

      const result = validator.validate(removeEntitySchemaId, validOperation);
      expect(result.isValid).toBe(true);
    });
  });

  describe('operation.schema.json integration', () => {
    it('should resolve removeEntity schema references', () => {
      const operationSchemaId =
        'schema://living-narrative-engine/operation.schema.json';

      expect(validator.isSchemaLoaded(operationSchemaId)).toBe(true);

      const removeEntityOp = {
        type: 'REMOVE_ENTITY',
        parameters: {
          entity_ref: 'test-entity',
        },
      };

      const result = validator.validate(operationSchemaId, removeEntityOp);

      // Check for reference resolution errors - must not have any ref errors
      const refErrors = (result.errors || []).filter(
        (err) =>
          err.message &&
          (err.message.includes("can't resolve reference") ||
            err.message.includes('unresolved'))
      );
      expect(refErrors).toHaveLength(0);
    });
  });

  describe('rule.schema.json integration', () => {
    it('should allow REMOVE_ENTITY operations in rules', () => {
      const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';

      expect(validator.isSchemaLoaded(ruleSchemaId)).toBe(true);

      const testRule = {
        id: 'test:remove_entity_rule',
        description: 'Test rule for remove entity operation',
        conditions: [],
        operations: [
          {
            type: 'REMOVE_ENTITY',
            parameters: {
              entity_ref: '{event.payload.targetId}',
              cleanup_inventory: true,
            },
          },
        ],
      };

      const result = validator.validate(ruleSchemaId, testRule);

      // Check for ref errors specifically - must not have any ref errors
      const refErrors = (result.errors || []).filter(
        (err) =>
          err.message &&
          (err.message.includes("can't resolve reference") ||
            err.message.includes('unresolved'))
      );
      expect(refErrors).toHaveLength(0);
    });
  });
});
