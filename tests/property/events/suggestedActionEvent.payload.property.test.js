/**
 * @file Property-based validation for the core:suggested_action payload schema.
 */

import { beforeAll, describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fc from 'fast-check';
import commonSchema from '../../../data/schemas/common.schema.json';
import suggestedActionEvent from '../../../data/mods/core/events/suggested_action.event.json';

const subjectTypeEnum =
  commonSchema.definitions.structuredNote.properties.subjectType.enum;

const nullableStringArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 200 }),
  fc.constant(null)
);

const namespacedSegmentCharArb = fc.constantFrom(
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '_',
  '-'
);

const namespacedSegmentArb = fc
  .array(namespacedSegmentCharArb, { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(''));

const namespacedIdArb = fc
  .tuple(namespacedSegmentArb, namespacedSegmentArb)
  .map(([namespace, id]) => `${namespace}:${id}`);

const timestampArb = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2099-12-31T23:59:59.999Z'),
  })
  .map((date) => date.toISOString());

const legacyNoteArb = fc.record({
  text: fc.string({ minLength: 1, maxLength: 240 }),
  subject: fc.string({ minLength: 1, maxLength: 120 }),
  context: nullableStringArb,
  timestamp: fc.oneof(timestampArb, fc.constant(null)),
});

const typedNoteArb = fc.record({
  text: fc.string({ minLength: 1, maxLength: 240 }),
  subject: fc.string({ minLength: 1, maxLength: 120 }),
  subjectType: fc.constantFrom(...subjectTypeEnum),
  context: nullableStringArb,
  timestamp: fc.oneof(timestampArb, fc.constant(null)),
});

const notesArb = fc.oneof(
  fc.constant(null),
  fc.array(fc.oneof(typedNoteArb, legacyNoteArb), { maxLength: 8 })
);

const payloadArb = fc.record({
  actorId: namespacedIdArb,
  suggestedIndex: fc.oneof(fc.integer({ min: 1, max: 20 }), fc.constant(null)),
  suggestedActionDescriptor: nullableStringArb,
  speech: nullableStringArb,
  thoughts: nullableStringArb,
  notes: notesArb,
});

const disallowedNoteKeyArb = fc
  .string({ minLength: 1, maxLength: 12 })
  .filter(
    (key) =>
      !['text', 'subject', 'subjectType', 'context', 'timestamp'].includes(key)
  );

describe('core:suggested_action payload schema (property)', () => {
  let validatePayload;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema);
    validatePayload = ajv.compile(suggestedActionEvent.payloadSchema);
  });

  it('accepts payloads with mixed typed and legacy notes', () => {
    fc.assert(
      fc.property(payloadArb, (payload) => {
        const valid = validatePayload(payload);
        if (!valid) {
          // eslint-disable-next-line no-console
          console.error(validatePayload.errors);
        }
        expect(valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects additional properties on notes', () => {
    const fallbackNote = {
      text: 'fallback note',
      subject: 'topic',
      subjectType: subjectTypeEnum[0],
      context: null,
      timestamp: null,
    };

    fc.assert(
      fc.property(payloadArb, disallowedNoteKeyArb, nullableStringArb, (payload, extraKey, extraValue) => {
        const baseNotes =
          payload.notes === null || payload.notes.length === 0
            ? [fallbackNote]
            : payload.notes;

        const mutatedNotes = baseNotes.map((note, idx) =>
          idx === 0 ? { ...note, [extraKey]: extraValue } : note
        );
        const mutatedPayload = { ...payload, notes: mutatedNotes };

        expect(validatePayload(mutatedPayload)).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  it('permits nullable optional fields across the payload', () => {
    fc.assert(
      fc.property(namespacedIdArb, (actorId) => {
        const payload = {
          actorId,
          suggestedIndex: null,
          suggestedActionDescriptor: null,
          speech: null,
          thoughts: null,
          notes: null,
        };
        expect(validatePayload(payload)).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});
