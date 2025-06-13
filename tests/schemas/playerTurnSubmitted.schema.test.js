import Ajv from 'ajv';
import commonSchema from '../../data/schemas/common.schema.json';
import eventDefSchema from '../../data/schemas/event-definition.schema.json';
import eventFile from '../../data/mods/core/events/player_turn_submitted.event.json';
import { describe, beforeAll, test, expect } from '@jest/globals';

describe('core:player_turn_submitted schema', () => {
  let ajv;
  let validateDef;

  beforeAll(() => {
    ajv = new Ajv({ strict: false });
    ajv.addSchema(commonSchema, 'common.schema.json');
    validateDef = ajv.compile(eventDefSchema);
  });

  test('event definition is valid against event-definition.schema.json', () => {
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
          chosenActionId: 2,
          speech: 'Let’s do this!',
        })
      ).toBe(true);
    });

    test('rejects missing required properties', () => {
      expect(
        validatePayload({
          submittedByActorId: 'actor-123',
          chosenActionId: 2,
        })
      ).toBe(false);
    });

    test('rejects empty submittedByActorId', () => {
      expect(
        validatePayload({
          submittedByActorId: '',
          chosenActionId: 1,
          speech: null,
        })
      ).toBe(false);
    });

    test('rejects chosenActionId ≤ 0', () => {
      expect(
        validatePayload({
          submittedByActorId: 'actor-123',
          chosenActionId: 0,
          speech: null,
        })
      ).toBe(false);
    });

    test('rejects additional properties', () => {
      expect(
        validatePayload({
          submittedByActorId: 'actor-123',
          chosenActionId: 1,
          speech: null,
          extra: 'not allowed',
        })
      ).toBe(false);
    });
  });
});
