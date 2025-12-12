import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const readJson = (relativePath) =>
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
  );

const getSlotPreferId = (recipe, slotName) => {
  if (recipe.slots && recipe.slots[slotName]) {
    return recipe.slots[slotName].preferId;
  }
  if (recipe.patterns) {
    const pattern = recipe.patterns.find(
      (p) => p.matches && p.matches.includes(slotName)
    );
    if (pattern) {
      return pattern.preferId;
    }
  }
  return undefined;
};

describe('dredgers character recipes reference anatomy-creatures assets', () => {
  it('ermine_folk_female uses anatomy-creatures blueprint and parts', () => {
    const recipe = readJson('data/mods/dredgers/recipes/ermine_folk_female.recipe.json');

    expect(recipe.blueprintId).toBe('anatomy-creatures:ermine_folk_female');
    expect(getSlotPreferId(recipe, 'torso')).toBe(
      'anatomy-creatures:ermine_folk_female_torso'
    );
    expect(getSlotPreferId(recipe, 'left_ear')).toBe(
      'anatomy-creatures:ermine_ear'
    );
    expect(getSlotPreferId(recipe, 'right_ear')).toBe(
      'anatomy-creatures:ermine_ear'
    );
    expect(getSlotPreferId(recipe, 'tail')).toBe('anatomy-creatures:ermine_tail');
  });

  it('toad_folk_male uses anatomy-creatures blueprint and parts', () => {
    const recipe = readJson('data/mods/dredgers/recipes/toad_folk_male.recipe.json');

    expect(recipe.blueprintId).toBe('anatomy-creatures:toad_folk_male');
    expect(getSlotPreferId(recipe, 'torso')).toBe(
      'anatomy-creatures:toad_folk_male_torso'
    );
    expect(getSlotPreferId(recipe, 'left_eye')).toBe('anatomy-creatures:toad_eye');
    expect(getSlotPreferId(recipe, 'right_eye')).toBe('anatomy-creatures:toad_eye');
    expect(getSlotPreferId(recipe, 'left_ear')).toBe(
      'anatomy-creatures:toad_tympanum'
    );
    expect(getSlotPreferId(recipe, 'right_ear')).toBe(
      'anatomy-creatures:toad_tympanum'
    );
  });
});
