import Ajv from 'ajv';
import commonSchema from '../../../data/schemas/common.schema.json';
import eventDefSchema from '../../../data/schemas/event.schema.json';
import failedEventSchema from '../../../data/mods/core/events/display_failed_action_result.event.json';
import { describe, beforeAll, test, expect } from '@jest/globals';

describe('core:display_failed_action_result schema', () => {
  let ajv;
  let validateDef;

  beforeAll(() => {
    ajv = new Ajv({ strict: false });
    ajv.addSchema(commonSchema, 'common.schema.json');
    validateDef = ajv.compile(eventDefSchema);
  });

  test('event definition is valid against event.schema.json', () => {
    const valid = validateDef(failedEventSchema);
    if (!valid) console.error(validateDef.errors);
    expect(valid).toBe(true);
  });

  describe('payload.message validation', () => {
    let validatePayload;

    beforeAll(() => {
      validatePayload = ajv.compile(failedEventSchema.payloadSchema);
    });

    test('accepts a non-empty message', () => {
      expect(
        validatePayload({ message: 'Action failed due to error X.' })
      ).toBe(true);
    });

    test('rejects an empty message', () => {
      expect(validatePayload({ message: '' })).toBe(false);
    });

    test('rejects missing message property', () => {
      expect(validatePayload({})).toBe(false);
    });

    test('rejects extra properties in payload', () => {
      expect(validatePayload({ message: 'Oops', code: 123 })).toBe(false);
    });
  });
});
