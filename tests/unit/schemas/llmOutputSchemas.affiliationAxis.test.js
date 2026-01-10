// tests/unit/schemas/llmOutputSchemas.affiliationAxis.test.js
// -----------------------------------------------------------------------------
// Tests that verify the affiliation mood axis is properly integrated into
// the LLM response schemas.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA,
} from '../../../src/turns/schemas/llmOutputSchemas.js';
import { describe, test, expect, beforeAll } from '@jest/globals';

// -----------------------------------------------------------------------------
// Helper – compile schemas once for all tests
// -----------------------------------------------------------------------------

let validateMoodUpdate;
let validateLegacy;

// Valid fixtures that include all 8 mood axes including affiliation
const validMoodUpdateWith8Axes = {
  valence: 10,
  arousal: -20,
  agency_control: 30,
  threat: -40,
  engagement: 50,
  future_expectancy: -60,
  self_evaluation: 70,
  affiliation: 15,
};

const validMoodUpdateWithout_Affiliation = {
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
 * Creates a valid mood update response.
 */
function createValidMoodResponse(overrides = {}) {
  return {
    moodUpdate: validMoodUpdateWith8Axes,
    sexualUpdate: validSexualUpdate,
    ...overrides,
  };
}

/**
 * Creates a valid legacy response.
 */
function createValidLegacyResponse(overrides = {}) {
  return {
    chosenIndex: 1,
    speech: 'Hello',
    thoughts: 'Internal monologue',
    moodUpdate: validMoodUpdateWith8Axes,
    sexualUpdate: validSexualUpdate,
    ...overrides,
  };
}

beforeAll(() => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  validateMoodUpdate = ajv.compile(LLM_MOOD_UPDATE_RESPONSE_SCHEMA);
  validateLegacy = ajv.compile(LLM_TURN_ACTION_RESPONSE_SCHEMA);
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
      moodUpdate: { ...validMoodUpdateWith8Axes, affiliation: -100 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(true);
  });

  test('should accept affiliation at maximum bound (100)', () => {
    const data = createValidMoodResponse({
      moodUpdate: { ...validMoodUpdateWith8Axes, affiliation: 100 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(true);
  });

  test('should reject affiliation below minimum (-101)', () => {
    const data = createValidMoodResponse({
      moodUpdate: { ...validMoodUpdateWith8Axes, affiliation: -101 },
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
      moodUpdate: { ...validMoodUpdateWith8Axes, affiliation: 101 },
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
      moodUpdate: { ...validMoodUpdateWith8Axes, affiliation: 10.5 },
    });

    const isValid = validateMoodUpdate(data);
    expect(isValid).toBe(false);

    const typeError = validateMoodUpdate.errors.find(
      (err) =>
        err.instancePath === '/moodUpdate/affiliation' && err.keyword === 'type'
    );
    expect(typeError).toBeTruthy();
  });

  test('schema should document 8 mood axes in description', () => {
    const description =
      LLM_MOOD_UPDATE_RESPONSE_SCHEMA.properties.moodUpdate.description;
    expect(description).toContain('8');
  });
});

// -----------------------------------------------------------------------------
// Test Suite - LLM_TURN_ACTION_RESPONSE_SCHEMA (Legacy v4)
// -----------------------------------------------------------------------------

describe('LLM_TURN_ACTION_RESPONSE_SCHEMA (legacy) affiliation axis', () => {
  test('should accept valid response with affiliation axis', () => {
    const data = createValidLegacyResponse();

    const isValid = validateLegacy(data);
    expect(isValid).toBe(true);
    expect(validateLegacy.errors).toBeNull();
  });

  test('should require affiliation axis in moodUpdate', () => {
    const data = createValidLegacyResponse({
      moodUpdate: validMoodUpdateWithout_Affiliation,
    });

    const isValid = validateLegacy(data);
    expect(isValid).toBe(false);
    expect(validateLegacy.errors).toBeDefined();

    const missingAffiliationError = validateLegacy.errors.find(
      (err) =>
        err.keyword === 'required' &&
        err.params?.missingProperty === 'affiliation'
    );
    expect(missingAffiliationError).toBeTruthy();
  });

  test('legacy schema should document 8 mood axes in description', () => {
    const description =
      LLM_TURN_ACTION_RESPONSE_SCHEMA.properties.moodUpdate.description;
    expect(description).toContain('8');
  });
});
