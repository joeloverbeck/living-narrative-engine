import { describe, it, expect } from '@jest/globals';
import path from 'path';
import fs from 'fs';

const loadBlueprint = (fileName) => {
  const fullPath = path.resolve(
    process.cwd(),
    'data/mods/anatomy-creatures/blueprints',
    fileName
  );
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

describe('anatomy-creatures blueprints', () => {
  describe('ermine_folk_female blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('ermine_folk_female.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:ermine_folk_female');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('ermine_folk_female.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:ermine_folk_female_torso');
    });

    it('has compose part reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('ermine_folk_female.blueprint.json');
      expect(blueprint.compose[0].part).toBe('anatomy-creatures:mustelid_core');
    });

    it('has no remaining dredgers namespace references', () => {
      const blueprint = loadBlueprint('ermine_folk_female.blueprint.json');
      const jsonStr = JSON.stringify(blueprint);
      expect(jsonStr).not.toContain('dredgers:');
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('ermine_folk_female.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves slots structure', () => {
      const blueprint = loadBlueprint('ermine_folk_female.blueprint.json');
      expect(blueprint.slots).toHaveProperty('left_ear');
      expect(blueprint.slots).toHaveProperty('right_ear');
      expect(blueprint.slots).toHaveProperty('tail');
      expect(blueprint.slots).toHaveProperty('left_breast');
      expect(blueprint.slots).toHaveProperty('right_breast');
      expect(blueprint.slots).toHaveProperty('vagina');
    });

    it('preserves clothingSlotMappings structure', () => {
      const blueprint = loadBlueprint('ermine_folk_female.blueprint.json');
      expect(blueprint.clothingSlotMappings).toHaveProperty('back_accessory');
      expect(blueprint.clothingSlotMappings).toHaveProperty('tail_accessory');
      expect(blueprint.clothingSlotMappings).toHaveProperty('torso_lower');
      expect(blueprint.clothingSlotMappings).toHaveProperty('full_body');
      expect(blueprint.clothingSlotMappings).toHaveProperty('torso_upper');
    });
  });

  describe('toad_folk_male blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('toad_folk_male.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:toad_folk_male');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('toad_folk_male.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:toad_folk_male_torso');
    });

    it('has compose part reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('toad_folk_male.blueprint.json');
      expect(blueprint.compose[0].part).toBe('anatomy-creatures:amphibian_core');
    });

    it('has no remaining dredgers namespace references', () => {
      const blueprint = loadBlueprint('toad_folk_male.blueprint.json');
      const jsonStr = JSON.stringify(blueprint);
      expect(jsonStr).not.toContain('dredgers:');
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('toad_folk_male.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves slots structure', () => {
      const blueprint = loadBlueprint('toad_folk_male.blueprint.json');
      expect(blueprint.slots).toHaveProperty('penis');
      expect(blueprint.slots).toHaveProperty('left_testicle');
      expect(blueprint.slots).toHaveProperty('right_testicle');
    });

    it('preserves clothingSlotMappings structure', () => {
      const blueprint = loadBlueprint('toad_folk_male.blueprint.json');
      expect(blueprint.clothingSlotMappings).toHaveProperty('back_accessory');
      expect(blueprint.clothingSlotMappings).toHaveProperty('torso_lower');
      expect(blueprint.clothingSlotMappings).toHaveProperty('full_body');
      expect(blueprint.clothingSlotMappings).toHaveProperty('torso_upper');
      expect(blueprint.clothingSlotMappings).toHaveProperty('legs');
      expect(blueprint.clothingSlotMappings).toHaveProperty('feet');
    });
  });

  // ============================================================
  // Blueprints migrated from anatomy mod (ticket ANACREMODMIG-006h)
  // ============================================================

  describe('cat_girl blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('cat_girl.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:cat_girl');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('cat_girl.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:cat_girl_torso');
    });

    it('has compose part reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('cat_girl.blueprint.json');
      expect(blueprint.compose[0].part).toBe('anatomy-creatures:feline_core');
    });

    it('has no remaining anatomy: namespace references for creature entities', () => {
      const blueprint = loadBlueprint('cat_girl.blueprint.json');
      const jsonStr = JSON.stringify(blueprint);
      // Should not have anatomy namespace for root, compose, or entity refs
      // But may still have anatomy:part component refs which are correct
      expect(blueprint.root).not.toContain('anatomy:');
      expect(blueprint.compose[0].part).not.toContain('anatomy:');
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('cat_girl.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves slots structure', () => {
      const blueprint = loadBlueprint('cat_girl.blueprint.json');
      expect(blueprint.slots).toHaveProperty('left_ear');
      expect(blueprint.slots).toHaveProperty('right_ear');
      expect(blueprint.slots).toHaveProperty('tail');
      expect(blueprint.slots).toHaveProperty('vagina');
    });

    it('preserves clothingSlotMappings structure', () => {
      const blueprint = loadBlueprint('cat_girl.blueprint.json');
      expect(blueprint.clothingSlotMappings).toHaveProperty('back_accessory');
      expect(blueprint.clothingSlotMappings).toHaveProperty('tail_accessory');
      expect(blueprint.clothingSlotMappings).toHaveProperty('torso_lower');
      expect(blueprint.clothingSlotMappings).toHaveProperty('full_body');
      expect(blueprint.clothingSlotMappings).toHaveProperty('torso_upper');
    });
  });

  describe('centaur_warrior blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('centaur_warrior.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:centaur_warrior');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('centaur_warrior.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:centaur_torso');
    });

    it('has structureTemplate reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('centaur_warrior.blueprint.json');
      expect(blueprint.structureTemplate).toBe(
        'anatomy-creatures:structure_centauroid'
      );
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('centaur_warrior.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves additionalSlots structure', () => {
      const blueprint = loadBlueprint('centaur_warrior.blueprint.json');
      expect(blueprint.additionalSlots).toHaveProperty('quiver_mount');
      expect(blueprint.additionalSlots).toHaveProperty('arm_left');
      expect(blueprint.additionalSlots).toHaveProperty('arm_right');
      expect(blueprint.additionalSlots).toHaveProperty('head');
    });

    it('preserves clothingSlotMappings structure', () => {
      const blueprint = loadBlueprint('centaur_warrior.blueprint.json');
      expect(blueprint.clothingSlotMappings).toHaveProperty('torso_upper');
      expect(blueprint.clothingSlotMappings).toHaveProperty('legs_equine');
    });
  });

  describe('giant_spider blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('giant_spider.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:giant_spider');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('giant_spider.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:spider_cephalothorax');
    });

    it('has structureTemplate reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('giant_spider.blueprint.json');
      expect(blueprint.structureTemplate).toBe(
        'anatomy-creatures:structure_arachnid_8leg'
      );
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('giant_spider.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves additionalSlots structure', () => {
      const blueprint = loadBlueprint('giant_spider.blueprint.json');
      expect(blueprint.additionalSlots).toHaveProperty('venom_gland');
      expect(blueprint.additionalSlots).toHaveProperty('spinnerets');
    });
  });

  describe('hen blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('hen.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:hen');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('hen.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:chicken_torso');
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('hen.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves slots structure with chicken anatomy', () => {
      const blueprint = loadBlueprint('hen.blueprint.json');
      expect(blueprint.slots).toHaveProperty('head');
      expect(blueprint.slots).toHaveProperty('beak');
      expect(blueprint.slots).toHaveProperty('comb');
      expect(blueprint.slots).toHaveProperty('wattle');
      expect(blueprint.slots).toHaveProperty('tail');
      expect(blueprint.slots).toHaveProperty('heart');
      expect(blueprint.slots).toHaveProperty('spine');
      expect(blueprint.slots).toHaveProperty('brain');
    });
  });

  describe('kraken blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('kraken.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:kraken');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('kraken.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:kraken_mantle');
    });

    it('has structureTemplate reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('kraken.blueprint.json');
      expect(blueprint.structureTemplate).toBe(
        'anatomy-creatures:structure_octopoid'
      );
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('kraken.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves additionalSlots structure', () => {
      const blueprint = loadBlueprint('kraken.blueprint.json');
      expect(blueprint.additionalSlots).toHaveProperty('ink_sac');
    });
  });

  describe('red_dragon blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('red_dragon.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:red_dragon');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('red_dragon.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:dragon_torso');
    });

    it('has structureTemplate reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('red_dragon.blueprint.json');
      expect(blueprint.structureTemplate).toBe(
        'anatomy-creatures:structure_winged_quadruped'
      );
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('red_dragon.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });
  });

  describe('rooster blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('rooster.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:rooster');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('rooster.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:chicken_torso');
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('rooster.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves slots structure with chicken anatomy including spurs', () => {
      const blueprint = loadBlueprint('rooster.blueprint.json');
      expect(blueprint.slots).toHaveProperty('head');
      expect(blueprint.slots).toHaveProperty('beak');
      expect(blueprint.slots).toHaveProperty('comb');
      expect(blueprint.slots).toHaveProperty('wattle');
      expect(blueprint.slots).toHaveProperty('tail');
      expect(blueprint.slots).toHaveProperty('left_spur');
      expect(blueprint.slots).toHaveProperty('right_spur');
    });
  });

  describe('tortoise_person blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('tortoise_person.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:tortoise_person');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('tortoise_person.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:tortoise_torso_with_shell');
    });

    it('has structureTemplate reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('tortoise_person.blueprint.json');
      expect(blueprint.structureTemplate).toBe(
        'anatomy-creatures:structure_tortoise_biped'
      );
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('tortoise_person.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves additionalSlots structure', () => {
      const blueprint = loadBlueprint('tortoise_person.blueprint.json');
      expect(blueprint.additionalSlots).toHaveProperty('shell_upper');
      expect(blueprint.additionalSlots).toHaveProperty('shell_lower');
    });
  });

  describe('writhing_observer blueprint', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('writhing_observer.blueprint.json');
      expect(blueprint.id).toBe('anatomy-creatures:writhing_observer');
    });

    it('has root entity reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('writhing_observer.blueprint.json');
      expect(blueprint.root).toBe('anatomy-creatures:eldritch_core_mass');
    });

    it('has structureTemplate reference updated to anatomy-creatures namespace', () => {
      const blueprint = loadBlueprint('writhing_observer.blueprint.json');
      expect(blueprint.structureTemplate).toBe(
        'anatomy-creatures:structure_eldritch_abomination'
      );
    });

    it('has valid blueprint schema reference', () => {
      const blueprint = loadBlueprint('writhing_observer.blueprint.json');
      expect(blueprint.$schema).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });

    it('preserves additionalSlots structure with eldritch anatomy', () => {
      const blueprint = loadBlueprint('writhing_observer.blueprint.json');
      expect(blueprint.additionalSlots).toHaveProperty('central_baleful_eye');
      expect(blueprint.additionalSlots).toHaveProperty('vocal_sac_1');
      expect(blueprint.additionalSlots).toHaveProperty('vocal_sac_2');
      expect(blueprint.additionalSlots).toHaveProperty('vocal_sac_3');
      // Surface eyes
      expect(blueprint.additionalSlots).toHaveProperty('surface_eye_1');
      expect(blueprint.additionalSlots).toHaveProperty('surface_eye_12');
    });
  });
});
