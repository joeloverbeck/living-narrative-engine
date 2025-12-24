/**
 * @file Integration test for amphibian respiratory entities
 * @description Validates that amphibian respiratory entities from OXYDROSYS-009 have correct structure
 */

import { describe, expect, test } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ANATOMY_CREATURES_PATH = join(
  process.cwd(),
  'data/mods/anatomy-creatures/entities/definitions'
);

const DREDGERS_RECIPES_PATH = join(
  process.cwd(),
  'data/mods/dredgers/recipes'
);

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

describe('OXYDROSYS-009: Amphibian Lung Entity Creation', () => {
  const amphibianLungEntities = [
    'amphibian_lung_left.entity.json',
    'amphibian_lung_right.entity.json',
  ];

  test('both amphibian lung entity files should exist', () => {
    for (const filename of amphibianLungEntities) {
      const filepath = join(ANATOMY_CREATURES_PATH, filename);
      expect(existsSync(filepath)).toBe(true);
    }
  });

  test.each(amphibianLungEntities)(
    '%s should have anatomy-creatures namespace ID',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.id).toMatch(/^anatomy-creatures:/);
    }
  );

  test.each(amphibianLungEntities)(
    '%s should have anatomy:part component with lung subType',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('lung');
    }
  );

  test.each(amphibianLungEntities)(
    '%s should have anatomy:part_health component with 20 health',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['anatomy:part_health']).toBeDefined();
      expect(entity.components['anatomy:part_health'].maxHealth).toBe(20);
      expect(entity.components['anatomy:part_health'].currentHealth).toBe(20);
    }
  );

  test.each(amphibianLungEntities)(
    '%s should have core:weight component with 0.4 weight',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['core:weight']).toBeDefined();
      expect(entity.components['core:weight'].weight).toBe(0.4);
    }
  );

  test.each(amphibianLungEntities)(
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
      ).toBe(6);
      expect(
        entity.components['breathing-states:respiratory_organ'].currentOxygen
      ).toBe(6);
    }
  );

  test.each(amphibianLungEntities)(
    '%s should have environmentCompatibility for air only',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(
        entity.components['breathing-states:respiratory_organ']
          .environmentCompatibility
      ).toEqual(['air']);
    }
  );

  test('amphibian_lung_left should have left orientation', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'amphibian_lung_left.entity.json')
    );
    expect(entity.components['anatomy:part'].orientation).toBe('left');
  });

  test('amphibian_lung_right should have right orientation', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'amphibian_lung_right.entity.json')
    );
    expect(entity.components['anatomy:part'].orientation).toBe('right');
  });

  test('amphibian lungs should have smaller capacity than feline lungs (6 vs 8)', () => {
    const amphibianLung = loadJson(
      join(ANATOMY_CREATURES_PATH, 'amphibian_lung_left.entity.json')
    );
    const felineLung = loadJson(
      join(ANATOMY_CREATURES_PATH, 'feline_lung_left.entity.json')
    );

    expect(
      amphibianLung.components['breathing-states:respiratory_organ']
        .oxygenCapacity
    ).toBe(6);
    expect(
      felineLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    ).toBe(8);
    expect(
      amphibianLung.components['breathing-states:respiratory_organ']
        .oxygenCapacity
    ).toBeLessThan(
      felineLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    );
  });
});

describe('OXYDROSYS-009: Amphibian Skin Respiration Entity', () => {
  const skinRespirationFilename = 'amphibian_skin_respiration.entity.json';

  test('skin respiration entity file should exist', () => {
    const filepath = join(ANATOMY_CREATURES_PATH, skinRespirationFilename);
    expect(existsSync(filepath)).toBe(true);
  });

  test('skin respiration should have anatomy-creatures namespace ID', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, skinRespirationFilename)
    );
    expect(entity.id).toBe('anatomy-creatures:amphibian_skin_respiration');
  });

  test('skin respiration should have anatomy:part component with skin_respiration subType', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, skinRespirationFilename)
    );
    expect(entity.components['anatomy:part']).toBeDefined();
    expect(entity.components['anatomy:part'].subType).toBe('skin_respiration');
  });

  test('skin respiration should have zero health calculation weight', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, skinRespirationFilename)
    );
    expect(entity.components['anatomy:part'].health_calculation_weight).toBe(0);
  });

  test('skin respiration should have zero weight', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, skinRespirationFilename)
    );
    expect(entity.components['core:weight'].weight).toBe(0);
  });

  test('skin respiration should have cutaneous respiration type', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, skinRespirationFilename)
    );
    expect(
      entity.components['breathing-states:respiratory_organ'].respirationType
    ).toBe('cutaneous');
  });

  test('skin respiration should work in both air and water environments', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, skinRespirationFilename)
    );
    expect(
      entity.components['breathing-states:respiratory_organ']
        .environmentCompatibility
    ).toContain('air');
    expect(
      entity.components['breathing-states:respiratory_organ']
        .environmentCompatibility
    ).toContain('water');
  });

  test('skin respiration should have lower oxygen capacity than lungs', () => {
    const skinRespiration = loadJson(
      join(ANATOMY_CREATURES_PATH, skinRespirationFilename)
    );
    const lung = loadJson(
      join(ANATOMY_CREATURES_PATH, 'amphibian_lung_left.entity.json')
    );

    expect(
      skinRespiration.components['breathing-states:respiratory_organ']
        .oxygenCapacity
    ).toBe(4);
    expect(
      lung.components['breathing-states:respiratory_organ'].oxygenCapacity
    ).toBe(6);
    expect(
      skinRespiration.components['breathing-states:respiratory_organ']
        .oxygenCapacity
    ).toBeLessThan(
      lung.components['breathing-states:respiratory_organ'].oxygenCapacity
    );
  });
});

