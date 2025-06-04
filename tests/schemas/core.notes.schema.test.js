/**
 * @file Unit tests for the core:notes JSON-Schema.
 * Validates that arbitrary entity payloads either pass or fail according
 * to the Acceptance Criteria in ticket “Write Unit Tests for core:notes Schema
 * Validation”.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Scenarios covered
 * 1. Entity without core:notes                         → should PASS
 * 2. core:notes with empty notes array                 → should PASS
 * 3. Note with empty text                              → should FAIL
 * 4. Note missing timestamp                            → should FAIL
 * 5. Note with malformed timestamp                     → should FAIL
 * 6. Note with an extra, disallowed property           → should FAIL
 * ──────────────────────────────────────────────────────────────────────────
 *
 * The test harness:
 * • Uses Ajv (strict mode) with ajv-formats for ISO-8601 checking.
 * • Registers the component schema under the ID "core:notes".
 * • Wraps it in a minimal “entity” schema where core:notes is optional.
 *
 * Run with:  npm test
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import coreNotesSchema from '../../data/mods/core/components/notes.component.json';
import { beforeAll, describe, expect, test } from '@jest/globals';

describe('JSON-Schema – core:notes component', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateEntity;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);

    // Register the component schema so it can be $-referred from others.
    ajv.addSchema(coreNotesSchema, 'core:notes');

    // Minimal wrapper: an “entity” that may (or may not) contain core:notes.
    const entitySchema = {
      $id: 'test://schemas/entity-with-optional-notes',
      type: 'object',
      properties: {
        'core:notes': { $ref: 'core:notes#' },
      },
      additionalProperties: true,
    };
    validateEntity = ajv.compile(entitySchema);
  });

  const validCases = [
    ['no core:notes key', {}],
    ['core:notes with empty array', { 'core:notes': { notes: [] } }],
  ];

  test.each(validCases)('✓ %s – should validate', (_label, payload) => {
    const isValid = validateEntity(payload);
    if (!isValid) {
      // Helpful if the test ever fails.
      console.error(validateEntity.errors);
    }
    expect(isValid).toBe(true);
  });

  const invalidCases = [
    [
      'empty text',
      {
        'core:notes': {
          notes: [{ text: '', timestamp: '2025-06-04T12:00:00Z' }],
        },
      },
    ],
    [
      'missing timestamp',
      {
        'core:notes': {
          notes: [{ text: 'foo' }],
        },
      },
    ],
    [
      'malformed timestamp',
      {
        'core:notes': {
          notes: [{ text: 'foo', timestamp: 'not-a-date' }],
        },
      },
    ],
    [
      'extra property on note object',
      {
        'core:notes': {
          notes: [
            {
              text: 'foo',
              timestamp: '2025-06-04T12:00:00Z',
              extra: 123,
            },
          ],
        },
      },
    ],
  ];

  test.each(invalidCases)('✗ %s – should reject', (_label, payload) => {
    const isValid = validateEntity(payload);
    expect(isValid).toBe(false);
    expect(validateEntity.errors).toBeDefined();
    expect(validateEntity.errors.length).toBeGreaterThan(0);
  });
});
