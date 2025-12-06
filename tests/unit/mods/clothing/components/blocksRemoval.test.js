/**
 * @file Unit tests for the clothing:blocks_removal component
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('clothing:blocks_removal Component', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Schema Validation - blockedSlots', () => {
    it('should validate component with valid blockedSlots', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base', 'outer'],
            blockType: 'must_remove_first',
            reason: 'Belt secures pants at waist',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate component with blocksRemovalOf', () => {
      const data = {
        blocksRemovalOf: ['clothing:pants', 'clothing:skirt'],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate component with both blockedSlots and blocksRemovalOf', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
        blocksRemovalOf: ['clothing:special_pants'],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject component without blockedSlots or blocksRemovalOf', () => {
      const data = {};
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid slot names', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'invalid_slot',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid layer names', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['invalid_layer'],
            blockType: 'must_remove_first',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid blockType', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'invalid_type',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject empty layers array', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: [],
            blockType: 'must_remove_first',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject duplicate layers', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base', 'base'],
            blockType: 'must_remove_first',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid item ID pattern in blocksRemovalOf', () => {
      const data = {
        blocksRemovalOf: ['invalid@pattern', 'also-bad!'],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should accept valid namespaced item IDs', () => {
      const data = {
        blocksRemovalOf: ['clothing:pants_blue', 'armor:plate_legs'],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate multiple blocked slots', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base', 'outer'],
            blockType: 'must_remove_first',
          },
          {
            slot: 'torso_lower',
            layers: ['underwear'],
            blockType: 'full_block',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate all blockType values', () => {
      const blockTypes = [
        'must_remove_first',
        'must_loosen_first',
        'full_block',
      ];
      blockTypes.forEach((blockType) => {
        const data = {
          blockedSlots: [
            {
              slot: 'legs',
              layers: ['base'],
              blockType: blockType,
            },
          ],
        };
        const result = testBed.validateAgainstSchema(
          data,
          'clothing:blocks_removal'
        );
        expect(result.isValid).toBe(true);
      });
    });

    it('should accept optional reason field', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
            reason: 'This is a valid reason',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject empty reason string', () => {
      const data = {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
            reason: '',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(false);
    });

    it('should validate all equipment slots used in clothing mod', () => {
      // These are the equipment slots actually used as primary/secondary slots in clothing entities
      const validSlots = [
        'feet',
        'full_body',
        'hands',
        'head_gear',
        'left_arm_clothing',
        'legs',
        'right_arm_clothing',
        'torso_lower',
        'torso_upper',
      ];

      validSlots.forEach((slot) => {
        const data = {
          blockedSlots: [
            {
              slot: slot,
              layers: ['base'],
              blockType: 'must_remove_first',
            },
          ],
        };
        const result = testBed.validateAgainstSchema(
          data,
          'clothing:blocks_removal'
        );
        expect(result.isValid).toBe(true);
      });
    });

    it('should specifically validate full_body slot for dresses and gowns', () => {
      // full_body is used by dresses, gowns, and bodysuits - must be supported
      const data = {
        blockedSlots: [
          {
            slot: 'full_body',
            layers: ['underwear', 'base'],
            blockType: 'must_remove_first',
            reason: 'Full-body garment blocks removal of underlying items',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(
        data,
        'clothing:blocks_removal'
      );
      expect(result.isValid).toBe(true);
    });
  });
});
