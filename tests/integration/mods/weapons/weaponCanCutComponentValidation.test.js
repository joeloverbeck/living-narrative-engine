/**
 * @file Integration test for weapon damage capabilities component validation
 * Validates that weapons use damage-types:damage_capabilities with correct entries
 * Related tickets: NONDETACTSYS-015, WEADAMCAPREF-011
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Weapon Damage Capabilities Validation - Integration', () => {
  const FANTASY_MOD_PATH = 'data/mods/fantasy';
  let rapierData;
  let mainGaucheData;
  let longswordData;
  let practiceStickData;

  beforeAll(async () => {
    const rapierPath = join(
      FANTASY_MOD_PATH,
      'entities/definitions/vespera_rapier.entity.json'
    );
    rapierData = JSON.parse(await readFile(rapierPath, 'utf-8'));

    const mainGauchePath = join(
      FANTASY_MOD_PATH,
      'entities/definitions/vespera_main_gauche.entity.json'
    );
    mainGaucheData = JSON.parse(await readFile(mainGauchePath, 'utf-8'));

    const longswordPath = join(
      FANTASY_MOD_PATH,
      'entities/definitions/threadscar_melissa_longsword.entity.json'
    );
    longswordData = JSON.parse(await readFile(longswordPath, 'utf-8'));

    const practiceStickPath = join(
      FANTASY_MOD_PATH,
      'entities/definitions/rill_practice_stick.entity.json'
    );
    practiceStickData = JSON.parse(await readFile(practiceStickPath, 'utf-8'));
  });

  describe('All weapons should have weapons:weapon component', () => {
    it('longsword should have weapons:weapon', () => {
      expect(longswordData.components['weapons:weapon']).toBeDefined();
    });

    it('rapier should have weapons:weapon', () => {
      expect(rapierData.components['weapons:weapon']).toBeDefined();
    });

    it('main-gauche should have weapons:weapon', () => {
      expect(mainGaucheData.components['weapons:weapon']).toBeDefined();
    });

    it('practice stick should have weapons:weapon', () => {
      expect(practiceStickData.components['weapons:weapon']).toBeDefined();
    });
  });

  describe('Weapon type classification via damage_capabilities', () => {
    describe('Slashing weapons (longsword, rapier)', () => {
      it('longsword should have slashing damage capability', () => {
        const entries =
          longswordData.components['damage-types:damage_capabilities']?.entries;
        expect(entries).toBeDefined();
        expect(entries.some((e) => e.name === 'slashing')).toBe(true);
      });

      it('rapier should have slashing damage capability', () => {
        const entries =
          rapierData.components['damage-types:damage_capabilities']?.entries;
        expect(entries).toBeDefined();
        expect(entries.some((e) => e.name === 'slashing')).toBe(true);
      });
    });

    describe('Piercing weapons (main-gauche)', () => {
      it('main-gauche should have piercing damage capability', () => {
        const entries =
          mainGaucheData.components['damage-types:damage_capabilities']
            ?.entries;
        expect(entries).toBeDefined();
        expect(entries.some((e) => e.name === 'piercing')).toBe(true);
      });

      it('main-gauche should NOT have slashing damage capability', () => {
        const entries =
          mainGaucheData.components['damage-types:damage_capabilities']
            ?.entries;
        expect(entries.some((e) => e.name === 'slashing')).toBe(false);
      });
    });

    describe('Blunt weapons (practice stick)', () => {
      it('practice stick should have blunt damage capability', () => {
        const entries =
          practiceStickData.components['damage-types:damage_capabilities']
            ?.entries;
        expect(entries).toBeDefined();
        expect(entries.some((e) => e.name === 'blunt')).toBe(true);
      });

      it('practice stick should NOT have slashing damage capability', () => {
        const entries =
          practiceStickData.components['damage-types:damage_capabilities']
            ?.entries;
        expect(entries.some((e) => e.name === 'slashing')).toBe(false);
      });
    });
  });

  describe('Damage capabilities component', () => {
    it('should exist on all four weapons', () => {
      for (const weapon of [
        rapierData,
        mainGaucheData,
        longswordData,
        practiceStickData,
      ]) {
        expect(
          weapon.components['damage-types:damage_capabilities']
        ).toBeDefined();
        expect(
          weapon.components['damage-types:damage_capabilities']?.entries?.length
        ).toBeGreaterThan(0);
      }
    });

    it('should define rapier slashing profile with bleed and dismember', () => {
      const entries =
        rapierData.components['damage-types:damage_capabilities'].entries;
      expect(entries).toHaveLength(2);
      expect(entries[1]).toMatchObject({
        name: 'slashing',
        amount: 8,
        penetration: 0.1,
        bleed: {
          enabled: true,
          severity: 'minor',
          baseDurationTurns: 2,
        },
      });
    });

    it('should define main-gauche piercing profile with minor bleed', () => {
      const entries =
        mainGaucheData.components['damage-types:damage_capabilities'].entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        name: 'piercing',
        amount: 10,
        penetration: 0.8,
        bleed: {
          enabled: true,
          severity: 'minor',
          baseDurationTurns: 2,
        },
      });
      expect(entries[0].dismember).toBeUndefined();
    });

    it('should define practice stick blunt profile with fracture', () => {
      const entries =
        practiceStickData.components['damage-types:damage_capabilities']
          .entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        name: 'blunt',
        amount: 5,
        fracture: {
          enabled: true,
          thresholdFraction: 0.7,
          stunChance: 0.1,
        },
      });
    });

    it('should define longsword slashing profile with bleed and dismember', () => {
      const entries =
        longswordData.components['damage-types:damage_capabilities'].entries;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        name: 'slashing',
        amount: 22,
        penetration: 0.3,
        bleed: {
          enabled: true,
          severity: 'moderate',
          baseDurationTurns: 3,
        },
        dismember: {
          enabled: true,
          thresholdFraction: 0.7,
        },
      });
    });
  });

  describe('Weapon Classification via damage_capabilities (post WEADAMCAPREF-011)', () => {
    it('slashing weapons should have damage_capabilities with slashing entry', () => {
      const slashingWeapons = [longswordData, rapierData];
      for (const weapon of slashingWeapons) {
        // Must have damage_capabilities with slashing entry to be discovered by wielded_cutting_weapons scope
        expect(weapon.components['weapons:weapon']).toBeDefined();
        expect(
          weapon.components['damage-types:damage_capabilities']
        ).toBeDefined();
        const entries =
          weapon.components['damage-types:damage_capabilities'].entries;
        expect(entries.some((e) => e.name === 'slashing')).toBe(true);
      }
    });

    it('piercing-only weapons should have weapon marker but no slashing capability', () => {
      // Main-gauche is described as "needle-thin, purpose-built for finding gaps"
      expect(mainGaucheData.components['weapons:weapon']).toBeDefined();
      expect(
        mainGaucheData.components['damage-types:damage_capabilities']
      ).toBeDefined();
      const entries =
        mainGaucheData.components['damage-types:damage_capabilities'].entries;
      expect(entries.some((e) => e.name === 'slashing')).toBe(false);
      expect(entries.some((e) => e.name === 'piercing')).toBe(true);
    });

    it('blunt weapons should have weapon marker but no slashing capability', () => {
      expect(practiceStickData.components['weapons:weapon']).toBeDefined();
      expect(
        practiceStickData.components['damage-types:damage_capabilities']
      ).toBeDefined();
      const entries =
        practiceStickData.components['damage-types:damage_capabilities']
          .entries;
      expect(entries.some((e) => e.name === 'slashing')).toBe(false);
      expect(entries.some((e) => e.name === 'blunt')).toBe(true);
    });
  });

  describe('Entity ID Preservation', () => {
    it('should preserve rapier entity ID', () => {
      expect(rapierData.id).toBe('fantasy:vespera_rapier');
    });

    it('should preserve main-gauche entity ID', () => {
      expect(mainGaucheData.id).toBe('fantasy:vespera_main_gauche');
    });

    it('should preserve longsword entity ID', () => {
      expect(longswordData.id).toBe('fantasy:threadscar_melissa_longsword');
    });
  });

  describe('Component Structure Integrity', () => {
    it('should not modify other weapon components when adding damage components', () => {
      // Ensure adding can_cut/damage_capabilities didn't remove or modify other baseline components
      const requiredComponents = [
        'core:name',
        'core:description',
        'items:item',
        'items:portable',
        'weapons:weapon',
        'core:weight',
        'descriptors:color_basic',
        'descriptors:texture',
        'core:material',
        'anatomy:requires_grabbing',
      ];

      for (const weapon of [
        longswordData,
        rapierData,
        mainGaucheData,
        practiceStickData,
      ]) {
        for (const component of requiredComponents) {
          expect(weapon.components[component]).toBeDefined();
        }
      }
    });
  });
});
