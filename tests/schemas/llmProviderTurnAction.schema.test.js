// tests/schemas/llmProviderTurnAction.schema.test.js
// -----------------------------------------------------------------------------
// JSON‑Schema validation tests for the LLM_PROVIDER_TURN_ACTION_SCHEMA
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA } from '../../src/llms/constants/llmConstants.js';
import { describe, beforeAll, test, expect } from '@jest/globals';

const schema = OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema;

describe('JSON‑Schema – LLM_PROVIDER_TURN_ACTION_SCHEMA', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    validate = ajv.compile(schema);
  });

  /* ── VALID CASES ─────────────────────────────────────────────────────── */
  test.each([
    [
      'minimal payload',
      { chosenActionId: 1, speech: 'hello', thoughts: 'thinking' },
    ],
    [
      'empty speech and thoughts',
      { chosenActionId: 5, speech: '', thoughts: '' },
    ],
    [
      'with empty notes array',
      { chosenActionId: 1, speech: 's', thoughts: 't', notes: [] },
    ],
    [
      'with notes entries',
      {
        chosenActionId: 2,
        speech: 'action',
        thoughts: 'inner monologue',
        notes: ['note1', 'another note'],
      },
    ],
  ])('✓ %s – should validate', (_label, payload) => {
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  /* ── INVALID CASES ───────────────────────────────────────────────────── */
  test.each([
    ['missing chosenActionId', { speech: 'a', thoughts: 'b' }],
    ['missing speech', { chosenActionId: 1, thoughts: 'b' }],
    ['missing thoughts', { chosenActionId: 1, speech: 'a' }],
    [
      'chosenActionId too low (0)',
      { chosenActionId: 0, speech: 'a', thoughts: 'b' },
    ],
    [
      'chosenActionId negative',
      { chosenActionId: -5, speech: 'a', thoughts: 'b' },
    ],
    [
      'chosenActionId non-integer',
      { chosenActionId: 1.5, speech: 'a', thoughts: 'b' },
    ],
    ['speech not a string', { chosenActionId: 1, speech: 123, thoughts: 'b' }],
    [
      'thoughts not a string',
      { chosenActionId: 1, speech: 'a', thoughts: 456 },
    ],
    [
      'notes not an array',
      { chosenActionId: 1, speech: 'a', thoughts: 'b', notes: 'not-array' },
    ],
    [
      'note item empty string',
      { chosenActionId: 1, speech: 'a', thoughts: 'b', notes: [''] },
    ],
    [
      'note item non-string',
      { chosenActionId: 1, speech: 'a', thoughts: 'b', notes: [123] },
    ],
    [
      'additional property at root',
      { chosenActionId: 1, speech: 'a', thoughts: 'b', extra: 'x' },
    ],
  ])('✗ %s – should reject', (_label, payload) => {
    const ok = validate(payload);
    expect(ok).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });
});
