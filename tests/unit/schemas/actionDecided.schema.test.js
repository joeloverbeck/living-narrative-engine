// tests/schemas/actionDecided.schema.test.js
// -----------------------------------------------------------------------------
// Contract tests for the core:action_decided payload schema
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import eventDef from '../../../data/mods/core/events/action_decided.event.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('Schema – core:action_decided payload', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    ajv.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    validate = ajv.compile(eventDef.payloadSchema);
  });

  /* ── VALID CASES ──────────────────────────────────────────────────────── */

  test('✓ should validate a payload with full extractedData', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'human',
      extractedData: {
        thoughts: 'This seems like a good idea.',
        notes: ['note 1', 'note 2'],
        speech: 'I will do it.',
      },
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  test('✓ should validate a payload without extractedData', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'ai',
    };
    expect(validate(payload)).toBe(true);
  });

  test('✓ should validate with empty thoughts and notes', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'human',
      extractedData: {
        thoughts: '',
        notes: [],
      },
    };
    expect(validate(payload)).toBe(true);
  });

  test('✓ should validate with only some optional keys present', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'human',
      extractedData: {
        speech: 'This is my speech.',
        thoughts: 'A thought.',
        // notes is omitted, which is valid
      },
    };
    expect(validate(payload)).toBe(true);
  });

  /* ── INVALID CASES ────────────────────────────────────────────────────── */

  test('✗ should NOT validate when thoughts is null', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'human',
      extractedData: {
        thoughts: null, // Invalid type
        notes: [],
      },
    };
    expect(validate(payload)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: '/extractedData/thoughts',
          message: 'must be string',
        }),
      ])
    );
  });

  test('✗ should NOT validate when notes is null', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'human',
      extractedData: {
        thoughts: '',
        notes: null, // Invalid type
      },
    };
    expect(validate(payload)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: '/extractedData/notes',
          message: 'must be array',
        }),
      ])
    );
  });

  test('✗ should NOT validate when thoughts has wrong type (number)', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'human',
      extractedData: {
        thoughts: 12345, // Invalid type
      },
    };
    expect(validate(payload)).toBe(false);
  });

  test('✗ should NOT validate when notes has wrong type (string)', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'human',
      extractedData: {
        notes: 'this should be an array', // Invalid type
      },
    };
    expect(validate(payload)).toBe(false);
  });

  test('✗ should NOT validate with missing required actorId', () => {
    const payload = {
      actorType: 'ai',
    };
    expect(validate(payload)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "must have required property 'actorId'",
        }),
      ])
    );
  });

  test('✗ should NOT validate with invalid actorType', () => {
    const payload = {
      actorId: 'player-1',
      actorType: 'robot', // Not in enum
    };
    expect(validate(payload)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: '/actorType',
          message: 'must be equal to one of the allowed values',
        }),
      ])
    );
  });
});
