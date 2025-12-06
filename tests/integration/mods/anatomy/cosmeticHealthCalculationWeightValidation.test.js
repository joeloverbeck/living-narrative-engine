/**
 * @file cosmeticHealthCalculationWeightValidation.test.js
 * @description Validates that all cosmetic entity definitions have the correct
 * health_calculation_weight property for the data-driven health calculation system.
 *
 * This test ensures the invariants from HEACALOVE-011 are maintained:
 * - Hair entities (subType: hair) have health_calculation_weight: 0.1
 * - Pubic hair entity (subType: pubic_hair) has health_calculation_weight: 0.1
 * - Ass cheek entities (subType: ass_cheek) have health_calculation_weight: 0.2
 * - Breast entities (subType: breast) have health_calculation_weight: 0.3
 * - Genital entities (penis, vagina, testicle) have health_calculation_weight: 0.5
 * @see archive/HEACALOVE-011-update-cosmetic-entities.md
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

describe('HEACALOVE-011: Cosmetic Entity health_calculation_weight Validation', () => {
  // Hair entities - weight: 0.1
  const HAIR_ENTITIES = [
    { file: 'human_hair.entity.json', expectedSubType: 'hair' },
    {
      file: 'human_hair_black_long_tousled.entity.json',
      expectedSubType: 'hair',
    },
    { file: 'human_hair_blonde.entity.json', expectedSubType: 'hair' },
    { file: 'human_hair_blonde_buzzed.entity.json', expectedSubType: 'hair' },
    {
      file: 'human_hair_blonde_long_braided.entity.json',
      expectedSubType: 'hair',
    },
    {
      file: 'human_hair_blonde_long_straight.entity.json',
      expectedSubType: 'hair',
    },
    {
      file: 'human_hair_blonde_medium_ponytail.entity.json',
      expectedSubType: 'hair',
    },
    {
      file: 'human_hair_blonde_medium_straight.entity.json',
      expectedSubType: 'hair',
    },
    {
      file: 'human_hair_brown_short_ponytail.entity.json',
      expectedSubType: 'hair',
    },
    {
      file: 'human_hair_medium_brown_ponytail.entity.json',
      expectedSubType: 'hair',
    },
    { file: 'human_hair_raven.entity.json', expectedSubType: 'hair' },
    {
      file: 'human_hair_raven_medium_straight.entity.json',
      expectedSubType: 'hair',
    },
    { file: 'human_hair_red_ponytails.entity.json', expectedSubType: 'hair' },
    { file: 'human_hair_red_tousled.entity.json', expectedSubType: 'hair' },
    {
      file: 'human_hair_short_brown_wavy.entity.json',
      expectedSubType: 'hair',
    },
    {
      file: 'human_hair_short_dirty_blonde_wavy.entity.json',
      expectedSubType: 'hair',
    },
    { file: 'human_hair_short_gray_wavy.entity.json', expectedSubType: 'hair' },
  ];

  // Pubic hair entity - weight: 0.1
  const PUBIC_HAIR_ENTITIES = [
    { file: 'human_pubic_hair.entity.json', expectedSubType: 'pubic_hair' },
  ];

  // Ass cheek entities - weight: 0.2
  const ASS_CHEEK_ENTITIES = [
    { file: 'human_ass_cheek.entity.json', expectedSubType: 'ass_cheek' },
    {
      file: 'human_ass_cheek_bubbly.entity.json',
      expectedSubType: 'ass_cheek',
    },
    { file: 'human_ass_cheek_firm.entity.json', expectedSubType: 'ass_cheek' },
    {
      file: 'human_ass_cheek_firm_athletic_shelf.entity.json',
      expectedSubType: 'ass_cheek',
    },
    {
      file: 'human_ass_cheek_firm_muscular_shelf.entity.json',
      expectedSubType: 'ass_cheek',
    },
    {
      file: 'human_ass_cheek_firm_thick.entity.json',
      expectedSubType: 'ass_cheek',
    },
    { file: 'human_ass_cheek_round.entity.json', expectedSubType: 'ass_cheek' },
    {
      file: 'human_ass_cheek_round_soft.entity.json',
      expectedSubType: 'ass_cheek',
    },
    {
      file: 'human_ass_cheek_small_bubbly.entity.json',
      expectedSubType: 'ass_cheek',
    },
    {
      file: 'human_ass_cheek_small_round.entity.json',
      expectedSubType: 'ass_cheek',
    },
  ];

  // Breast entities - weight: 0.3
  const BREAST_ENTITIES = [
    { file: 'human_breast.entity.json', expectedSubType: 'breast' },
    { file: 'human_breast_a_cup.entity.json', expectedSubType: 'breast' },
    { file: 'human_breast_c_cup_firm.entity.json', expectedSubType: 'breast' },
    { file: 'human_breast_c_cup_soft.entity.json', expectedSubType: 'breast' },
    { file: 'human_breast_d_cup.entity.json', expectedSubType: 'breast' },
    { file: 'human_breast_g_cup.entity.json', expectedSubType: 'breast' },
    { file: 'human_breast_shelf.entity.json', expectedSubType: 'breast' },
  ];

  // Genital entities - weight: 0.5
  const GENITAL_ENTITIES = [
    { file: 'human_penis.entity.json', expectedSubType: 'penis' },
    { file: 'human_penis_small.entity.json', expectedSubType: 'penis' },
    { file: 'human_penis_thick_huge.entity.json', expectedSubType: 'penis' },
    { file: 'human_penis_thick_large.entity.json', expectedSubType: 'penis' },
    { file: 'human_vagina.entity.json', expectedSubType: 'vagina' },
    { file: 'human_vagina_deep_ridged.entity.json', expectedSubType: 'vagina' },
    { file: 'human_vagina_large_soft.entity.json', expectedSubType: 'vagina' },
    { file: 'human_vagina_petite_firm.entity.json', expectedSubType: 'vagina' },
    { file: 'human_vagina_silky_tight.entity.json', expectedSubType: 'vagina' },
    { file: 'human_vagina_soft_pliant.entity.json', expectedSubType: 'vagina' },
    {
      file: 'human_vagina_tight_smooth.entity.json',
      expectedSubType: 'vagina',
    },
    { file: 'human_testicle.entity.json', expectedSubType: 'testicle' },
    { file: 'human_testicle_thick.entity.json', expectedSubType: 'testicle' },
  ];

  describe('Hair entities (weight: 0.1)', () => {
    it.each(HAIR_ENTITIES)(
      'should have health_calculation_weight: 0.1 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(0.1);
      }
    );

    it('should have exactly 17 hair entities with correct weight', () => {
      expect(HAIR_ENTITIES.length).toBe(17);

      const entitiesWithWeight = HAIR_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === 0.1;
      });

      expect(entitiesWithWeight.length).toBe(17);
    });
  });

  describe('Pubic hair entity (weight: 0.1)', () => {
    it.each(PUBIC_HAIR_ENTITIES)(
      'should have health_calculation_weight: 0.1 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(0.1);
      }
    );
  });

  describe('Ass cheek entities (weight: 0.2)', () => {
    it.each(ASS_CHEEK_ENTITIES)(
      'should have health_calculation_weight: 0.2 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(0.2);
      }
    );

    it('should have exactly 10 ass cheek entities with correct weight', () => {
      expect(ASS_CHEEK_ENTITIES.length).toBe(10);

      const entitiesWithWeight = ASS_CHEEK_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === 0.2;
      });

      expect(entitiesWithWeight.length).toBe(10);
    });
  });

  describe('Breast entities (weight: 0.3)', () => {
    it.each(BREAST_ENTITIES)(
      'should have health_calculation_weight: 0.3 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(0.3);
      }
    );

    it('should have exactly 7 breast entities with correct weight', () => {
      expect(BREAST_ENTITIES.length).toBe(7);

      const entitiesWithWeight = BREAST_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === 0.3;
      });

      expect(entitiesWithWeight.length).toBe(7);
    });
  });

  describe('Genital entities (weight: 0.5)', () => {
    it.each(GENITAL_ENTITIES)(
      'should have health_calculation_weight: 0.5 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(0.5);
      }
    );

    it('should have exactly 13 genital entities with correct weight', () => {
      expect(GENITAL_ENTITIES.length).toBe(13);

      const entitiesWithWeight = GENITAL_ENTITIES.filter((e) => {
        const entity = loadEntityFile(e.file);
        return getHealthCalculationWeight(entity) === 0.5;
      });

      expect(entitiesWithWeight.length).toBe(13);
    });
  });

  describe('anatomy:part component structure', () => {
    const ALL_COSMETIC_ENTITIES = [
      ...HAIR_ENTITIES,
      ...PUBIC_HAIR_ENTITIES,
      ...ASS_CHEEK_ENTITIES,
      ...BREAST_ENTITIES,
      ...GENITAL_ENTITIES,
    ];

    it.each(ALL_COSMETIC_ENTITIES)(
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

  describe('Cosmetic entity total count verification', () => {
    it('should have exactly 48 cosmetic entities with health_calculation_weight', () => {
      const totalEntities =
        HAIR_ENTITIES.length +
        PUBIC_HAIR_ENTITIES.length +
        ASS_CHEEK_ENTITIES.length +
        BREAST_ENTITIES.length +
        GENITAL_ENTITIES.length;

      // 17 hair + 1 pubic hair + 10 ass cheek + 7 breast + 13 genital = 48
      expect(totalEntities).toBe(48);
    });
  });

  describe('Cosmetic tier weight rationale', () => {
    it('should have hair with lowest weight (purely cosmetic)', () => {
      const entity = loadEntityFile('human_hair.entity.json');
      expect(getHealthCalculationWeight(entity)).toBe(0.1);
    });

    it('should have ass cheeks with low weight (cosmetic/padding)', () => {
      const entity = loadEntityFile('human_ass_cheek.entity.json');
      expect(getHealthCalculationWeight(entity)).toBe(0.2);
    });

    it('should have breasts with moderate low weight (tissue mass)', () => {
      const entity = loadEntityFile('human_breast.entity.json');
      expect(getHealthCalculationWeight(entity)).toBe(0.3);
    });

    it('should have genitals with higher weight (important but not life-critical)', () => {
      const entity = loadEntityFile('human_penis.entity.json');
      expect(getHealthCalculationWeight(entity)).toBe(0.5);
    });

    it('should ensure cosmetic weights are all below 1.0', () => {
      const allEntities = [
        ...HAIR_ENTITIES,
        ...PUBIC_HAIR_ENTITIES,
        ...ASS_CHEEK_ENTITIES,
        ...BREAST_ENTITIES,
        ...GENITAL_ENTITIES,
      ];

      allEntities.forEach(({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        expect(weight).toBeLessThan(1.0);
      });
    });
  });
});
