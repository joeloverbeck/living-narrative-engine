/**
 * @file Unit tests for anatomy entity shape validation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import shapeGeneralSchema from '../../../data/mods/descriptors/components/shape_general.component.json';

describe('Anatomy Entity Shape Validation', () => {
  let schemaValidator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Register the shape_general component schema
    schemaValidator.preloadSchemas([
      {
        schema: shapeGeneralSchema.dataSchema,
        id: 'descriptors:shape_general',
      },
    ]);
  });

  describe('Valid shape values', () => {
    const validShapes = [
      'round',
      'square',
      'oval',
      'elongated',
      'angular',
      'curved',
      'circular',
    ];

    validShapes.forEach((shape) => {
      it(`should accept shape value: ${shape}`, () => {
        const result = schemaValidator.validate('descriptors:shape_general', {
          shape,
        });
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });
    });
  });

  describe('Invalid shape values', () => {
    const invalidShapes = [
      'normal',
      'wide',
      '',
      null,
      undefined,
      123,
    ];

    invalidShapes.forEach((shape) => {
      it(`should reject invalid shape value: ${shape}`, () => {
        const result = schemaValidator.validate('descriptors:shape_general', {
          shape,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).not.toBeNull();
        if (shape !== null && shape !== undefined) {
          expect(result.errors.some((e) => e.keyword === 'enum')).toBe(true);
        }
      });
    });
  });

  describe('Schema structure validation', () => {
    it('should reject objects with additional properties', () => {
      const result = schemaValidator.validate('descriptors:shape_general', {
        shape: 'round',
        extra: 'property',
      });
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.keyword === 'additionalProperties')
      ).toBe(true);
    });

    it('should reject objects missing the shape property', () => {
      const result = schemaValidator.validate('descriptors:shape_general', {});
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.keyword === 'required')).toBe(true);
    });
  });

  describe('Anatomy entity examples', () => {
    const anatomyExamples = [
      { entity: 'human_hand', shape: 'square' },
      { entity: 'human_breast', shape: 'round' },
      { entity: 'humanoid_ear', shape: 'round' },
      { entity: 'humanoid_mouth', shape: 'oval' },
      { entity: 'humanoid_nose', shape: 'elongated' },
    ];

    anatomyExamples.forEach(({ entity, shape }) => {
      it(`should validate ${entity} with shape ${shape}`, () => {
        const result = schemaValidator.validate('descriptors:shape_general', {
          shape,
        });
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });
    });
  });
});
