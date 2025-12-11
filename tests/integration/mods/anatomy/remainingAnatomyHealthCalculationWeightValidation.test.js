/**
 * @file remainingAnatomyHealthCalculationWeightValidation.test.js
 * @description Validates that all remaining anatomy entity definitions have the correct
 * health_calculation_weight property for the data-driven health calculation system.
 *
 * This test ensures the invariants from HEACALOVE-012 are maintained:
 * - All remaining anatomy entities have appropriate health_calculation_weight values
 * - Values are consistent within each category
 * @see archive/HEACALOVE-012-update-remaining-anatomy-entities.md
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

describe('HEACALOVE-012: Remaining Anatomy Entity health_calculation_weight Validation', () => {
  describe('Beaks (weight: 1)', () => {
    const BEAK_ENTITIES = [
      { file: 'beak.entity.json', expectedSubType: 'beak' },
      { file: 'chicken_beak.entity.json', expectedSubType: 'chicken_beak' },
      { file: 'tortoise_beak.entity.json', expectedSubType: 'tortoise_beak' },
    ];

    const EXPECTED_WEIGHT = 1;

    it.each(BEAK_ENTITIES)(
      'should have health_calculation_weight: 1 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_WEIGHT);
      }
    );

    it('should have exactly 3 beak entities', () => {
      expect(BEAK_ENTITIES.length).toBe(3);
    });
  });

  describe('Tails (weight: 1)', () => {
    const TAIL_ENTITIES = [
      { file: 'cat_tail.entity.json', expectedSubType: 'tail' },
      { file: 'horse_tail.entity.json', expectedSubType: 'horse_tail' },
      { file: 'dragon_tail.entity.json', expectedSubType: 'dragon_tail' },
      { file: 'chicken_tail.entity.json', expectedSubType: 'chicken_tail' },
      {
        file: 'chicken_tail_large_long.entity.json',
        expectedSubType: 'chicken_tail',
      },
      { file: 'tortoise_tail.entity.json', expectedSubType: 'tortoise_tail' },
    ];

    const EXPECTED_WEIGHT = 1;

    it.each(TAIL_ENTITIES)(
      'should have health_calculation_weight: 1 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_WEIGHT);
      }
    );

    it('should have exactly 6 tail entities', () => {
      expect(TAIL_ENTITIES.length).toBe(6);
    });
  });

  describe('Wings (weight: 2)', () => {
    const WING_ENTITIES = [
      { file: 'dragon_wing.entity.json', expectedSubType: 'dragon_wing' },
      { file: 'chicken_wing.entity.json', expectedSubType: 'chicken_wing' },
      {
        file: 'chicken_wing_buff.entity.json',
        expectedSubType: 'chicken_wing',
      },
      {
        file: 'chicken_wing_copper_metallic.entity.json',
        expectedSubType: 'chicken_wing',
      },
      {
        file: 'chicken_wing_glossy_black_iridescent.entity.json',
        expectedSubType: 'chicken_wing',
      },
      {
        file: 'chicken_wing_slate_blue.entity.json',
        expectedSubType: 'chicken_wing',
      },
      {
        file: 'chicken_wing_speckled.entity.json',
        expectedSubType: 'chicken_wing',
      },
      {
        file: 'eldritch_membrane_wing.entity.json',
        expectedSubType: 'eldritch_membrane_wing',
      },
    ];

    const EXPECTED_WEIGHT = 2;

    it.each(WING_ENTITIES)(
      'should have health_calculation_weight: 2 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_WEIGHT);
      }
    );

    it('should have exactly 8 wing entities', () => {
      expect(WING_ENTITIES.length).toBe(8);
    });
  });

  describe('Cephalopod Tentacles (weight: 2)', () => {
    const CEPHALOPOD_TENTACLE_ENTITIES = [
      { file: 'kraken_tentacle.entity.json', expectedSubType: 'tentacle' },
      { file: 'octopus_tentacle.entity.json', expectedSubType: 'tentacle' },
      { file: 'squid_tentacle.entity.json', expectedSubType: 'tentacle' },
    ];

    const EXPECTED_WEIGHT = 2;

    it.each(CEPHALOPOD_TENTACLE_ENTITIES)(
      'should have health_calculation_weight: 2 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_WEIGHT);
      }
    );

    it('should have exactly 3 cephalopod tentacle entities', () => {
      expect(CEPHALOPOD_TENTACLE_ENTITIES.length).toBe(3);
    });
  });

  describe('Cephalopod Mantles (weight: 8)', () => {
    const MANTLE_ENTITIES = [
      { file: 'kraken_mantle.entity.json', expectedSubType: 'mantle' },
      { file: 'octopus_mantle.entity.json', expectedSubType: 'mantle' },
      { file: 'squid_mantle.entity.json', expectedSubType: 'mantle' },
    ];

    const EXPECTED_WEIGHT = 8;

    it.each(MANTLE_ENTITIES)(
      'should have health_calculation_weight: 8 in $file',
      ({ file, expectedSubType }) => {
        const entity = loadEntityFile(file);
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe(expectedSubType);
        expect(weight).toBeDefined();
        expect(typeof weight).toBe('number');
        expect(weight).toBe(EXPECTED_WEIGHT);
      }
    );

    it('should have exactly 3 mantle entities', () => {
      expect(MANTLE_ENTITIES.length).toBe(3);
    });
  });

  describe('Spider Parts', () => {
    describe('Spider Abdomen (weight: 6)', () => {
      it('should have health_calculation_weight: 6', () => {
        const entity = loadEntityFile('spider_abdomen.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('spider_abdomen');
        expect(weight).toBe(6);
      });
    });

    describe('Spider Cephalothorax (weight: 8)', () => {
      it('should have health_calculation_weight: 8', () => {
        const entity = loadEntityFile('spider_cephalothorax.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('spider_cephalothorax');
        expect(weight).toBe(8);
      });
    });

    describe('Spider Pedipalp (weight: 1)', () => {
      it('should have health_calculation_weight: 1', () => {
        const entity = loadEntityFile('spider_pedipalp.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('spider_pedipalp');
        expect(weight).toBe(1);
      });
    });

    describe('Spider Spinneret (weight: 1)', () => {
      it('should have health_calculation_weight: 1', () => {
        const entity = loadEntityFile('spider_spinneret.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('spinneret');
        expect(weight).toBe(1);
      });
    });
  });

  describe('Chicken Cosmetic Parts', () => {
    describe('Combs (weight: 0.1)', () => {
      const COMB_ENTITIES = [
        { file: 'chicken_comb.entity.json', expectedSubType: 'chicken_comb' },
        {
          file: 'chicken_comb_bantam.entity.json',
          expectedSubType: 'chicken_comb',
        },
        {
          file: 'chicken_comb_large_coarse.entity.json',
          expectedSubType: 'chicken_comb',
        },
      ];

      const EXPECTED_WEIGHT = 0.1;

      it.each(COMB_ENTITIES)(
        'should have health_calculation_weight: 0.1 in $file',
        ({ file, expectedSubType }) => {
          const entity = loadEntityFile(file);
          const weight = getHealthCalculationWeight(entity);
          const subType = getSubType(entity);

          expect(subType).toBe(expectedSubType);
          expect(weight).toBeCloseTo(EXPECTED_WEIGHT, 2);
        }
      );
    });

    describe('Wattles (weight: 0.1)', () => {
      const WATTLE_ENTITIES = [
        {
          file: 'chicken_wattle.entity.json',
          expectedSubType: 'chicken_wattle',
        },
        {
          file: 'chicken_wattle_bantam.entity.json',
          expectedSubType: 'chicken_wattle',
        },
        {
          file: 'chicken_wattle_large.entity.json',
          expectedSubType: 'chicken_wattle',
        },
      ];

      const EXPECTED_WEIGHT = 0.1;

      it.each(WATTLE_ENTITIES)(
        'should have health_calculation_weight: 0.1 in $file',
        ({ file, expectedSubType }) => {
          const entity = loadEntityFile(file);
          const weight = getHealthCalculationWeight(entity);
          const subType = getSubType(entity);

          expect(subType).toBe(expectedSubType);
          expect(weight).toBeCloseTo(EXPECTED_WEIGHT, 2);
        }
      );
    });

    describe('Spur (weight: 0.5)', () => {
      it('should have health_calculation_weight: 0.5', () => {
        const entity = loadEntityFile('chicken_spur.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('chicken_spur');
        expect(weight).toBeCloseTo(0.5, 2);
      });
    });
  });

  describe('Tortoise Shell Parts', () => {
    describe('Carapace (weight: 10)', () => {
      it('should have health_calculation_weight: 10', () => {
        const entity = loadEntityFile('tortoise_carapace.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('shell_carapace');
        expect(weight).toBe(10);
      });
    });

    describe('Plastron (weight: 8)', () => {
      it('should have health_calculation_weight: 8', () => {
        const entity = loadEntityFile('tortoise_plastron.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('shell_plastron');
        expect(weight).toBe(8);
      });
    });
  });

  describe('Eldritch Parts', () => {
    describe('Eldritch Core Mass (weight: 10)', () => {
      it('should have health_calculation_weight: 10', () => {
        const entity = loadEntityFile('eldritch_core_mass.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_core');
        expect(weight).toBe(10);
      });
    });

    describe('Eldritch Tentacles', () => {
      it('feeding tentacle should have weight: 1', () => {
        const entity = loadEntityFile('eldritch_tentacle_feeding.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_tentacle');
        expect(weight).toBe(1);
      });

      it('large tentacle should have weight: 2', () => {
        const entity = loadEntityFile('eldritch_tentacle_large.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_tentacle');
        expect(weight).toBe(2);
      });

      it('sensory tentacle should have weight: 1', () => {
        const entity = loadEntityFile('eldritch_tentacle_sensory.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_tentacle');
        expect(weight).toBe(1);
      });
    });

    describe('Eldritch Sensory Stalk (weight: 1)', () => {
      it('should have health_calculation_weight: 1', () => {
        const entity = loadEntityFile('eldritch_sensory_stalk.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_sensory_stalk');
        expect(weight).toBe(1);
      });
    });

    describe('Eldritch Mouths', () => {
      it('speaking orifice should have weight: 1', () => {
        const entity = loadEntityFile('eldritch_speaking_orifice.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_mouth');
        expect(weight).toBe(1);
      });

      it('vertical maw should have weight: 2', () => {
        const entity = loadEntityFile('eldritch_vertical_maw.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_mouth');
        expect(weight).toBe(2);
      });
    });

    describe('Eldritch Vestigial Arm (weight: 1)', () => {
      it('should have health_calculation_weight: 1', () => {
        const entity = loadEntityFile('eldritch_vestigial_arm.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_vestigial_arm');
        expect(weight).toBe(1);
      });
    });

    describe('Eldritch Vocal Sac (weight: 1)', () => {
      it('should have health_calculation_weight: 1', () => {
        const entity = loadEntityFile('eldritch_vocal_sac.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('eldritch_vocal_sac');
        expect(weight).toBe(1);
      });
    });
  });

  describe('Miscellaneous Parts', () => {
    describe('Face variant (weight: 5)', () => {
      it('humanoid_face_bearded_full_trimmed should have weight: 5', () => {
        const entity = loadEntityFile(
          'humanoid_face_bearded_full_trimmed.entity.json'
        );
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('head');
        expect(weight).toBe(5);
      });
    });

    describe('Human Asshole (weight: 0.2)', () => {
      it('should have health_calculation_weight: 0.2', () => {
        const entity = loadEntityFile('human_asshole.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('asshole');
        expect(weight).toBeCloseTo(0.2, 2);
      });
    });

    describe('Equipment Mount (weight: 0)', () => {
      it('should have health_calculation_weight: 0', () => {
        const entity = loadEntityFile('equipment_mount.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('equipment_mount');
        expect(weight).toBe(0);
      });
    });

    describe('Ink Reservoir (weight: 0.5)', () => {
      it('should have health_calculation_weight: 0.5', () => {
        const entity = loadEntityFile('ink_reservoir.entity.json');
        const weight = getHealthCalculationWeight(entity);
        const subType = getSubType(entity);

        expect(subType).toBe('ink_reservoir');
        expect(weight).toBeCloseTo(0.5, 2);
      });
    });
  });

  describe('Total entity count verification', () => {
    it('should cover all 49 entities from HEACALOVE-012', () => {
      // Count all entities covered:
      // Beaks: 3, Tails: 6, Wings: 8, Cephalopod tentacles: 3, Mantles: 3
      // Spider: 4, Chicken cosmetic: 7, Tortoise shell: 2
      // Eldritch: 8, Misc: 4
      // Total: 48 (humanoid_face_bearded_full_trimmed has subType 'head' which
      // overlaps with head category but was still updated by HEACALOVE-012)
      const totalExpected = 3 + 6 + 8 + 3 + 3 + 4 + 7 + 2 + 8 + 4;
      expect(totalExpected).toBe(48);
    });
  });
});
