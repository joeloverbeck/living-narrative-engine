/**
 * @file sensoryOrganHealthCalculationWeightValidation.test.js
 * @description Validates that all sensory organ entity definitions have the correct
 * health_calculation_weight property for the data-driven health calculation system.
 *
 * This test ensures the invariants from HEACALOVE-010 are maintained:
 * - All eye entities have health_calculation_weight: 2 (Tier 6: Sensory - Critical)
 * - All ear entities have health_calculation_weight: 1 (Tier 6: Sensory - Standard)
 * - All nose entities have health_calculation_weight: 1 (Tier 6: Sensory - Standard)
 * - All mouth entities have health_calculation_weight: 1 (Tier 6: Sensory - Standard)
 * - All teeth entities have health_calculation_weight: 0.5 (Tier 6: Sensory - Minor)
 * @see archive/HEACALOVE-010-update-sensory-organ-entities.md
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

describe('HEACALOVE-010: Sensory Organ Entity health_calculation_weight Validation', () => {
  // Eye entities expected to have health_calculation_weight: 2
  const EYE_ENTITIES = [
    // Human eyes
    { file: 'human_eye_amber.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_blue.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_blue_hooded.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_brown.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_brown_almond.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_cobalt.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_gray_hooded.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_green.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_hazel_almond.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_hazel_hooded.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_pale_blue_round.entity.json', expectedSubType: 'eye' },
    { file: 'human_eye_red_hooded.entity.json', expectedSubType: 'eye' },
    // Feline eyes
    {
      file: 'feline_eye_abyssal_black_glow.entity.json',
      expectedSubType: 'eye',
    },
    { file: 'feline_eye_amber_slit.entity.json', expectedSubType: 'eye' },
    { file: 'feline_eye_ice_blue_slit.entity.json', expectedSubType: 'eye' },
    // Creature eyes
    { file: 'tortoise_eye.entity.json', expectedSubType: 'tortoise_eye' },
    // Eldritch eyes
    {
      file: 'eldritch_baleful_eye.entity.json',
      expectedSubType: 'eldritch_baleful_eye',
    },
    {
      file: 'eldritch_surface_eye.entity.json',
      expectedSubType: 'eldritch_surface_eye',
    },
    {
      file: 'eldritch_compound_eye_stalk.entity.json',
      expectedSubType: 'eldritch_compound_eye_stalk',
    },
  ];

  // Ear entities expected to have health_calculation_weight: 1
  const EAR_ENTITIES = [
    { file: 'humanoid_ear.entity.json', expectedSubType: 'ear' },
    { file: 'cat_ear.entity.json', expectedSubType: 'ear' },
    { file: 'cat_ear_decorated.entity.json', expectedSubType: 'ear' },
  ];

  // Nose entities expected to have health_calculation_weight: 1
  const NOSE_ENTITIES = [
    { file: 'humanoid_nose.entity.json', expectedSubType: 'nose' },
    { file: 'humanoid_nose_scarred.entity.json', expectedSubType: 'nose' },
    { file: 'humanoid_nose_small.entity.json', expectedSubType: 'nose' },
  ];

  // Mouth entities expected to have health_calculation_weight: 1
  const MOUTH_ENTITIES = [
    { file: 'humanoid_mouth.entity.json', expectedSubType: 'mouth' },
    {
      file: 'eldritch_lamprey_mouth.entity.json',
      expectedSubType: 'eldritch_lamprey_mouth',
    },
  ];

  // Teeth entities expected to have health_calculation_weight: 0.5
  const TEETH_ENTITIES = [
    { file: 'humanoid_teeth.entity.json', expectedSubType: 'teeth' },
  ];

  const EXPECTED_EYE_WEIGHT = 2;
  const EXPECTED_EAR_WEIGHT = 1;
  const EXPECTED_NOSE_WEIGHT = 1;
  const EXPECTED_MOUTH_WEIGHT = 1;
  const EXPECTED_TEETH_WEIGHT = 0.5;

  describe('Eye entities should have health_calculation_weight: 2', () => {
    it.each(EYE_ENTITIES)(
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
        expect(weight).toBe(EXPECTED_EYE_WEIGHT);
      }
    );
  });

  describe('Ear entities should have health_calculation_weight: 1', () => {
    it.each(EAR_ENTITIES)(
      'should have health_calculation_weight: 1 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_EAR_WEIGHT);
      }
    );
  });

  describe('Nose entities should have health_calculation_weight: 1', () => {
    it.each(NOSE_ENTITIES)(
      'should have health_calculation_weight: 1 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_NOSE_WEIGHT);
      }
    );
  });

  describe('Mouth entities should have health_calculation_weight: 1', () => {
    it.each(MOUTH_ENTITIES)(
      'should have health_calculation_weight: 1 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_MOUTH_WEIGHT);
      }
    );
  });

  describe('Teeth entities should have health_calculation_weight: 0.5', () => {
    it.each(TEETH_ENTITIES)(
      'should have health_calculation_weight: 0.5 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_TEETH_WEIGHT);
      }
    );
  });

  describe('Entity count verification', () => {
    it('should have exactly 19 eye entities with health_calculation_weight', () => {
      const count = EYE_ENTITIES.length;
      expect(count).toBe(19);

      const entitiesWithWeight = EYE_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === EXPECTED_EYE_WEIGHT;
      });

      expect(entitiesWithWeight.length).toBe(19);
    });

    it('should have exactly 3 ear entities with health_calculation_weight', () => {
      const count = EAR_ENTITIES.length;
      expect(count).toBe(3);

      const entitiesWithWeight = EAR_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === EXPECTED_EAR_WEIGHT;
      });

      expect(entitiesWithWeight.length).toBe(3);
    });

    it('should have exactly 3 nose entities with health_calculation_weight', () => {
      const count = NOSE_ENTITIES.length;
      expect(count).toBe(3);

      const entitiesWithWeight = NOSE_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === EXPECTED_NOSE_WEIGHT;
      });

      expect(entitiesWithWeight.length).toBe(3);
    });

    it('should have exactly 2 mouth entities with health_calculation_weight', () => {
      const count = MOUTH_ENTITIES.length;
      expect(count).toBe(2);

      const entitiesWithWeight = MOUTH_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === EXPECTED_MOUTH_WEIGHT;
      });

      expect(entitiesWithWeight.length).toBe(2);
    });

    it('should have exactly 1 teeth entity with health_calculation_weight', () => {
      const count = TEETH_ENTITIES.length;
      expect(count).toBe(1);

      const entitiesWithWeight = TEETH_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === EXPECTED_TEETH_WEIGHT;
      });

      expect(entitiesWithWeight.length).toBe(1);
    });
  });

  describe('anatomy:part component structure', () => {
    const ALL_SENSORY_ENTITIES = [
      ...EYE_ENTITIES,
      ...EAR_ENTITIES,
      ...NOSE_ENTITIES,
      ...MOUTH_ENTITIES,
      ...TEETH_ENTITIES,
    ];

    it.each(ALL_SENSORY_ENTITIES)(
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

  describe('Sensory organ weight tier verification', () => {
    it('eyes should have higher weight than ears/nose/mouth (vision is critical)', () => {
      EYE_ENTITIES.forEach(({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        expect(weight).toBeGreaterThan(EXPECTED_EAR_WEIGHT);
      });
    });

    it('ears/nose/mouth should have higher weight than teeth', () => {
      const standardSensoryEntities = [
        ...EAR_ENTITIES,
        ...NOSE_ENTITIES,
        ...MOUTH_ENTITIES,
      ];

      standardSensoryEntities.forEach(({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        expect(weight).toBeGreaterThan(EXPECTED_TEETH_WEIGHT);
      });
    });

    it('sensory organs should have weight consistent with Tier 6', () => {
      // Tier 6 (Sensory) values: Eyes=2, Standard=1, Minor=0.5
      // All should be less than Tier 5 (Extremities) at 2, or equal for critical eyes
      const EXTREMITY_WEIGHT = 2;

      const allSensoryEntities = [
        ...EYE_ENTITIES,
        ...EAR_ENTITIES,
        ...NOSE_ENTITIES,
        ...MOUTH_ENTITIES,
        ...TEETH_ENTITIES,
      ];

      allSensoryEntities.forEach(({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        expect(weight).toBeLessThanOrEqual(EXTREMITY_WEIGHT);
      });
    });
  });
});