describe('OXYDROSYS-009: Amphibian Core Part Respiratory Slots', () => {
  test('amphibian_core.part.json should have left_lung slot', () => {
    const part = loadJson(join(PARTS_PATH, 'amphibian_core.part.json'));
    expect(part.slots.left_lung).toBeDefined();
    expect(part.slots.left_lung.$use).toBe('standard_lung_left');
  });

  test('amphibian_core.part.json should have right_lung slot', () => {
    const part = loadJson(join(PARTS_PATH, 'amphibian_core.part.json'));
    expect(part.slots.right_lung).toBeDefined();
    expect(part.slots.right_lung.$use).toBe('standard_lung_right');
  });

  test('amphibian_core.part.json should have skin_respiration slot', () => {
    const part = loadJson(join(PARTS_PATH, 'amphibian_core.part.json'));
    expect(part.slots.skin_respiration).toBeDefined();
    expect(part.slots.skin_respiration.socket).toBe('skin_respiration_socket');
    expect(part.slots.skin_respiration.requirements.partType).toBe(
      'skin_respiration'
    );
  });
});

describe('OXYDROSYS-009: Toad Folk Male Recipe Respiratory Preferences', () => {
  test('toad_folk_male.recipe.json should have left_lung slot with amphibian lung preference', () => {
    const recipe = loadJson(
      join(DREDGERS_RECIPES_PATH, 'toad_folk_male.recipe.json')
    );
    expect(recipe.slots.left_lung).toBeDefined();
    expect(recipe.slots.left_lung.partType).toBe('lung');
    expect(recipe.slots.left_lung.preferId).toBe(
      'anatomy-creatures:amphibian_lung_left'
    );
  });

  test('toad_folk_male.recipe.json should have right_lung slot with amphibian lung preference', () => {
    const recipe = loadJson(
      join(DREDGERS_RECIPES_PATH, 'toad_folk_male.recipe.json')
    );
    expect(recipe.slots.right_lung).toBeDefined();
    expect(recipe.slots.right_lung.partType).toBe('lung');
    expect(recipe.slots.right_lung.preferId).toBe(
      'anatomy-creatures:amphibian_lung_right'
    );
  });

  test('toad_folk_male.recipe.json should have skin_respiration slot', () => {
    const recipe = loadJson(
      join(DREDGERS_RECIPES_PATH, 'toad_folk_male.recipe.json')
    );
    expect(recipe.slots.skin_respiration).toBeDefined();
    expect(recipe.slots.skin_respiration.partType).toBe('skin_respiration');
    expect(recipe.slots.skin_respiration.preferId).toBe(
      'anatomy-creatures:amphibian_skin_respiration'
    );
  });
});

describe('OXYDROSYS-009: Toad Folk Male Torso Sockets', () => {
  test('toad_folk_male_torso should have lung sockets', () => {
    const torso = loadJson(
      join(ANATOMY_CREATURES_PATH, 'toad_folk_male_torso.entity.json')
    );
    const sockets = torso.components['anatomy:sockets'].sockets;

    const lungLeftSocket = sockets.find((s) => s.id === 'lung_left_socket');
    const lungRightSocket = sockets.find((s) => s.id === 'lung_right_socket');

    expect(lungLeftSocket).toBeDefined();
    expect(lungLeftSocket.allowedTypes).toContain('lung');
    expect(lungLeftSocket.orientation).toBe('left');

    expect(lungRightSocket).toBeDefined();
    expect(lungRightSocket.allowedTypes).toContain('lung');
    expect(lungRightSocket.orientation).toBe('right');
  });

  test('toad_folk_male_torso should have skin respiration socket', () => {
    const torso = loadJson(
      join(ANATOMY_CREATURES_PATH, 'toad_folk_male_torso.entity.json')
    );
    const sockets = torso.components['anatomy:sockets'].sockets;

    const skinRespirationSocket = sockets.find(
      (s) => s.id === 'skin_respiration_socket'
    );

    expect(skinRespirationSocket).toBeDefined();
    expect(skinRespirationSocket.allowedTypes).toContain('skin_respiration');
  });
});

describe('OXYDROSYS-009: Manifest Registration', () => {
  test('mod-manifest.json should contain all amphibian respiratory entities', () => {
    const manifestPath = join(
      process.cwd(),
      'data/mods/anatomy-creatures/mod-manifest.json'
    );
    const manifest = loadJson(manifestPath);
    const entityDefs = manifest.content.entities.definitions;

    expect(entityDefs).toContain('amphibian_lung_left.entity.json');
    expect(entityDefs).toContain('amphibian_lung_right.entity.json');
    expect(entityDefs).toContain('amphibian_skin_respiration.entity.json');
  });
});
