// tests/schemas/llmOutputSchemas.test.js
// -----------------------------------------------------------------------------
// Contract tests for LLM_TURN_ACTION_RESPONSE_SCHEMA.
// Ensures the schema correctly enforces the presence and type of the `thoughts` field
// and the `chosenIndex` field of the LLM's output.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA } from '../../../src/turns/schemas/llmOutputSchemas.js';
import { SUBJECT_TYPE_ENUM_VALUES } from '../../../src/constants/subjectTypes.js';
import { describe, test, expect, beforeAll } from '@jest/globals';

// -----------------------------------------------------------------------------
// Helper – compile the schema once for all tests to keep things DRY.
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

describe('LLM_TURN_ACTION_RESPONSE_SCHEMA contract', () => {
  test('fails validation when `thoughts` field is missing', () => {
    const data = {
      chosenIndex: 1,
      speech: 'z',
      // `thoughts` is omitted
    };

    const isValid = validate(data);
    expect(isValid).toBe(false);
    expect(validate.errors).toBeDefined();
    // Ensure the error is specifically about the missing `thoughts` property.
    const missingThoughtsError = validate.errors.find(
      (err) =>
        err.keyword === 'required' && err.params?.missingProperty === 'thoughts'
    );
    expect(missingThoughtsError).toBeTruthy();
  });

  test('fails validation when `thoughts` is not a string', () => {
    const data = {
      chosenIndex: 1,
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
      chosenIndex: 1,
      speech: 'z',
      thoughts: 'Internal monologue',
    };

    const isValid = validate(data);
    expect(isValid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  describe('notes validation', () => {
    test('should validate notes without tags property', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Internal monologue',
        notes: [
          {
            text: 'This is a note',
            subject: 'Test Subject',
            subjectType: 'entity',
            context: 'Testing context',
          },
        ],
      };

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should reject notes containing tags property', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Internal monologue',
        notes: [
          {
            text: 'This is a note',
            subject: 'Test Subject',
            subjectType: 'entity',
            context: 'Testing context',
            tags: ['emotion', 'politics'], // This should cause validation failure
          },
        ],
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();

      // Find the specific error about additional properties (tags)
      const additionalPropsError = validate.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'tags'
      );
      expect(additionalPropsError).toBeTruthy();
    });

    test('should validate notes with minimal required fields only', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Internal monologue',
        notes: [
          {
            text: 'Minimal note',
            subject: 'Subject',
            subjectType: 'event',
          },
        ],
      };

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should reject notes with missing required fields', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Internal monologue',
        notes: [
          {
            text: 'Note without subject',
            // Missing subject and subjectType
            context: 'Test context',
          },
        ],
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();

      // Should have errors for missing required fields
      const missingSubjectError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'subject'
      );
      const missingSubjectTypeError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'subjectType'
      );

      expect(missingSubjectError).toBeTruthy();
      expect(missingSubjectTypeError).toBeTruthy();
    });

    test('should handle multiple notes with mixed valid/invalid properties', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Internal monologue',
        notes: [
          {
            text: 'Valid note',
            subject: 'Valid Subject',
            subjectType: 'entity',
          },
          {
            text: 'Invalid note with tags',
            subject: 'Invalid Subject',
            subjectType: 'event',
            tags: ['should-fail'], // This should cause validation failure
          },
        ],
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();

      // Should reject due to tags in the second note
      const additionalPropsError = validate.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'tags'
      );
      expect(additionalPropsError).toBeTruthy();
    });

    test('should reject notes with legacy subjectType values', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello',
        thoughts: 'Internal monologue',
        notes: [
          {
            text: 'Note with legacy type',
            subject: 'Legacy Subject',
            subjectType: 'character', // Legacy type - should be 'entity'
          },
        ],
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();

      // Should reject because 'character' is not in the new enum
      const enumError = validate.errors.find(
        (err) => err.keyword === 'enum' && err.instancePath === '/notes/0/subjectType'
      );
      expect(enumError).toBeTruthy();
    });

    test('subjectType enum should match SUBJECT_TYPE_ENUM_VALUES constant', () => {
      // Extract the enum from the schema
      const schemaEnum = LLM_TURN_ACTION_RESPONSE_SCHEMA.properties.notes.items.properties.subjectType.enum;

      // Verify the schema enum matches the constants
      expect(schemaEnum.sort()).toEqual([...SUBJECT_TYPE_ENUM_VALUES].sort());
    });
  });
});
