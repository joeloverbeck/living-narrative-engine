import { describe, it, expect } from '@jest/globals';
import path from 'path';
import fs from 'fs';

const loadRecipe = (fileName) => {
  const fullPath = path.resolve(
    process.cwd(),
    'data/mods/anatomy-creatures/recipes',
    fileName
  );
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

describe('anatomy-creatures recipes (migrated from anatomy mod - ANACREMODMIG-006h)', () => {
  describe('cat_girl recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('cat_girl.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:cat_girl_standard');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('cat_girl.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:cat_girl');
    });

    it('has preferId references updated to anatomy-creatures for creature entities', () => {
      const recipe = loadRecipe('cat_girl.recipe.json');
      // Cat-specific slots should reference anatomy-creatures
      expect(recipe.slots.left_ear.preferId).toBe('anatomy-creatures:cat_ear');
      expect(recipe.slots.tail.preferId).toBe('anatomy-creatures:cat_tail');
      expect(recipe.slots.torso.preferId).toBe(
        'anatomy-creatures:cat_girl_torso'
      );
    });

    it('preserves humanoid references in anatomy namespace', () => {
      const recipe = loadRecipe('cat_girl.recipe.json');
      // Humanoid parts stay in anatomy
      expect(recipe.slots.left_breast.preferId).toBe(
        'anatomy:human_breast_average'
      );
      expect(recipe.slots.vagina.preferId).toBe('anatomy:human_vagina');
      expect(recipe.slots.head.preferId).toBe('anatomy:humanoid_head');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('cat_girl.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('cat_girl.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('hairDensity');
      expect(recipe.bodyDescriptors).toHaveProperty('skinColor');
    });

    it('preserves patterns with humanoid preferId references', () => {
      const recipe = loadRecipe('cat_girl.recipe.json');
      const eyePattern = recipe.patterns.find((p) =>
        p.matches?.includes('left_eye')
      );
      expect(eyePattern.preferId).toBe('anatomy:humanoid_eye');
    });
  });

  describe('centaur_warrior recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('centaur_warrior.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:centaur_warrior');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('centaur_warrior.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:centaur_warrior');
    });

    it('has slot for equipment mount', () => {
      const recipe = loadRecipe('centaur_warrior.recipe.json');
      expect(recipe.slots.quiver_mount.partType).toBe('equipment_mount');
    });

    it('has pattern references for centaur limbs', () => {
      const recipe = loadRecipe('centaur_warrior.recipe.json');
      const frontLegPattern = recipe.patterns.find(
        (p) =>
          p.matchesAll?.slotType === 'leg' &&
          p.matchesAll?.orientation === '*_front'
      );
      expect(frontLegPattern.partType).toBe('centaur_leg_front');

      const headPattern = recipe.patterns.find(
        (p) => p.matchesGroup === 'appendage:head'
      );
      expect(headPattern.partType).toBe('centaur_head');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('centaur_warrior.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('centaur_warrior.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('height');
    });

    it('preserves constraints', () => {
      const recipe = loadRecipe('centaur_warrior.recipe.json');
      expect(recipe.constraints.requires[0].partTypes).toContain(
        'equipment_mount'
      );
      expect(recipe.constraints.requires[0].partTypes).toContain('horse_tail');
    });
  });

  describe('giant_forest_spider recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('giant_forest_spider.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:giant_forest_spider');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('giant_forest_spider.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:giant_spider');
    });

    it('has pattern partType references for spider limbs', () => {
      const recipe = loadRecipe('giant_forest_spider.recipe.json');
      const legPattern = recipe.patterns.find(
        (p) => p.matchesGroup === 'limbSet:leg'
      );
      expect(legPattern.partType).toBe('spider_leg');
    });

    it('has slot references for spider parts', () => {
      const recipe = loadRecipe('giant_forest_spider.recipe.json');
      expect(recipe.slots.spinnerets.partType).toBe('spinneret');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('giant_forest_spider.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('giant_forest_spider.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('hairDensity');
    });

    it('preserves constraints', () => {
      const recipe = loadRecipe('giant_forest_spider.recipe.json');
      expect(recipe.constraints.requires[0].partTypes).toContain(
        'spider_abdomen'
      );
      expect(recipe.constraints.requires[0].partTypes).toContain('spinneret');
    });
  });

  describe('hen recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('hen.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:hen');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('hen.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:hen');
    });

    it('has slot preferId references updated to anatomy-creatures', () => {
      const recipe = loadRecipe('hen.recipe.json');
      expect(recipe.slots.head.preferId).toBe('anatomy-creatures:chicken_head');
      expect(recipe.slots.beak.preferId).toBe('anatomy-creatures:chicken_beak');
    });

    it('has pattern preferId references updated to anatomy-creatures', () => {
      const recipe = loadRecipe('hen.recipe.json');
      const wingPattern = recipe.patterns.find((p) =>
        p.matches?.includes('left_wing')
      );
      expect(wingPattern.preferId).toBe('anatomy-creatures:chicken_wing');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('hen.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('hen.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('hairDensity');
    });
  });

  describe('kraken recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('kraken.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:kraken_elder');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('kraken.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:kraken');
    });

    it('has slot partType references for kraken parts', () => {
      const recipe = loadRecipe('kraken.recipe.json');
      expect(recipe.slots.ink_sac.partType).toBe('ink_reservoir');
      expect(recipe.slots.beak.partType).toBe('beak');
    });

    it('has pattern partType references for tentacles', () => {
      const recipe = loadRecipe('kraken.recipe.json');
      const tentaclePattern = recipe.patterns.find(
        (p) => p.matchesGroup === 'limbSet:tentacle'
      );
      expect(tentaclePattern.partType).toBe('tentacle');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('kraken.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('kraken.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('hairDensity');
    });

    it('preserves constraints', () => {
      const recipe = loadRecipe('kraken.recipe.json');
      expect(recipe.constraints.requires[0].partTypes).toContain('tentacle');
      expect(recipe.constraints.requires[0].partTypes).toContain(
        'ink_reservoir'
      );
    });
  });

  describe('red_dragon recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('red_dragon.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:red_dragon');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('red_dragon.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:red_dragon');
    });

    it('has slot partType for dragon head', () => {
      const recipe = loadRecipe('red_dragon.recipe.json');
      expect(recipe.slots.head.partType).toBe('dragon_head');
    });

    it('has pattern references for dragon limbs', () => {
      const recipe = loadRecipe('red_dragon.recipe.json');
      const legPattern = recipe.patterns.find(
        (p) => p.matchesGroup === 'limbSet:leg'
      );
      expect(legPattern.partType).toBe('dragon_leg');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('red_dragon.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('red_dragon.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('skinColor');
    });

    it('preserves constraints', () => {
      const recipe = loadRecipe('red_dragon.recipe.json');
      expect(recipe.constraints.requires[0].partTypes).toContain('dragon_wing');
    });
  });

  describe('rooster recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('rooster.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:rooster');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('rooster.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:rooster');
    });

    it('has slot preferId references updated to anatomy-creatures', () => {
      const recipe = loadRecipe('rooster.recipe.json');
      expect(recipe.slots.head.preferId).toBe('anatomy-creatures:chicken_head');
      expect(recipe.slots.left_spur.preferId).toBe(
        'anatomy-creatures:chicken_spur'
      );
    });

    it('has pattern preferId references updated to anatomy-creatures', () => {
      const recipe = loadRecipe('rooster.recipe.json');
      const wingPattern = recipe.patterns.find((p) =>
        p.matches?.includes('left_wing')
      );
      expect(wingPattern.preferId).toBe('anatomy-creatures:chicken_wing');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('rooster.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('rooster.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('hairDensity');
    });
  });

  describe('tortoise_person recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('tortoise_person.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:tortoise_person');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('tortoise_person.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:tortoise_person');
    });

    it('has slot preferId references updated to anatomy-creatures', () => {
      const recipe = loadRecipe('tortoise_person.recipe.json');
      expect(recipe.slots.shell_upper.preferId).toBe(
        'anatomy-creatures:tortoise_carapace'
      );
      expect(recipe.slots.shell_lower.preferId).toBe(
        'anatomy-creatures:tortoise_plastron'
      );
      expect(recipe.slots.head.preferId).toBe('anatomy-creatures:tortoise_head');
    });

    it('has pattern preferId references updated to anatomy-creatures', () => {
      const recipe = loadRecipe('tortoise_person.recipe.json');
      const armPattern = recipe.patterns.find(
        (p) => p.matchesGroup === 'limbSet:arm'
      );
      expect(armPattern.preferId).toBe('anatomy-creatures:tortoise_arm');
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('tortoise_person.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('tortoise_person.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('height');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('skinColor');
    });

    it('preserves constraints', () => {
      const recipe = loadRecipe('tortoise_person.recipe.json');
      expect(recipe.constraints.requires[0].partTypes).toContain(
        'shell_carapace'
      );
    });
  });

  describe('writhing_observer recipe', () => {
    it('loads with correct anatomy-creatures namespace', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      expect(recipe.recipeId).toBe('anatomy-creatures:writhing_observer');
    });

    it('has blueprintId reference updated to anatomy-creatures namespace', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      expect(recipe.blueprintId).toBe('anatomy-creatures:writhing_observer');
    });

    it('has slot partType references for eldritch entities', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      expect(recipe.slots.central_baleful_eye.partType).toBe(
        'eldritch_baleful_eye'
      );
      expect(recipe.slots.vocal_sac_1.partType).toBe('eldritch_vocal_sac');
    });

    it('has pattern preferId references updated to anatomy-creatures', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      const tentaclePattern = recipe.patterns.find(
        (p) => p.matchesGroup === 'limbSet:tentacle'
      );
      expect(tentaclePattern.preferId).toBe(
        'anatomy-creatures:eldritch_tentacle_large'
      );
    });

    it('has valid recipe schema reference', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('preserves bodyDescriptors', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      expect(recipe.bodyDescriptors).toHaveProperty('build');
      expect(recipe.bodyDescriptors).toHaveProperty('height');
      expect(recipe.bodyDescriptors).toHaveProperty('skinColor');
      expect(recipe.bodyDescriptors).toHaveProperty('smell');
    });

    it('preserves constraints', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      expect(recipe.constraints.requires[0].partTypes).toContain(
        'eldritch_tentacle'
      );
    });

    it('has multiple surface eyes defined', () => {
      const recipe = loadRecipe('writhing_observer.recipe.json');
      expect(recipe.slots).toHaveProperty('surface_eye_1');
      expect(recipe.slots).toHaveProperty('surface_eye_12');
    });
  });
});
