/**
 * @file humanHairWeightValidation.test.js
 * @description Validates that human hair entity definitions have
 * appropriate items:weight components for the dismemberment spawning feature.
 *
 * This test ensures the invariants from DISBODPARSPA-012 are maintained:
 * - All human hair entities have items:weight
 * - Weights are positive numbers within realistic ranges based on hair length
 *
 * @see tickets/DISBODPARSPA-012-weight-human-hair-extremities.md
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
  return entity?.components?.['items:weight']?.weight;
}

describe('DISBODPARSPA-012: Human Hair Weight Validation', () => {
  describe('Long Hair Definitions', () => {
    const LONG_HAIR = [
      { file: 'human_hair_black_long_tousled.entity.json', weight: 0.15 },
      { file: 'human_hair_blonde.entity.json', weight: 0.15 },
      { file: 'human_hair_blonde_long_braided.entity.json', weight: 0.15 },
      { file: 'human_hair_blonde_long_straight.entity.json', weight: 0.15 },
      { file: 'human_hair_raven.entity.json', weight: 0.15 },
    ];

    it.each(LONG_HAIR)(
      'should have valid weight for $file',
      ({ file, weight }) => {
        const entity = loadEntityFile(file);
        const actualWeight = getWeight(entity);

        expect(actualWeight).toBeDefined();
        expect(typeof actualWeight).toBe('number');
        expect(actualWeight).toBeGreaterThan(0);
        expect(actualWeight).toBe(weight);
      }
    );

    it('should have all 5 long hair files with weights', () => {
      const hairCount = LONG_HAIR.length;
      expect(hairCount).toBe(5);

      const entitiesWithWeights = LONG_HAIR.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(hairCount);
    });
  });

  describe('Medium Hair Definitions', () => {
    const MEDIUM_HAIR = [
      { file: 'human_hair.entity.json', weight: 0.1 },
      { file: 'human_hair_blonde_medium_ponytail.entity.json', weight: 0.1 },
      { file: 'human_hair_blonde_medium_straight.entity.json', weight: 0.1 },
      { file: 'human_hair_medium_brown_ponytail.entity.json', weight: 0.1 },
      { file: 'human_hair_raven_medium_straight.entity.json', weight: 0.1 },
      { file: 'human_hair_red_ponytails.entity.json', weight: 0.1 },
      { file: 'human_hair_red_tousled.entity.json', weight: 0.1 },
    ];

    it.each(MEDIUM_HAIR)(
      'should have valid weight for $file',
      ({ file, weight }) => {
        const entity = loadEntityFile(file);
        const actualWeight = getWeight(entity);

        expect(actualWeight).toBeDefined();
        expect(typeof actualWeight).toBe('number');
        expect(actualWeight).toBeGreaterThan(0);
        expect(actualWeight).toBe(weight);
      }
    );

    it('should have all 7 medium hair files with weights', () => {
      const hairCount = MEDIUM_HAIR.length;
      expect(hairCount).toBe(7);

      const entitiesWithWeights = MEDIUM_HAIR.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(hairCount);
    });
  });

  describe('Short Hair Definitions', () => {
    const SHORT_HAIR = [
      { file: 'human_hair_brown_short_ponytail.entity.json', weight: 0.05 },
      { file: 'human_hair_short_brown_wavy.entity.json', weight: 0.05 },
      { file: 'human_hair_short_dirty_blonde_wavy.entity.json', weight: 0.05 },
      { file: 'human_hair_short_gray_wavy.entity.json', weight: 0.05 },
    ];

    it.each(SHORT_HAIR)(
      'should have valid weight for $file',
      ({ file, weight }) => {
        const entity = loadEntityFile(file);
        const actualWeight = getWeight(entity);

        expect(actualWeight).toBeDefined();
        expect(typeof actualWeight).toBe('number');
        expect(actualWeight).toBeGreaterThan(0);
        expect(actualWeight).toBe(weight);
      }
    );

    it('should have all 4 short hair files with weights', () => {
      const hairCount = SHORT_HAIR.length;
      expect(hairCount).toBe(4);

      const entitiesWithWeights = SHORT_HAIR.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(hairCount);
    });
  });

  describe('Buzzed Hair Definitions', () => {
    const BUZZED_HAIR = [
      { file: 'human_hair_blonde_buzzed.entity.json', weight: 0.02 },
    ];

    it.each(BUZZED_HAIR)(
      'should have valid weight for $file',
      ({ file, weight }) => {
        const entity = loadEntityFile(file);
        const actualWeight = getWeight(entity);

        expect(actualWeight).toBeDefined();
        expect(typeof actualWeight).toBe('number');
        expect(actualWeight).toBeGreaterThan(0);
        expect(actualWeight).toBe(weight);
      }
    );
  });

  describe('Weight Component Schema Compliance', () => {
    const ALL_FILES = [
      'human_hair.entity.json',
      'human_hair_black_long_tousled.entity.json',
      'human_hair_blonde.entity.json',
      'human_hair_blonde_buzzed.entity.json',
      'human_hair_blonde_long_braided.entity.json',
      'human_hair_blonde_long_straight.entity.json',
      'human_hair_blonde_medium_ponytail.entity.json',
      'human_hair_blonde_medium_straight.entity.json',
      'human_hair_brown_short_ponytail.entity.json',
      'human_hair_medium_brown_ponytail.entity.json',
      'human_hair_raven.entity.json',
      'human_hair_raven_medium_straight.entity.json',
      'human_hair_red_ponytails.entity.json',
      'human_hair_red_tousled.entity.json',
      'human_hair_short_brown_wavy.entity.json',
      'human_hair_short_dirty_blonde_wavy.entity.json',
      'human_hair_short_gray_wavy.entity.json',
    ];

    it('should have exactly 17 files with weight components', () => {
      expect(ALL_FILES.length).toBe(17);

      const filesWithWeights = ALL_FILES.filter((file) => {
        const entity = loadEntityFile(file);
        return getWeight(entity) !== undefined;
      });

      expect(filesWithWeights.length).toBe(17);
    });

    it.each(ALL_FILES)(
      'should have properly structured items:weight component in %s',
      (file) => {
        const entity = loadEntityFile(file);
        const weightComponent = entity?.components?.['items:weight'];

        expect(weightComponent).toBeDefined();
        expect(weightComponent).toHaveProperty('weight');
        expect(typeof weightComponent.weight).toBe('number');
        expect(Object.keys(weightComponent)).toEqual(['weight']);
      }
    );
  });

  describe('Weight Value Ranges', () => {
    it('should have long hair weights around 0.15 kg', () => {
      const longHairFiles = [
        'human_hair_black_long_tousled.entity.json',
        'human_hair_blonde.entity.json',
        'human_hair_blonde_long_braided.entity.json',
        'human_hair_blonde_long_straight.entity.json',
        'human_hair_raven.entity.json',
      ];

      longHairFiles.forEach((file) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);
        expect(weight).toBeGreaterThanOrEqual(0.12);
        expect(weight).toBeLessThanOrEqual(0.18);
      });
    });

    it('should have medium hair weights around 0.1 kg', () => {
      const mediumHairFiles = [
        'human_hair.entity.json',
        'human_hair_blonde_medium_ponytail.entity.json',
        'human_hair_blonde_medium_straight.entity.json',
        'human_hair_medium_brown_ponytail.entity.json',
        'human_hair_raven_medium_straight.entity.json',
        'human_hair_red_ponytails.entity.json',
        'human_hair_red_tousled.entity.json',
      ];

      mediumHairFiles.forEach((file) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);
        expect(weight).toBeGreaterThanOrEqual(0.08);
        expect(weight).toBeLessThanOrEqual(0.12);
      });
    });

    it('should have short hair weights around 0.05 kg', () => {
      const shortHairFiles = [
        'human_hair_brown_short_ponytail.entity.json',
        'human_hair_short_brown_wavy.entity.json',
        'human_hair_short_dirty_blonde_wavy.entity.json',
        'human_hair_short_gray_wavy.entity.json',
      ];

      shortHairFiles.forEach((file) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);
        expect(weight).toBeGreaterThanOrEqual(0.03);
        expect(weight).toBeLessThanOrEqual(0.07);
      });
    });

    it('should have buzzed hair weight around 0.02 kg', () => {
      const entity = loadEntityFile('human_hair_blonde_buzzed.entity.json');
      const weight = getWeight(entity);
      expect(weight).toBeGreaterThanOrEqual(0.01);
      expect(weight).toBeLessThanOrEqual(0.03);
    });
  });
});
