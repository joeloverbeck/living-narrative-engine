// tests/actions/kiss_cheek.action.test.js
// -----------------------------------------------------------------------------
// Integration test for the 'intimacy:kiss_cheek' action definition.
// This test validates the action file against the master action definition
// schema to ensure its structure and content are valid.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import conditionContainerSchema from '../../data/schemas/condition-container.schema.json';

// Import the data to be tested
import actionData from '../../data/mods/intimacy/actions/kiss_cheek.action.json';

// Import the schemas required for validation
import actionSchema from '../../data/schemas/action-definition.schema.json';
import commonSchema from '../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../data/schemas/json-logic.schema.json';

describe("Action Definition: 'intimacy:kiss_cheek'", () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema, jsonLogicSchema, conditionContainerSchema],
    });
    validate = ajv.compile(actionSchema);
  });

  test('should be a valid action definition', () => {
    const isValid = validate(actionData);

    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }

    expect(isValid).toBe(true);
  });
});
