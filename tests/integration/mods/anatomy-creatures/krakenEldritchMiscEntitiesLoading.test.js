/**
 * @file Integration test for kraken, eldritch, and misc entity migrations
 * @description Validates that entity files migrated in ANACREMODMIG-006g have correct structure
 */

import { describe, expect, test } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ANATOMY_CREATURES_PATH = join(
  process.cwd(),
  'data/mods/anatomy-creatures/entities/definitions'
);

/**
 * Helper to load and validate entity JSON
 * @param {string} filename
 * @returns {object}
 */
function loadEntity(filename) {
  const filepath = join(ANATOMY_CREATURES_PATH, filename);
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

describe('ANACREMODMIG-006g: Kraken/Cephalopod Entity Migration', () => {
  const krakenCephalopodEntities = [
    'kraken_head.entity.json',
    'kraken_mantle.entity.json',
    'kraken_tentacle.entity.json',
    'octopus_mantle.entity.json',
    'octopus_tentacle.entity.json',
    'squid_mantle.entity.json',
    'squid_tentacle.entity.json',
    'ink_reservoir.entity.json',
  ];

  test('all 8 kraken/cephalopod entity files should exist', () => {
    for (const filename of krakenCephalopodEntities) {
      const filepath = join(ANATOMY_CREATURES_PATH, filename);
      expect(existsSync(filepath)).toBe(true);
    }
  });

  test.each(krakenCephalopodEntities)(
    '%s should have anatomy-creatures namespace ID',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.id).toMatch(/^anatomy-creatures:/);
    }
  );

  test.each(krakenCephalopodEntities)(
    '%s should have required anatomy:part component',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBeDefined();
    }
  );

  test.each(krakenCephalopodEntities)(
    '%s should have anatomy:part_health component',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.components['anatomy:part_health']).toBeDefined();
      expect(entity.components['anatomy:part_health'].maxHealth).toBeGreaterThan(
        0
      );
    }
  );

  test.each(krakenCephalopodEntities)(
    '%s should have core:weight component',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.components['core:weight']).toBeDefined();
      expect(
        typeof entity.components['core:weight'].weight
      ).toBe('number');
    }
  );
});

describe('ANACREMODMIG-006g: Eldritch Entity Migration', () => {
  const eldritchEntities = [
    'eldritch_baleful_eye.entity.json',
    'eldritch_compound_eye_stalk.entity.json',
    'eldritch_core_mass.entity.json',
    'eldritch_lamprey_mouth.entity.json',
    'eldritch_malformed_hand.entity.json',
    'eldritch_membrane_wing.entity.json',
    'eldritch_sensory_stalk.entity.json',
    'eldritch_speaking_orifice.entity.json',
    'eldritch_surface_eye.entity.json',
    'eldritch_tentacle_feeding.entity.json',
    'eldritch_tentacle_large.entity.json',
    'eldritch_tentacle_sensory.entity.json',
    'eldritch_vertical_maw.entity.json',
    'eldritch_vestigial_arm.entity.json',
    'eldritch_vocal_sac.entity.json',
  ];

  test('all 15 eldritch entity files should exist', () => {
    for (const filename of eldritchEntities) {
      const filepath = join(ANATOMY_CREATURES_PATH, filename);
      expect(existsSync(filepath)).toBe(true);
    }
  });

  test.each(eldritchEntities)(
    '%s should have anatomy-creatures namespace ID',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.id).toMatch(/^anatomy-creatures:/);
    }
  );

  test.each(eldritchEntities)(
    '%s should have required anatomy:part component',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.components['anatomy:part']).toBeDefined();
      expect(entity.components['anatomy:part'].subType).toBeDefined();
    }
  );

  test.each(eldritchEntities)(
    '%s should have anatomy:part_health component',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.components['anatomy:part_health']).toBeDefined();
    }
  );
});

