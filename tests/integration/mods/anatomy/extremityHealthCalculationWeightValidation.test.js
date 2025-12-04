/**
 * @file extremityHealthCalculationWeightValidation.test.js
 * @description Validates that all extremity (hand and foot) entity definitions have the correct
 * health_calculation_weight property for the data-driven health calculation system.
 *
 * This test ensures the invariants from HEACALOVE-009 are maintained:
 * - All hand entities have health_calculation_weight: 2 in anatomy:part component
 * - All foot entities have health_calculation_weight: 2 in anatomy:part component
 * - The weight value is consistent across all extremity variants
 * @see archive/HEACALOVE-009-update-extremity-entities.md
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

describe('HEACALOVE-009: Extremity Entity health_calculation_weight Validation', () => {
  // All hand entities expected to have health_calculation_weight: 2
  const HAND_ENTITIES = [
    // Human hands
    { file: 'human_hand.entity.json', expectedSubType: 'hand' },
    // Humanoid hand variants
    {
      file: 'humanoid_hand_craftsman_scarred.entity.json',
      expectedSubType: 'hand',
    },
    {
      file: 'humanoid_hand_craftsman_stained.entity.json',
      expectedSubType: 'hand',
    },
    { file: 'humanoid_hand_rough.entity.json', expectedSubType: 'hand' },
    { file: 'humanoid_hand_scarred.entity.json', expectedSubType: 'hand' },
    // Creature hands
    { file: 'tortoise_hand.entity.json', expectedSubType: 'tortoise_hand' },
    // Eldritch hands
    {
      file: 'eldritch_malformed_hand.entity.json',
      expectedSubType: 'eldritch_hand',
    },
  ];

  // All foot entities expected to have health_calculation_weight: 2
  const FOOT_ENTITIES = [
    // Human feet
    { file: 'human_foot.entity.json', expectedSubType: 'foot' },
    // Creature feet
    { file: 'chicken_foot.entity.json', expectedSubType: 'chicken_foot' },
    { file: 'tortoise_foot.entity.json', expectedSubType: 'tortoise_foot' },
  ];

  const EXPECTED_EXTREMITY_HEALTH_WEIGHT = 2;

  describe('Hand entities should have health_calculation_weight: 2', () => {
    it.each(HAND_ENTITIES)(
      'should have health_calculation_weight: 2 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        // Verify anatomy:part component exists with correct subType
        expect(subType).toBe(expectedSubType);

        // Verify health_calculation_weight exists and has correct value
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_EXTREMITY_HEALTH_WEIGHT);
      }
    );
  });

  describe('Foot entities should have health_calculation_weight: 2', () => {
    it.each(FOOT_ENTITIES)(
      'should have health_calculation_weight: 2 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        // Verify anatomy:part component exists with correct subType
        expect(subType).toBe(expectedSubType);

        // Verify health_calculation_weight exists and has correct value
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_EXTREMITY_HEALTH_WEIGHT);
      }
    );
  });

  describe('Entity count verification', () => {
    it('should have exactly 7 hand entities with health_calculation_weight', () => {
      const count = HAND_ENTITIES.length;
      expect(count).toBe(7);

      const entitiesWithWeight = HAND_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return (
          getHealthCalculationWeight(entity) === EXPECTED_EXTREMITY_HEALTH_WEIGHT
        );
      });

      expect(entitiesWithWeight.length).toBe(7);
    });

    it('should have exactly 3 foot entities with health_calculation_weight', () => {
      const count = FOOT_ENTITIES.length;
      expect(count).toBe(3);

      const entitiesWithWeight = FOOT_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return (
          getHealthCalculationWeight(entity) === EXPECTED_EXTREMITY_HEALTH_WEIGHT
        );
      });

      expect(entitiesWithWeight.length).toBe(3);
    });
  });

  describe('anatomy:part component structure', () => {
    const ALL_EXTREMITY_ENTITIES = [...HAND_ENTITIES, ...FOOT_ENTITIES];

    it.each(ALL_EXTREMITY_ENTITIES)(
      'should have properly structured anatomy:part component in $file',
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

  describe('Extremity weight tier verification', () => {
    it('should have lower weight than limbs (which have weight 3)', () => {
      const LIMB_WEIGHT = 3;
      const allExtremities = [...HAND_ENTITIES, ...FOOT_ENTITIES];

      allExtremities.forEach(({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        expect(weight).toBeLessThan(LIMB_WEIGHT);
      });
    });

    it('should have weight consistent with Tier 5: Extremities', () => {
      // Tier 5 (Extremities) should be 2, lower than Tier 4 (Limbs) at 3
      const allExtremities = [...HAND_ENTITIES, ...FOOT_ENTITIES];

      allExtremities.forEach(({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        expect(weight).toBe(2);
      });
    });
  });
});
