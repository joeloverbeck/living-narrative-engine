/**
 * @file Integration test for reptilian and eldritch respiratory entities
 * @description Validates that respiratory entities from OXYDROSYS-010 have correct structure
 */

import { describe, expect, test } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ANATOMY_CREATURES_PATH = join(
  process.cwd(),
  'data/mods/anatomy-creatures/entities/definitions'
);

const RECIPES_PATH = join(process.cwd(), 'data/mods/anatomy-creatures/recipes');

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

describe('OXYDROSYS-010: Reptilian Lung Entity Creation', () => {
  const reptilianLungEntities = [
    'reptilian_lung_left.entity.json',
    'reptilian_lung_right.entity.json',
  ];

  test('both reptilian lung entity files should exist', () => {
    for (const filename of reptilianLungEntities) {
      const filepath = join(ANATOMY_CREATURES_PATH, filename);
      expect(existsSync(filepath)).toBe(true);
    }
  });

  test.each(reptilianLungEntities)(
    '%s should have anatomy-creatures namespace ID',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.id).toMatch(/^anatomy-creatures:/);
    }
  );

  test.each(reptilianLungEntities)(
    '%s should have anatomy:part component with lung subType',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBe('lung');
    }
  );

  test.each(reptilianLungEntities)(
    '%s should have anatomy:part_health component with dragon-sized health',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['anatomy:part_health']).toBeDefined();
      expect(entity.components['anatomy:part_health'].maxHealth).toBe(50);
      expect(entity.components['anatomy:part_health'].currentHealth).toBe(50);
    }
  );

  test.each(reptilianLungEntities)(
    '%s should have core:weight component with dragon-scaled weight',
    (filename) => {
      const entity = loadJson(join(ANATOMY_CREATURES_PATH, filename));
      expect(entity.components['core:weight']).toBeDefined();
      expect(entity.components['core:weight'].weight).toBe(2.5);
    }
  );

  test.each(reptilianLungEntities)(
    '%s should have breathing-states:respiratory_organ component with pulmonary type',
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
      ).toBe(20);
      expect(
        entity.components['breathing-states:respiratory_organ'].currentOxygen
      ).toBe(20);
    }
  );

  test('reptilian_lung_left should have left orientation', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'reptilian_lung_left.entity.json')
    );
    expect(entity.components['anatomy:part'].orientation).toBe('left');
  });

  test('reptilian_lung_right should have right orientation', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'reptilian_lung_right.entity.json')
    );
    expect(entity.components['anatomy:part'].orientation).toBe('right');
  });

  test('reptilian lungs should have larger capacity than human lungs (20 vs 10)', () => {
    const reptilianLung = loadJson(
      join(ANATOMY_CREATURES_PATH, 'reptilian_lung_left.entity.json')
    );
    const humanLungPath = join(
      process.cwd(),
      'data/mods/anatomy/entities/definitions/human_lung_left.entity.json'
    );
    const humanLung = loadJson(humanLungPath);

    expect(
      reptilianLung.components['breathing-states:respiratory_organ']
        .oxygenCapacity
    ).toBe(20);
    expect(
      humanLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    ).toBe(10);
    expect(
      reptilianLung.components['breathing-states:respiratory_organ']
        .oxygenCapacity
    ).toBeGreaterThan(
      humanLung.components['breathing-states:respiratory_organ'].oxygenCapacity
    );
  });
});

describe('OXYDROSYS-010: Eldritch Respiratory Mass Entity Creation', () => {
  const entityFilename = 'eldritch_respiratory_mass.entity.json';

  test('eldritch respiratory mass entity file should exist', () => {
    const filepath = join(ANATOMY_CREATURES_PATH, entityFilename);
    expect(existsSync(filepath)).toBe(true);
  });

  test('should have anatomy-creatures namespace ID', () => {
    const entity = loadJson(join(ANATOMY_CREATURES_PATH, entityFilename));
    expect(entity.id).toBe('anatomy-creatures:eldritch_respiratory_mass');
  });

  test('should have anatomy:part component with respiratory_mass subType', () => {
    const entity = loadJson(join(ANATOMY_CREATURES_PATH, entityFilename));
    expect(entity.components['anatomy:part']).toBeDefined();
    expect(entity.components['anatomy:part'].subType).toBe('respiratory_mass');
  });

  test('should have anatomy:part_health component with eldritch-scaled health', () => {
    const entity = loadJson(join(ANATOMY_CREATURES_PATH, entityFilename));
    expect(entity.components['anatomy:part_health']).toBeDefined();
    expect(entity.components['anatomy:part_health'].maxHealth).toBe(60);
    expect(entity.components['anatomy:part_health'].currentHealth).toBe(60);
  });

  test('should have core:weight component with amorphous mass weight', () => {
    const entity = loadJson(join(ANATOMY_CREATURES_PATH, entityFilename));
    expect(entity.components['core:weight']).toBeDefined();
    expect(entity.components['core:weight'].weight).toBe(5.0);
  });

  test('should have breathing-states:respiratory_organ component with unusual type', () => {
    const entity = loadJson(join(ANATOMY_CREATURES_PATH, entityFilename));
    expect(
      entity.components['breathing-states:respiratory_organ']
    ).toBeDefined();
    expect(
      entity.components['breathing-states:respiratory_organ'].respirationType
    ).toBe('unusual');
    expect(
      entity.components['breathing-states:respiratory_organ'].oxygenCapacity
    ).toBe(30);
    expect(
      entity.components['breathing-states:respiratory_organ'].currentOxygen
    ).toBe(30);
  });

  test('should have supernatural oxygen capacity greater than human and reptilian', () => {
    const eldritchMass = loadJson(
      join(ANATOMY_CREATURES_PATH, entityFilename)
    );
    const humanLung = loadJson(
      join(
        process.cwd(),
        'data/mods/anatomy/entities/definitions/human_lung_left.entity.json'
      )
    );
    const reptilianLung = loadJson(
      join(ANATOMY_CREATURES_PATH, 'reptilian_lung_left.entity.json')
    );

    const eldritchCapacity =
      eldritchMass.components['breathing-states:respiratory_organ']
        .oxygenCapacity;
    const humanCapacity =
      humanLung.components['breathing-states:respiratory_organ'].oxygenCapacity;
    const reptilianCapacity =
      reptilianLung.components['breathing-states:respiratory_organ']
        .oxygenCapacity;

    expect(eldritchCapacity).toBe(30);
    expect(eldritchCapacity).toBeGreaterThan(humanCapacity);
    expect(eldritchCapacity).toBeGreaterThan(reptilianCapacity);
  });
});

