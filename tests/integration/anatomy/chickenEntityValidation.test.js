import { describe, it, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENTITY_PATH = 'data/mods/anatomy/entities/definitions';

/**
 * Helper to load an entity JSON file
 *
 * @param {string} filename - Entity filename without path
 * @returns {object} Parsed entity object
 */
function loadEntity(filename) {
  const path = join(process.cwd(), ENTITY_PATH, filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Chicken Entity Validation', () => {
  // List of all chicken entity files to validate
  const CHICKEN_ENTITIES = [
    'chicken_torso.entity.json',
    'chicken_head.entity.json',
    'chicken_beak.entity.json',
    'chicken_comb.entity.json',
    'chicken_wattle.entity.json',
    'chicken_wing.entity.json',
    'chicken_leg.entity.json',
    'chicken_foot.entity.json',
    'chicken_tail.entity.json',
    'chicken_spur.entity.json',
  ];

  describe('All chicken entities exist', () => {
    it.each(CHICKEN_ENTITIES)('entity file %s should exist', (filename) => {
      const path = join(process.cwd(), ENTITY_PATH, filename);
      expect(existsSync(path)).toBe(true);
    });
  });

  describe('chicken_torso entity', () => {
    const entity = loadEntity('chicken_torso.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_torso');
    });

    it('should have anatomy:part component with chicken_torso subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_torso');
    });

    it('should have "small" size category', () => {
      expect(entity.components['descriptors:size_category']).toBeDefined();
      expect(entity.components['descriptors:size_category'].size).toBe('small');
    });

    it('should have "feathered" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('feathered');
    });
  });

  describe('chicken_head entity', () => {
    const entity = loadEntity('chicken_head.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_head');
    });

    it('should have anatomy:part component with chicken_head subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_head');
    });

    it('should have "small" size category', () => {
      expect(entity.components['descriptors:size_category']).toBeDefined();
      expect(entity.components['descriptors:size_category'].size).toBe('small');
    });

    it('should have "feathered" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('feathered');
    });
  });

  describe('chicken_beak entity', () => {
    const entity = loadEntity('chicken_beak.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_beak');
    });

    it('should have anatomy:part component with chicken_beak subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_beak');
    });

    it('should have "small" size category', () => {
      expect(entity.components['descriptors:size_category']).toBeDefined();
      expect(entity.components['descriptors:size_category'].size).toBe('small');
    });

    it('should have "conical" shape', () => {
      expect(entity.components['descriptors:shape_general']).toBeDefined();
      expect(entity.components['descriptors:shape_general'].shape).toBe('conical');
    });

    it('should have "yellow" color', () => {
      expect(entity.components['descriptors:color_basic']).toBeDefined();
      expect(entity.components['descriptors:color_basic'].color).toBe('yellow');
    });

    it('should be distinct from anatomy:beak (Kraken beak)', () => {
      expect(entity.id).not.toBe('anatomy:beak');
      expect(entity.components['anatomy:part'].subType).toBe('chicken_beak');
    });
  });

  describe('chicken_comb entity', () => {
    const entity = loadEntity('chicken_comb.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_comb');
    });

    it('should have anatomy:part component with chicken_comb subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_comb');
    });

    it('should have "fleshy" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('fleshy');
    });

    it('should have "red" color', () => {
      expect(entity.components['descriptors:color_basic']).toBeDefined();
      expect(entity.components['descriptors:color_basic'].color).toBe('red');
    });
  });

  describe('chicken_wattle entity', () => {
    const entity = loadEntity('chicken_wattle.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_wattle');
    });

    it('should have anatomy:part component with chicken_wattle subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_wattle');
    });

    it('should have "fleshy" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('fleshy');
    });

    it('should have "red" color', () => {
      expect(entity.components['descriptors:color_basic']).toBeDefined();
      expect(entity.components['descriptors:color_basic'].color).toBe('red');
    });
  });

  describe('chicken_wing entity', () => {
    const entity = loadEntity('chicken_wing.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_wing');
    });

    it('should have anatomy:part component with chicken_wing subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_wing');
    });

    it('should have "feathered" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('feathered');
    });
  });

  describe('chicken_leg entity', () => {
    const entity = loadEntity('chicken_leg.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_leg');
    });

    it('should have anatomy:part component with chicken_leg subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_leg');
    });

    it('should have "scaled" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('scaled');
    });

    it('should have "yellow" color', () => {
      expect(entity.components['descriptors:color_basic']).toBeDefined();
      expect(entity.components['descriptors:color_basic'].color).toBe('yellow');
    });
  });

  describe('chicken_foot entity', () => {
    const entity = loadEntity('chicken_foot.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_foot');
    });

    it('should have anatomy:part component with chicken_foot subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_foot');
    });

    it('should have "scaled" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('scaled');
    });

    it('should have "yellow" color', () => {
      expect(entity.components['descriptors:color_basic']).toBeDefined();
      expect(entity.components['descriptors:color_basic'].color).toBe('yellow');
    });
  });

  describe('chicken_tail entity', () => {
    const entity = loadEntity('chicken_tail.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_tail');
    });

    it('should have anatomy:part component with chicken_tail subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_tail');
    });

    it('should have "feathered" texture', () => {
      expect(entity.components['descriptors:texture']).toBeDefined();
      expect(entity.components['descriptors:texture'].texture).toBe('feathered');
    });
  });

  describe('chicken_spur entity', () => {
    const entity = loadEntity('chicken_spur.entity.json');

    it('should have correct entity ID', () => {
      expect(entity.id).toBe('anatomy:chicken_spur');
    });

    it('should have anatomy:part component with chicken_spur subType', () => {
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('chicken_spur');
    });

    it('should have "small" size category', () => {
      expect(entity.components['descriptors:size_category']).toBeDefined();
      expect(entity.components['descriptors:size_category'].size).toBe('small');
    });

    it('should have "conical" shape', () => {
      expect(entity.components['descriptors:shape_general']).toBeDefined();
      expect(entity.components['descriptors:shape_general'].shape).toBe('conical');
    });

    it('should be a distinct part for roosters', () => {
      expect(entity.description).toContain('rooster');
    });
  });

  describe('Schema compliance for all chicken entities', () => {
    const entities = CHICKEN_ENTITIES.map((filename) => ({
      filename,
      entity: loadEntity(filename),
    }));

    it.each(entities)('$filename should reference correct schema', ({ entity }) => {
      expect(entity.$schema).toBe('schema://living-narrative-engine/entity-definition.schema.json');
    });

    it.each(entities)('$filename should have anatomy:part component', ({ entity }) => {
      expect(entity.components['anatomy:part']).toBeDefined();
    });

    it.each(entities)('$filename should have anatomy:part_health component', ({ entity }) => {
      expect(entity.components['anatomy:part_health']).toBeDefined();
      expect(entity.components['anatomy:part_health'].currentHealth).toBeGreaterThan(0);
      expect(entity.components['anatomy:part_health'].maxHealth).toBeGreaterThan(0);
      expect(entity.components['anatomy:part_health'].state).toBe('healthy');
    });

    it.each(entities)('$filename should have core:name component', ({ entity }) => {
      expect(entity.components['core:name']).toBeDefined();
      expect(entity.components['core:name'].text).toBeTruthy();
    });
  });

  describe('Texture enum extensions', () => {
    it('entities using "feathered" texture should be valid', () => {
      const torso = loadEntity('chicken_torso.entity.json');
      const head = loadEntity('chicken_head.entity.json');
      const wing = loadEntity('chicken_wing.entity.json');
      const tail = loadEntity('chicken_tail.entity.json');

      [torso, head, wing, tail].forEach((entity) => {
        expect(entity.components['descriptors:texture'].texture).toBe('feathered');
      });
    });

    it('entities using "fleshy" texture should be valid', () => {
      const comb = loadEntity('chicken_comb.entity.json');
      const wattle = loadEntity('chicken_wattle.entity.json');

      [comb, wattle].forEach((entity) => {
        expect(entity.components['descriptors:texture'].texture).toBe('fleshy');
      });
    });

    it('entities using "scaled" texture should be valid', () => {
      const leg = loadEntity('chicken_leg.entity.json');
      const foot = loadEntity('chicken_foot.entity.json');

      [leg, foot].forEach((entity) => {
        expect(entity.components['descriptors:texture'].texture).toBe('scaled');
      });
    });
  });

  describe('Weight component validation (DISBODPARSPA-013)', () => {
    // All 26 chicken entity files including variants
    const ALL_CHICKEN_ENTITIES = [
      'chicken_beak.entity.json',
      'chicken_brain.entity.json',
      'chicken_comb.entity.json',
      'chicken_comb_bantam.entity.json',
      'chicken_comb_large_coarse.entity.json',
      'chicken_foot.entity.json',
      'chicken_head.entity.json',
      'chicken_head_chalky_white.entity.json',
      'chicken_head_rust_red.entity.json',
      'chicken_head_twisted_joints.entity.json',
      'chicken_heart.entity.json',
      'chicken_leg.entity.json',
      'chicken_spine.entity.json',
      'chicken_spur.entity.json',
      'chicken_tail.entity.json',
      'chicken_tail_large_long.entity.json',
      'chicken_torso.entity.json',
      'chicken_wattle.entity.json',
      'chicken_wattle_bantam.entity.json',
      'chicken_wattle_large.entity.json',
      'chicken_wing.entity.json',
      'chicken_wing_buff.entity.json',
      'chicken_wing_copper_metallic.entity.json',
      'chicken_wing_glossy_black_iridescent.entity.json',
      'chicken_wing_slate_blue.entity.json',
      'chicken_wing_speckled.entity.json',
    ];

    it('should have exactly 26 chicken entity definitions', () => {
      expect(ALL_CHICKEN_ENTITIES.length).toBe(26);
    });

    it.each(ALL_CHICKEN_ENTITIES)('%s should have items:weight component', (filename) => {
      const entity = loadEntity(filename);
      expect(entity.components['items:weight']).toBeDefined();
      expect(entity.components['items:weight'].weight).toBeDefined();
    });

    it.each(ALL_CHICKEN_ENTITIES)('%s should have weight > 0', (filename) => {
      const entity = loadEntity(filename);
      expect(entity.components['items:weight'].weight).toBeGreaterThan(0);
    });

    describe('Weight realism checks', () => {
      it('chicken_torso should be the heaviest part (1-2 kg range)', () => {
        const torso = loadEntity('chicken_torso.entity.json');
        expect(torso.components['items:weight'].weight).toBeGreaterThanOrEqual(1.0);
        expect(torso.components['items:weight'].weight).toBeLessThanOrEqual(2.0);
      });

      it('chicken head variants should weigh approximately the same', () => {
        const heads = [
          'chicken_head.entity.json',
          'chicken_head_chalky_white.entity.json',
          'chicken_head_rust_red.entity.json',
          'chicken_head_twisted_joints.entity.json',
        ].map((f) => loadEntity(f).components['items:weight'].weight);

        // All head variants should have identical weights
        const uniqueWeights = [...new Set(heads)];
        expect(uniqueWeights.length).toBe(1);
      });

      it('chicken wing variants should weigh approximately the same', () => {
        const wings = [
          'chicken_wing.entity.json',
          'chicken_wing_buff.entity.json',
          'chicken_wing_copper_metallic.entity.json',
          'chicken_wing_glossy_black_iridescent.entity.json',
          'chicken_wing_slate_blue.entity.json',
          'chicken_wing_speckled.entity.json',
        ].map((f) => loadEntity(f).components['items:weight'].weight);

        // All wing variants should have identical weights
        const uniqueWeights = [...new Set(wings)];
        expect(uniqueWeights.length).toBe(1);
      });

      it('smaller parts should weigh less than larger parts', () => {
        const torso = loadEntity('chicken_torso.entity.json');
        const head = loadEntity('chicken_head.entity.json');
        const wing = loadEntity('chicken_wing.entity.json');
        const leg = loadEntity('chicken_leg.entity.json');
        const foot = loadEntity('chicken_foot.entity.json');
        const beak = loadEntity('chicken_beak.entity.json');
        const comb = loadEntity('chicken_comb.entity.json');
        const brain = loadEntity('chicken_brain.entity.json');

        // Torso heaviest
        expect(torso.components['items:weight'].weight).toBeGreaterThan(
          head.components['items:weight'].weight
        );
        expect(torso.components['items:weight'].weight).toBeGreaterThan(
          wing.components['items:weight'].weight
        );

        // Leg heavier than foot
        expect(leg.components['items:weight'].weight).toBeGreaterThan(
          foot.components['items:weight'].weight
        );

        // Head heavier than small facial features
        expect(head.components['items:weight'].weight).toBeGreaterThan(
          beak.components['items:weight'].weight
        );
        expect(head.components['items:weight'].weight).toBeGreaterThan(
          comb.components['items:weight'].weight
        );

        // Brain should be very light
        expect(brain.components['items:weight'].weight).toBeLessThan(0.01);
      });

      it('size variants should have appropriate weight differences', () => {
        const combBase = loadEntity('chicken_comb.entity.json');
        const combBantam = loadEntity('chicken_comb_bantam.entity.json');
        const combLarge = loadEntity('chicken_comb_large_coarse.entity.json');

        expect(combBantam.components['items:weight'].weight).toBeLessThan(
          combBase.components['items:weight'].weight
        );
        expect(combLarge.components['items:weight'].weight).toBeGreaterThan(
          combBase.components['items:weight'].weight
        );

        const wattleBase = loadEntity('chicken_wattle.entity.json');
        const wattleBantam = loadEntity('chicken_wattle_bantam.entity.json');
        const wattleLarge = loadEntity('chicken_wattle_large.entity.json');

        expect(wattleBantam.components['items:weight'].weight).toBeLessThan(
          wattleBase.components['items:weight'].weight
        );
        expect(wattleLarge.components['items:weight'].weight).toBeGreaterThan(
          wattleBase.components['items:weight'].weight
        );

        const tailBase = loadEntity('chicken_tail.entity.json');
        const tailLarge = loadEntity('chicken_tail_large_long.entity.json');

        expect(tailLarge.components['items:weight'].weight).toBeGreaterThan(
          tailBase.components['items:weight'].weight
        );
      });
    });
  });
});
