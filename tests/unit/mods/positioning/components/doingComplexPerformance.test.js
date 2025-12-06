/**
 * @file Unit tests for positioning mod doing_complex_performance component
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const testFilePath = fileURLToPath(import.meta.url);
const testDir = path.dirname(testFilePath);

describe('Positioning Mod - doing_complex_performance Component', () => {
  let ajv;
  let component;

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

    // Load the doing_complex_performance component
    const componentPath = path.resolve(
      testDir,
      '../../../../../data/mods/positioning/components/doing_complex_performance.component.json'
    );
    component = JSON.parse(readFileSync(componentPath, 'utf8'));
  });

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
    expect(component.id).toBe('positioning:doing_complex_performance');
  });

  it('should have a description', () => {
    expect(component.description).toBeDefined();
    expect(typeof component.description).toBe('string');
    expect(component.description.length).toBeGreaterThan(0);
  });

  it('should mention performance and concentration in description', () => {
    expect(component.description.toLowerCase()).toContain('performance');
    expect(component.description.toLowerCase()).toContain('concentration');
  });

  it('should be a marker component with no properties', () => {
    expect(component.dataSchema.type).toBe('object');
    expect(component.dataSchema.properties).toEqual({});
    expect(component.dataSchema.additionalProperties).toBe(false);
  });

  it('should validate empty data object', () => {
    const dataValidator = ajv.compile(component.dataSchema);
    const valid = dataValidator({});
    expect(valid).toBe(true);
  });

  it('should reject data with additional properties', () => {
    const dataValidator = ajv.compile(component.dataSchema);
    const valid = dataValidator({ unexpectedProperty: 'value' });
    expect(valid).toBe(false);
  });
});
