// tests/schemas/entity-definition.schema.test.js
// -----------------------------------------------------------------------------
// Contract tests for the main entity definition schema.
// Ensures that the schema correctly validates the fundamental structure of an
// entity definition, including the allowance for the optional `$schema` property.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import entityDefinitionSchema from '../../data/schemas/entity-definition.schema.json';
import commonSchema from '../../data/schemas/common.schema.json';

describe('Schema – Game Entity Definition contract', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);

    // Add the common schema as a dependency so $ref works correctly
    ajv.addSchema(commonSchema, commonSchema.$id);
    validate = ajv.compile(entityDefinitionSchema);
  });

  /* ---------------------------------------------------------------------- */
  /* ✓ VALID payloads                                                      */
  /* ---------------------------------------------------------------------- */

  test('should validate a basic entity definition without a $schema property', () => {
    const validEntity = {
      id: 'core:player',
      components: {
        'core:name': { text: 'Hero' },
      },
    };
    const ok = validate(validEntity);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  test('should validate an entity definition that INCLUDES the $schema property', () => {
    const validEntityWithSchema = {
      $schema: 'http://example.com/schemas/entity-definition.schema.json',
      id: 'core:adventurers_guild',
      components: {
        'core:name': { text: "Adventurers' Guild" },
        'core:description': { text: 'A place to find quests.' },
      },
    };
    const ok = validate(validEntityWithSchema);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  /* ---------------------------------------------------------------------- */
  /* ✗ INVALID payloads                                                    */
  /* ---------------------------------------------------------------------- */

  test('should reject an entity definition with an unknown additional property', () => {
    const invalidEntity = {
      id: 'core:player',
      components: { 'core:name': { text: 'Hero' } },
      unknownProperty: 'should not be here',
    };
    expect(validate(invalidEntity)).toBe(false);
    const error = validate.errors.find(
      (e) => e.keyword === 'additionalProperties'
    );
    expect(error).toBeDefined();
    expect(error.params.additionalProperty).toBe('unknownProperty');
  });

  test('should reject an entity definition missing the "id" property', () => {
    const invalidEntity = {
      components: { 'core:name': { text: 'Nameless' } },
    };
    expect(validate(invalidEntity)).toBe(false);
    const error = validate.errors.find(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'id'
    );
    expect(error).toBeDefined();
  });

  test('should reject an entity definition missing the "components" property', () => {
    const invalidEntity = {
      id: 'core:thing',
    };
    expect(validate(invalidEntity)).toBe(false);
    const error = validate.errors.find(
      (e) =>
        e.keyword === 'required' && e.params.missingProperty === 'components'
    );
    expect(error).toBeDefined();
  });

  test('should reject an entity definition with an invalid "id" format', () => {
    const invalidEntity = {
      id: 'invalid id with spaces',
      components: { 'core:name': { text: 'Invalid' } },
    };
    expect(validate(invalidEntity)).toBe(false);
    const error = validate.errors.find((e) => e.instancePath === '/id');
    expect(error).toBeDefined();
    expect(error.keyword).toBe('pattern');
  });

  test('should reject an entity definition with an invalid component key format', () => {
    const invalidEntity = {
      id: 'core:test',
      components: {
        'invalid component key with spaces': { text: 'Invalid' },
      },
    };
    expect(validate(invalidEntity)).toBe(false);
    const error = validate.errors.find((e) => e.keyword === 'propertyNames');
    expect(error).toBeDefined();
  });
});
