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
    [
      'note with required fields only',
      {
        'core:notes': {
          notes: [
            {
              text: 'A note about something',
              subject: 'something',
              subjectType: 'other',
            },
          ],
        },
      },
    ],
    [
      'note with all fields',
      {
        'core:notes': {
          notes: [
            {
              text: 'A note about player',
              subject: 'player',
              subjectType: 'character',
              context: 'During combat',
              timestamp: '2025-06-04T12:00:00Z',
            },
          ],
        },
      },
    ],
    [
      'note with valid character subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'NPC behavior',
              subject: 'Iker Aguirre',
              subjectType: 'character',
            },
          ],
        },
      },
    ],
    [
      'note with valid location subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'Area description',
              subject: 'Market Square',
              subjectType: 'location',
            },
          ],
        },
      },
    ],
    [
      'note with valid item subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'Artifact properties',
              subject: 'Magic Sword',
              subjectType: 'item',
            },
          ],
        },
      },
    ],
    [
      'note with valid event subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'Important meeting',
              subject: 'Council Meeting',
              subjectType: 'event',
            },
          ],
        },
      },
    ],
    [
      'note with valid plan subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'Intend to walk into freezing woods on December 24',
              subject: 'December 24 plan',
              subjectType: 'plan',
            },
          ],
        },
      },
    ],
    [
      'note with valid timeline subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'Must survive 122 days until April 27, 1973',
              subject: 'survival timeline',
              subjectType: 'timeline',
            },
          ],
        },
      },
    ],
    [
      'note with valid theory subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'My ontological framework may be fundamentally incomplete',
              subject: 'reality model uncertainty',
              subjectType: 'theory',
            },
          ],
        },
      },
    ],
    [
      'note with valid observation subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'Uses term "miracle" casually when describing claimed abilities',
              subject: 'Jon Ureña language patterns',
              subjectType: 'observation',
            },
          ],
        },
      },
    ],
    [
      'note with valid knowledge_state subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'May have knowledge of December 24 plan without being told',
              subject: 'Jon Ureña knowledge',
              subjectType: 'knowledge_state',
            },
          ],
        },
      },
    ],
    [
      'note with valid psychological_state subjectType',
      {
        'core:notes': {
          notes: [
            {
              text: 'Wrestling with existential dread about nature of reality',
              subject: 'my psychological state',
              subjectType: 'psychological_state',
            },
          ],
        },
      },
    ],
  ])('✓ %s – should validate', (_label, payload) => {
    const ok = validateEntity(payload);
    if (!ok) console.error(validateEntity.errors);
    expect(ok).toBe(true);
  });

  /* ── INVALID CASES ───────────────────────────────────────────────────── */
  test.each([
    [
      'missing required subject field',
      {
        'core:notes': {
          notes: [{ text: 'A note without subject', subjectType: 'other' }],
        },
      },
    ],
    [
      'missing required subjectType field',
      {
        'core:notes': {
          notes: [{ text: 'A note without subjectType', subject: 'player' }],
        },
      },
    ],
    [
      'empty text',
      {
        'core:notes': {
          notes: [{ text: '', subject: 'player', subjectType: 'character' }],
        },
      },
    ],
    [
      'empty subject',
      {
        'core:notes': {
          notes: [{ text: 'A note', subject: '', subjectType: 'other' }],
        },
      },
    ],
    [
      'invalid subjectType',
      {
        'core:notes': {
          notes: [
            { text: 'A note', subject: 'player', subjectType: 'invalid_type' },
          ],
        },
      },
    ],
    [
      'malformed timestamp',
      {
        'core:notes': {
          notes: [
            {
              text: 'foo',
              subject: 'bar',
              subjectType: 'other',
              timestamp: 'not-a-date',
            },
          ],
        },
      },
    ],
    [
      'extra property',
      {
        'core:notes': {
          notes: [
            {
              text: 'foo',
              subject: 'bar',
              subjectType: 'other',
              timestamp: '2025-06-04T12:00:00Z',
              extra: 123,
            },
          ],
        },
      },
    ],
    [
      'tags field (no longer supported)',
      {
        'core:notes': {
          notes: [
            {
              text: 'A note about player',
              subject: 'player',
              subjectType: 'character',
              context: 'During combat',
              tags: ['combat', 'observation'],
              timestamp: '2025-06-04T12:00:00Z',
            },
          ],
        },
      },
    ],
  ])('✗ %s – should reject', (_label, payload) => {
    expect(validateEntity(payload)).toBe(false);
    expect(validateEntity.errors?.length).toBeGreaterThan(0);
  });
});
