import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import actionData from '../../data/mods/core/actions/go.action.json';
import actionSchema from '../../data/schemas/action-definition.schema.json';
import commonSchema from '../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../data/schemas/condition-container.schema.json';

describe("Action Definition: 'core:go'", () => {
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
