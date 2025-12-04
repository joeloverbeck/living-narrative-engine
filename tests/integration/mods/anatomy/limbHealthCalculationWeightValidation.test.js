/**
 * @file limbHealthCalculationWeightValidation.test.js
 * @description Validates that all limb (arm and leg) entity definitions have the correct
 * health_calculation_weight property for the data-driven health calculation system.
 *
 * This test ensures the invariants from HEACALOVE-008 are maintained:
 * - All arm entities have health_calculation_weight: 3 in anatomy:part component
 * - All leg entities have health_calculation_weight: 3 in anatomy:part component
 * - The weight value is consistent across all limb variants
 * - Vestigial limbs are excluded (handled in HEACALOVE-012)
 * @see archive/HEACALOVE-008-update-limb-entities.md
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
 * Helper to get health_calculation_weight from entity
 *
 * @param {object} entity - Entity definition object
 * @returns {number|undefined} Weight value or undefined
 */
function getHealthCalculationWeight(entity) {
  return entity?.components?.['anatomy:part']?.health_calculation_weight;
}

/**
 * Helper to get subType from entity
 *
 * @param {object} entity - Entity definition object
 * @returns {string|undefined} subType value or undefined
 */
function getSubType(entity) {
  return entity?.components?.['anatomy:part']?.subType;
}

describe('HEACALOVE-008: Limb Entity health_calculation_weight Validation', () => {
  // All arm entities expected to have health_calculation_weight: 3
  const ARM_ENTITIES = [
    // Humanoid arms
    { file: 'humanoid_arm.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_athletic.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_hulking.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_hulking_hairy.entity.json', expectedSubType: 'arm' },
    {
      file: 'humanoid_arm_hulking_scarred.entity.json',
      expectedSubType: 'arm',
    },
    { file: 'humanoid_arm_lean.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_muscular.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_muscular_hairy.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_scarred.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_slim.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_soft.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_soft_lissom.entity.json', expectedSubType: 'arm' },
    { file: 'humanoid_arm_thick_hairy.entity.json', expectedSubType: 'arm' },
    {
      file: 'humanoid_arm_weathered_tannery_stained.entity.json',
      expectedSubType: 'arm',
    },
    // Creature arms
    { file: 'tortoise_arm.entity.json', expectedSubType: 'tortoise_arm' },
  ];

  // All leg entities expected to have health_calculation_weight: 3
  const LEG_ENTITIES = [
    // Human legs
    { file: 'human_leg.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_athletic.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_hulking.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_hulking_hairy.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_long_lean.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_muscular.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_muscular_hairy.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_shapely.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_slim.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_soft_lissom.entity.json', expectedSubType: 'leg' },
    { file: 'human_leg_thick_hairy.entity.json', expectedSubType: 'leg' },
    // Creature legs
    {
      file: 'centaur_leg_front.entity.json',
      expectedSubType: 'centaur_leg_front',
    },
    {
      file: 'centaur_leg_rear.entity.json',
      expectedSubType: 'centaur_leg_rear',
    },
    { file: 'dragon_leg.entity.json', expectedSubType: 'dragon_leg' },
    { file: 'chicken_leg.entity.json', expectedSubType: 'chicken_leg' },
    { file: 'spider_leg.entity.json', expectedSubType: 'spider_leg' },
    { file: 'tortoise_leg.entity.json', expectedSubType: 'tortoise_leg' },
  ];

  // Vestigial limbs excluded from this ticket (handled in HEACALOVE-012)
  const EXCLUDED_VESTIGIAL_ENTITIES = [
    'eldritch_vestigial_arm.entity.json',
    // Add other vestigial limbs here as they are created
  ];

  const EXPECTED_LIMB_HEALTH_WEIGHT = 3;

  describe('Arm entities should have health_calculation_weight: 3', () => {
    it.each(ARM_ENTITIES)(
      'should have health_calculation_weight: 3 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        // Verify anatomy:part component exists with correct subType
        expect(subType).toBe(expectedSubType);

        // Verify health_calculation_weight exists and has correct value
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_LIMB_HEALTH_WEIGHT);
      }
    );
  });

  describe('Leg entities should have health_calculation_weight: 3', () => {
    it.each(LEG_ENTITIES)(
      'should have health_calculation_weight: 3 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        // Verify anatomy:part component exists with correct subType
        expect(subType).toBe(expectedSubType);

        // Verify health_calculation_weight exists and has correct value
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_LIMB_HEALTH_WEIGHT);
      }
    );
  });

  describe('Entity count verification', () => {
    it('should have exactly 15 arm entities with health_calculation_weight', () => {
      const count = ARM_ENTITIES.length;
      expect(count).toBe(15);

      const entitiesWithWeight = ARM_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return (
          getHealthCalculationWeight(entity) === EXPECTED_LIMB_HEALTH_WEIGHT
        );
      });

      expect(entitiesWithWeight.length).toBe(15);
    });

    it('should have exactly 17 leg entities with health_calculation_weight', () => {
      const count = LEG_ENTITIES.length;
      expect(count).toBe(17);

      const entitiesWithWeight = LEG_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return (
          getHealthCalculationWeight(entity) === EXPECTED_LIMB_HEALTH_WEIGHT
        );
      });

      expect(entitiesWithWeight.length).toBe(17);
    });
  });

  describe('Vestigial limb exclusion verification', () => {
    it.each(EXCLUDED_VESTIGIAL_ENTITIES)(
      'vestigial entity %s should NOT have health_calculation_weight: 3 (handled separately)',
      (file) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);

        // Vestigial limbs should either not have health_calculation_weight
        // or have a different value (to be determined in HEACALOVE-012)
        expect(weight).not.toBe(EXPECTED_LIMB_HEALTH_WEIGHT);
      }
    );
  });

  describe('anatomy:part component structure', () => {
    const ALL_LIMB_ENTITIES = [...ARM_ENTITIES, ...LEG_ENTITIES];

    it.each(ALL_LIMB_ENTITIES)(
      'should have properly structured anatomy:part component in %s',
      ({ file }) => {
        const entity = loadEntityFile(file);
        const partComponent = entity?.components?.['anatomy:part'];

        expect(partComponent).toBeDefined();
        expect(partComponent).toHaveProperty('subType');
        expect(partComponent).toHaveProperty('hit_probability_weight');
        expect(partComponent).toHaveProperty('health_calculation_weight');
        expect(typeof partComponent.health_calculation_weight).toBe('number');
      }
    );
  });
});
