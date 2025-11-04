/**
 * @file Test suite for validating Lookup definitions against lookup.schema.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// Schemas to be loaded
import lookupSchema from '../../../data/schemas/lookup.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('JSON-Schema – Lookup Definition', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Add referenced schemas to AJV instance
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );

    // Compile the main schema we want to test
    validate = ajv.compile(lookupSchema);
  });

  describe('Valid Lookup – mood_descriptors', () => {
    const validLookup = {
      $schema: 'schema://living-narrative-engine/lookup.schema.json',
      id: 'music_performance:mood_descriptors',
      description:
        'Maps musical mood names to descriptive adjectives and nouns',
      dataSchema: {
        type: 'object',
        properties: {
          adj: { type: 'string', description: 'Primary adjective' },
          adjectives: { type: 'string', description: 'List of adjectives' },
          noun: { type: 'string', description: 'Noun form' },
        },
        required: ['adj', 'adjectives', 'noun'],
        additionalProperties: false,
      },
      entries: {
        cheerful: {
          adj: 'bright',
          adjectives: 'bright, skipping',
          noun: 'bouncy',
        },
        solemn: {
          adj: 'grave',
          adjectives: 'measured, weighty',
          noun: 'grave',
        },
      },
    };

    test('should validate successfully against the schema', () => {
      const ok = validate(validLookup);
      if (!ok) {
        console.error(
          'Validation errors for music_performance:mood_descriptors:',
          validate.errors
        );
      }
      expect(ok).toBe(true);
    });

    test('should accept optional comment field', () => {
      const lookupWithComment = {
        ...validLookup,
        comment: 'This is a note for modders',
      };
      const ok = validate(lookupWithComment);
      expect(ok).toBe(true);
    });
  });

  describe('Schema property validations', () => {
    const validLookup = {
      id: 'test_mod:test_lookup',
      description: 'Test lookup table',
      dataSchema: {
        type: 'object',
        properties: {
          value: { type: 'number' },
        },
      },
      entries: {
        key1: { value: 1 },
        key2: { value: 2 },
      },
    };

    test('should fail validation if required "id" property is missing', () => {
      const invalidData = { ...validLookup };
      delete invalidData.id;
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'id'",
        })
      );
    });

    test('should fail validation if required "description" property is missing', () => {
      const invalidData = { ...validLookup };
      delete invalidData.description;
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'description'",
        })
      );
    });

    test('should fail validation if required "dataSchema" property is missing', () => {
      const invalidData = { ...validLookup };
      delete invalidData.dataSchema;
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'dataSchema'",
        })
      );
    });

    test('should fail validation if required "entries" property is missing', () => {
      const invalidData = { ...validLookup };
      delete invalidData.entries;
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'entries'",
        })
      );
    });

    test('should fail validation if "entries" is empty object', () => {
      const invalidData = { ...validLookup, entries: {} };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have fewer than 1 properties',
          instancePath: '/entries',
        })
      );
    });

    test('should fail validation if "dataSchema" is not an object', () => {
      const invalidData = { ...validLookup, dataSchema: 'not an object' };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be object',
          instancePath: '/dataSchema',
        })
      );
    });

    test('should fail validation if "entries" is not an object', () => {
      const invalidData = { ...validLookup, entries: 'not an object' };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be object',
          instancePath: '/entries',
        })
      );
    });

    test('should fail validation if an extra, undefined property is included', () => {
      const invalidData = { ...validLookup, unknownProperty: 'test' };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'unknownProperty' },
        })
      );
    });

    test('should accept minimal valid lookup with single entry', () => {
      const minimalLookup = {
        id: 'mod:minimal',
        description: 'Minimal lookup',
        dataSchema: { type: 'string' },
        entries: { key: 'value' },
      };
      const ok = validate(minimalLookup);
      expect(ok).toBe(true);
    });

    test('should accept lookup with complex nested dataSchema', () => {
      const complexLookup = {
        id: 'mod:complex',
        description: 'Complex lookup',
        dataSchema: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                deep: { type: 'number' },
              },
            },
            array: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        entries: {
          item1: { nested: { deep: 42 }, array: ['a', 'b'] },
        },
      };
      const ok = validate(complexLookup);
      expect(ok).toBe(true);
    });
  });
});
