// tests/actions/thumb_wipe_cheek.action.test.js
// -----------------------------------------------------------------------------
// Integration test for the 'caressing:thumb_wipe_cheek' action definition.
// This test validates the action file against the master action definition
// schema to ensure its structure and content are valid.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';

// Import the data to be tested
import actionData from '../../../data/mods/caressing/actions/thumb_wipe_cheek.action.json';

// Import the schemas required for validation
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';

describe("Action Definition: 'caressing:thumb_wipe_cheek'", () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema, jsonLogicSchema, conditionContainerSchema],
    });
    addFormats(ajv); // <-- FIX: Add format validators
    validate = ajv.compile(actionSchema);
  });

  test('should be a valid action definition', () => {
    const isValid = validate(actionData);

    // Provide detailed error output if validation fails
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }

    expect(isValid).toBe(true);
  });
});
