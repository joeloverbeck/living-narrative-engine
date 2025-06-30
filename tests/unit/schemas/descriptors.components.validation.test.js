/**
 * @file Test suite to validate that descriptor component definition files adhere to the component schema.
 * 
 * This test suite was created to ensure all descriptor components follow the correct schema
 * after fixing validation errors where components were missing 'id' and using 'data' instead of 'dataSchema'.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// --- Schemas to test against ---
import componentSchema from '../../../data/schemas/component.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

// --- Load all descriptor component files dynamically ---
const descriptorComponentsPath = path.join(
  __dirname,
  '../../../data/mods/descriptors/components'
);

// Get all .component.json files from the descriptors mod
const descriptorComponentFiles = fs
  .readdirSync(descriptorComponentsPath)
  .filter((file) => file.endsWith('.component.json'))
  .map((file) => {
    const content = JSON.parse(
      fs.readFileSync(path.join(descriptorComponentsPath, file), 'utf8')
    );
    return [file, content];
  });

/**
 * Test suite – Descriptor Component Schema Validation.
 *
 * This suite validates that all descriptor component definition files
 * conform to the primary component schema (`component.schema.json`).
 * 
 * It specifically tests:
 * 1. All required properties are present (id, description, dataSchema)
 * 2. The id follows the correct format (descriptors:{component_name})
 * 3. No invalid properties are present
 * 4. The dataSchema property is used (not the incorrect 'data' property)
 */
describe('Descriptor Components - Schema Validation', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema],
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    validate = ajv.compile(componentSchema);
  });

  describe('✓ All descriptor components should be valid', () => {
    test.each(descriptorComponentFiles)(
      '✓ %s – should conform to the component definition schema',
      (filename, componentDefinition) => {
        const ok = validate(componentDefinition);

        if (!ok) {
          console.error(
            `Validation failed for ${filename}:`,
            JSON.stringify(validate.errors, null, 2)
          );
        }

        expect(ok).toBe(true);
      }
    );
  });

  describe('✓ ID format validation', () => {
    test.each(descriptorComponentFiles)(
      '✓ %s – should have correctly formatted id',
      (filename, componentDefinition) => {
        // Extract component name from filename (e.g., "build" from "build.component.json")
        const componentName = filename.replace('.component.json', '');
        const expectedId = `descriptors:${componentName}`;

        expect(componentDefinition.id).toBe(expectedId);
      }
    );
  });

  describe('✓ Required properties validation', () => {
    test.each(descriptorComponentFiles)(
      '✓ %s – should have all required properties',
      (filename, componentDefinition) => {
        expect(componentDefinition).toHaveProperty('id');
        expect(componentDefinition).toHaveProperty('description');
        expect(componentDefinition).toHaveProperty('dataSchema');
        
        // Ensure 'data' property is NOT present (was the old incorrect property name)
        expect(componentDefinition).not.toHaveProperty('data');
      }
    );
  });

  describe('✓ DataSchema structure validation', () => {
    test.each(descriptorComponentFiles)(
      '✓ %s – should have valid dataSchema structure',
      (filename, componentDefinition) => {
        const { dataSchema } = componentDefinition;
        
        // dataSchema should be an object
        expect(typeof dataSchema).toBe('object');
        expect(dataSchema).not.toBeNull();
        
        // For descriptor components, dataSchema typically defines a type and properties
        // Check if type is present and valid when defined
        expect(
          !dataSchema.type ||
            ['object', 'string', 'number', 'boolean', 'array'].includes(
              dataSchema.type
            )
        ).toBe(true);
      }
    );
  });

  // Regression test for the specific issue that was fixed
  describe('✗ Invalid component definitions (regression tests)', () => {
    test('✗ should reject component with missing id', () => {
      const invalidComponent = {
        description: 'Test component',
        dataSchema: { type: 'object' },
      };
      
      expect(validate(invalidComponent)).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: { missingProperty: 'id' },
          }),
        ])
      );
    });

    test('✗ should reject component using "data" instead of "dataSchema"', () => {
      const invalidComponent = {
        id: 'descriptors:test',
        description: 'Test component',
        data: { type: 'object' }, // Wrong property name
      };
      
      expect(validate(invalidComponent)).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: { missingProperty: 'dataSchema' },
          }),
        ])
      );
    });

    test('✗ should reject component with both "data" and "dataSchema"', () => {
      const invalidComponent = {
        id: 'descriptors:test',
        description: 'Test component',
        dataSchema: { type: 'object' },
        data: { type: 'object' }, // Additional property not allowed
      };
      
      expect(validate(invalidComponent)).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
            params: { additionalProperty: 'data' },
          }),
        ])
      );
    });
  });
});