// tests/schemas/core.notes.schema.test.js
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import coreNotesComponent from '../../../data/mods/core/components/notes.component.json';
import { beforeAll, describe, expect, test } from '@jest/globals';

describe('JSON-Schema – core:notes component', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateEntity;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);

    // Pull out *only* the schema that describes the note data
    const coreNotesDataSchema = {
      ...coreNotesComponent.dataSchema,
      $id: 'core:notes', // so $ref: 'core:notes#' resolves
      title: 'core:notes data', // optional, nice for error messages
    };

    ajv.addSchema(coreNotesDataSchema); // register as ‘core:notes’

    // Wrapper “entity” schema where the component is optional
    validateEntity = ajv.compile({
      $id: 'test://schemas/entity-with-optional-notes',
      type: 'object',
      properties: { 'core:notes': { $ref: 'core:notes#' } },
      additionalProperties: true,
    });
  });

  /* ── VALID CASES ─────────────────────────────────────────────────────── */
  test.each([
    ['no core:notes key', {}],
    ['core:notes with empty array', { 'core:notes': { notes: [] } }],
  ])('✓ %s – should validate', (_label, payload) => {
    const ok = validateEntity(payload);
    if (!ok) console.error(validateEntity.errors);
    expect(ok).toBe(true);
  });

  /* ── INVALID CASES ───────────────────────────────────────────────────── */
  test.each([
    [
      'empty text',
      {
        'core:notes': {
          notes: [{ text: '', timestamp: '2025-06-04T12:00:00Z' }],
        },
      },
    ],
    ['missing timestamp', { 'core:notes': { notes: [{ text: 'foo' }] } }],
    [
      'malformed timestamp',
      { 'core:notes': { notes: [{ text: 'foo', timestamp: 'not-a-date' }] } },
    ],
    [
      'extra property',
      {
        'core:notes': {
          notes: [
            { text: 'foo', timestamp: '2025-06-04T12:00:00Z', extra: 123 },
          ],
        },
      },
    ],
  ])('✗ %s – should reject', (_label, payload) => {
    expect(validateEntity(payload)).toBe(false);
    expect(validateEntity.errors?.length).toBeGreaterThan(0);
  });
});
