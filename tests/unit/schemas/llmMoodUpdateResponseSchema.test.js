// tests/unit/schemas/llmMoodUpdateResponseSchema.test.js
// -----------------------------------------------------------------------------
// Contract tests for LLM_MOOD_UPDATE_RESPONSE_SCHEMA.
// Phase 1 of two-phase emotional state update flow: mood/sexual updates only.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import {
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID,
} from '../../../src/turns/schemas/llmOutputSchemas.js';
import { describe, test, expect, beforeAll } from '@jest/globals';

// -----------------------------------------------------------------------------
// Helper – compile the schema once for all tests to keep things DRY.
// -----------------------------------------------------------------------------

let validate;

// Valid fixtures for required fields (all 11 mood axes)
const validMoodUpdate = {
  valence: 25,
  arousal: -10,
  agency_control: 50,
  threat: -30,
  engagement: 75,
  future_expectancy: 0,
  temporal_orientation: 0,
  self_evaluation: -20,
  affiliation: 0,
  inhibitory_control: 0,
  uncertainty: 0,
};

const validSexualUpdate = {
  sex_excitation: 15,
  sex_inhibition: 60,
};

/**
 * Creates a minimal valid response with all required fields.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid response object.
 */
function createValidResponse(overrides = {}) {
  return {
    moodUpdate: { ...validMoodUpdate },
    sexualUpdate: { ...validSexualUpdate },
    ...overrides,
  };
}

beforeAll(() => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  validate = ajv.compile(LLM_MOOD_UPDATE_RESPONSE_SCHEMA);
});

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('LLM_MOOD_UPDATE_RESPONSE_SCHEMA contract', () => {
  describe('schema metadata', () => {
    test('schema ID constant has expected value', () => {
      // Verify the exported ID constant has the expected versioned format
      expect(LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID).toBe(
        'llmMoodUpdateResponseSchema/v1'
      );
    });

    test('schema has valid $id property', () => {
      // The schema's $id is a URI for JSON Schema validation
      expect(LLM_MOOD_UPDATE_RESPONSE_SCHEMA.$id).toBeDefined();
      expect(typeof LLM_MOOD_UPDATE_RESPONSE_SCHEMA.$id).toBe('string');
    });
  });

  describe('valid responses', () => {
    test('valid complete response validates successfully', () => {
      const data = createValidResponse();

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('missing required root properties', () => {
    test('missing moodUpdate object fails validation', () => {
      const data = {
        sexualUpdate: validSexualUpdate,
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'moodUpdate'
      );
      expect(missingError).toBeTruthy();
    });

    test('missing sexualUpdate object fails validation', () => {
      const data = {
        moodUpdate: validMoodUpdate,
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'sexualUpdate'
      );
      expect(missingError).toBeTruthy();
    });
  });

  describe('moodUpdate validation', () => {
    test('missing individual mood axis (agency_control) fails validation', () => {
      const incompleteMood = { ...validMoodUpdate };
      delete incompleteMood.agency_control;

      const data = createValidResponse({
        moodUpdate: incompleteMood,
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'agency_control'
      );
      expect(missingError).toBeTruthy();
    });

    test('out-of-range mood value (-101) fails validation', () => {
      const data = createValidResponse({
        moodUpdate: { ...validMoodUpdate, valence: -101 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const minError = validate.errors.find(
        (err) =>
          err.instancePath === '/moodUpdate/valence' && err.keyword === 'minimum'
      );
      expect(minError).toBeTruthy();
    });

    test('out-of-range mood value (101) fails validation', () => {
      const data = createValidResponse({
        moodUpdate: { ...validMoodUpdate, arousal: 101 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const maxError = validate.errors.find(
        (err) =>
          err.instancePath === '/moodUpdate/arousal' && err.keyword === 'maximum'
      );
      expect(maxError).toBeTruthy();
    });

    test('additional mood properties rejected', () => {
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
  });

  describe('sexualUpdate validation', () => {
    test('missing sex_excitation fails validation', () => {
      const data = createValidResponse({
        sexualUpdate: { sex_inhibition: 50 },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'sex_excitation'
      );
      expect(missingError).toBeTruthy();
    });

    test('missing sex_inhibition fails validation', () => {
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

    test('out-of-range sexual value (-1) fails validation', () => {
      const data = createValidResponse({
        sexualUpdate: { sex_excitation: -1, sex_inhibition: 50 },
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

    test('out-of-range sexual value (101) fails validation', () => {
      const data = createValidResponse({
        sexualUpdate: { sex_excitation: 50, sex_inhibition: 101 },
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

    test('additional sexual properties rejected', () => {
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

  describe('additional root properties', () => {
    test('additional root properties rejected', () => {
      const data = createValidResponse();
      data.unexpectedField = 'should fail';

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const additionalPropsError = validate.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'unexpectedField'
      );
      expect(additionalPropsError).toBeTruthy();
    });
  });
});