describe('OXYDROSYS-010: Dragon Torso Lung Sockets', () => {
  test('dragon_torso.entity.json should have lung_left_socket', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'dragon_torso.entity.json')
    );
    const sockets = entity.components['anatomy:sockets'].sockets;
    const lungLeftSocket = sockets.find((s) => s.id === 'lung_left_socket');

    expect(lungLeftSocket).toBeDefined();
    expect(lungLeftSocket.allowedTypes).toContain('lung');
    expect(lungLeftSocket.orientation).toBe('left');
  });

  test('dragon_torso.entity.json should have lung_right_socket', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'dragon_torso.entity.json')
    );
    const sockets = entity.components['anatomy:sockets'].sockets;
    const lungRightSocket = sockets.find((s) => s.id === 'lung_right_socket');

    expect(lungRightSocket).toBeDefined();
    expect(lungRightSocket.allowedTypes).toContain('lung');
    expect(lungRightSocket.orientation).toBe('right');
  });
});

describe('OXYDROSYS-010: Eldritch Core Mass Respiratory Socket', () => {
  test('eldritch_core_mass.entity.json should have respiratory_mass_socket', () => {
    const entity = loadJson(
      join(ANATOMY_CREATURES_PATH, 'eldritch_core_mass.entity.json')
    );
    const sockets = entity.components['anatomy:sockets'].sockets;
    const respiratorySocket = sockets.find(
      (s) => s.id === 'respiratory_mass_socket'
    );

    expect(respiratorySocket).toBeDefined();
    expect(respiratorySocket.allowedTypes).toContain('respiratory_mass');
  });
});

describe('OXYDROSYS-010: Red Dragon Recipe Lung Preferences', () => {
  test('red_dragon.recipe.json should have left_lung slot with reptilian lung preference', () => {
    const recipe = loadJson(join(RECIPES_PATH, 'red_dragon.recipe.json'));
    expect(recipe.slots.left_lung).toBeDefined();
    expect(recipe.slots.left_lung.partType).toBe('lung');
    expect(recipe.slots.left_lung.preferId).toBe(
      'anatomy-creatures:reptilian_lung_left'
    );
  });

  test('red_dragon.recipe.json should have right_lung slot with reptilian lung preference', () => {
    const recipe = loadJson(join(RECIPES_PATH, 'red_dragon.recipe.json'));
    expect(recipe.slots.right_lung).toBeDefined();
    expect(recipe.slots.right_lung.partType).toBe('lung');
    expect(recipe.slots.right_lung.preferId).toBe(
      'anatomy-creatures:reptilian_lung_right'
    );
  });
});

describe('OXYDROSYS-010: Writhing Observer Recipe Respiratory Mass Preference', () => {
  test('writhing_observer.recipe.json should have respiratory_mass slot with eldritch preference', () => {
    const recipe = loadJson(
      join(RECIPES_PATH, 'writhing_observer.recipe.json')
    );
    expect(recipe.slots.respiratory_mass).toBeDefined();
    expect(recipe.slots.respiratory_mass.partType).toBe('respiratory_mass');
    expect(recipe.slots.respiratory_mass.preferId).toBe(
      'anatomy-creatures:eldritch_respiratory_mass'
    );
  });
});

describe('OXYDROSYS-010: Manifest Registration', () => {
  test('mod-manifest.json should contain reptilian lung entities', () => {
    const manifestPath = join(
      process.cwd(),
      'data/mods/anatomy-creatures/mod-manifest.json'
    );
    const manifest = loadJson(manifestPath);
    const entityDefs = manifest.content.entities.definitions;

    expect(entityDefs).toContain('reptilian_lung_left.entity.json');
    expect(entityDefs).toContain('reptilian_lung_right.entity.json');
  });

  test('mod-manifest.json should contain eldritch respiratory mass entity', () => {
    const manifestPath = join(
      process.cwd(),
      'data/mods/anatomy-creatures/mod-manifest.json'
    );
    const manifest = loadJson(manifestPath);
    const entityDefs = manifest.content.entities.definitions;

    expect(entityDefs).toContain('eldritch_respiratory_mass.entity.json');
  });
});
