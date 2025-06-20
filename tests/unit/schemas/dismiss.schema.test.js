import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionData from '../../../data/mods/core/actions/dismiss.action.json';
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';

describe("Action Definition: 'core:dismiss'", () => {
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
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(isValid).toBe(true);
  });
});
