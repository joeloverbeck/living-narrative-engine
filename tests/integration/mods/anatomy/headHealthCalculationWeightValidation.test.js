/**
 * @file headHealthCalculationWeightValidation.test.js
 * @description Validates that all head entity definitions have the correct
 * health_calculation_weight property for the data-driven health calculation system.
 *
 * This test ensures the invariants from HEACALOVE-007 are maintained:
 * - All head entities have health_calculation_weight: 8 in anatomy:part component
 * - The weight value is consistent across all head variants
 * @see archive/HEACALOVE-007-update-head-entities.md
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const ANATOMY_DEFINITIONS_PATH = path.resolve(
  process.cwd(),
  'data/mods/anatomy/entities/definitions'
);
const CREATURE_DEFINITIONS_PATH = path.resolve(
  process.cwd(),
  'data/mods/anatomy-creatures/entities/definitions'
);

function resolveDefinitionPath(filename) {
  const creaturePath = path.join(CREATURE_DEFINITIONS_PATH, filename);
  if (fs.existsSync(creaturePath)) {
    return creaturePath;
  }
  return path.join(ANATOMY_DEFINITIONS_PATH, filename);
}

/**
 * Helper to load entity JSON file
 *
 * @param {string} filename - Entity file name
 * @returns {object} Parsed JSON
 */
function loadEntityFile(filename) {
  const filePath = resolveDefinitionPath(filename);
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

describe('HEACALOVE-007: Head Entity health_calculation_weight Validation', () => {
  // All head entities expected to have health_calculation_weight: 8
  const HEAD_ENTITIES = [
    // Humanoid heads
    { file: 'humanoid_head.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_attractive.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_bearded.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_beautiful.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_cute.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_hideous.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_moustached.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_plain.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_plain_weary.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_scarred.entity.json', expectedSubType: 'head' },
    { file: 'humanoid_head_stubble.entity.json', expectedSubType: 'head' },
    // Creature heads
    { file: 'centaur_head.entity.json', expectedSubType: 'centaur_head' },
    { file: 'dragon_head.entity.json', expectedSubType: 'dragon_head' },
    { file: 'kraken_head.entity.json', expectedSubType: 'head' },
    { file: 'tortoise_head.entity.json', expectedSubType: 'tortoise_head' },
    // Chicken heads
    { file: 'chicken_head.entity.json', expectedSubType: 'chicken_head' },
    {
      file: 'chicken_head_chalky_white.entity.json',
      expectedSubType: 'chicken_head',
    },
    {
      file: 'chicken_head_rust_red.entity.json',
      expectedSubType: 'chicken_head',
    },
    {
      file: 'chicken_head_twisted_joints.entity.json',
      expectedSubType: 'chicken_head',
    },
  ];

  const EXPECTED_HEALTH_WEIGHT = 8;

  describe('All head entities should have health_calculation_weight', () => {
    it.each(HEAD_ENTITIES)(
      'should have health_calculation_weight: 8 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        // Verify anatomy:part component exists with correct subType
        expect(subType).toBe(expectedSubType);

        // Verify health_calculation_weight exists and has correct value
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_HEALTH_WEIGHT);
      }
    );
  });

  describe('Head entity count verification', () => {
    it('should have exactly 19 head entities with health_calculation_weight', () => {
      const count = HEAD_ENTITIES.length;
      expect(count).toBe(19);

      const entitiesWithWeight = HEAD_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === EXPECTED_HEALTH_WEIGHT;
      });

      expect(entitiesWithWeight.length).toBe(19);
    });
  });

  describe('anatomy:part component structure', () => {
    it.each(HEAD_ENTITIES)(
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
