/**
 * @file Test suite to validate the goals component schema.
 * @see tests/schemas/core.goals.schema.test.js
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import coreGoalsComponent from '../../../data/mods/core/components/goals.component.json';
import { beforeAll, describe, expect, test } from '@jest/globals';

/**
 * Test suite – JSON‑Schema validation for the `movement:goals` component.
 *
 * Mirrors the structure of the existing `core:notes` schema tests to ensure
 * consistent coverage and behaviour across similar components.
 *
 * Valid cases:
 *   • entities without a `movement:goals` key
 *   • entities with an empty `goals` array
 *
 * Invalid cases:
 *   • goal object with empty `text`
 *   • goal object missing `text`
 *   • goal object missing `timestamp`
 *   • goal object with malformed `timestamp`
 *   • goal object with additional properties
 */

describe('JSON‑Schema – movement:goals component', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateEntity;

  /* ---------------------------------------------------------------------- */
  /*  Compile reusable validator once per suite                             */
  /* ---------------------------------------------------------------------- */
  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);

    // Isolate the data schema for the component and give it a canonical $id
    const coreGoalsDataSchema = {
      ...coreGoalsComponent.dataSchema,
      $id: 'movement:goals',
      title: 'movement:goals data',
    };

    ajv.addSchema(coreGoalsDataSchema);

    // Minimal wrapper schema where the component is optional on the entity
    validateEntity = ajv.compile({
      $id: 'test://schemas/entity-with-optional-goals',
      type: 'object',
      properties: { 'movement:goals': { $ref: 'movement:goals#' } },
      additionalProperties: true,
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  ✓ VALID payloads                                                      */
  /* ---------------------------------------------------------------------- */
  test.each([
    ['no movement:goals key', {}],
    ['movement:goals with empty array', { 'movement:goals': { goals: [] } }],
    [
      'goal without timestamp',
      { 'movement:goals': { goals: [{ text: 'A goal without timestamp' }] } },
    ],
  ])('✓ %s – should validate', (_label, payload) => {
    const ok = validateEntity(payload);
    if (!ok) console.error(validateEntity.errors);
    expect(ok).toBe(true);
  });

  /* ---------------------------------------------------------------------- */
  /*  ✗ INVALID payloads                                                    */
  /* ---------------------------------------------------------------------- */
  test.each([
    [
      'empty text',
      {
        'movement:goals': {
          goals: [{ text: '', timestamp: '2025-06-04T12:00:00Z' }],
        },
      },
    ],
    [
      'missing text property',
      {
        'movement:goals': {
          goals: [{ timestamp: '2025-06-04T12:00:00Z' }],
        },
      },
    ],
    [
      'malformed timestamp',
      {
        'movement:goals': {
          goals: [{ text: 'foo', timestamp: 'not-a-date' }],
        },
      },
    ],
    [
      'extra property',
      {
        'movement:goals': {
          goals: [
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
