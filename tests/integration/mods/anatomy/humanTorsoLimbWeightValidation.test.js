/**
 * @file humanTorsoLimbWeightValidation.test.js
 * @description Validates that human torso and limb entity definitions have
 * appropriate core:weight components for the dismemberment spawning feature.
 *
 * This test ensures the invariants from DISBODPARSPA-010 are maintained:
 * - All human torso/limb entities have core:weight
 * - Weights are positive numbers within realistic ranges
 *
 * @see tickets/DISBODPARSPA-010-weight-human-torso-limbs.md
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
 * @param {object} entity - Entity definition object
 * @returns {number|undefined} Weight value or undefined
 */
function getWeight(entity) {
  return entity?.components?.['core:weight']?.weight;
}

describe('DISBODPARSPA-010: Human Torso/Limb Weight Validation', () => {
  describe('Human Torso Definitions', () => {
    const FEMALE_TORSOS = [
      { file: 'human_female_torso.entity.json', minWeight: 24, maxWeight: 35 },
      {
        file: 'human_female_torso_hourglass_soft.entity.json',
        minWeight: 22,
        maxWeight: 30,
      },
      {
        file: 'human_female_torso_hulking.entity.json',
        minWeight: 30,
        maxWeight: 40,
      },
      {
        file: 'human_female_torso_muscular_scarred.entity.json',
        minWeight: 26,
        maxWeight: 35,
      },
      {
        file: 'human_female_torso_slim.entity.json',
        minWeight: 20,
        maxWeight: 28,
      },
      {
        file: 'human_female_torso_stocky.entity.json',
        minWeight: 28,
        maxWeight: 38,
      },
    ];

    const FUTA_TORSOS = [
      { file: 'human_futa_torso.entity.json', minWeight: 26, maxWeight: 36 },
      {
        file: 'human_futa_torso_hulking_scarred.entity.json',
        minWeight: 30,
        maxWeight: 40,
      },
    ];

    const MALE_TORSOS = [
      { file: 'human_male_torso.entity.json', minWeight: 28, maxWeight: 38 },
      {
        file: 'human_male_torso_hulking_hairy.entity.json',
        minWeight: 38,
        maxWeight: 50,
      },
      {
        file: 'human_male_torso_muscular.entity.json',
        minWeight: 32,
        maxWeight: 42,
      },
      {
        file: 'human_male_torso_muscular_hairy.entity.json',
        minWeight: 32,
        maxWeight: 42,
      },
      {
        file: 'human_male_torso_muscular_moderate.entity.json',
        minWeight: 30,
        maxWeight: 40,
      },
      {
        file: 'human_male_torso_thick_hairy.entity.json',
        minWeight: 34,
        maxWeight: 44,
      },
      {
        file: 'human_male_torso_thick_hairy_overweight.entity.json',
        minWeight: 40,
        maxWeight: 55,
      },
    ];

    const ALL_TORSOS = [...FEMALE_TORSOS, ...FUTA_TORSOS, ...MALE_TORSOS];

    it.each(ALL_TORSOS)(
      'should have valid weight for $file',
      ({ file, minWeight, maxWeight }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeGreaterThanOrEqual(minWeight);
        expect(weight).toBeLessThanOrEqual(maxWeight);
      }
    );

    it('should have all 15 torso files with weights', () => {
      const torsoCount = ALL_TORSOS.length;
      expect(torsoCount).toBe(15);

      const entitiesWithWeights = ALL_TORSOS.filter((t) => {
        const entity = loadEntityFile(t.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(torsoCount);
    });
  });

  describe('Human Leg Definitions', () => {
    const LEGS = [
      { file: 'human_leg.entity.json', minWeight: 10, maxWeight: 16 },
      { file: 'human_leg_athletic.entity.json', minWeight: 11, maxWeight: 16 },
      { file: 'human_leg_hulking.entity.json', minWeight: 14, maxWeight: 20 },
      {
        file: 'human_leg_hulking_hairy.entity.json',
        minWeight: 14,
        maxWeight: 20,
      },
      { file: 'human_leg_long_lean.entity.json', minWeight: 9, maxWeight: 14 },
      { file: 'human_leg_muscular.entity.json', minWeight: 12, maxWeight: 18 },
      {
        file: 'human_leg_muscular_hairy.entity.json',
        minWeight: 12,
        maxWeight: 18,
      },
      { file: 'human_leg_shapely.entity.json', minWeight: 10, maxWeight: 15 },
      { file: 'human_leg_slim.entity.json', minWeight: 8, maxWeight: 13 },
      {
        file: 'human_leg_soft_lissom.entity.json',
        minWeight: 9,
        maxWeight: 14,
      },
      {
        file: 'human_leg_thick_hairy.entity.json',
        minWeight: 13,
        maxWeight: 18,
      },
    ];

    it.each(LEGS)(
      'should have valid weight for $file',
      ({ file, minWeight, maxWeight }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeGreaterThanOrEqual(minWeight);
        expect(weight).toBeLessThanOrEqual(maxWeight);
      }
    );

    it('should have all 11 leg files with weights', () => {
      const legCount = LEGS.length;
      expect(legCount).toBe(11);

      const entitiesWithWeights = LEGS.filter((l) => {
        const entity = loadEntityFile(l.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(legCount);
    });
  });

  describe('Human Extremity Definitions', () => {
    it('should have valid weight for human_foot.entity.json', () => {
      const entity = loadEntityFile('human_foot.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeGreaterThanOrEqual(0.8);
      expect(weight).toBeLessThanOrEqual(1.5);
    });

    it('should have valid weight for human_hand.entity.json', () => {
      const entity = loadEntityFile('human_hand.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeGreaterThanOrEqual(0.3);
      expect(weight).toBeLessThanOrEqual(0.6);
    });
  });

  describe('Weight Component Schema Compliance', () => {
    const ALL_FILES = [
      'human_foot.entity.json',
      'human_hand.entity.json',
      'human_leg.entity.json',
      'human_leg_athletic.entity.json',
      'human_leg_hulking.entity.json',
      'human_leg_hulking_hairy.entity.json',
      'human_leg_long_lean.entity.json',
      'human_leg_muscular.entity.json',
      'human_leg_muscular_hairy.entity.json',
      'human_leg_shapely.entity.json',
      'human_leg_slim.entity.json',
      'human_leg_soft_lissom.entity.json',
      'human_leg_thick_hairy.entity.json',
      'human_female_torso.entity.json',
      'human_female_torso_hourglass_soft.entity.json',
      'human_female_torso_hulking.entity.json',
      'human_female_torso_muscular_scarred.entity.json',
      'human_female_torso_slim.entity.json',
      'human_female_torso_stocky.entity.json',
      'human_futa_torso.entity.json',
      'human_futa_torso_hulking_scarred.entity.json',
      'human_male_torso.entity.json',
      'human_male_torso_hulking_hairy.entity.json',
      'human_male_torso_muscular.entity.json',
      'human_male_torso_muscular_hairy.entity.json',
      'human_male_torso_muscular_moderate.entity.json',
      'human_male_torso_thick_hairy.entity.json',
      'human_male_torso_thick_hairy_overweight.entity.json',
    ];

    it('should have exactly 28 files with weight components', () => {
      expect(ALL_FILES.length).toBe(28);

      const filesWithWeights = ALL_FILES.filter((file) => {
        const entity = loadEntityFile(file);
        return getWeight(entity) !== undefined;
      });

      expect(filesWithWeights.length).toBe(28);
    });

    it.each(ALL_FILES)(
      'should have properly structured core:weight component in %s',
      (file) => {
        const entity = loadEntityFile(file);
        const weightComponent = entity?.components?.['core:weight'];

        expect(weightComponent).toBeDefined();
        expect(weightComponent).toHaveProperty('weight');
        expect(typeof weightComponent.weight).toBe('number');
        expect(Object.keys(weightComponent)).toEqual(['weight']);
      }
    );
  });
});
