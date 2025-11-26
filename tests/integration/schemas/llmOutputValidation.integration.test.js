// tests/integration/schemas/llmOutputValidation.integration.test.js
// Integration tests for LLM output validation pipeline
// Verifies that LLM responses are properly validated against schema v4
// and that responses with tags are rejected while responses without tags pass

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA } from '../../../src/turns/schemas/llmOutputSchemas.js';

describe('LLM Output Validation Pipeline Integration', () => {
  let validator;

  beforeAll(() => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    validator = ajv.compile(LLM_TURN_ACTION_RESPONSE_SCHEMA);
  });

  describe('Mock LLM Response Processing', () => {
    test('should accept valid LLM response without tags', () => {
      const mockLlmResponse = {
        chosenIndex: 2,
        speech: 'I understand your concern about the situation.',
        thoughts:
          'The player seems worried. I should provide reassurance while staying in character.',
        notes: [
          {
            text: 'Player expressed worry about upcoming battle',
            subject: 'Player Character',
            subjectType: 'entity',
            context: 'Pre-battle conversation',
          },
          {
            text: 'Castle defenses appear well-maintained',
            subject: 'Castle Defenses',
            subjectType: 'entity',
          },
        ],
      };

      const isValid = validator(mockLlmResponse);
      expect(isValid).toBe(true);
      expect(validator.errors).toBeNull();
    });

    test('should reject LLM response containing tags in notes', () => {
      const mockLlmResponseWithTags = {
        chosenIndex: 1,
        speech: 'The marketplace is bustling today.',
        thoughts:
          'Many people are out shopping. This could be useful information.',
        notes: [
          {
            text: 'Merchant seems nervous about recent events',
            subject: 'Merchant',
            subjectType: 'entity',
            context: 'Marketplace observation',
            tags: ['emotion', 'merchant', 'nervous'], // This should cause validation failure
          },
        ],
      };

      const isValid = validator(mockLlmResponseWithTags);
      expect(isValid).toBe(false);
      expect(validator.errors).toBeDefined();

      // Verify the error is specifically about the tags property
      const tagError = validator.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'tags'
      );
      expect(tagError).toBeTruthy();
      expect(tagError.instancePath).toContain('/notes/0');
    });

    test('should handle LLM response with empty notes array', () => {
      const mockLlmResponse = {
        chosenIndex: 3,
        speech: 'Yes, that makes sense.',
        thoughts: 'Simple response, no new information to note.',
        notes: [],
      };

      const isValid = validator(mockLlmResponse);
      expect(isValid).toBe(true);
      expect(validator.errors).toBeNull();
    });

    test('should handle LLM response without notes field', () => {
      const mockLlmResponse = {
        chosenIndex: 1,
        speech: 'Hello there!',
        thoughts: 'Greeting the player character.',
      };

      const isValid = validator(mockLlmResponse);
      expect(isValid).toBe(true);
      expect(validator.errors).toBeNull();
    });

    test('should reject response with multiple notes where some contain tags', () => {
      const mockLlmResponse = {
        chosenIndex: 2,
        speech: 'The situation is quite complex.',
        thoughts: 'Multiple observations to record.',
        notes: [
          {
            text: 'First observation - normal note',
            subject: 'Situation',
            subjectType: 'event',
            context: 'Current discussion',
          },
          {
            text: 'Second observation - has tags',
            subject: 'Character',
            subjectType: 'entity',
            tags: ['problem'], // This should cause validation failure
          },
        ],
      };

      const isValid = validator(mockLlmResponse);
      expect(isValid).toBe(false);
      expect(validator.errors).toBeDefined();

      const tagError = validator.errors.find(
        (err) =>
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'tags'
      );
      expect(tagError).toBeTruthy();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should provide clear error messages for debugging', () => {
      const invalidResponse = {
        chosenIndex: 1,
        speech: 'Test response',
        thoughts: 'Test thoughts',
        notes: [
          {
            text: 'Note with tags',
            subject: 'Test',
            subjectType: 'other',
            tags: ['debug-tag'],
          },
        ],
      };

      const isValid = validator(invalidResponse);
      expect(isValid).toBe(false);

      // Verify error structure provides useful debugging information
      const errors = validator.errors;
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        keyword: 'additionalProperties',
        instancePath: '/notes/0',
        params: { additionalProperty: 'tags' },
      });

      // Error message should be helpful for developers
      expect(errors[0].message).toContain(
        'must NOT have additional properties'
      );
    });

    test('should handle malformed note structure gracefully', () => {
      const malformedResponse = {
        chosenIndex: 1,
        speech: 'Test',
        thoughts: 'Test',
        notes: [
          {
            text: 'Valid note',
            subject: 'Test',
            subjectType: 'other',
          },
          {
            // Missing required fields
            text: 'Invalid note',
            tags: ['should-fail-anyway'],
          },
        ],
      };

      const isValid = validator(malformedResponse);
      expect(isValid).toBe(false);
      expect(validator.errors).toBeDefined();

      // Should have multiple errors - missing required fields AND tags
      expect(validator.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Schema Compilation and Structure', () => {
    test('should compile schema successfully', () => {
      expect(validator).toBeDefined();
      expect(typeof validator).toBe('function');
    });

    test('should maintain correct schema version', () => {
      expect(LLM_TURN_ACTION_RESPONSE_SCHEMA.$id).toContain(
        'llmTurnActionResponse'
      );
      expect(LLM_TURN_ACTION_RESPONSE_SCHEMA.properties).toBeDefined();
      expect(LLM_TURN_ACTION_RESPONSE_SCHEMA.required).toEqual([
        'chosenIndex',
        'speech',
        'thoughts',
      ]);
    });

    test('should verify notes structure excludes tags', () => {
      const notesSchema = LLM_TURN_ACTION_RESPONSE_SCHEMA.properties.notes;
      const noteItemSchema = notesSchema.items;

      expect(noteItemSchema.properties).toBeDefined();
      expect(noteItemSchema.properties.tags).toBeUndefined();
      expect(noteItemSchema.additionalProperties).toBe(false);

      // Verify required fields are still intact
      expect(noteItemSchema.required).toEqual([
        'text',
        'subject',
        'subjectType',
      ]);
    });
  });
});
