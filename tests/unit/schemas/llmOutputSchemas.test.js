// tests/schemas/llmOutputSchemas.test.js
// -----------------------------------------------------------------------------
// Contract tests for LLM_TURN_ACTION_RESPONSE_SCHEMA.
// Ensures the schema correctly enforces the presence and type of required fields:
// chosenIndex, speech, thoughts, moodUpdate, and sexualUpdate.
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

// Common valid fixtures for required fields
const validMoodUpdate = {
  valence: 10,
  arousal: -20,
  agency_control: 30,
  threat: -40,
  engagement: 50,
  future_expectancy: -60,
  self_evaluation: 70,
};

const validSexualUpdate = {
  sex_excitation: 30,
  sex_inhibition: 70,
};

/**
 * Creates a minimal valid response with all required fields.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid response object.
 */
function createValidResponse(overrides = {}) {
  return {
    chosenIndex: 1,
    speech: 'Hello',
    thoughts: 'Internal monologue',
    moodUpdate: validMoodUpdate,
    sexualUpdate: validSexualUpdate,
    ...overrides,
  };
}

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

  test('passes validation with all required fields', () => {
    const data = createValidResponse();

    const isValid = validate(data);
    expect(isValid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  test('fails validation when moodUpdate is missing (required)', () => {
    const data = {
      chosenIndex: 1,
      speech: 'Hello',
      thoughts: 'Internal monologue',
      sexualUpdate: validSexualUpdate,
    };

    const isValid = validate(data);
    expect(isValid).toBe(false);
    expect(validate.errors).toBeDefined();
    const missingMoodError = validate.errors.find(
      (err) =>
        err.keyword === 'required' && err.params?.missingProperty === 'moodUpdate'
    );
    expect(missingMoodError).toBeTruthy();
  });

  test('fails validation when sexualUpdate is missing (required)', () => {
    const data = {
      chosenIndex: 1,
      speech: 'Hello',
      thoughts: 'Internal monologue',
      moodUpdate: validMoodUpdate,
    };

    const isValid = validate(data);
    expect(isValid).toBe(false);
    expect(validate.errors).toBeDefined();
    const missingSexualError = validate.errors.find(
      (err) =>
        err.keyword === 'required' &&
        err.params?.missingProperty === 'sexualUpdate'
    );
    expect(missingSexualError).toBeTruthy();
  });

  describe('notes validation', () => {
    test('should validate notes without tags property', () => {
      const data = createValidResponse({
        notes: [
          {
            text: 'This is a note',
            subject: 'Test Subject',
            subjectType: 'entity',
            context: 'Testing context',
          },
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should reject notes containing tags property', () => {
      const data = createValidResponse({
        notes: [
          {
            text: 'This is a note',
            subject: 'Test Subject',
            subjectType: 'entity',
            context: 'Testing context',
            tags: ['emotion', 'politics'], // This should cause validation failure
          },
        ],
      });

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
      const data = createValidResponse({
        notes: [
          {
            text: 'Minimal note',
            subject: 'Subject',
            subjectType: 'event',
          },
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('should reject notes with missing required fields', () => {
      const data = createValidResponse({
        notes: [
          {
            text: 'Note without subject',
            // Missing subject and subjectType
            context: 'Test context',
          },
        ],
      });

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
      const data = createValidResponse({
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
      });

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
      const data = createValidResponse({
        notes: [
          {
            text: 'Note with legacy type',
            subject: 'Legacy Subject',
            subjectType: 'character', // Legacy type - should be 'entity'
          },
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();

      // Should reject because 'character' is not in the new enum
      const enumError = validate.errors.find(
        (err) =>
          err.keyword === 'enum' && err.instancePath === '/notes/0/subjectType'
      );
      expect(enumError).toBeTruthy();
    });

    test('subjectType enum should match SUBJECT_TYPE_ENUM_VALUES constant', () => {
      // Extract the enum from the schema
      const schemaEnum =
        LLM_TURN_ACTION_RESPONSE_SCHEMA.properties.notes.items.properties
          .subjectType.enum;

      // Verify the schema enum matches the constants
      expect(schemaEnum.sort()).toEqual([...SUBJECT_TYPE_ENUM_VALUES].sort());
    });
  });

  describe('moodUpdate validation', () => {
    // Uses validMoodUpdate and validSexualUpdate fixtures defined at top of file

    test('should reject moodUpdate with out-of-range valence (> 100)', () => {
      const data = createValidResponse({
        moodUpdate: { ...validMoodUpdate, valence: 150 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const maxError = validate.errors.find(
        (err) =>
          err.instancePath === '/moodUpdate/valence' && err.keyword === 'maximum'
      );
      expect(maxError).toBeTruthy();
    });

    test('should reject moodUpdate with out-of-range arousal (< -100)', () => {
      const data = createValidResponse({
        moodUpdate: { ...validMoodUpdate, arousal: -150 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const minError = validate.errors.find(
        (err) =>
          err.instancePath === '/moodUpdate/arousal' && err.keyword === 'minimum'
      );
      expect(minError).toBeTruthy();
    });

    test('should reject moodUpdate missing required axis (self_evaluation)', () => {
      const incompleteMood = { ...validMoodUpdate };
      delete incompleteMood.self_evaluation;

      const data = createValidResponse({
        moodUpdate: incompleteMood,
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'self_evaluation'
      );
      expect(missingError).toBeTruthy();
    });

    test('should reject moodUpdate with extra properties', () => {
      const data = createValidResponse({
        moodUpdate: { ...validMoodUpdate, extraField: 'should fail' },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const additionalPropsError = validate.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'extraField'
      );
      expect(additionalPropsError).toBeTruthy();
    });

    test('should reject moodUpdate with non-integer values', () => {
      const data = createValidResponse({
        moodUpdate: { ...validMoodUpdate, valence: 10.5 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const typeError = validate.errors.find(
        (err) =>
          err.instancePath === '/moodUpdate/valence' && err.keyword === 'type'
      );
      expect(typeError).toBeTruthy();
    });
  });

  describe('sexualUpdate validation', () => {
    // Uses validMoodUpdate and validSexualUpdate fixtures defined at top of file

    test('should reject sexualUpdate with negative sex_excitation', () => {
      const data = createValidResponse({
        sexualUpdate: { sex_excitation: -10, sex_inhibition: 50 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const minError = validate.errors.find(
        (err) =>
          err.instancePath === '/sexualUpdate/sex_excitation' &&
          err.keyword === 'minimum'
      );
      expect(minError).toBeTruthy();
    });

    test('should reject sexualUpdate with out-of-range sex_inhibition (> 100)', () => {
      const data = createValidResponse({
        sexualUpdate: { sex_excitation: 50, sex_inhibition: 150 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const maxError = validate.errors.find(
        (err) =>
          err.instancePath === '/sexualUpdate/sex_inhibition' &&
          err.keyword === 'maximum'
      );
      expect(maxError).toBeTruthy();
    });

    test('should reject sexualUpdate missing required field (sex_inhibition)', () => {
      const data = createValidResponse({
        sexualUpdate: { sex_excitation: 50 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'sex_inhibition'
      );
      expect(missingError).toBeTruthy();
    });

    test('should reject sexualUpdate with extra properties', () => {
      const data = createValidResponse({
        sexualUpdate: { ...validSexualUpdate, baseline_libido: 50 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const additionalPropsError = validate.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'baseline_libido'
      );
      expect(additionalPropsError).toBeTruthy();
    });
  });
});
