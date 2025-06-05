// tests/schemas/llmOutputSchemas.test.js
// -----------------------------------------------------------------------------
// Contract tests for LLM_TURN_ACTION_RESPONSE_SCHEMA.
// Ensures the schema correctly enforces the presence and type of the `thoughts` field.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA } from '../../src/turns/schemas/llmOutputSchemas.js';
import { jest, describe, test, expect, beforeAll } from '@jest/globals';

// -----------------------------------------------------------------------------
// Helper – compile the schema once for all tests to keep things DRY.
// -----------------------------------------------------------------------------

let validate;

beforeAll(() => {
  const ajv = new Ajv({ strict: true });
  addFormats(ajv);
  validate = ajv.compile(LLM_TURN_ACTION_RESPONSE_SCHEMA);
});

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('LLM_TURN_ACTION_RESPONSE_SCHEMA contract', () => {
  test('fails validation when `thoughts` field is missing', () => {
    const data = {
      actionDefinitionId: 'x',
      commandString: 'y',
      speech: 'z',
      // `thoughts` is omitted
    };

    const isValid = validate(data);
    expect(isValid).toBe(false);
    expect(validate.errors).toBeDefined();
    // Ensure the error is specifically about the missing `thoughts` property.
    const missingThoughtsError = validate.errors.find(
      (err) =>
        err.keyword === 'required' && err.params.missingProperty === 'thoughts'
    );
    expect(missingThoughtsError).toBeTruthy();
  });

  test('fails validation when `thoughts` is not a string', () => {
    const data = {
      actionDefinitionId: 'x',
      commandString: 'y',
      speech: 'z',
      thoughts: 123, // invalid type
    };

    const isValid = validate(data);
    expect(isValid).toBe(false);
    expect(validate.errors).toBeDefined();
    const typeError = validate.errors.find(
      (err) => err.instancePath === '/thoughts' && err.keyword === 'type'
    );
    expect(typeError).toBeTruthy();
  });

  test('passes validation when `thoughts` is a valid string', () => {
    const data = {
      actionDefinitionId: 'x',
      commandString: 'y',
      speech: 'z',
      thoughts: 'Internal monologue',
    };

    const isValid = validate(data);
    expect(isValid).toBe(true);
    expect(validate.errors).toBeNull();
  });
});
