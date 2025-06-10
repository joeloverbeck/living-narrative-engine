// tests/schemas/PromptOutputContract.test.js
// -----------------------------------------------------------------------------
// Contract tests for LLM_TURN_ACTION_RESPONSE_SCHEMA.
// Ensures that LLM payloads conform to the consolidated schema requirements.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA } from '../../src/turns/schemas/llmOutputSchemas.js';
import { jest, describe, beforeAll, test, expect } from '@jest/globals';

// -----------------------------------------------------------------------------
// Compile schema once for all tests
// -----------------------------------------------------------------------------

let validate;

beforeAll(() => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  validate = ajv.compile(LLM_TURN_ACTION_RESPONSE_SCHEMA);
});

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('PromptOutputContract', () => {
  test('fails validation when `thoughts` field is missing', () => {
    const payload = {
      chosenActionId: 1,
      speech: '',
    };

    const isValid = validate(payload);
    expect(isValid).toBe(false);
    expect(validate.errors).toBeDefined();
  });

  test('fails validation when `thoughts` is not a string', () => {
    const payload = {
      chosenActionId: 1,
      speech: '',
      thoughts: 123,
    };

    const isValid = validate(payload);
    expect(isValid).toBe(false);
    expect(validate.errors).toBeDefined();
  });

  test('passes validation for a correct payload', () => {
    const payload = {
      chosenActionId: 1,
      speech: '',
      thoughts: 'Thinking about next move.',
    };

    const isValid = validate(payload);
    expect(isValid).toBe(true);
    expect(validate.errors).toBeNull();
  });
});
