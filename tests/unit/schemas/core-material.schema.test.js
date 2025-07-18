import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/entities/testBed.js';

describe('core:material component schema validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('valid material data', () => {
    it('should validate with required material field only', () => {
      const validData = {
        material: 'linen'
      };

      const result = testBed.validateAgainstSchema(validData, 'core:material');
      expect(result.isValid).toBe(true);
    });

    it('should validate with all valid material types', () => {
      const materials = [
        'linen', 'silk', 'stretch-silk', 'leather', 'calfskin', 'wool',
        'cotton', 'canvas', 'steel', 'iron', 'wood', 'glass', 'plastic',
        'ceramic', 'stone', 'fabric', 'synthetic', 'organic'
      ];

      materials.forEach(material => {
        const validData = { material };
        const result = testBed.validateAgainstSchema(validData, 'core:material');
        expect(result.isValid).toBe(true);
      });
    });

    it('should validate with optional durability field', () => {
      const validData = {
        material: 'steel',
        durability: 85
      };

      const result = testBed.validateAgainstSchema(validData, 'core:material');
      expect(result.isValid).toBe(true);
    });

    it('should validate with optional care instructions', () => {
      const validData = {
        material: 'silk',
        careInstructions: ['hand_wash_only', 'dry_clean_only']
      };

      const result = testBed.validateAgainstSchema(validData, 'core:material');
      expect(result.isValid).toBe(true);
    });

    it('should validate with optional properties', () => {
      const validData = {
        material: 'cotton',
        properties: ['breathable', 'flexible']
      };

      const result = testBed.validateAgainstSchema(validData, 'core:material');
      expect(result.isValid).toBe(true);
    });

    it('should validate with all optional fields', () => {
      const validData = {
        material: 'leather',
        durability: 75,
        careInstructions: ['requires_oiling', 'requires_polishing'],
        properties: ['flexible', 'waterproof']
      };

      const result = testBed.validateAgainstSchema(validData, 'core:material');
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid material data', () => {
    it('should reject missing material field', () => {
      const invalidData = {
        durability: 50
      };

      const result = testBed.validateAgainstSchema(invalidData, 'core:material');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("must have required property 'material'");
    });

    it('should reject invalid material type', () => {
      const invalidData = {
        material: 'unobtainium'
      };

      const result = testBed.validateAgainstSchema(invalidData, 'core:material');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be equal to one of the allowed values');
    });

    it('should reject durability out of range (negative)', () => {
      const invalidData = {
        material: 'wood',
        durability: -10
      };

      const result = testBed.validateAgainstSchema(invalidData, 'core:material');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be >= 0');
    });

    it('should reject durability out of range (over 100)', () => {
      const invalidData = {
        material: 'steel',
        durability: 150
      };

      const result = testBed.validateAgainstSchema(invalidData, 'core:material');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be <= 100');
    });

    it('should reject invalid care instructions', () => {
      const invalidData = {
        material: 'silk',
        careInstructions: ['invalid_care_type']
      };

      const result = testBed.validateAgainstSchema(invalidData, 'core:material');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be equal to one of the allowed values');
    });

    it('should reject invalid properties', () => {
      const invalidData = {
        material: 'cotton',
        properties: ['invalid_property']
      };

      const result = testBed.validateAgainstSchema(invalidData, 'core:material');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be equal to one of the allowed values');
    });

    it('should reject additional properties', () => {
      const invalidData = {
        material: 'linen',
        invalidProperty: 'should not be allowed'
      };

      const result = testBed.validateAgainstSchema(invalidData, 'core:material');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must NOT have additional properties');
    });
  });

  describe('edge cases', () => {
    it('should handle empty care instructions array', () => {
      const validData = {
        material: 'cotton',
        careInstructions: []
      };

      const result = testBed.validateAgainstSchema(validData, 'core:material');
      expect(result.isValid).toBe(true);
    });

    it('should handle empty properties array', () => {
      const validData = {
        material: 'wood',
        properties: []
      };

      const result = testBed.validateAgainstSchema(validData, 'core:material');
      expect(result.isValid).toBe(true);
    });

    it('should handle boundary durability values', () => {
      const minDurability = { material: 'glass', durability: 0 };
      const maxDurability = { material: 'steel', durability: 100 };

      expect(testBed.validateAgainstSchema(minDurability, 'core:material').isValid).toBe(true);
      expect(testBed.validateAgainstSchema(maxDurability, 'core:material').isValid).toBe(true);
    });
  });
});