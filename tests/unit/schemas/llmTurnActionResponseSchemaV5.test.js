// tests/unit/schemas/llmTurnActionResponseSchemaV5.test.js
// -----------------------------------------------------------------------------
// Contract tests for LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.
// Phase 2 of two-phase emotional state update flow: action-only responses.
// This schema explicitly DOES NOT allow moodUpdate or sexualUpdate properties.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import {
  LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID,
} from '../../../src/turns/schemas/llmOutputSchemas.js';
import { SUBJECT_TYPE_ENUM_VALUES } from '../../../src/constants/subjectTypes.js';
import { describe, test, expect, beforeAll } from '@jest/globals';

// -----------------------------------------------------------------------------
// Helper – compile the schema once for all tests to keep things DRY.
// -----------------------------------------------------------------------------

let validate;

/**
 * Creates a minimal valid response with all required fields.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid response object.
 */
function createValidResponse(overrides = {}) {
  return {
    chosenIndex: 1,
    speech: 'Hello there!',
    thoughts: 'I should be cautious.',
    cognitive_ledger: createValidCognitiveLedger(),
    ...overrides,
  };
}

/**
 * Creates a valid note item.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid note object.
 */
function createValidNote(overrides = {}) {
  return {
    text: 'They seem friendly',
    subject: 'stranger',
    subjectType: 'entity',
    ...overrides,
  };
}

/**
 * Creates a valid cognitive ledger payload.
 *
 * @param {object} overrides - Fields to override or add.
 * @returns {object} Valid cognitive ledger object.
 */
function createValidCognitiveLedger(overrides = {}) {
  return {
    settled_conclusions: ['We are in a safe place.'],
    open_questions: ['Who is the stranger?'],
    ...overrides,
  };
}

