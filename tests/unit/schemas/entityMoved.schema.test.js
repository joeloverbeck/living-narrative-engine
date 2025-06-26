// tests/schemas/entityMoved.schema.test.js
// -----------------------------------------------------------------------------
// Contract tests for the core:entity_moved payload schema
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import eventDef from '../../../data/mods/core/events/entity_moved.event.json';
import commonSchema from '../../../data/schemas/common.schema.json';

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

  /* ── VALID PAYLOADS ──────────────────────────────────────────────────────── */

  test('should validate a valid payload', () => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'some:entity',
      previousLocationId: 'some:location',
      currentLocationId: 'another:location',
      originalCommand: 'go north',
    };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  /* ── INVALID PAYLOADS ───────────────────────────────────────────────────── */

  test.each([
    ['eventName'],
    ['entityId'],
    ['previousLocationId'],
    ['currentLocationId'],
    ['originalCommand'],
  ])('should reject a payload with a missing property: %s', (missingProperty) => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'some:entity',
      previousLocationId: 'some:location',
      currentLocationId: 'another:location',
      originalCommand: 'go north',
    };
    delete payload[missingProperty];
    expect(validate(payload)).toBe(false);
  });

  test('should reject a payload with an extra property', () => {
    const payload = {
      eventName: 'core:entity_moved',
      entityId: 'some:entity',
      previousLocationId: 'some:location',
      currentLocationId: 'another:location',
      originalCommand: 'go north',
      extra: 'property',
    };
    expect(validate(payload)).toBe(false);
  });
});
