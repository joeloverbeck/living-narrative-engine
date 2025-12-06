/**
 * @file humanIntimatePartWeightValidation.test.js
 * @description Validates that human intimate anatomy entity definitions have appropriate
 * core:weight components with biologically realistic values.
 *
 * This test ensures weight coverage for:
 * - Ass cheeks (11 variants)
 * - Asshole (1 file)
 * - Breasts (7 variants)
 * - Heart (1 vital organ)
 * - Penis (4 variants)
 * - Pubic hair (1 file)
 * - Spine (1 vital organ)
 * - Testicles (2 variants)
 * - Vaginas (7 variants)
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

describe('Human Intimate Part Weight Validation', () => {
  describe('Ass Cheeks (11 files)', () => {
    const ASS_CHEEK_PARTS = [
      {
        file: 'human_ass_cheek.entity.json',
        weight: 1.5,
        desc: 'Base ass cheek',
      },
      { file: 'human_ass_cheek_round.entity.json', weight: 1.6, desc: 'Round' },
      { file: 'human_ass_cheek_firm.entity.json', weight: 1.5, desc: 'Firm' },
      {
        file: 'human_ass_cheek_bubbly.entity.json',
        weight: 1.7,
        desc: 'Bubbly',
      },
      {
        file: 'human_ass_cheek_small_round.entity.json',
        weight: 1.2,
        desc: 'Small round',
      },
      {
        file: 'human_ass_cheek_round_soft.entity.json',
        weight: 1.6,
        desc: 'Round soft',
      },
      {
        file: 'human_ass_cheek_small_bubbly.entity.json',
        weight: 1.3,
        desc: 'Small bubbly',
      },
      {
        file: 'human_ass_cheek_firm_athletic_shelf.entity.json',
        weight: 1.6,
        desc: 'Athletic shelf',
      },
      {
        file: 'human_ass_cheek_firm_muscular_shelf.entity.json',
        weight: 1.8,
        desc: 'Muscular shelf',
      },
      {
        file: 'human_ass_cheek_firm_thick.entity.json',
        weight: 2.0,
        desc: 'Thick',
      },
    ];

    it.each(ASS_CHEEK_PARTS)(
      'should have valid weight (1-2.5 kg) for $file ($desc)',
      ({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThanOrEqual(1);
        expect(weight).toBeLessThanOrEqual(2.5);
      }
    );
  });

  describe('Asshole (1 file)', () => {
    it('should have valid weight for human_asshole.entity.json', () => {
      const entity = loadEntityFile('human_asshole.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(0.05);
    });
  });

  describe('Breasts (7 files)', () => {
    const BREAST_PARTS = [
      {
        file: 'human_breast.entity.json',
        minWeight: 0.4,
        maxWeight: 0.6,
        desc: 'Base breast',
      },
      {
        file: 'human_breast_a_cup.entity.json',
        minWeight: 0.2,
        maxWeight: 0.3,
        desc: 'A cup',
      },
      {
        file: 'human_breast_c_cup_firm.entity.json',
        minWeight: 0.4,
        maxWeight: 0.6,
        desc: 'C cup firm',
      },
      {
        file: 'human_breast_c_cup_soft.entity.json',
        minWeight: 0.4,
        maxWeight: 0.6,
        desc: 'C cup soft',
      },
      {
        file: 'human_breast_d_cup.entity.json',
        minWeight: 0.6,
        maxWeight: 0.9,
        desc: 'D cup',
      },
      {
        file: 'human_breast_g_cup.entity.json',
        minWeight: 1.2,
        maxWeight: 1.8,
        desc: 'G cup',
      },
      {
        file: 'human_breast_shelf.entity.json',
        minWeight: 0.5,
        maxWeight: 0.8,
        desc: 'Shelf',
      },
    ];

    it.each(BREAST_PARTS)(
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

  describe('Heart (1 file)', () => {
    it('should have valid weight for human_heart.entity.json (~300g)', () => {
      const entity = loadEntityFile('human_heart.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThanOrEqual(0.25);
      expect(weight).toBeLessThanOrEqual(0.4);
    });
  });

  describe('Penis (4 files)', () => {
    const PENIS_PARTS = [
      {
        file: 'human_penis.entity.json',
        minWeight: 0.08,
        maxWeight: 0.12,
        desc: 'Base penis',
      },
      {
        file: 'human_penis_small.entity.json',
        minWeight: 0.05,
        maxWeight: 0.1,
        desc: 'Small',
      },
      {
        file: 'human_penis_thick_large.entity.json',
        minWeight: 0.12,
        maxWeight: 0.18,
        desc: 'Large',
      },
      {
        file: 'human_penis_thick_huge.entity.json',
        minWeight: 0.15,
        maxWeight: 0.25,
        desc: 'Huge',
      },
    ];

    it.each(PENIS_PARTS)(
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

  describe('Pubic Hair (1 file)', () => {
    it('should have valid weight for human_pubic_hair.entity.json (negligible)', () => {
      const entity = loadEntityFile('human_pubic_hair.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(0.02);
    });
  });

  describe('Spine (1 file)', () => {
    it('should have valid weight for human_spine.entity.json (~1kg)', () => {
      const entity = loadEntityFile('human_spine.entity.json');
      const weight = getWeight(entity);

      expect(weight).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(weight).toBeGreaterThanOrEqual(0.8);
      expect(weight).toBeLessThanOrEqual(1.2);
    });
  });

  describe('Testicles (2 files)', () => {
    const TESTICLE_PARTS = [
      {
        file: 'human_testicle.entity.json',
        minWeight: 0.02,
        maxWeight: 0.03,
        desc: 'Base testicle',
      },
      {
        file: 'human_testicle_thick.entity.json',
        minWeight: 0.03,
        maxWeight: 0.05,
        desc: 'Thick',
      },
    ];

    it.each(TESTICLE_PARTS)(
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

  describe('Vaginas (7 files)', () => {
    const VAGINA_PARTS = [
      { file: 'human_vagina.entity.json', desc: 'Base vagina' },
      { file: 'human_vagina_petite_firm.entity.json', desc: 'Petite firm' },
      { file: 'human_vagina_tight_smooth.entity.json', desc: 'Tight smooth' },
      { file: 'human_vagina_silky_tight.entity.json', desc: 'Silky tight' },
      { file: 'human_vagina_soft_pliant.entity.json', desc: 'Soft pliant' },
      { file: 'human_vagina_large_soft.entity.json', desc: 'Large soft' },
      { file: 'human_vagina_deep_ridged.entity.json', desc: 'Deep ridged' },
    ];

    it.each(VAGINA_PARTS)(
      'should have valid weight (0.03-0.08 kg) for $file ($desc)',
      ({ file }) => {
        const entity = loadEntityFile(file);
        const weight = getWeight(entity);

        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBeGreaterThanOrEqual(0.03);
        expect(weight).toBeLessThanOrEqual(0.08);
      }
    );
  });

  describe('Coverage Completeness', () => {
    it('should have all 34 intimate body parts with weight', () => {
      const targetPrefixes = [
        'human_ass_cheek',
        'human_asshole',
        'human_breast',
        'human_heart',
        'human_penis',
        'human_pubic',
        'human_spine',
        'human_testicle',
        'human_vagina',
      ];

      const allFiles = fs
        .readdirSync(DEFINITIONS_PATH)
        .filter((f) => f.endsWith('.entity.json'));
      const targetFiles = allFiles.filter((f) =>
        targetPrefixes.some((prefix) => f.startsWith(prefix))
      );

      // All target files should have anatomy:part
      const bodyParts = targetFiles.filter((f) =>
        hasAnatomyPart(loadEntityFile(f))
      );

      // All body parts should have weight
      const bodyPartsWithWeight = bodyParts.filter(
        (f) => getWeight(loadEntityFile(f)) !== undefined
      );

      expect(bodyParts.length).toBe(34);
      expect(bodyPartsWithWeight.length).toBe(34);
    });

    it('should have all weights as positive numbers', () => {
      const targetPrefixes = [
        'human_ass_cheek',
        'human_asshole',
        'human_breast',
        'human_heart',
        'human_penis',
        'human_pubic',
        'human_spine',
        'human_testicle',
        'human_vagina',
      ];

      const allFiles = fs
        .readdirSync(DEFINITIONS_PATH)
        .filter((f) => f.endsWith('.entity.json'));
      const targetFiles = allFiles.filter((f) =>
        targetPrefixes.some((prefix) => f.startsWith(prefix))
      );

      const filesWithInvalidWeight = targetFiles.filter((f) => {
        const entity = loadEntityFile(f);
        if (!hasAnatomyPart(entity)) return false;
        const weight = getWeight(entity);
        return weight === undefined || weight <= 0;
      });

      expect(filesWithInvalidWeight).toEqual([]);
    });
  });
});