describe('ANACREMODMIG-006g: Misc Entity Migration', () => {
  const miscEntities = [
    'horse_tail.entity.json',
    'beak.entity.json',
  ];

  test('all 2 misc entity files should exist', () => {
    for (const filename of miscEntities) {
      const filepath = join(ANATOMY_CREATURES_PATH, filename);
      expect(existsSync(filepath)).toBe(true);
    }
  });

  test.each(miscEntities)(
    '%s should have anatomy-creatures namespace ID',
    (filename) => {
      const entity = loadEntity(filename);
      expect(entity.id).toMatch(/^anatomy-creatures:/);
    }
  );

  test('horse_tail should have horse_tail subType', () => {
    const entity = loadEntity('horse_tail.entity.json');
    expect(entity.components['anatomy:part'].subType).toBe('horse_tail');
  });

  test('beak should have beak subType', () => {
    const entity = loadEntity('beak.entity.json');
    expect(entity.components['anatomy:part'].subType).toBe('beak');
  });

  test('beak should have damage_capabilities component', () => {
    const entity = loadEntity('beak.entity.json');
    expect(entity.components['damage-types:damage_capabilities']).toBeDefined();
    expect(
      entity.components['damage-types:damage_capabilities'].entries
    ).toHaveLength(1);
  });
});

describe('ANACREMODMIG-006g: Manifest Registration', () => {
  test('mod-manifest.json should contain all 25 migrated entities', () => {
    const manifestPath = join(
      process.cwd(),
      'data/mods/anatomy-creatures/mod-manifest.json'
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const normalize = (value) => value.split('/').pop();
    const entityDefs = manifest.content.entities.definitions.map(normalize);
    const expectDefs = (value) =>
      expect(entityDefs).toContain(normalize(value));

    // Kraken/Cephalopod - 8
    expectDefs('entities/definitions/kraken_head.entity.json');
    expectDefs('entities/definitions/kraken_mantle.entity.json');
    expectDefs('entities/definitions/kraken_tentacle.entity.json');
    expectDefs('entities/definitions/octopus_mantle.entity.json');
    expectDefs('entities/definitions/octopus_tentacle.entity.json');
    expectDefs('entities/definitions/squid_mantle.entity.json');
    expectDefs('entities/definitions/squid_tentacle.entity.json');
    expectDefs('entities/definitions/ink_reservoir.entity.json');

    // Eldritch - 15
    expectDefs('entities/definitions/eldritch_baleful_eye.entity.json');
    expectDefs('entities/definitions/eldritch_compound_eye_stalk.entity.json');
    expectDefs('entities/definitions/eldritch_core_mass.entity.json');
    expectDefs('entities/definitions/eldritch_lamprey_mouth.entity.json');
    expectDefs('entities/definitions/eldritch_malformed_hand.entity.json');
    expectDefs('entities/definitions/eldritch_membrane_wing.entity.json');
    expectDefs('entities/definitions/eldritch_sensory_stalk.entity.json');
    expectDefs('entities/definitions/eldritch_speaking_orifice.entity.json');
    expectDefs('entities/definitions/eldritch_surface_eye.entity.json');
    expectDefs('entities/definitions/eldritch_tentacle_feeding.entity.json');
    expectDefs('entities/definitions/eldritch_tentacle_large.entity.json');
    expectDefs('entities/definitions/eldritch_tentacle_sensory.entity.json');
    expectDefs('entities/definitions/eldritch_vertical_maw.entity.json');
    expectDefs('entities/definitions/eldritch_vestigial_arm.entity.json');
    expectDefs('entities/definitions/eldritch_vocal_sac.entity.json');

    // Misc - 2
    expectDefs('entities/definitions/horse_tail.entity.json');
    expectDefs('entities/definitions/beak.entity.json');
  });

  test('mod-manifest.json should have at least 91 total entity definitions', () => {
    const manifestPath = join(
      process.cwd(),
      'data/mods/anatomy-creatures/mod-manifest.json'
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(
      manifest.content.entities.definitions.length
    ).toBeGreaterThanOrEqual(91);
  });
});
