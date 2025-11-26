/**
 * @file Unit tests for positioning:wielding component schema validation
 * @see specs/wielding-component.md
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const testFilePath = fileURLToPath(import.meta.url);
const testDir = path.dirname(testFilePath);

describe('positioning:wielding Component Schema', () => {
  let ajv;
  let component;
  let dataValidator;

  beforeAll(() => {
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Load the common schema first (required by component schema)
    const commonSchemaPath = path.resolve(
      testDir,
      '../../../../../data/schemas/common.schema.json'
    );
    const commonSchema = JSON.parse(readFileSync(commonSchemaPath, 'utf8'));
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );

    // Load the component schema
    const componentSchemaPath = path.resolve(
      testDir,
      '../../../../../data/schemas/component.schema.json'
    );
    const componentSchema = JSON.parse(
      readFileSync(componentSchemaPath, 'utf8')
    );
    ajv.addSchema(
      componentSchema,
      'schema://living-narrative-engine/component.schema.json'
    );

    // Load the wielding component
    const componentPath = path.resolve(
      testDir,
      '../../../../../data/mods/positioning/components/wielding.component.json'
    );
    component = JSON.parse(readFileSync(componentPath, 'utf8'));

    // Compile the data schema validator
    dataValidator = ajv.compile(component.dataSchema);
  });

  describe('Component Definition', () => {
    it('should be a valid component schema', () => {
      const validate = ajv.getSchema(
        'schema://living-narrative-engine/component.schema.json'
      );
      const valid = validate(component);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should have correct id', () => {
      expect(component.id).toBe('positioning:wielding');
    });

    it('should have a description', () => {
      expect(component.description).toBeDefined();
      expect(typeof component.description).toBe('string');
      expect(component.description.length).toBeGreaterThan(0);
    });

    it('should mention wielding in description', () => {
      expect(component.description.toLowerCase()).toContain('wielding');
    });

    it('should require wielded_item_ids', () => {
      expect(component.dataSchema.required).toContain('wielded_item_ids');
    });
  });

  describe('Valid Cases', () => {
    it('should accept empty wielded_item_ids array', () => {
      const valid = dataValidator({ wielded_item_ids: [] });
      expect(valid).toBe(true);
    });

    it('should accept single item in array', () => {
      const valid = dataValidator({ wielded_item_ids: ['sword-1'] });
      expect(valid).toBe(true);
    });

    it('should accept multiple items in array', () => {
      const valid = dataValidator({
        wielded_item_ids: ['sword-1', 'dagger-2'],
      });
      expect(valid).toBe(true);
    });

    it('should accept namespaced IDs', () => {
      const valid = dataValidator({
        wielded_item_ids: ['weapons:silver_revolver'],
      });
      expect(valid).toBe(true);
    });

    it('should accept IDs with underscores and hyphens', () => {
      const valid = dataValidator({
        wielded_item_ids: ['weapon_great-sword', 'item-123_abc'],
      });
      expect(valid).toBe(true);
    });

    it('should accept with minimal activityMetadata', () => {
      const valid = dataValidator({
        wielded_item_ids: ['sword'],
        activityMetadata: { shouldDescribeInActivity: true },
      });
      expect(valid).toBe(true);
    });

    it('should accept with full activityMetadata', () => {
      const valid = dataValidator({
        wielded_item_ids: ['sword'],
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} is wielding {targets} threateningly',
          targetRole: 'wielded_item_ids',
          targetRoleIsArray: true,
          priority: 70,
        },
      });
      expect(valid).toBe(true);
    });

    it('should accept empty activityMetadata object', () => {
      const valid = dataValidator({
        wielded_item_ids: ['sword'],
        activityMetadata: {},
      });
      expect(valid).toBe(true);
    });

    it('should accept priority at boundary values', () => {
      let valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { priority: 0 },
      });
      expect(valid).toBe(true);

      valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { priority: 100 },
      });
      expect(valid).toBe(true);
    });
  });

  describe('Invalid Cases', () => {
    it('should reject missing wielded_item_ids', () => {
      const valid = dataValidator({});
      expect(valid).toBe(false);
      expect(dataValidator.errors).toBeDefined();
      expect(
        dataValidator.errors.some(
          (e) => e.keyword === 'required' && e.params.missingProperty === 'wielded_item_ids'
        )
      ).toBe(true);
    });

    it('should reject wielded_item_ids as string', () => {
      const valid = dataValidator({ wielded_item_ids: 'sword' });
      expect(valid).toBe(false);
    });

    it('should reject non-string in array', () => {
      const valid = dataValidator({ wielded_item_ids: [123] });
      expect(valid).toBe(false);
    });

    it('should reject object in array', () => {
      const valid = dataValidator({
        wielded_item_ids: [{ id: 'sword' }],
      });
      expect(valid).toBe(false);
    });

    it('should reject additional properties at root', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        extra: 'bad',
      });
      expect(valid).toBe(false);
    });

    it('should reject duplicate items in array', () => {
      const valid = dataValidator({
        wielded_item_ids: ['sword', 'sword'],
      });
      expect(valid).toBe(false);
    });

    it('should reject null wielded_item_ids', () => {
      const valid = dataValidator({ wielded_item_ids: null });
      expect(valid).toBe(false);
    });

    it('should reject invalid activityMetadata properties', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { unknownProp: true },
      });
      expect(valid).toBe(false);
    });

    it('should reject priority below minimum', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { priority: -1 },
      });
      expect(valid).toBe(false);
    });

    it('should reject priority above maximum', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { priority: 101 },
      });
      expect(valid).toBe(false);
    });

    it('should reject non-boolean shouldDescribeInActivity', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { shouldDescribeInActivity: 'yes' },
      });
      expect(valid).toBe(false);
    });

    it('should reject non-string template', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { template: 123 },
      });
      expect(valid).toBe(false);
    });

    it('should reject non-boolean targetRoleIsArray', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { targetRoleIsArray: 'true' },
      });
      expect(valid).toBe(false);
    });

    it('should reject non-integer priority', () => {
      const valid = dataValidator({
        wielded_item_ids: [],
        activityMetadata: { priority: 50.5 },
      });
      expect(valid).toBe(false);
    });
  });

  describe('Edge Cases - namespacedId Pattern', () => {
    it('should handle large arrays', () => {
      const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
      const valid = dataValidator({ wielded_item_ids: items });
      expect(valid).toBe(true);
    });

    it('should reject empty string in array', () => {
      const valid = dataValidator({ wielded_item_ids: [''] });
      expect(valid).toBe(false);
    });

    it('should reject whitespace-only string in array', () => {
      const valid = dataValidator({ wielded_item_ids: ['  '] });
      expect(valid).toBe(false);
    });

    it('should reject IDs with spaces', () => {
      const valid = dataValidator({
        wielded_item_ids: ['sword with spaces'],
      });
      expect(valid).toBe(false);
    });

    it('should reject IDs with special characters', () => {
      const valid = dataValidator({
        wielded_item_ids: ['sword!@#'],
      });
      expect(valid).toBe(false);
    });

    it('should accept IDs with only colons (namespacing)', () => {
      const valid = dataValidator({
        wielded_item_ids: ['mod:category:item'],
      });
      expect(valid).toBe(true);
    });

    it('should accept numeric-only IDs', () => {
      const valid = dataValidator({ wielded_item_ids: ['12345'] });
      expect(valid).toBe(true);
    });

    it('should accept single character IDs', () => {
      const valid = dataValidator({ wielded_item_ids: ['a'] });
      expect(valid).toBe(true);
    });

    it('should handle mixed valid IDs', () => {
      const valid = dataValidator({
        wielded_item_ids: [
          'simple',
          'with-hyphen',
          'with_underscore',
          'mod:namespaced',
          '123',
          'a',
        ],
      });
      expect(valid).toBe(true);
    });
  });
});
