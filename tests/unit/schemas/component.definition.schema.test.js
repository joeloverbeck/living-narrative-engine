/**
 * @file Test suite to validate that component definition files adhere to the main component schema.
 * @see tests/schemas/component.definition.schema.test.js
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../data/schemas/component.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

// --- Component definition files to validate ---
// Note: As you create new components, add them to this import list to ensure they are tested.
import goalsComponent from '../../../data/mods/core/components/goals.component.json';
import followingComponent from '../../../data/mods/core/components/following.component.json';
import leadingComponent from '../../../data/mods/core/components/leading.component.json';

/**
 * Test suite – Component Definition Schema Validation.
 *
 * This suite validates that component definition files (e.g., `goals.component.json`)
 * conform to the primary component schema (`component.schema.json`).
 *
 * It prevents regressions where invalid properties (like the obsolete `resolveFields`)
 * are added to component definitions, which would cause loading errors.
 */
describe('JSON-Schema – Component Definition Validation', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  /* ---------------------------------------------------------------------- */
  /* Setup: Compile the component schema once for all tests in this suite  */
  /* ---------------------------------------------------------------------- */
  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema], // Provide common definitions schema
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    validate = ajv.compile(componentSchema);
  });

  /* ---------------------------------------------------------------------- */
  /* ✓ VALID definitions: Test each component file against the schema      */
  /* ---------------------------------------------------------------------- */
  test.each([
    ['goals.component.json', goalsComponent],
    ['following.component.json', followingComponent],
    ['leading.component.json', leadingComponent],
    // Add new component definition files here as they are created
  ])(
    '✓ %s – should conform to the component definition schema',
    (_filename, componentDefinition) => {
      const ok = validate(componentDefinition);

      // Provide detailed error feedback if validation fails
      if (!ok) {
        console.error(
          `Validation failed for ${_filename}:`,
          JSON.stringify(validate.errors, null, 2)
        );
      }

      expect(ok).toBe(true);
    }
  );

  /* ---------------------------------------------------------------------- */
  /* ✗ INVALID definitions: Test cases that should fail validation         */
  /* ---------------------------------------------------------------------- */
  describe('✗ Invalid component definitions', () => {
    test.each([
      [
        'with an unknown additional property',
        {
          id: 'core:test',
          description: 'A test component.',
          dataSchema: {},
          unknownProperty: 'should cause failure', // Invalid property
        },
      ],
      [
        'missing required "id" property',
        {
          description: 'A test component.',
          dataSchema: {},
        },
      ],
      [
        'missing required "description" property',
        {
          id: 'core:test',
          dataSchema: {},
        },
      ],
      [
        'missing required "dataSchema" property',
        {
          id: 'core:test',
          description: 'A test component.',
        },
      ],
      [
        'with "id" in an invalid format',
        {
          id: 'invalid id with spaces', // Invalid format
          description: 'A test component.',
          dataSchema: {},
        },
      ],
    ])('✗ should reject definition %s', (_label, invalidPayload) => {
      expect(validate(invalidPayload)).toBe(false);
      expect(validate.errors?.length).toBeGreaterThan(0);
    });
  });
});
