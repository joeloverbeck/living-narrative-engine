// tests/schemas/entityMoved.schema.test.js
// -----------------------------------------------------------------------------
// Contract tests for the core:entity_moved payload schema
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import eventDef from '../../data/mods/core/events/entity_moved.event.json';
import commonSchema from '../../data/schemas/common.schema.json';

describe('Schema – core:entity_moved payload', () => {
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

  /* ── VALID PAYLOADS ───────────────────────────────────────────────────── */

  test('should validate a payload with a string direction', () => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'core:player',
      previousLocationId: 'core:room_a',
      currentLocationId: 'core:room_b',
      direction: 'north',
      originalCommand: 'go north',
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  test('should validate a payload with a null direction', () => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'core:player',
      previousLocationId: 'core:guild',
      currentLocationId: 'core:town_square',
      direction: null,
      originalCommand: 'go to town square',
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  /* ── INVALID PAYLOADS ─────────────────────────────────────────────────── */

  test('should reject a payload with a missing direction', () => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'core:player',
      previousLocationId: 'core:room_a',
      currentLocationId: 'core:room_b',
      originalCommand: 'go north',
    };
    expect(validate(payload)).toBe(false);
  });

  test.each([
    ['number', 123],
    ['object', { dir: 'north' }],
    ['array', ['north']],
    ['boolean', true],
  ])('should reject a payload with a %s direction', (_type, value) => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'core:player',
      previousLocationId: 'core:room_a',
      currentLocationId: 'core:room_b',
      direction: value,
      originalCommand: 'go north',
    };
    expect(validate(payload)).toBe(false);
  });

  test('should reject a payload with extra properties', () => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'core:player',
      previousLocationId: 'core:room_a',
      currentLocationId: 'core:room_b',
      direction: 'north',
      originalCommand: 'go north',
      extraField: 'should not be here',
    };
    expect(validate(payload)).toBe(false);
  });
});
