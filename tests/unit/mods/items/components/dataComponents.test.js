/**
 * @file Unit tests for items mod data components
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('Items - Data Components', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('items:weight', () => {
    it('should validate valid weight data', () => {
      const data = {
        weight: 0.5,
      };
      const result = testBed.validateAgainstSchema(data, 'items:weight');
      expect(result.isValid).toBe(true);
    });

    it('should reject negative weight', () => {
      const data = {
        weight: -1,
      };
      const result = testBed.validateAgainstSchema(data, 'items:weight');
      expect(result.isValid).toBe(false);
    });

    it('should require weight property', () => {
      const data = {};
      const result = testBed.validateAgainstSchema(data, 'items:weight');
      expect(result.isValid).toBe(false);
    });

    it('should accept zero weight', () => {
      const data = {
        weight: 0,
      };
      const result = testBed.validateAgainstSchema(data, 'items:weight');
      expect(result.isValid).toBe(true);
    });

    it('should reject additional properties', () => {
      const data = {
        weight: 1.5,
        extraProperty: 'not allowed',
      };
      const result = testBed.validateAgainstSchema(data, 'items:weight');
      expect(result.isValid).toBe(false);
    });
  });

  describe('items:inventory', () => {
    it('should validate valid inventory data', () => {
      const data = {
        items: ['item-1', 'item-2'],
        capacity: { maxWeight: 50, maxItems: 10 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(true);
    });

    it('should enforce unique item IDs', () => {
      const data = {
        items: ['item-1', 'item-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });

    it('should require capacity properties', () => {
      const data = {
        items: [],
        capacity: { maxWeight: 50 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid entity ID patterns', () => {
      const data = {
        items: ['invalid@id'],
        capacity: { maxWeight: 50, maxItems: 10 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });

    it('should accept empty items array', () => {
      const data = {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(true);
    });

    it('should validate valid entity ID patterns', () => {
      const data = {
        items: ['item_1', 'item-2', 'ABC123'],
        capacity: { maxWeight: 50, maxItems: 10 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(true);
    });

    it('should require items property', () => {
      const data = {
        capacity: { maxWeight: 50, maxItems: 10 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });

    it('should require capacity property', () => {
      const data = {
        items: ['item-1'],
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });

    it('should reject negative maxWeight', () => {
      const data = {
        items: ['item-1'],
        capacity: { maxWeight: -10, maxItems: 10 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });

    it('should reject zero or negative maxItems', () => {
      const data = {
        items: ['item-1'],
        capacity: { maxWeight: 50, maxItems: 0 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });

    it('should accept maxItems of 1', () => {
      const data = {
        items: ['item-1'],
        capacity: { maxWeight: 50, maxItems: 1 },
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(true);
    });

    it('should reject additional properties', () => {
      const data = {
        items: ['item-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
        extraProperty: 'not allowed',
      };
      const result = testBed.validateAgainstSchema(data, 'items:inventory');
      expect(result.isValid).toBe(false);
    });
  });
});
