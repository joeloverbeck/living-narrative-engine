/**
 * @file humanHeadFaceWeightValidation.test.js
 * @description Validates that human head and face entity definitions have
 * appropriate core:weight components for the dismemberment spawning feature.
 *
 * This test ensures the invariants from DISBODPARSPA-011 are maintained:
 * - All human head/face entities (brain, eye variants) have core:weight
 * - Weights are positive numbers within realistic ranges
 *
 * @see tickets/DISBODPARSPA-011-weight-human-head-face.md
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

describe('DISBODPARSPA-011: Human Head/Face Weight Validation', () => {
  describe('Human Brain Definition', () => {
    it('should have valid weight for human_brain.entity.json', () => {
      const entity = loadEntityFile('human_brain.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThan(0);
      // Brain weight: 1.3-1.5 kg typical adult brain
      expect(weight).toBeGreaterThanOrEqual(1.3);
      expect(weight).toBeLessThanOrEqual(1.5);
    });

    it('should have properly structured core:weight component in human_brain.entity.json', () => {
      const entity = loadEntityFile('human_brain.entity.json');
      const weightComponent = entity?.components?.['core:weight'];

      expect(weightComponent).toBeDefined();
      expect(weightComponent).toHaveProperty('weight');
      expect(typeof weightComponent.weight).toBe('number');
      expect(Object.keys(weightComponent)).toEqual(['weight']);
    });
  });

  describe('Human Eye Definitions', () => {
    const EYES = [
      {
        file: 'human_eye_amber.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_blue.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_blue_hooded.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_brown.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_brown_almond.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_cobalt.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_gray_hooded.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_green.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_hazel_almond.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_hazel_hooded.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_pale_blue_round.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
      {
        file: 'human_eye_red_hooded.entity.json',
        minWeight: 0.007,
        maxWeight: 0.009,
      },
    ];

    it.each(EYES)(
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

    it('should have all 12 eye files with weights', () => {
      const eyeCount = EYES.length;
      expect(eyeCount).toBe(12);

      const entitiesWithWeights = EYES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(eyeCount);
    });
  });

  describe('Weight Component Schema Compliance', () => {
    const ALL_FILES = [
      'human_brain.entity.json',
      'human_eye_amber.entity.json',
      'human_eye_blue.entity.json',
      'human_eye_blue_hooded.entity.json',
      'human_eye_brown.entity.json',
      'human_eye_brown_almond.entity.json',
      'human_eye_cobalt.entity.json',
      'human_eye_gray_hooded.entity.json',
      'human_eye_green.entity.json',
      'human_eye_hazel_almond.entity.json',
      'human_eye_hazel_hooded.entity.json',
      'human_eye_pale_blue_round.entity.json',
      'human_eye_red_hooded.entity.json',
    ];

    it('should have exactly 13 files with weight components', () => {
      expect(ALL_FILES.length).toBe(13);

      const filesWithWeights = ALL_FILES.filter((file) => {
        const entity = loadEntityFile(file);
        return getWeight(entity) !== undefined;
      });

      expect(filesWithWeights.length).toBe(13);
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
