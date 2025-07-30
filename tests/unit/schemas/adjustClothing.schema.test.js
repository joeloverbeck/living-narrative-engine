// tests/actions/adjust_clothing.action.test.js
// -----------------------------------------------------------------------------
// Integration test for the 'intimacy:adjust_clothing' action definition.
// This test validates the action file against the master action definition
// schema to ensure its structure and content are valid.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';

// Import the data to be tested
import actionData from '../../../data/mods/intimacy/actions/adjust_clothing.action.json';

// Import the schemas required for validation
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';

describe("Action Definition: 'intimacy:adjust_clothing'", () => {
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

  test('should have correct multi-target structure', () => {
    expect(actionData.targets).toBeDefined();
    expect(actionData.targets.primary).toBeDefined();
    expect(actionData.targets.secondary).toBeDefined();

    expect(actionData.targets.primary.scope).toBe(
      'intimacy:close_actors_facing_each_other_with_torso_clothing'
    );
    expect(actionData.targets.primary.placeholder).toBe('primary');

    expect(actionData.targets.secondary.scope).toBe(
      'intimacy:target_topmost_torso_upper_clothing'
    );
    expect(actionData.targets.secondary.placeholder).toBe('secondary');
    expect(actionData.targets.secondary.contextFrom).toBe('primary');

    expect(actionData.template).toBe("adjust {primary}'s {secondary}");
  });

  test('should not have deprecated scope property', () => {
    expect(actionData.scope).toBeUndefined();
  });
});
