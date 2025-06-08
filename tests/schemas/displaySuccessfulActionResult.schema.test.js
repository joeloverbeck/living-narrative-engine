import Ajv from 'ajv';
import commonSchema from '../../data/schemas/common.schema.json';
import eventDefSchema from '../../data/schemas/event-definition.schema.json';
import successEventSchema from '../../data/mods/core/events/display_successful_action_result.event.json';
import { describe, beforeAll, test, expect } from '@jest/globals';

describe('core:display_successful_action_result schema', () => {
  let ajv;
  let validateDef;

  beforeAll(() => {
    // Allow external $refs and non-strict mode for formats
    ajv = new Ajv({ strict: false });
    // Register common definitions so "$ref": "./common.schema.json#/definitions/..." resolves
    ajv.addSchema(commonSchema, 'common.schema.json');
    validateDef = ajv.compile(eventDefSchema);
  });

  test('schema is valid against event-definition.schema.json', () => {
    const valid = validateDef(successEventSchema);
    if (!valid) console.error(validateDef.errors);
    expect(valid).toBe(true);
  });

  describe('payload.message validation', () => {
    let validatePayload;

    beforeAll(() => {
      // Compile the payloadSchema from the event file
      validatePayload = ajv.compile(successEventSchema.payloadSchema);
    });

    test('accepts a non-empty message', () => {
      expect(validatePayload({ message: 'Action succeeded!' })).toBe(true);
    });

    test('rejects an empty message', () => {
      expect(validatePayload({ message: '' })).toBe(false);
    });

    test('rejects missing message property', () => {
      expect(validatePayload({})).toBe(false);
    });

    test('rejects extra properties in payload', () => {
      expect(validatePayload({ message: 'Hi', extra: 123 })).toBe(false);
    });
  });
});
