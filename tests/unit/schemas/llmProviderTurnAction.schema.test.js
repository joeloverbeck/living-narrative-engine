// tests/schemas/llmProviderTurnAction.schema.test.js
// -----------------------------------------------------------------------------
// JSON‑Schema validation tests for the LLM Provider Turn Action schema.
// NOTE: In v5, moodUpdate/sexualUpdate are handled separately by MoodResponseProcessor,
// not included in the action response schema.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// v5: Define test-specific schema since default schemas were removed.
// This schema reflects the v5 action response structure (without moodUpdate/sexualUpdate).
const LLM_PROVIDER_TURN_ACTION_SCHEMA = {
  type: 'object',
  properties: {
    chosenIndex: {
      type: 'integer',
      minimum: 1,
      description: 'The 1-based index of the chosen action from the available options.',
    },
    speech: {
      type: 'string',
      description: "The character's spoken dialogue.",
    },
    thoughts: {
      type: 'string',
      description: "The character's internal thoughts.",
    },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1 },
          subject: { type: 'string', minLength: 1 },
          subjectType: {
            type: 'string',
            enum: ['self', 'other', 'knowledge', 'location'],
          },
        },
        required: ['text', 'subject', 'subjectType'],
        additionalProperties: false,
      },
      description: 'Optional notes about the situation.',
    },
  },
  required: ['chosenIndex', 'speech', 'thoughts'],
  additionalProperties: false,
};

describe('JSON‑Schema – LLM_PROVIDER_TURN_ACTION_SCHEMA (v5)', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  const basePayload = {
    chosenIndex: 1,
    speech: 'hello',
    thoughts: 'thinking',
  };

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    validate = ajv.compile(LLM_PROVIDER_TURN_ACTION_SCHEMA);
  });

  /* ── VALID CASES ─────────────────────────────────────────────────────── */
  test.each([
    ['minimal payload', basePayload],
    [
      'empty speech and thoughts',
      { ...basePayload, chosenIndex: 5, speech: '', thoughts: '' },
    ],
    [
      'with empty notes array',
      { ...basePayload, speech: 's', thoughts: 't', notes: [] },
    ],
    [
      'with notes entries',
      {
        ...basePayload,
        chosenIndex: 2,
        speech: 'action',
        thoughts: 'inner monologue',
        notes: [
          {
            text: 'note1',
            subject: 'test_subject',
            subjectType: 'other',
          },
          {
            text: 'another note',
            subject: 'another_subject',
            subjectType: 'knowledge',
          },
        ],
      },
    ],
  ])('✓ %s – should validate', (_label, payload) => {
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  /* ── INVALID CASES ───────────────────────────────────────────────────── */
  test.each([
    ['missing chosenIndex', { ...basePayload, chosenIndex: undefined }],
    ['missing speech', { ...basePayload, speech: undefined }],
    ['missing thoughts', { ...basePayload, thoughts: undefined }],
    ['chosenIndex too low (0)', { ...basePayload, chosenIndex: 0 }],
    ['chosenIndex negative', { ...basePayload, chosenIndex: -5 }],
    [
      'chosenIndex non-integer',
      { ...basePayload, chosenIndex: 1.5 },
    ],
    ['speech not a string', { ...basePayload, speech: 123 }],
    ['thoughts not a string', { ...basePayload, thoughts: 456 }],
    [
      'notes not an array',
      { ...basePayload, notes: 'not-array' },
    ],
    [
      'note item missing required fields',
      { ...basePayload, notes: [{ text: 'note' }] },
    ],
    [
      'additional property at root',
      { ...basePayload, extra: 'x' },
    ],
  ])('✗ %s – should reject', (_label, payload) => {
    if (payload.chosenIndex === undefined) {
      delete payload.chosenIndex;
    }
    if (payload.speech === undefined) {
      delete payload.speech;
    }
    if (payload.thoughts === undefined) {
      delete payload.thoughts;
    }
    const ok = validate(payload);
    expect(ok).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });

  /* ── v5 SPECIFIC: moodUpdate/sexualUpdate NOT in action schema ───────── */
  test('v5: moodUpdate should be rejected (handled by MoodResponseProcessor)', () => {
    const payloadWithMood = {
      ...basePayload,
      moodUpdate: { valence: 10 },
    };
    const ok = validate(payloadWithMood);
    expect(ok).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: 'additionalProperties' }),
      ])
    );
  });

  test('v5: sexualUpdate should be rejected (handled by MoodResponseProcessor)', () => {
    const payloadWithSexual = {
      ...basePayload,
      sexualUpdate: { sex_excitation: 25 },
    };
    const ok = validate(payloadWithSexual);
    expect(ok).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: 'additionalProperties' }),
      ])
    );
  });
});
