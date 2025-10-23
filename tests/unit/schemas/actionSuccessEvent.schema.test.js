/**
 * @file Test suite to validate the core:action_success event definition.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import commonSchema from '../../../data/schemas/common.schema.json';
import eventDefSchema from '../../../data/schemas/event.schema.json';
import actionSuccessSchema from '../../../data/mods/core/events/action_success.event.json';
import { describe, beforeAll, test, expect } from '@jest/globals';

describe('core:action_success event schema', () => {
  let ajv;
  let validateDef;

  beforeAll(() => {
    ajv = new Ajv({ strict: false });
    addFormats(ajv);
    ajv.addSchema(commonSchema, 'common.schema.json');
    validateDef = ajv.compile(eventDefSchema);
  });

  test('event definition conforms to event schema', () => {
    const valid = validateDef(actionSuccessSchema);
    if (!valid) {
      console.error(validateDef.errors);
    }
    expect(valid).toBe(true);
  });

  describe('payload schema validation', () => {
    let validatePayload;

    beforeAll(() => {
      validatePayload = ajv.compile(actionSuccessSchema.payloadSchema);
    });

    const basePayload = {
      eventName: 'core:action_success',
      actionId: 'affection:tickle_target_playfully',
      actorId: 'actor-123',
      targetId: 'target-456',
      success: true,
    };

    test('accepts payload with all required fields', () => {
      expect(validatePayload(basePayload)).toBe(true);
    });

    test('allows payload without eventName', () => {
      const { eventName, ...payload } = basePayload;
      expect(validatePayload(payload)).toBe(true);
    });

    test('allows payload without targetId', () => {
      const { targetId, ...payload } = basePayload;
      expect(validatePayload(payload)).toBe(true);
    });

    test('rejects payload when success is false', () => {
      expect(validatePayload({ ...basePayload, success: false })).toBe(false);
    });

    test('rejects payload without actionId', () => {
      const { actionId, ...payload } = basePayload;
      expect(validatePayload(payload)).toBe(false);
    });

    test('rejects payload with unexpected properties', () => {
      expect(validatePayload({ ...basePayload, extra: 'nope' })).toBe(false);
    });
  });
});
