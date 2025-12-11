/**
 * @file creatureEntityWeightValidation.test.js
 * @description Validates that creature entity definitions (cephalopods, spiders, tortoises)
 * have appropriate core:weight components for the dismemberment spawning feature.
 *
 * This test ensures the invariants from DISBODPARSPA-015 are maintained:
 * - All creature entities with anatomy:part have core:weight
 * - Weights are positive numbers within realistic ranges for each part type
 *
 * Note: Humanoid utility entity tests are in:
 * tests/integration/mods/anatomy/utilityEntityWeightValidation.test.js
 *
 * @see tickets/DISBODPARSPA-015-weight-utility.md
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const DEFINITIONS_PATH = path.resolve(
  process.cwd(),
  'data/mods/anatomy-creatures/entities/definitions'
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

describe('DISBODPARSPA-015: Creature Entity Weight Validation', () => {
  describe('Cephalopod Parts (9 files)', () => {
    const CEPHALOPOD_PARTS = [
      {
        file: 'beak.entity.json',
        minWeight: 3,
        maxWeight: 7,
        desc: 'Kraken beak',
      },
      {
        file: 'ink_reservoir.entity.json',
        minWeight: 1,
        maxWeight: 3,
        desc: 'Ink reservoir',
      },
      {
        file: 'kraken_head.entity.json',
        minWeight: 40,
        maxWeight: 60,
        desc: 'Kraken head',
      },
      {
        file: 'kraken_mantle.entity.json',
        minWeight: 150,
        maxWeight: 250,
        desc: 'Kraken mantle',
      },
      {
        file: 'kraken_tentacle.entity.json',
        minWeight: 80,
        maxWeight: 120,
        desc: 'Kraken tentacle',
      },
      {
        file: 'octopus_mantle.entity.json',
        minWeight: 10,
        maxWeight: 20,
        desc: 'Octopus mantle',
      },
      {
        file: 'octopus_tentacle.entity.json',
        minWeight: 2,
        maxWeight: 5,
        desc: 'Octopus tentacle',
      },
      {
        file: 'squid_mantle.entity.json',
        minWeight: 8,
        maxWeight: 15,
        desc: 'Squid mantle',
      },
      {
        file: 'squid_tentacle.entity.json',
        minWeight: 1,
        maxWeight: 4,
        desc: 'Squid tentacle',
      },
    ];

    it.each(CEPHALOPOD_PARTS)(
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

  describe('Spider Parts (5 files)', () => {
    const SPIDER_PARTS = [
      {
        file: 'spider_abdomen.entity.json',
        minWeight: 0.01,
        maxWeight: 0.05,
        desc: 'Spider abdomen',
      },
      {
        file: 'spider_cephalothorax.entity.json',
        minWeight: 0.008,
        maxWeight: 0.03,
        desc: 'Spider cephalothorax',
      },
      {
        file: 'spider_leg.entity.json',
        minWeight: 0.001,
        maxWeight: 0.005,
        desc: 'Spider leg',
      },
      {
        file: 'spider_pedipalp.entity.json',
        minWeight: 0.0005,
        maxWeight: 0.003,
        desc: 'Spider pedipalp',
      },
      {
        file: 'spider_spinneret.entity.json',
        minWeight: 0.002,
        maxWeight: 0.01,
        desc: 'Spider spinneret',
      },
    ];

    it.each(SPIDER_PARTS)(
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

  describe('Tortoise Parts (11 files)', () => {
    const TORTOISE_PARTS = [
      {
        file: 'tortoise_arm.entity.json',
        minWeight: 1,
        maxWeight: 2,
        desc: 'Tortoise arm',
      },
      {
        file: 'tortoise_hand.entity.json',
        minWeight: 0.2,
        maxWeight: 0.5,
        desc: 'Tortoise hand',
      },
      {
        file: 'tortoise_leg.entity.json',
        minWeight: 1.5,
        maxWeight: 3,
        desc: 'Tortoise leg',
      },
      {
        file: 'tortoise_foot.entity.json',
        minWeight: 0.3,
        maxWeight: 0.6,
        desc: 'Tortoise foot',
      },
      {
        file: 'tortoise_head.entity.json',
        minWeight: 0.5,
        maxWeight: 1.2,
        desc: 'Tortoise head',
      },
      {
        file: 'tortoise_beak.entity.json',
        minWeight: 0.03,
        maxWeight: 0.1,
        desc: 'Tortoise beak',
      },
      {
        file: 'tortoise_eye.entity.json',
        minWeight: 0.01,
        maxWeight: 0.05,
        desc: 'Tortoise eye',
      },
      {
        file: 'tortoise_torso_with_shell.entity.json',
        minWeight: 12,
        maxWeight: 20,
        desc: 'Tortoise body with shell',
      },
      {
        file: 'tortoise_carapace.entity.json',
        minWeight: 4,
        maxWeight: 7,
        desc: 'Tortoise carapace',
      },
      {
        file: 'tortoise_plastron.entity.json',
        minWeight: 2,
        maxWeight: 4,
        desc: 'Tortoise plastron',
      },
      {
        file: 'tortoise_tail.entity.json',
        minWeight: 0.1,
        maxWeight: 0.4,
        desc: 'Tortoise tail',
      },
    ];

    it.each(TORTOISE_PARTS)(
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

  describe('Coverage Completeness', () => {
    it('should have all creature body parts with weight (25 files total)', () => {
      // Only check creature files being tested: cephalopods, spiders, tortoises
      const creaturePattern =
        /^(beak|ink_reservoir|kraken_|octopus_|squid_|spider_|tortoise_)/;

      const allFiles = fs
        .readdirSync(DEFINITIONS_PATH)
        .filter((f) => f.endsWith('.entity.json'));

      const creatureFiles = allFiles.filter((f) => creaturePattern.test(f));

      // Count body parts (files with anatomy:part)
      const bodyParts = creatureFiles.filter((f) => {
        const entity = loadEntityFile(f);
        return hasAnatomyPart(entity);
      });

      // All body parts should have weight
      const bodyPartsWithWeight = bodyParts.filter((f) => {
        const entity = loadEntityFile(f);
        return getWeight(entity) !== undefined;
      });

      expect(bodyParts.length).toBe(25);
      expect(bodyPartsWithWeight.length).toBe(25);
    });

    it('should have all weights as positive numbers', () => {
      const creaturePattern =
        /^(beak|ink_reservoir|kraken_|octopus_|squid_|spider_|tortoise_)/;

      const allFiles = fs
        .readdirSync(DEFINITIONS_PATH)
        .filter((f) => f.endsWith('.entity.json'));

      const creatureFiles = allFiles.filter((f) => creaturePattern.test(f));

      const bodyPartsWithInvalidWeight = creatureFiles.filter((f) => {
        const entity = loadEntityFile(f);
        if (!hasAnatomyPart(entity)) return false;
        const weight = getWeight(entity);
        return weight === undefined || weight <= 0;
      });

      expect(bodyPartsWithInvalidWeight).toEqual([]);
    });
  });
});
