// tests/macros/autoMoveFollower.macro.test.js
// -----------------------------------------------------------------------------
// Integration test for the 'core:autoMoveFollower' macro.
// This test validates the macro file against the master macro schema to ensure
// its structure and content are valid.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schemas and data
import macroData from '../../../data/mods/core/macros/autoMoveFollower.macro.json';
import macroSchema from '../../../data/schemas/macro.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import operationSchema from '../../../data/schemas/operation.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';

// Helpers
import loadOperationSchemas from '../helpers/loadOperationSchemas.js';

describe("Macro Definition: 'core:autoMoveFollower'", () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv); // <-- FIX: Add format validators

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
    ajv.addSchema(
      conditionContainerSchema,
      'http://example.com/schemas/condition-container.schema.json'
    );

    // The main operation schema references individual schemas for each operation type.
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
