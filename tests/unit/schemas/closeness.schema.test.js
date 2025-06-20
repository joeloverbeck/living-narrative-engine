/**
 * @file Validates the intimacy:closeness component definition.
 * @see {@link ../../../../../data/mods/intimacy/components/closeness.component.json}
 */

import { describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Direct import of JSON files, as supported by Jest's transformer.
import componentDefinitionSchema from '../../../data/schemas/component.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import closenessComponent from '../../../data/mods/intimacy/components/closeness.component.json';

describe('intimacy:closeness component definition', () => {
  it('should be a valid component definition according to the schema', () => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // The component definition schema and our new component schema both reference the common schema.
    // We must add it to AJV with its full URI as the key, so that AJV can resolve the $refs.
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );

    const valid = ajv.validate(componentDefinitionSchema, closenessComponent);

    // Log errors for easier debugging if validation fails
    if (!valid) {
      console.error('AJV validation errors:', ajv.errors);
    }

    expect(valid).toBe(true);
  });
});
