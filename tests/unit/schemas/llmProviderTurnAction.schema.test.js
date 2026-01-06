// tests/schemas/llmProviderTurnAction.schema.test.js
// -----------------------------------------------------------------------------
// JSON‑Schema validation tests for the LLM_PROVIDER_TURN_ACTION_SCHEMA
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA } from '../../../src/llms/constants/llmConstants.js';
import { describe, beforeAll, test, expect } from '@jest/globals';

const schema = OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema;

describe('JSON‑Schema – LLM_PROVIDER_TURN_ACTION_SCHEMA', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;
  const baseMoodUpdate = {
    valence: 10,
    arousal: 5,
    agency_control: 3,
    threat: -4,
    engagement: 2,
    future_expectancy: 1,
    self_evaluation: 0,
  };
  const baseSexualUpdate = {
    sex_excitation: 25,
    sex_inhibition: 30,
  };
  const basePayload = {
    chosenIndex: 1,
    speech: 'hello',
    thoughts: 'thinking',
    moodUpdate: baseMoodUpdate,
    sexualUpdate: baseSexualUpdate,
  };

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    validate = ajv.compile(schema);
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
    [
      'missing moodUpdate',
      { ...basePayload, moodUpdate: undefined },
    ],
    [
      'missing sexualUpdate',
      { ...basePayload, sexualUpdate: undefined },
    ],
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
      'note item empty string',
      { ...basePayload, notes: [''] },
    ],
    [
      'note item non-string',
      { ...basePayload, notes: [123] },
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
    if (payload.moodUpdate === undefined) {
      delete payload.moodUpdate;
    }
    if (payload.sexualUpdate === undefined) {
      delete payload.sexualUpdate;
    }
    const ok = validate(payload);
    expect(ok).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });
});
