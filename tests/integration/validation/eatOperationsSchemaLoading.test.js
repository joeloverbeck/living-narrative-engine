/**
 * @file Integration test to verify eatEntirely and eatFrom schemas load correctly
 * Tests that the eat operation schemas are properly registered and can resolve references
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';

describe('Eat Operations Schema Loading', () => {
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

  describe('eatEntirely schema', () => {
    it('should be listed in OPERATION_SCHEMA_FILES configuration', () => {
      const schemaFiles = config.getSchemaFiles();
      const hasEatEntirelySchema = schemaFiles.some((file) =>
        file.includes('eatEntirely.schema.json')
      );
      expect(hasEatEntirelySchema).toBe(true);
    });

    it('should load without reference errors', () => {
      const eatEntirelySchemaId =
        'schema://living-narrative-engine/operations/eatEntirely.schema.json';

      expect(validator.isSchemaLoaded(eatEntirelySchemaId)).toBe(true);
      expect(validator.getValidator(eatEntirelySchemaId)).toBeTruthy();
    });

    it('should validate a correct EAT_ENTIRELY operation', () => {
      const eatEntirelySchemaId =
        'schema://living-narrative-engine/operations/eatEntirely.schema.json';

      const validOperation = {
        type: 'EAT_ENTIRELY',
        parameters: {
          actorEntity: 'test-actor',
          foodEntity: 'test-food',
        },
      };

      const result = validator.validate(eatEntirelySchemaId, validOperation);
      expect(result.isValid).toBe(true);
    });

    it('should validate EAT_ENTIRELY with optional result_variable', () => {
      const eatEntirelySchemaId =
        'schema://living-narrative-engine/operations/eatEntirely.schema.json';

      const validOperation = {
        type: 'EAT_ENTIRELY',
        parameters: {
          actorEntity: 'test-actor',
          foodEntity: 'test-food',
          result_variable: 'eatResult',
        },
      };

      const result = validator.validate(eatEntirelySchemaId, validOperation);
      expect(result.isValid).toBe(true);
    });
  });

  describe('eatFrom schema', () => {
    it('should be listed in OPERATION_SCHEMA_FILES configuration', () => {
      const schemaFiles = config.getSchemaFiles();
      const hasEatFromSchema = schemaFiles.some((file) =>
        file.includes('eatFrom.schema.json')
      );
      expect(hasEatFromSchema).toBe(true);
    });

    it('should load without reference errors', () => {
      const eatFromSchemaId =
        'schema://living-narrative-engine/operations/eatFrom.schema.json';

      expect(validator.isSchemaLoaded(eatFromSchemaId)).toBe(true);
      expect(validator.getValidator(eatFromSchemaId)).toBeTruthy();
    });

    it('should validate a correct EAT_FROM operation', () => {
      const eatFromSchemaId =
        'schema://living-narrative-engine/operations/eatFrom.schema.json';

      const validOperation = {
        type: 'EAT_FROM',
        parameters: {
          actorEntity: 'test-actor',
          foodEntity: 'test-food',
        },
      };

      const result = validator.validate(eatFromSchemaId, validOperation);
      expect(result.isValid).toBe(true);
    });

    it('should validate EAT_FROM with optional result_variable', () => {
      const eatFromSchemaId =
        'schema://living-narrative-engine/operations/eatFrom.schema.json';

      const validOperation = {
        type: 'EAT_FROM',
        parameters: {
          actorEntity: 'test-actor',
          foodEntity: 'test-food',
          result_variable: 'eatResult',
        },
      };

      const result = validator.validate(eatFromSchemaId, validOperation);
      expect(result.isValid).toBe(true);
    });
  });

  describe('operation.schema.json integration', () => {
    it('should resolve eat operation schema references', () => {
      const operationSchemaId =
        'schema://living-narrative-engine/operation.schema.json';

      expect(validator.isSchemaLoaded(operationSchemaId)).toBe(true);

      // Test EAT_ENTIRELY operation through operation.schema.json
      const eatEntirelyOp = {
        type: 'EAT_ENTIRELY',
        parameters: {
          actorEntity: 'test-actor',
          foodEntity: 'test-food',
        },
      };

      const eatEntirelyResult = validator.validate(
        operationSchemaId,
        eatEntirelyOp
      );

      // Check for reference resolution errors - must not have any ref errors
      const eatEntirelyRefErrors = (eatEntirelyResult.errors || []).filter(
        (err) =>
          err.message &&
          (err.message.includes("can't resolve reference") ||
            err.message.includes('unresolved'))
      );
      expect(eatEntirelyRefErrors).toHaveLength(0);

      // Test EAT_FROM operation through operation.schema.json
      const eatFromOp = {
        type: 'EAT_FROM',
        parameters: {
          actorEntity: 'test-actor',
          foodEntity: 'test-food',
        },
      };

      const eatFromResult = validator.validate(operationSchemaId, eatFromOp);

      // Check for reference resolution errors - must not have any ref errors
      const eatFromRefErrors = (eatFromResult.errors || []).filter(
        (err) =>
          err.message &&
          (err.message.includes("can't resolve reference") ||
            err.message.includes('unresolved'))
      );
      expect(eatFromRefErrors).toHaveLength(0);
    });
  });

  describe('rule.schema.json integration', () => {
    it('should allow eat operations in rules', () => {
      const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';

      expect(validator.isSchemaLoaded(ruleSchemaId)).toBe(true);

      const testRule = {
        id: 'test:eat_rule',
        description: 'Test rule for eating operations',
        conditions: [],
        operations: [
          {
            type: 'EAT_FROM',
            parameters: {
              actorEntity: { scope: 'actor' },
              foodEntity: { var: 'targetFood' },
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
