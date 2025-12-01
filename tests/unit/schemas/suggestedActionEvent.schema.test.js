/**
 * @file Schema validation for the core:suggested_action event definition.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';
import commonSchema from '../../../data/schemas/common.schema.json';
import eventDefSchema from '../../../data/schemas/event.schema.json';
import suggestedActionEvent from '../../../data/mods/core/events/suggested_action.event.json';

describe('core:suggested_action event schema', () => {
  let ajv;
  let validateDef;

  beforeAll(() => {
    ajv = new Ajv({ strict: false });
    addFormats(ajv);
    ajv.addSchema(commonSchema);
    validateDef = ajv.compile(eventDefSchema);
  });

  test('event definition conforms to event.schema.json', () => {
    const valid = validateDef(suggestedActionEvent);
    if (!valid) {
      // Helpful debugging if this fails in CI
      // eslint-disable-next-line no-console
      console.error(validateDef.errors);
    }
    expect(valid).toBe(true);
  });

  describe('payload schema validation', () => {
    let validatePayload;

    beforeAll(() => {
      validatePayload = ajv.compile(suggestedActionEvent.payloadSchema);
    });

    const basePayload = {
      actorId: 'core:actor_1',
      suggestedIndex: 2,
      suggestedActionDescriptor: 'Move north',
      speech: 'We should head north.',
      thoughts: 'This seems safest.',
      notes: [
        { text: 'Prefers safety', subject: 'motivation', subjectType: 'state' },
        {
          text: 'Check surroundings',
          subject: 'tactics',
          subjectType: 'plan',
          context: 'cautious',
        },
      ],
    };

    test('accepts a full payload', () => {
      expect(validatePayload(basePayload)).toBe(true);
    });

    test('allows nullable optional fields', () => {
      const payload = {
        actorId: 'core:actor_1',
        suggestedIndex: 1,
        suggestedActionDescriptor: null,
        speech: null,
        thoughts: null,
        notes: null,
      };
      expect(validatePayload(payload)).toBe(true);
    });

    test('allows null suggestedIndex when no actions are available', () => {
      const payload = {
        actorId: 'core:actor_1',
        suggestedIndex: null,
        suggestedActionDescriptor: null,
        speech: null,
        thoughts: null,
        notes: null,
      };
      expect(validatePayload(payload)).toBe(true);
    });

    test('allows structured notes with subjectType', () => {
      const payload = {
        actorId: 'core:actor_1',
        suggestedIndex: 1,
        suggestedActionDescriptor: 'Act',
        speech: null,
        thoughts: null,
        notes: [
          {
            text: 'Track the catfolk mercenary',
            subject: 'Vespera Nightwhisper',
            subjectType: 'entity',
            context: 'Arrived with Bertram',
          },
        ],
      };
      expect(validatePayload(payload)).toBe(true);
    });

    test('supports notes that omit subjectType for backward compatibility', () => {
      const payload = {
        actorId: 'core:actor_1',
        suggestedIndex: 1,
        suggestedActionDescriptor: 'Act',
        speech: null,
        thoughts: null,
        notes: [{ text: 'Legacy note', subject: 'topic' }],
      };
      expect(validatePayload(payload)).toBe(true);
    });

    test('rejects notes with unexpected fields even in legacy form', () => {
      const payload = {
        actorId: 'core:actor_1',
        suggestedIndex: 1,
        suggestedActionDescriptor: 'Act',
        speech: null,
        thoughts: null,
        notes: [
          {
            text: 'Legacy note',
            subject: 'topic',
            extra: 'nope',
          },
        ],
      };
      expect(validatePayload(payload)).toBe(false);
    });

    test('rejects payload without actorId', () => {
      const { actorId, ...rest } = basePayload;
      expect(validatePayload(rest)).toBe(false);
    });

    test('rejects payload without suggestedIndex', () => {
      const { suggestedIndex, ...rest } = basePayload;
      expect(validatePayload(rest)).toBe(false);
    });

    test('rejects negative or zero suggestedIndex', () => {
      expect(validatePayload({ ...basePayload, suggestedIndex: 0 })).toBe(false);
      expect(validatePayload({ ...basePayload, suggestedIndex: -1 })).toBe(
        false
      );
    });

    test('rejects additional properties', () => {
      expect(validatePayload({ ...basePayload, extra: 'nope' })).toBe(false);
    });
  });
});
