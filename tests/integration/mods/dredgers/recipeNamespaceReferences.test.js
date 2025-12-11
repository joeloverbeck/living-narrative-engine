import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const readJson = (relativePath) =>
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
  );

describe('dredgers character recipes reference anatomy-creatures assets', () => {
  it('ermine_folk_female uses anatomy-creatures blueprint and parts', () => {
    const recipe = readJson('data/mods/dredgers/recipes/ermine_folk_female.recipe.json');

    expect(recipe.blueprintId).toBe('anatomy-creatures:ermine_folk_female');
    expect(recipe.slots.torso.preferId).toBe(
      'anatomy-creatures:ermine_folk_female_torso'
    );
    expect(recipe.slots.left_ear.preferId).toBe(
      'anatomy-creatures:ermine_ear'
    );
    expect(recipe.slots.right_ear.preferId).toBe(
      'anatomy-creatures:ermine_ear'
    );
    expect(recipe.slots.tail.preferId).toBe('anatomy-creatures:ermine_tail');
  });

  it('toad_folk_male uses anatomy-creatures blueprint and parts', () => {
    const recipe = readJson('data/mods/dredgers/recipes/toad_folk_male.recipe.json');

    expect(recipe.blueprintId).toBe('anatomy-creatures:toad_folk_male');
    expect(recipe.slots.torso.preferId).toBe(
      'anatomy-creatures:toad_folk_male_torso'
    );
    expect(recipe.slots.left_eye.preferId).toBe('anatomy-creatures:toad_eye');
    expect(recipe.slots.right_eye.preferId).toBe('anatomy-creatures:toad_eye');
    expect(recipe.slots.left_ear.preferId).toBe(
      'anatomy-creatures:toad_tympanum'
    );
    expect(recipe.slots.right_ear.preferId).toBe(
      'anatomy-creatures:toad_tympanum'
    );
  });
});
