/**
 * @file Property-based validation for component/event ID formats.
 */

import { beforeAll, describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fc from 'fast-check';
import commonSchema from '../../../data/schemas/common.schema.json';
import componentSchema from '../../../data/schemas/component.schema.json';
import eventSchema from '../../../data/schemas/event.schema.json';

const allowedChars = [
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
  '-',
  ':',
];

const allowedCharArb = fc.constantFrom(...allowedChars);

const namespacedIdArb = fc
  .array(allowedCharArb, { minLength: 1, maxLength: 40 })
  .map((chars) => chars.join(''));

const disallowedCharArb = fc.constantFrom(' ', '.', '/', '!', '@', '#', '?');

const invalidIdArb = fc
  .tuple(namespacedIdArb, disallowedCharArb, namespacedIdArb)
  .map(([prefix, badChar, suffix]) => `${prefix}${badChar}${suffix}`);

const buildComponentDefinition = (id) => ({
  id,
  description: 'test component',
  dataSchema: {
    type: 'object',
    properties: {},
    additionalProperties: true,
  },
});

const buildEventDefinition = (id) => ({
  id,
  description: 'test event',
  payloadSchema: null,
});

describe('Component/event ID format (property)', () => {
  let validateComponent;
  let validateEvent;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema);
    validateComponent = ajv.compile(componentSchema);
    validateEvent = ajv.compile(eventSchema);
  });

  it('accepts IDs that match the namespacedId pattern', () => {
    fc.assert(
      fc.property(namespacedIdArb, (id) => {
        expect(validateComponent(buildComponentDefinition(id))).toBe(true);
        expect(validateEvent(buildEventDefinition(id))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects IDs containing disallowed characters', () => {
    fc.assert(
      fc.property(invalidIdArb, (id) => {
        expect(validateComponent(buildComponentDefinition(id))).toBe(false);
        expect(validateEvent(buildEventDefinition(id))).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('documents schema acceptance for colon-optional IDs', () => {
    const cases = ['core', 'core:sub:leaf'];

    for (const id of cases) {
      expect(validateComponent(buildComponentDefinition(id))).toBe(true);
      expect(validateEvent(buildEventDefinition(id))).toBe(true);
    }
  });

  it('rejects empty string IDs', () => {
    expect(validateComponent(buildComponentDefinition(''))).toBe(false);
    expect(validateEvent(buildEventDefinition(''))).toBe(false);
  });
});
