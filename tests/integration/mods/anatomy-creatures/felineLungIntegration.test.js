/**
 * @file Integration test for feline lung entities
 * @description Validates that feline lung entities from OXYDROSYS-008 have correct structure
 */

import { describe, expect, test } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ANATOMY_CREATURES_PATH = join(
  process.cwd(),
  'data/mods/anatomy-creatures/entities/definitions'
);

const RECIPES_PATH = join(process.cwd(), 'data/mods/anatomy-creatures/recipes');

const PARTS_PATH = join(process.cwd(), 'data/mods/anatomy-creatures/parts');

/**
 * Helper to load and validate entity JSON.
 *
 * @param {string} filepath - Path to the JSON file
 * @returns {object} Parsed JSON object
 */
function loadJson(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

describe('OXYDROSYS-008: Feline Lung Entity Creation', () => {
  const felineLungEntities = [
    'feline_lung_left.entity.json',
    'feline_lung_right.entity.json',
  ];

  test('both feline lung entity files should exist', () => {
    for (const filename of felineLungEntities) {
      const filepath = join(ANATOMY_CREATURES_PATH, filename);
      expect(existsSync(filepath)).toBe(true);
    }
  });

  test.each(felineLungEntities)(
    '%s should have anatomy-creatures namespace ID',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.id).toMatch(/^anatomy-creatures:/);
    }
  );

  test.each(felineLungEntities)(
    '%s should have anatomy:part component with lung subType',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('lung');
    }
  );

  test.each(felineLungEntities)(
    '%s should have anatomy:part_health component',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['anatomy:part_health']).toBeDefined();
      expect(entity.components['anatomy:part_health'].maxHealth).toBe(25);
      expect(entity.components['anatomy:part_health'].currentHealth).toBe(25);
    }
  );

  test.each(felineLungEntities)(
    '%s should have core:weight component',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['core:weight']).toBeDefined();
      expect(entity.components['core:weight'].weight).toBe(0.5);
    }
  );

  test.each(felineLungEntities)(
    '%s should have breathing-states:respiratory_organ component',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(
        entity.components['breathing-states:respiratory_organ']
      ).toBeDefined();
      expect(
        entity.components['breathing-states:respiratory_organ'].respirationType
      ).toBe('pulmonary');
      expect(
        entity.components['breathing-states:respiratory_organ'].oxygenCapacity
      ).toBe(8);
      expect(
        entity.components['breathing-states:respiratory_organ'].currentOxygen
      ).toBe(8);
    }
  );

  test('feline_lung_left should have left orientation', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'feline_lung_left.entity.json')
    );
    expect(entity.components['anatomy:part'].orientation).toBe('left');
  });

  test('feline_lung_right should have right orientation', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'feline_lung_right.entity.json')
    );
    expect(entity.components['anatomy:part'].orientation).toBe('right');
  });

  test('feline lungs should have smaller capacity than human lungs (8 vs 10)', () => {
    const felineLung = loadJson(
      join(ANATOMY_CREATURES_PATH, 'feline_lung_left.entity.json')
    );
    const humanLungPath = join(
      process.cwd(),
      'data/mods/anatomy/entities/definitions/human_lung_left.entity.json'
    );
    const humanLung = loadJson(humanLungPath);

    expect(
      felineLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    ).toBe(8);
    expect(
      humanLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    ).toBe(10);
    expect(
      felineLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    ).toBeLessThan(
      humanLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    );
  });
});

describe('OXYDROSYS-008: Feline Core Part Lung Slots', () => {
  test('feline_core.part.json should have left_lung slot', () => {
    const part = loadJson(join(PARTS_PATH, 'feline_core.part.json'));
    expect(part.slots.left_lung).toBeDefined();
    expect(part.slots.left_lung.$use).toBe('standard_lung_left');
  });

  test('feline_core.part.json should have right_lung slot', () => {
    const part = loadJson(join(PARTS_PATH, 'feline_core.part.json'));
    expect(part.slots.right_lung).toBeDefined();
    expect(part.slots.right_lung.$use).toBe('standard_lung_right');
  });
});

describe('OXYDROSYS-008: Cat Girl Recipe Lung Preferences', () => {
  test('cat_girl.recipe.json should have left_lung slot with feline lung preference', () => {
    const recipe = loadJson(join(RECIPES_PATH, 'cat_girl.recipe.json'));
    expect(recipe.slots.left_lung).toBeDefined();
    expect(recipe.slots.left_lung.partType).toBe('lung');
    expect(recipe.slots.left_lung.preferId).toBe(
      'anatomy-creatures:feline_lung_left'
    );
  });

  test('cat_girl.recipe.json should have right_lung slot with feline lung preference', () => {
    const recipe = loadJson(join(RECIPES_PATH, 'cat_girl.recipe.json'));
    expect(recipe.slots.right_lung).toBeDefined();
    expect(recipe.slots.right_lung.partType).toBe('lung');
    expect(recipe.slots.right_lung.preferId).toBe(
      'anatomy-creatures:feline_lung_right'
    );
  });
});

describe('OXYDROSYS-008: Manifest Registration', () => {
  test('mod-manifest.json should contain both feline lung entities', () => {
    const manifestPath = join(
      process.cwd(),
      'data/mods/anatomy-creatures/mod-manifest.json'
    );
    const manifest = loadJson(manifestPath);
    const entityDefs = manifest.content.entities.definitions;

    expect(entityDefs).toContain('feline_lung_left.entity.json');
    expect(entityDefs).toContain('feline_lung_right.entity.json');
  });
});