beforeAll(() => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  validate = ajv.compile(LLM_TURN_ACTION_RESPONSE_SCHEMA_V5);
});

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('LLM_TURN_ACTION_RESPONSE_SCHEMA_V5 contract', () => {
  describe('schema metadata', () => {
    test('schema ID constant has expected value', () => {
      // Verify the exported ID constant has the expected versioned format
      expect(LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID).toBe(
        'llmTurnActionResponseSchema/v5'
      );
    });

    test('schema has valid $id property', () => {
      // The schema's $id is a URI for JSON Schema validation
      expect(LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.$id).toBeDefined();
      expect(typeof LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.$id).toBe('string');
    });
  });

  describe('valid responses', () => {
    test('valid response with required fields validates (chosenIndex, speech, thoughts)', () => {
      const data = createValidResponse();

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('valid response with optional notes array validates', () => {
      const data = createValidResponse({
        notes: [createValidNote()],
      });

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('valid response with cognitive_ledger validates', () => {
      const data = createValidResponse({
        cognitive_ledger: createValidCognitiveLedger(),
      });

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('missing required fields', () => {
    test('missing chosenIndex fails validation', () => {
      const data = {
        speech: 'Hello',
        thoughts: 'Thinking...',
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'chosenIndex'
      );
      expect(missingError).toBeTruthy();
    });

    test('missing speech fails validation', () => {
      const data = {
        chosenIndex: 1,
        thoughts: 'Thinking...',
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' && err.params?.missingProperty === 'speech'
      );
      expect(missingError).toBeTruthy();
    });

    test('missing thoughts fails validation', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello',
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'thoughts'
      );
      expect(missingError).toBeTruthy();
    });
  });

  describe('chosenIndex validation', () => {
    test('invalid chosenIndex (0) fails validation', () => {
      const data = createValidResponse({ chosenIndex: 0 });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const minError = validate.errors.find(
        (err) =>
          err.instancePath === '/chosenIndex' && err.keyword === 'minimum'
      );
      expect(minError).toBeTruthy();
    });

    test('invalid chosenIndex (negative) fails validation', () => {
      const data = createValidResponse({ chosenIndex: -1 });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const minError = validate.errors.find(
        (err) =>
          err.instancePath === '/chosenIndex' && err.keyword === 'minimum'
      );
      expect(minError).toBeTruthy();
    });
  });

  describe('notes validation', () => {
    test('notes array with valid items validates', () => {
      const data = createValidResponse({
        notes: [
          createValidNote(),
          createValidNote({ text: 'Another observation', subject: 'room' }),
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('notes item missing text fails validation', () => {
      const data = createValidResponse({
        notes: [
          {
            subject: 'stranger',
            subjectType: 'entity',
          },
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' && err.params?.missingProperty === 'text'
      );
      expect(missingError).toBeTruthy();
    });

    test('notes item missing subject fails validation', () => {
      const data = createValidResponse({
        notes: [
          {
            text: 'Some observation',
            subjectType: 'entity',
          },
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'subject'
      );
      expect(missingError).toBeTruthy();
    });

    test('notes item missing subjectType fails validation', () => {
      const data = createValidResponse({
        notes: [
          {
            text: 'Some observation',
            subject: 'stranger',
          },
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'subjectType'
      );
      expect(missingError).toBeTruthy();
    });

    test('notes item with invalid subjectType fails validation', () => {
      const data = createValidResponse({
        notes: [
          {
            text: 'Some observation',
            subject: 'stranger',
            subjectType: 'invalid_type',
          },
        ],
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const enumError = validate.errors.find(
        (err) =>
          err.keyword === 'enum' && err.instancePath === '/notes/0/subjectType'
      );
      expect(enumError).toBeTruthy();
    });

    test('subjectType enum matches SUBJECT_TYPE_ENUM_VALUES constant', () => {
      const schemaEnum =
        LLM_TURN_ACTION_RESPONSE_SCHEMA_V5.properties.notes.items.properties
          .subjectType.enum;

      expect(schemaEnum.sort()).toEqual([...SUBJECT_TYPE_ENUM_VALUES].sort());
    });
  });

  describe('cognitive_ledger validation', () => {
    test('missing cognitive_ledger fails validation (required field)', () => {
      const data = {
        chosenIndex: 1,
        speech: 'Hello there!',
        thoughts: 'I should be cautious.',
        // cognitive_ledger intentionally omitted
      };

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'cognitive_ledger'
      );
      expect(missingError).toBeTruthy();
    });

    test('missing settled_conclusions fails validation', () => {
      const data = createValidResponse({
        cognitive_ledger: createValidCognitiveLedger({
          settled_conclusions: undefined,
        }),
      });
      delete data.cognitive_ledger.settled_conclusions;

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'settled_conclusions'
      );
      expect(missingError).toBeTruthy();
    });

    test('missing open_questions fails validation', () => {
      const data = createValidResponse({
        cognitive_ledger: createValidCognitiveLedger({ open_questions: undefined }),
      });
      delete data.cognitive_ledger.open_questions;

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const missingError = validate.errors.find(
        (err) =>
          err.keyword === 'required' &&
          err.params?.missingProperty === 'open_questions'
      );
      expect(missingError).toBeTruthy();
    });

    test('settled_conclusions with more than 3 items fails validation', () => {
      const data = createValidResponse({
        cognitive_ledger: createValidCognitiveLedger({
          settled_conclusions: ['a', 'b', 'c', 'd'],
        }),
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const maxItemsError = validate.errors.find(
        (err) =>
          err.instancePath === '/cognitive_ledger/settled_conclusions' &&
          err.keyword === 'maxItems'
      );
      expect(maxItemsError).toBeTruthy();
    });

    test('open_questions with more than 3 items fails validation', () => {
      const data = createValidResponse({
        cognitive_ledger: createValidCognitiveLedger({
          open_questions: ['a', 'b', 'c', 'd'],
        }),
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const maxItemsError = validate.errors.find(
        (err) =>
          err.instancePath === '/cognitive_ledger/open_questions' &&
          err.keyword === 'maxItems'
      );
      expect(maxItemsError).toBeTruthy();
    });

    test('cognitive_ledger rejects empty string items', () => {
      const data = createValidResponse({
        cognitive_ledger: createValidCognitiveLedger({
          settled_conclusions: [''],
        }),
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const minLengthError = validate.errors.find(
        (err) =>
          err.instancePath === '/cognitive_ledger/settled_conclusions/0' &&
          err.keyword === 'minLength'
      );
      expect(minLengthError).toBeTruthy();
    });

    test('cognitive_ledger rejects additional properties', () => {
      const data = createValidResponse({
        cognitive_ledger: createValidCognitiveLedger({
          extraField: 'nope',
        }),
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

  describe('additional properties rejected', () => {
    test('NO moodUpdate property allowed - additional properties rejected', () => {
      const data = createValidResponse({
        moodUpdate: {
          valence: 10,
          arousal: 20,
          agency_control: 30,
          threat: 40,
          engagement: 50,
          future_expectancy: 60,
          self_evaluation: 70,
        },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const additionalPropsError = validate.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'moodUpdate'
      );
      expect(additionalPropsError).toBeTruthy();
    });

    test('NO sexualUpdate property allowed - additional properties rejected', () => {
      const data = createValidResponse({
        sexualUpdate: {
          sex_excitation: 30,
          sex_inhibition: 70,
        },
      });

      const isValid = validate(data);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      const additionalPropsError = validate.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'sexualUpdate'
      );
      expect(additionalPropsError).toBeTruthy();
    });
  });
});
