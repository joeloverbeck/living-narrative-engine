/**
 * @file utilityEntityWeightValidation.test.js
 * @description Validates that utility/generic entity definitions (humanoid_* and utility parts)
 * have appropriate core:weight components for the dismemberment spawning feature.
 *
 * This test ensures the invariants from DISBODPARSPA-015 are maintained:
 * - All utility entities with anatomy:part have core:weight
 * - Weights are positive numbers within realistic ranges for each part type
 * - blueprint_slot.entity.json is correctly excluded (no anatomy:part)
 *
 * Note: Creature entity tests (cephalopods, spiders, tortoises) are in:
 * tests/integration/mods/anatomy-creatures/creatureEntityWeightValidation.test.js
 *
 * @see tickets/DISBODPARSPA-015-weight-utility.md
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const DEFINITIONS_PATH = path.resolve(
  process.cwd(),
  'data/mods/anatomy/entities/definitions'
);

/**
 * Helper to load entity JSON file
 *
 * @param {string} filename - Entity file name
 * @returns {object} Parsed JSON
 */
function loadEntityFile(filename) {
  const filePath = path.join(DEFINITIONS_PATH, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Helper to get weight from entity
 *
 * @param {object} entity - Entity definition object
 * @returns {number|undefined} Weight value or undefined
 */
function getWeight(entity) {
  return entity?.components?.['core:weight']?.weight;
}

/**
 * Helper to check if entity has anatomy:part
 *
 * @param {object} entity - Entity definition object
 * @returns {boolean} Whether entity has anatomy:part
 */
function hasAnatomyPart(entity) {
  return entity?.components?.['anatomy:part'] !== undefined;
}

describe('DISBODPARSPA-015: Utility Entity Weight Validation', () => {
  describe('Humanoid Arms (17 files)', () => {
    const HUMANOID_ARM_PARTS = [
      { file: 'humanoid_arm.entity.json', desc: 'Base humanoid arm' },
      { file: 'humanoid_arm_athletic.entity.json', desc: 'Athletic arm' },
      { file: 'humanoid_arm_hulking.entity.json', desc: 'Hulking arm' },
      {
        file: 'humanoid_arm_hulking_hairy.entity.json',
        desc: 'Hulking hairy arm',
      },
      {
        file: 'humanoid_arm_hulking_scarred.entity.json',
        desc: 'Hulking scarred arm',
      },
      { file: 'humanoid_arm_lean.entity.json', desc: 'Lean arm' },
      { file: 'humanoid_arm_muscular.entity.json', desc: 'Muscular arm' },
      {
        file: 'humanoid_arm_muscular_hairy.entity.json',
        desc: 'Muscular hairy arm',
      },
      { file: 'humanoid_arm_scarred.entity.json', desc: 'Scarred arm' },
      { file: 'humanoid_arm_slim.entity.json', desc: 'Slim arm' },
      { file: 'humanoid_arm_soft.entity.json', desc: 'Soft arm' },
      { file: 'humanoid_arm_soft_lissom.entity.json', desc: 'Soft lissom arm' },
      { file: 'humanoid_arm_thick_hairy.entity.json', desc: 'Thick hairy arm' },
      {
        file: 'humanoid_arm_weathered_tannery_stained.entity.json',
        desc: 'Weathered arm',
      },
    ];

    it.each(HUMANOID_ARM_PARTS)(
      'should have valid weight (3-5 kg) for $file ($desc)',
      ({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThanOrEqual(3);
        expect(weight).toBeLessThanOrEqual(5);
      }
    );
  });

  describe('Humanoid Heads (12 files)', () => {
    const HUMANOID_HEAD_PARTS = [
      { file: 'humanoid_head.entity.json', desc: 'Base humanoid head' },
      { file: 'humanoid_head_attractive.entity.json', desc: 'Attractive head' },
      { file: 'humanoid_head_bearded.entity.json', desc: 'Bearded head' },
      { file: 'humanoid_head_beautiful.entity.json', desc: 'Beautiful head' },
      { file: 'humanoid_head_cute.entity.json', desc: 'Cute head' },
      { file: 'humanoid_head_hideous.entity.json', desc: 'Hideous head' },
      { file: 'humanoid_head_moustached.entity.json', desc: 'Moustached head' },
      { file: 'humanoid_head_plain.entity.json', desc: 'Plain head' },
      {
        file: 'humanoid_head_plain_weary.entity.json',
        desc: 'Plain weary head',
      },
      { file: 'humanoid_head_scarred.entity.json', desc: 'Scarred head' },
      { file: 'humanoid_head_stubble.entity.json', desc: 'Stubble head' },
    ];

    it.each(HUMANOID_HEAD_PARTS)(
      'should have valid weight (4-6 kg) for $file ($desc)',
      ({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThanOrEqual(4);
        expect(weight).toBeLessThanOrEqual(6);
      }
    );
  });

  describe('Humanoid Hands (4 files)', () => {
    const HUMANOID_HAND_PARTS = [
      {
        file: 'humanoid_hand_craftsman_scarred.entity.json',
        desc: 'Craftsman scarred hand',
      },
      {
        file: 'humanoid_hand_craftsman_stained.entity.json',
        desc: 'Craftsman stained hand',
      },
      { file: 'humanoid_hand_rough.entity.json', desc: 'Rough hand' },
      { file: 'humanoid_hand_scarred.entity.json', desc: 'Scarred hand' },
    ];

    it.each(HUMANOID_HAND_PARTS)(
      'should have valid weight (0.3-0.5 kg) for $file ($desc)',
      ({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThanOrEqual(0.3);
        expect(weight).toBeLessThanOrEqual(0.5);
      }
    );
  });

  describe('Humanoid Small Parts', () => {
    const HUMANOID_SMALL_PARTS = [
      {
        file: 'humanoid_face_bearded_full_trimmed.entity.json',
        minWeight: 0.2,
        maxWeight: 0.4,
        desc: 'Face',
      },
      {
        file: 'humanoid_ear.entity.json',
        minWeight: 0.005,
        maxWeight: 0.02,
        desc: 'Ear',
      },
      {
        file: 'humanoid_mouth.entity.json',
        minWeight: 0.03,
        maxWeight: 0.1,
        desc: 'Mouth',
      },
      {
        file: 'humanoid_nose.entity.json',
        minWeight: 0.02,
        maxWeight: 0.05,
        desc: 'Nose',
      },
      {
        file: 'humanoid_nose_scarred.entity.json',
        minWeight: 0.02,
        maxWeight: 0.05,
        desc: 'Scarred nose',
      },
      {
        file: 'humanoid_nose_small.entity.json',
        minWeight: 0.02,
        maxWeight: 0.05,
        desc: 'Small nose',
      },
      {
        file: 'humanoid_teeth.entity.json',
        minWeight: 0.03,
        maxWeight: 0.1,
        desc: 'Teeth',
      },
    ];

    it.each(HUMANOID_SMALL_PARTS)(
      'should have valid weight for $file ($desc)',
      ({ file, minWeight, maxWeight }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThanOrEqual(minWeight);
        expect(weight).toBeLessThanOrEqual(maxWeight);
      }
    );
  });

  describe('Utility Parts', () => {
    it('should have valid weight for equipment_mount.entity.json', () => {
      const entity = loadEntityFile('equipment_mount.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(1);
    });

    it('should NOT have weight for blueprint_slot.entity.json (no anatomy:part)', () => {
      const entity = loadEntityFile('blueprint_slot.entity.json');

      // blueprint_slot has no anatomy:part, so it should not have weight
      expect(hasAnatomyPart(entity)).toBe(false);
      expect(getWeight(entity)).toBeUndefined();
    });
  });

  describe('Coverage Completeness', () => {
    it('should have all utility body parts with weight (37 files total)', () => {
      // Get all files NOT matching human_, chicken_, centaur_, dragon_, eldritch_, cat_, feline_, horse_
      // Note: Creature files (cephalopods, spiders, tortoises) moved to anatomy-creatures mod
      const allFiles = fs
        .readdirSync(DEFINITIONS_PATH)
        .filter((f) => f.endsWith('.entity.json'));
      const utilityFiles = allFiles.filter(
        (f) =>
          !/^(human_|chicken_|centaur_|dragon_|eldritch_|cat_|feline_|horse_)/.test(
            f
          )
      );

      // Count body parts (files with anatomy:part)
      const bodyParts = utilityFiles.filter((f) => {
        const entity = loadEntityFile(f);
        return hasAnatomyPart(entity);
      });

      // All body parts should have weight
      const bodyPartsWithWeight = bodyParts.filter((f) => {
        const entity = loadEntityFile(f);
        return getWeight(entity) !== undefined;
      });

      expect(bodyParts.length).toBe(37);
      expect(bodyPartsWithWeight.length).toBe(37);
    });

    it('should have all weights as positive numbers', () => {
      const allFiles = fs
        .readdirSync(DEFINITIONS_PATH)
        .filter((f) => f.endsWith('.entity.json'));
      const utilityFiles = allFiles.filter(
        (f) =>
          !/^(human_|chicken_|centaur_|dragon_|eldritch_|cat_|feline_|horse_)/.test(
            f
          )
      );

      const bodyPartsWithInvalidWeight = utilityFiles.filter((f) => {
        const entity = loadEntityFile(f);
        if (!hasAnatomyPart(entity)) return false;
        const weight = getWeight(entity);
        return weight === undefined || weight <= 0;
      });

      expect(bodyPartsWithInvalidWeight).toEqual([]);
    });
  });
});
