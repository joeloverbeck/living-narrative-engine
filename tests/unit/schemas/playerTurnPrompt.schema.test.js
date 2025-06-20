// tests/schemas/playerTurnPrompt.schema.test.js
// -----------------------------------------------------------------------------
// Contract tests for the PLAYER_TURN_PROMPT_ID payload schema
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import eventDef from '../../../data/mods/core/events/player_turn_prompt.event.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('Schema – PLAYER_TURN_PROMPT_ID payload', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    validate = ajv.compile(eventDef.payloadSchema);
  });

  /* ── VALID PAYLOAD ────────────────────────────────────────────────────── */
  test('happy-path payload validates', () => {
    const payload = {
      entityId: 'core:player_123',
      availableActions: [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          params: {},
          description: 'Skip your turn.',
        },
        {
          index: 2,
          actionId: 'core:go',
          commandString: 'go out to town',
          params: { targetId: '18f98503-a200-4689-947d-3d8a86d7a30c' },
          description: 'Move to another location.',
        },
      ],
    };

    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  /* ── GUARDED FAILURES ─────────────────────────────────────────────────── */
  test.each([
    [
      'missing index',
      { actionId: 'core:wait', commandString: 'wait', description: '…' },
    ],
    ['missing actionId', { index: 1, commandString: 'wait', description: '…' }],
    [
      'missing commandString',
      { index: 1, actionId: 'core:wait', description: '…' },
    ],
    [
      'index not integer',
      {
        index: 1.5,
        actionId: 'core:wait',
        commandString: 'wait',
        description: '…',
      },
    ],
    [
      'extra property rejected',
      {
        index: 1,
        actionId: 'core:wait',
        commandString: 'wait',
        description: '…',
        extra: true,
      },
    ],
  ])('❌ %s – should fail', (_label, actionPatch) => {
    const payload = {
      entityId: 'core:player_123',
      availableActions: [actionPatch],
    };
    expect(validate(payload)).toBe(false);
  });
});
