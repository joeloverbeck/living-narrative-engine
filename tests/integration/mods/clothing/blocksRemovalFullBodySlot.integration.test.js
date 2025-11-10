/**
 * @file Integration test for blocks_removal component with full_body equipment slot
 * Validates that full_body garments (dresses, gowns, bodysuits) can use blocks_removal component
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../common/entities/testBed.js';

describe('blocks_removal Component - full_body Slot Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should validate blocks_removal with full_body slot', () => {
    const componentData = {
      blockedSlots: [
        {
          slot: 'full_body',
          layers: ['underwear', 'base'],
          blockType: 'must_remove_first',
          reason: 'Full-body garment must be removed to access underlying clothing',
        },
      ],
    };

    const result = testBed.validateAgainstSchema(componentData, 'clothing:blocks_removal');
    expect(result.isValid).toBe(true);
  });

  it('should allow full_body garment to block torso slots', () => {
    // A full-body dress can block removal of upper and lower torso items
    const componentData = {
      blockedSlots: [
        {
          slot: 'torso_upper',
          layers: ['underwear', 'base'],
          blockType: 'must_remove_first',
        },
        {
          slot: 'torso_lower',
          layers: ['underwear', 'base'],
          blockType: 'must_remove_first',
        },
      ],
    };

    const result = testBed.validateAgainstSchema(componentData, 'clothing:blocks_removal');
    expect(result.isValid).toBe(true);
  });

  it('should validate blocks_removal component data as used in full_body garment entity', () => {
    // Validate the blocks_removal component data that would be used in a dress entity
    const blocksRemovalData = {
      blockedSlots: [
        {
          slot: 'torso_upper',
          layers: ['underwear'],
          blockType: 'must_remove_first',
          reason: 'Dress covers torso and must be removed first',
        },
      ],
    };

    const result = testBed.validateAgainstSchema(
      blocksRemovalData,
      'clothing:blocks_removal'
    );
    expect(result.isValid).toBe(true);
  });

  it('should validate complex removal blocking scenario for full_body garment', () => {
    // A complex bodysuit that blocks multiple areas
    const componentData = {
      blockedSlots: [
        {
          slot: 'torso_upper',
          layers: ['underwear', 'base'],
          blockType: 'full_block',
          reason: 'Bodysuit provides full coverage',
        },
        {
          slot: 'torso_lower',
          layers: ['underwear', 'base'],
          blockType: 'full_block',
          reason: 'Bodysuit provides full coverage',
        },
        {
          slot: 'legs',
          layers: ['underwear'],
          blockType: 'must_remove_first',
          reason: 'Bodysuit must be removed before pants',
        },
      ],
    };

    const result = testBed.validateAgainstSchema(componentData, 'clothing:blocks_removal');
    expect(result.isValid).toBe(true);
  });

  it('should support full_body in blocksRemovalOf scenario', () => {
    // Belt or accessory that prevents removal of full_body garment
    const componentData = {
      blocksRemovalOf: ['clothing:sand_silk_wrap_dress', 'clothing:full_length_black_velvet_gown'],
    };

    const result = testBed.validateAgainstSchema(componentData, 'clothing:blocks_removal');
    expect(result.isValid).toBe(true);
  });

  it('should validate all real equipment slots from clothing mod', () => {
    // Test all actual slots used in the clothing mod
    const realSlots = [
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

    realSlots.forEach((slot) => {
      const data = {
        blockedSlots: [
          {
            slot: slot,
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      };
      const result = testBed.validateAgainstSchema(data, 'clothing:blocks_removal');
      expect(result.isValid).toBe(true);
    });
  });

  it('should reject non-existent equipment slots', () => {
    const componentData = {
      blockedSlots: [
        {
          slot: 'nonexistent_slot',
          layers: ['base'],
          blockType: 'must_remove_first',
        },
      ],
    };

    const result = testBed.validateAgainstSchema(componentData, 'clothing:blocks_removal');
    expect(result.isValid).toBe(false);
  });
});
