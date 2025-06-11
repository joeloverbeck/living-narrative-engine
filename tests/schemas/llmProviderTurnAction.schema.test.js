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
      { chosenIndex: 1, speech: 'hello', thoughts: 'thinking' },
    ],
    ['empty speech and thoughts', { chosenIndex: 5, speech: '', thoughts: '' }],
    [
      'with empty notes array',
      { chosenIndex: 1, speech: 's', thoughts: 't', notes: [] },
    ],
    [
      'with notes entries',
      {
        chosenIndex: 2,
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
    ['missing chosenIndex', { speech: 'a', thoughts: 'b' }],
    ['missing speech', { chosenIndex: 1, thoughts: 'b' }],
    ['missing thoughts', { chosenIndex: 1, speech: 'a' }],
    ['chosenIndex too low (0)', { chosenIndex: 0, speech: 'a', thoughts: 'b' }],
    ['chosenIndex negative', { chosenIndex: -5, speech: 'a', thoughts: 'b' }],
    [
      'chosenIndex non-integer',
      { chosenIndex: 1.5, speech: 'a', thoughts: 'b' },
    ],
    ['speech not a string', { chosenIndex: 1, speech: 123, thoughts: 'b' }],
    ['thoughts not a string', { chosenIndex: 1, speech: 'a', thoughts: 456 }],
    [
      'notes not an array',
      { chosenIndex: 1, speech: 'a', thoughts: 'b', notes: 'not-array' },
    ],
    [
      'note item empty string',
      { chosenIndex: 1, speech: 'a', thoughts: 'b', notes: [''] },
    ],
    [
      'note item non-string',
      { chosenIndex: 1, speech: 'a', thoughts: 'b', notes: [123] },
    ],
    [
      'additional property at root',
      { chosenIndex: 1, speech: 'a', thoughts: 'b', extra: 'x' },
    ],
  ])('✗ %s – should reject', (_label, payload) => {
    const ok = validate(payload);
    expect(ok).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });
});
