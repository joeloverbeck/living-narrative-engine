/**
 * @file Tests for isSchemaLoaded() with schemas that have unresolved $refs
 * Ensures the validator correctly identifies schemas that cannot be compiled
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('AjvSchemaValidator - Unresolved References Detection', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    validator = new AjvSchemaValidator({ logger: mockLogger });
  });

  describe('isSchemaLoaded with unresolved $refs', () => {
    // Note: isSchemaLoaded() only checks registration, not compilation status
    // This is a performance optimization - compilation verification happens during validate()
    // Use validateSchemaRefs() to verify compilation status if needed

    it('should return true for schema registered even with unresolved relative $ref', async () => {
      const schemaWithUnresolvedRef = {
        $id: 'schema://test/parent.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Parent Schema',
        allOf: [
          {
            $ref: './missing-child.schema.json', // This reference cannot be resolved
          },
        ],
      };

      // Add the schema - this should succeed (registration)
      await validator.addSchema(
        schemaWithUnresolvedRef,
        schemaWithUnresolvedRef.$id
      );

      // isSchemaLoaded returns true because schema is registered (not compiled)
      // PERFORMANCE: This avoids expensive compilation during existence checks
      const isLoaded = validator.isSchemaLoaded(schemaWithUnresolvedRef.$id);
      expect(isLoaded).toBe(true);

      // Unresolved refs are detected during validation, not during registration check
      const result = validator.validate(schemaWithUnresolvedRef.$id, {});
      expect(result.isValid).toBe(false);
    });

    it('should return true for schema registered even with unresolved absolute $ref', async () => {
      const schemaWithUnresolvedAbsoluteRef = {
        $id: 'schema://test/parent2.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Parent Schema 2',
        properties: {
          child: {
            $ref: 'schema://test/non-existent-child.schema.json',
          },
        },
      };

      await validator.addSchema(
        schemaWithUnresolvedAbsoluteRef,
        schemaWithUnresolvedAbsoluteRef.$id
      );

      // Schema is registered, so isSchemaLoaded returns true
      const isLoaded = validator.isSchemaLoaded(
        schemaWithUnresolvedAbsoluteRef.$id
      );
      expect(isLoaded).toBe(true);

      // Validation will detect the unresolved refs
      const result = validator.validate(schemaWithUnresolvedAbsoluteRef.$id, {});
      expect(result.isValid).toBe(false);
    });

    it('should return true for schema with properly resolved $refs', async () => {
      // First add the referenced child schema
      const childSchema = {
        $id: 'schema://test/resolved-child.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
      };

      await validator.addSchema(childSchema, childSchema.$id);

      // Then add parent schema that references it
      const parentSchema = {
        $id: 'schema://test/resolved-parent.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        allOf: [
          {
            $ref: 'schema://test/resolved-child.schema.json',
          },
        ],
      };

      await validator.addSchema(parentSchema, parentSchema.$id);

      // Both should be loaded successfully
      expect(validator.isSchemaLoaded(childSchema.$id)).toBe(true);
      expect(validator.isSchemaLoaded(parentSchema.$id)).toBe(true);
    });

    it('should return true for deeply nested schema even with unresolved refs', async () => {
      const deeplyNestedSchema = {
        $id: 'schema://test/deeply-nested.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          level1: {
            properties: {
              level2: {
                $ref: './operations/deeply-missing.schema.json',
              },
            },
          },
        },
      };

      await validator.addSchema(deeplyNestedSchema, deeplyNestedSchema.$id);

      // Schema is registered, so isSchemaLoaded returns true
      const isLoaded = validator.isSchemaLoaded(deeplyNestedSchema.$id);
      expect(isLoaded).toBe(true);

      // Validation will detect the unresolved refs
      const result = validator.validate(deeplyNestedSchema.$id, { level1: {} });
      expect(result.isValid).toBe(false);
    });

    it('should correctly identify when schema becomes compilable after dependency is added', async () => {
      // Add parent with unresolved ref first
      const parentWithRef = {
        $id: 'schema://test/parent-waiting.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        $ref: 'schema://test/dependency.schema.json',
      };

      await validator.addSchema(parentWithRef, parentWithRef.$id);

      // Schema is registered so isSchemaLoaded returns true
      expect(validator.isSchemaLoaded(parentWithRef.$id)).toBe(true);

      // Add the dependency
      const dependency = {
        $id: 'schema://test/dependency.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      await validator.addSchema(dependency, dependency.$id);

      // Now parent should be compilable
      // Note: Ajv caches compilation results, so we need to check if it compiles now
      const canValidateNow = validator.getValidator(parentWithRef.$id);
      expect(canValidateNow).toBeDefined();
    });
  });

  describe('validate with unresolved $refs', () => {
    it('should return schema not found error when attempting to validate with unresolved refs', async () => {
      const schemaWithBadRef = {
        $id: 'schema://test/bad-ref-validate.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        allOf: [
          {
            $ref: './operations/missing-operation.schema.json',
          },
        ],
      };

      await validator.addSchema(schemaWithBadRef, schemaWithBadRef.$id);

      const result = validator.validate(schemaWithBadRef.$id, {
        test: 'data',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'schemaNotFound',
            message: expect.stringContaining('not found'),
          }),
        ])
      );
    });
  });

  describe('validateSchemaRefs', () => {
    it('should return false for schema with unresolved refs', async () => {
      const schemaWithBadRef = {
        $id: 'schema://test/refs-check.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        $ref: './missing-file.schema.json',
      };

      await validator.addSchema(schemaWithBadRef, schemaWithBadRef.$id);

      const hasValidRefs = validator.validateSchemaRefs(schemaWithBadRef.$id);

      expect(hasValidRefs).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('has unresolved $refs'),
        expect.any(Object)
      );
    });

    it('should return true for schema with all refs resolved', async () => {
      const simpleSchema = {
        $id: 'schema://test/simple-valid.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      await validator.addSchema(simpleSchema, simpleSchema.$id);

      const hasValidRefs = validator.validateSchemaRefs(simpleSchema.$id);

      expect(hasValidRefs).toBe(true);
    });
  });
});
