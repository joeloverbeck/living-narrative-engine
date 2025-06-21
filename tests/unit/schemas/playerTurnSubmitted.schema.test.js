import Ajv from 'ajv';
import commonSchema from '../../../data/schemas/common.schema.json';
import eventDefSchema from '../../../data/schemas/event.schema.json';
import eventFile from '../../../data/mods/core/events/player_turn_submitted.event.json';
import { describe, beforeAll, test, expect } from '@jest/globals';

describe('PLAYER_TURN_SUBMITTED_ID schema', () => {
  let ajv;
  let validateDef;

  beforeAll(() => {
    ajv = new Ajv({ strict: false });
    ajv.addSchema(commonSchema, 'common.schema.json');
    validateDef = ajv.compile(eventDefSchema);
  });

  test('event definition is valid against event.schema.json', () => {
    const valid = validateDef(eventFile);
    if (!valid) console.error(validateDef.errors);
    expect(valid).toBe(true);
  });

  describe('payload validation', () => {
    let validatePayload;

    beforeAll(() => {
      validatePayload = ajv.compile(eventFile.payloadSchema);
    });

    test('accepts a well-formed payload', () => {
      expect(
        validatePayload({
          submittedByActorId: 'actor-123',
          chosenIndex: 2,
          speech: 'Let’s do this!',
        })
      ).toBe(true);
    });

    test('rejects missing required properties', () => {
      expect(
        validatePayload({
          submittedByActorId: 'actor-123',
          chosenIndex: 2,
        })
      ).toBe(false);
    });

    test('rejects empty submittedByActorId', () => {
      expect(
        validatePayload({
          submittedByActorId: '',
          chosenIndex: 1,
          speech: null,
        })
      ).toBe(false);
    });

    test('rejects chosenIndex ≤ 0', () => {
      expect(
        validatePayload({
          submittedByActorId: 'actor-123',
          chosenIndex: 0,
          speech: null,
        })
      ).toBe(false);
    });

    test('rejects additional properties', () => {
      expect(
        validatePayload({
          submittedByActorId: 'actor-123',
          chosenIndex: 1,
          speech: null,
          extra: 'not allowed',
        })
      ).toBe(false);
    });
  });
});
