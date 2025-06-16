// tests/macros/autoMoveFollower.macro.test.js
// -----------------------------------------------------------------------------
// Integration test for the 'core:autoMoveFollower' macro.
// This test validates the macro file against the master macro schema to ensure
// its structure and content are valid.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';

// Schemas and data
// Note: This test will fail if the JSON file has not been corrected as per our previous discussion.
import macroData from '../../data/mods/core/macros/autoMoveFollower.macro.json';
import macroSchema from '../../data/schemas/macro.schema.json';
import commonSchema from '../../data/schemas/common.schema.json';
import operationSchema from '../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../data/schemas/json-logic.schema.json';

// Helpers
// This test assumes a helper function exists at this path that loads all
// individual operation schemas into the AJV instance.
import loadOperationSchemas from '../helpers/loadOperationSchemas.js';

describe("Macro Definition: 'core:autoMoveFollower'", () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });

    // Add schemas that other schemas depend on. Using the full $id as the key is crucial.
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    ajv.addSchema(
      operationSchema,
      'http://example.com/schemas/operation.schema.json'
    );
    ajv.addSchema(
      jsonLogicSchema,
      'http://example.com/schemas/json-logic.schema.json'
    );

    // The main operation schema references individual schemas for each operation type.
    // This helper function, as seen in your example tests, pre-loads all of them into the AJV instance.
    loadOperationSchemas(ajv);

    // Compile the main schema to create a validation function.
    validate = ajv.compile(macroSchema);
  });

  test('should be a valid macro definition', () => {
    const isValid = validate(macroData);

    // Provide detailed error output in the console if validation fails.
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }

    expect(isValid).toBe(true);
  });
});
