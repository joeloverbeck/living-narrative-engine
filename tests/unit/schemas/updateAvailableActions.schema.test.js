// tests/schemas/updateAvailableActions.schema.test.js
// -----------------------------------------------------------------------------
// Contract tests for the core:update_available_actions payload schema
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

import commonSchema from '../../../data/schemas/common.schema.json';
import eventDef from '../../../data/mods/core/events/update_available_actions.event.json';

describe('Schema – core:update_available_actions payload', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    validate = ajv.compile(eventDef.payloadSchema);
  });

  // ────────────────────────── VALID CASE ──────────────────────────
  test('happy-path payload validates', () => {
    const payload = {
      actorId: 'core:player_42',
      actions: [
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
          commandString: 'go west',
          params: { direction: 'west' },
          description: 'Move one room west.',
        },
      ],
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  // ─────────────────────── VISUAL PROPERTY SUPPORT ───────────────────────
  test('payload with visual properties validates', () => {
    const payload = {
      actorId: 'core:player_42',
      actions: [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          params: {},
          description: 'Skip your turn.',
          visual: {
            backgroundColor: '#546e7a',
            textColor: '#ffffff',
            hoverBackgroundColor: '#455a64',
            hoverTextColor: '#ffffff',
          },
        },
        {
          index: 2,
          actionId: 'violence:slap',
          commandString: 'slap target',
          params: { targetId: 'core:npc_1' },
          description: 'Slap someone across the face',
          visual: {
            backgroundColor: '#cc0000',
            textColor: '#ffffff',
            hoverBackgroundColor: '#990000',
            hoverTextColor: '#ffcccc',
          },
        },
      ],
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  test('payload with null visual property validates', () => {
    const payload = {
      actorId: 'core:player_42',
      actions: [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          params: {},
          description: 'Skip your turn.',
          visual: null,
        },
      ],
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  test('payload with partial visual properties validates', () => {
    const payload = {
      actorId: 'core:player_42',
      actions: [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          params: {},
          description: 'Skip your turn.',
          visual: {
            backgroundColor: '#546e7a',
            textColor: '#ffffff',
            // No hover colors - should still be valid
          },
        },
      ],
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  // ─────────────────────── GUARDED FAILURES ───────────────────────
  test.each([
    [
      'missing index',
      { actionId: 'core:wait', commandString: 'wait', description: '...' },
    ],
    [
      'missing actionId',
      { index: 1, commandString: 'wait', description: '...' },
    ],
    [
      'missing commandString',
      { index: 1, actionId: 'core:wait', description: '...' },
    ],
    [
      'index not integer',
      {
        index: 1.25,
        actionId: 'core:wait',
        commandString: 'wait',
        description: '...',
      },
    ],
    [
      'unexpected extra field',
      {
        index: 1,
        actionId: 'core:wait',
        commandString: 'wait',
        description: '...',
        extra: true,
      },
    ],
  ])('❌ %s – should fail', (_label, badAction) => {
    const payload = { actorId: 'core:player_42', actions: [badAction] };
    expect(validate(payload)).toBe(false);
  });
});
