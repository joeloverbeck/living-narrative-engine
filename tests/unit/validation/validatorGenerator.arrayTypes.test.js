/**
 * @file Tests for ValidatorGenerator array type handling
 * Validates proper handling of JSON Schema array-based type definitions
 * like ["object", "null"] for nullable types.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';

describe('ValidatorGenerator - Array Type Handling', () => {
  let generator;
  let mockLogger;
  let mockSimilarityCalculator;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
    mockSimilarityCalculator = {
      calculateDistance: () => {},
      findClosest: () => {},
    };
    generator = new ValidatorGenerator({
      logger: mockLogger,
      similarityCalculator: mockSimilarityCalculator,
    });
  });

  /**
   * Helper function to create a component schema with validation enabled
   *
   * @param dataSchema
   */
  const createComponentSchema = (dataSchema) => ({
    id: 'test:component',
    dataSchema,
    validationRules: {
      generateValidator: true,
    },
  });

  describe('Nullable Object Types ["object", "null"]', () => {
    const componentSchema = createComponentSchema({
      type: 'object',
      properties: {
        body: {
          type: ['object', 'null'],
          description: 'Nullable body property',
        },
      },
      required: [],
    });

    it('should validate null value as valid', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({ body: null });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate object value as valid', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({
        body: { structure: { head: {}, torso: {} } },
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject string value for nullable object', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({ body: 'invalid' });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject number value for nullable object', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({ body: 123 });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Nullable String Types ["string", "null"]', () => {
    const componentSchema = createComponentSchema({
      type: 'object',
      properties: {
        name: {
          type: ['string', 'null'],
          description: 'Nullable string property',
        },
      },
      required: [],
    });

    it('should validate null value as valid', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({ name: null });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate string value as valid', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({ name: 'John Doe' });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject object value for nullable string', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({ name: {} });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Anatomy Component Case', () => {
    // Simulates the anatomy:body component that triggered the bug
    const componentSchema = createComponentSchema({
      type: 'object',
      properties: {
        body: {
          type: ['object', 'null'],
          description: 'The generated anatomy structure, null until body is built',
        },
        generationMetadata: {
          type: 'object',
          properties: {
            generatedAt: { type: 'number' },
            recipeId: { type: 'string' },
          },
        },
      },
      required: [],
    });

    it('should validate initial state with null body', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({
        body: null,
        generationMetadata: {
          generatedAt: Date.now(),
          recipeId: 'fantasy:vespera_nightwhisper',
        },
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate generated state with body object', () => {
      const validator = generator.generate(componentSchema);
      const result = validator({
        body: {
          structure: {
            head: { name: 'head' },
            torso: { name: 'torso' },
          },
        },
        generationMetadata: {
          generatedAt: Date.now(),
          recipeId: 'fantasy:vespera_nightwhisper',
        },
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
