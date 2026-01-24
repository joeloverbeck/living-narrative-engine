// tests/unit/schemas/llmOutputSchemas.affiliationAxis.test.js
// -----------------------------------------------------------------------------
// Tests that verify the affiliation mood axis is properly integrated into
// the LLM mood update response schema (v1).
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LLM_MOOD_UPDATE_RESPONSE_SCHEMA } from '../../../src/turns/schemas/llmOutputSchemas.js';
import { describe, test, expect, beforeAll } from '@jest/globals';

// -----------------------------------------------------------------------------
// Helper – compile schema once for all tests
// -----------------------------------------------------------------------------

let validateMoodUpdate;

// Valid fixtures that include all 14 mood axes including affiliation
const validMoodUpdateWith14Axes = {
  valence: 10,
  arousal: -20,
  agency_control: 30,
  threat: -40,
  engagement: 50,
  future_expectancy: -60,
  temporal_orientation: 5,
  self_evaluation: 70,
  affiliation: 15,
  inhibitory_control: 0,
  uncertainty: 0,
  contamination_salience: 0,
  rumination: 0,
  evaluation_pressure: 0,
};

const validMoodUpdateWithout_Affiliation = {
  valence: 10,
  arousal: -20,
  agency_control: 30,
  threat: -40,
  engagement: 50,
  future_expectancy: -60,
  temporal_orientation: 5,
  self_evaluation: 70,
  inhibitory_control: 0,
  uncertainty: 0,
  contamination_salience: 0,
  rumination: 0,
  evaluation_pressure: 0,
};

const validSexualUpdate = {
  sex_excitation: 30,
  sex_inhibition: 70,
};

/**
 * Creates a valid mood update response.
 */
function createValidMoodResponse(overrides = {}) {
  return {
    moodUpdate: validMoodUpdateWith14Axes,
    sexualUpdate: validSexualUpdate,
    ...overrides,
  };
}

beforeAll(() => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  validateMoodUpdate = ajv.compile(LLM_MOOD_UPDATE_RESPONSE_SCHEMA);
});

// -----------------------------------------------------------------------------
// Test Suite - LLM_MOOD_UPDATE_RESPONSE_SCHEMA
// -----------------------------------------------------------------------------

describe('LLM_MOOD_UPDATE_RESPONSE_SCHEMA affiliation axis', () => {
  test('should accept valid response with affiliation axis', () => {
    const data = createValidMoodResponse();

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(true);
    expect(validateMoodUpdate.errors).toBeNull();
  });

  test('should require affiliation axis in moodUpdate', () => {
    const data = createValidMoodResponse({
      moodUpdate: validMoodUpdateWithout_Affiliation,
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(false);
    expect(validateMoodUpdate.errors).toBeDefined();

    const missingAffiliationError = validateMoodUpdate.errors.find(
      (err) =>
        err.keyword === 'required' &&
        err.params?.missingProperty === 'affiliation'
    );
    expect(missingAffiliationError).toBeTruthy();
  });

  test('should accept affiliation at minimum bound (-100)', () => {
    const data = createValidMoodResponse({
      moodUpdate: { ...validMoodUpdateWith14Axes, affiliation: -100 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(true);
  });

  test('should accept affiliation at maximum bound (100)', () => {
    const data = createValidMoodResponse({
      moodUpdate: { ...validMoodUpdateWith14Axes, affiliation: 100 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(true);
  });

  test('should reject affiliation below minimum (-101)', () => {
    const data = createValidMoodResponse({
      moodUpdate: { ...validMoodUpdateWith14Axes, affiliation: -101 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(false);

    const minError = validateMoodUpdate.errors.find(
      (err) =>
        err.instancePath === '/moodUpdate/affiliation' &&
        err.keyword === 'minimum'
    );
    expect(minError).toBeTruthy();
  });

  test('should reject affiliation above maximum (101)', () => {
    const data = createValidMoodResponse({
      moodUpdate: { ...validMoodUpdateWith14Axes, affiliation: 101 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(false);

    const maxError = validateMoodUpdate.errors.find(
      (err) =>
        err.instancePath === '/moodUpdate/affiliation' &&
        err.keyword === 'maximum'
    );
    expect(maxError).toBeTruthy();
  });

  test('should reject non-integer affiliation values', () => {
    const data = createValidMoodResponse({
      moodUpdate: { ...validMoodUpdateWith14Axes, affiliation: 10.5 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(false);

    const typeError = validateMoodUpdate.errors.find(
      (err) =>
        err.instancePath === '/moodUpdate/affiliation' && err.keyword === 'type'
    );
    expect(typeError).toBeTruthy();
  });

  test('schema should document 14 mood axes in description', () => {
    const description =
      LLM_MOOD_UPDATE_RESPONSE_SCHEMA.properties.moodUpdate.description;
    expect(description).toContain('14');
  });
});
