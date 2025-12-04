/**
 * @file creatureWeightValidation.test.js
 * @description Validates that creature entity definitions (centaur, dragon, eldritch,
 * cat/feline, horse) have appropriate core:weight components for the dismemberment
 * spawning feature.
 *
 * This test ensures the invariants from DISBODPARSPA-014 are maintained:
 * - All creature entities have core:weight
 * - Weights are positive numbers within realistic ranges for each creature type
 *
 * @see tickets/DISBODPARSPA-014-weight-creatures.md
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

describe('DISBODPARSPA-014: Creature Entity Weight Validation', () => {
  describe('Centaur Definitions (5 files)', () => {
    const CENTAUR_PARTS = [
      {
        file: 'centaur_head.entity.json',
        minWeight: 4,
        maxWeight: 7,
        desc: 'Humanoid head',
      },
      {
        file: 'centaur_leg_front.entity.json',
        minWeight: 20,
        maxWeight: 30,
        desc: 'Front horse leg',
      },
      {
        file: 'centaur_leg_rear.entity.json',
        minWeight: 25,
        maxWeight: 35,
        desc: 'Rear horse leg',
      },
      {
        file: 'centaur_torso.entity.json',
        minWeight: 120,
        maxWeight: 180,
        desc: 'Lower horse body',
      },
      {
        file: 'centaur_upper_torso.entity.json',
        minWeight: 28,
        maxWeight: 45,
        desc: 'Human-like upper torso',
      },
    ];

    it.each(CENTAUR_PARTS)(
      'should have valid weight for $file ($desc)',
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

    it('should have all 5 centaur files with weights', () => {
      const count = CENTAUR_PARTS.length;
      expect(count).toBe(5);

      const entitiesWithWeights = CENTAUR_PARTS.filter((p) => {
        const entity = loadEntityFile(p.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(count);
    });
  });

  describe('Dragon Definitions (5 files)', () => {
    const DRAGON_PARTS = [
      {
        file: 'dragon_head.entity.json',
        minWeight: 40,
        maxWeight: 60,
        desc: 'Large dragon head',
      },
      {
        file: 'dragon_leg.entity.json',
        minWeight: 50,
        maxWeight: 70,
        desc: 'Dragon leg',
      },
      {
        file: 'dragon_tail.entity.json',
        minWeight: 80,
        maxWeight: 120,
        desc: 'Heavy dragon tail',
      },
      {
        file: 'dragon_torso.entity.json',
        minWeight: 400,
        maxWeight: 600,
        desc: 'Main massive body',
      },
      {
        file: 'dragon_wing.entity.json',
        minWeight: 30,
        maxWeight: 50,
        desc: 'Dragon wing',
      },
    ];

    it.each(DRAGON_PARTS)(
      'should have valid weight for $file ($desc)',
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

    it('should have all 5 dragon files with weights', () => {
      const count = DRAGON_PARTS.length;
      expect(count).toBe(5);

      const entitiesWithWeights = DRAGON_PARTS.filter((p) => {
        const entity = loadEntityFile(p.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(count);
    });
  });

  describe('Eldritch Definitions (15 files)', () => {
    const ELDRITCH_PARTS = [
      {
        file: 'eldritch_baleful_eye.entity.json',
        minWeight: 1.5,
        maxWeight: 3,
        desc: 'Large central eye',
      },
      {
        file: 'eldritch_compound_eye_stalk.entity.json',
        minWeight: 1,
        maxWeight: 2,
        desc: 'Eye stalk',
      },
      {
        file: 'eldritch_core_mass.entity.json',
        minWeight: 150,
        maxWeight: 250,
        desc: 'Central pulsating mass',
      },
      {
        file: 'eldritch_lamprey_mouth.entity.json',
        minWeight: 2,
        maxWeight: 5,
        desc: 'Lamprey mouth',
      },
      {
        file: 'eldritch_malformed_hand.entity.json',
        minWeight: 1.5,
        maxWeight: 3,
        desc: 'Malformed appendage',
      },
      {
        file: 'eldritch_membrane_wing.entity.json',
        minWeight: 5,
        maxWeight: 12,
        desc: 'Membrane wing',
      },
      {
        file: 'eldritch_sensory_stalk.entity.json',
        minWeight: 0.3,
        maxWeight: 1,
        desc: 'Sensory stalk',
      },
      {
        file: 'eldritch_speaking_orifice.entity.json',
        minWeight: 0.5,
        maxWeight: 2,
        desc: 'Speaking orifice',
      },
      {
        file: 'eldritch_surface_eye.entity.json',
        minWeight: 0.1,
        maxWeight: 0.5,
        desc: 'Small surface eye',
      },
      {
        file: 'eldritch_tentacle_feeding.entity.json',
        minWeight: 8,
        maxWeight: 15,
        desc: 'Feeding tentacle',
      },
      {
        file: 'eldritch_tentacle_large.entity.json',
        minWeight: 15,
        maxWeight: 25,
        desc: 'Large tentacle',
      },
      {
        file: 'eldritch_tentacle_sensory.entity.json',
        minWeight: 3,
        maxWeight: 8,
        desc: 'Sensory tentacle',
      },
      {
        file: 'eldritch_vertical_maw.entity.json',
        minWeight: 10,
        maxWeight: 20,
        desc: 'Large vertical maw',
      },
      {
        file: 'eldritch_vestigial_arm.entity.json',
        minWeight: 2,
        maxWeight: 5,
        desc: 'Vestigial arm',
      },
      {
        file: 'eldritch_vocal_sac.entity.json',
        minWeight: 0.5,
        maxWeight: 2,
        desc: 'Vocal sac',
      },
    ];

    it.each(ELDRITCH_PARTS)(
      'should have valid weight for $file ($desc)',
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

    it('should have all 15 eldritch files with weights', () => {
      const count = ELDRITCH_PARTS.length;
      expect(count).toBe(15);

      const entitiesWithWeights = ELDRITCH_PARTS.filter((p) => {
        const entity = loadEntityFile(p.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(count);
    });
  });

  describe('Cat Definitions (4 files)', () => {
    const CAT_PARTS = [
      {
        file: 'cat_ear.entity.json',
        minWeight: 0.005,
        maxWeight: 0.02,
        desc: 'Cat ear',
      },
      {
        file: 'cat_ear_decorated.entity.json',
        minWeight: 0.01,
        maxWeight: 0.03,
        desc: 'Decorated cat ear',
      },
      {
        file: 'cat_girl_torso.entity.json',
        minWeight: 20,
        maxWeight: 30,
        desc: 'Cat-girl humanoid torso',
      },
      {
        file: 'cat_tail.entity.json',
        minWeight: 0.1,
        maxWeight: 0.25,
        desc: 'Cat tail',
      },
    ];

    it.each(CAT_PARTS)(
      'should have valid weight for $file ($desc)',
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

    it('should have all 4 cat files with weights', () => {
      const count = CAT_PARTS.length;
      expect(count).toBe(4);

      const entitiesWithWeights = CAT_PARTS.filter((p) => {
        const entity = loadEntityFile(p.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(count);
    });
  });

  describe('Feline Eye Definitions (3 files)', () => {
    const FELINE_EYES = [
      {
        file: 'feline_eye_abyssal_black_glow.entity.json',
        minWeight: 0.005,
        maxWeight: 0.015,
        desc: 'Feline eye',
      },
      {
        file: 'feline_eye_amber_slit.entity.json',
        minWeight: 0.005,
        maxWeight: 0.015,
        desc: 'Feline eye',
      },
      {
        file: 'feline_eye_ice_blue_slit.entity.json',
        minWeight: 0.005,
        maxWeight: 0.015,
        desc: 'Feline eye',
      },
    ];

    it.each(FELINE_EYES)(
      'should have valid weight for $file ($desc)',
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

    it('should have all 3 feline eye files with weights', () => {
      const count = FELINE_EYES.length;
      expect(count).toBe(3);

      const entitiesWithWeights = FELINE_EYES.filter((p) => {
        const entity = loadEntityFile(p.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(count);
    });
  });

  describe('Horse Definitions (1 file)', () => {
    const HORSE_PARTS = [
      {
        file: 'horse_tail.entity.json',
        minWeight: 3,
        maxWeight: 6,
        desc: 'Horse tail',
      },
    ];

    it.each(HORSE_PARTS)(
      'should have valid weight for $file ($desc)',
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

    it('should have all 1 horse file with weights', () => {
      const count = HORSE_PARTS.length;
      expect(count).toBe(1);

      const entitiesWithWeights = HORSE_PARTS.filter((p) => {
        const entity = loadEntityFile(p.file);
        return getWeight(entity) !== undefined;
      });

      expect(entitiesWithWeights.length).toBe(count);
    });
  });

  describe('Weight Component Schema Compliance (all 33 files)', () => {
    const ALL_FILES = [
      // Centaur (5)
      'centaur_head.entity.json',
      'centaur_leg_front.entity.json',
      'centaur_leg_rear.entity.json',
      'centaur_torso.entity.json',
      'centaur_upper_torso.entity.json',
      // Dragon (5)
      'dragon_head.entity.json',
      'dragon_leg.entity.json',
      'dragon_tail.entity.json',
      'dragon_torso.entity.json',
      'dragon_wing.entity.json',
      // Eldritch (15)
      'eldritch_baleful_eye.entity.json',
      'eldritch_compound_eye_stalk.entity.json',
      'eldritch_core_mass.entity.json',
      'eldritch_lamprey_mouth.entity.json',
      'eldritch_malformed_hand.entity.json',
      'eldritch_membrane_wing.entity.json',
      'eldritch_sensory_stalk.entity.json',
      'eldritch_speaking_orifice.entity.json',
      'eldritch_surface_eye.entity.json',
      'eldritch_tentacle_feeding.entity.json',
      'eldritch_tentacle_large.entity.json',
      'eldritch_tentacle_sensory.entity.json',
      'eldritch_vertical_maw.entity.json',
      'eldritch_vestigial_arm.entity.json',
      'eldritch_vocal_sac.entity.json',
      // Cat (4)
      'cat_ear.entity.json',
      'cat_ear_decorated.entity.json',
      'cat_girl_torso.entity.json',
      'cat_tail.entity.json',
      // Feline eyes (3)
      'feline_eye_abyssal_black_glow.entity.json',
      'feline_eye_amber_slit.entity.json',
      'feline_eye_ice_blue_slit.entity.json',
      // Horse (1)
      'horse_tail.entity.json',
    ];

    it('should have exactly 33 files with weight components', () => {
      expect(ALL_FILES.length).toBe(33);

      const filesWithWeights = ALL_FILES.filter((file) => {
        const entity = loadEntityFile(file);
        return getWeight(entity) !== undefined;
      });

      expect(filesWithWeights.length).toBe(33);
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
