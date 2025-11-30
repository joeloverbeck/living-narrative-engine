/**
 * @file Integration test for weapon entity can_cut component classification
 * Validates that cutting weapons have damage-types:can_cut and piercing weapons do not
 * Related ticket: NONDETACTSYS-015
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Weapon can_cut Component Validation - Integration', () => {
  const FANTASY_MOD_PATH = 'data/mods/fantasy';
  let rapierData;
  let mainGaucheData;
  let longswordData;

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
  });

  describe('Cutting Weapons - should have damage-types:can_cut', () => {
    describe('Threadscar Melissa Longsword', () => {
      it('should have weapons:weapon component', () => {
        expect(longswordData.components['weapons:weapon']).toBeDefined();
      });

      it('should have damage-types:can_cut component', () => {
        expect(longswordData.components['damage-types:can_cut']).toBeDefined();
      });

      it('should have can_cut as empty marker object', () => {
        expect(longswordData.components['damage-types:can_cut']).toEqual({});
      });
    });

    describe('Vespera Rapier', () => {
      it('should have weapons:weapon component', () => {
        expect(rapierData.components['weapons:weapon']).toBeDefined();
      });

      it('should have damage-types:can_cut component', () => {
        expect(rapierData.components['damage-types:can_cut']).toBeDefined();
      });

      it('should have can_cut as empty marker object', () => {
        expect(rapierData.components['damage-types:can_cut']).toEqual({});
      });
    });
  });

  describe('Piercing Weapons - should NOT have damage-types:can_cut', () => {
    describe('Vespera Main-Gauche (piercing dagger)', () => {
      it('should have weapons:weapon component', () => {
        expect(mainGaucheData.components['weapons:weapon']).toBeDefined();
      });

      it('should NOT have damage-types:can_cut component', () => {
        expect(
          mainGaucheData.components['damage-types:can_cut']
        ).toBeUndefined();
      });
    });
  });

  describe('Weapon Classification Consistency', () => {
    it('cutting weapons should be identifiable by both weapon and can_cut markers', () => {
      const cuttingWeapons = [longswordData, rapierData];
      for (const weapon of cuttingWeapons) {
        // Must have both components to be discovered by wielded_cutting_weapons scope
        expect(weapon.components['weapons:weapon']).toBeDefined();
        expect(weapon.components['damage-types:can_cut']).toBeDefined();
      }
    });

    it('piercing-only weapons should have weapon marker but not can_cut', () => {
      // Main-gauche is described as "needle-thin, purpose-built for finding gaps"
      expect(mainGaucheData.components['weapons:weapon']).toBeDefined();
      expect(mainGaucheData.components['damage-types:can_cut']).toBeUndefined();
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
    it('should not modify other weapon components when adding can_cut', () => {
      // Ensure adding can_cut didn't accidentally remove or modify other baseline components
      const requiredComponents = [
        'core:name',
        'core:description',
        'items:item',
        'items:portable',
        'weapons:weapon',
        'items:weight',
        'descriptors:color_basic',
        'descriptors:texture',
        'core:material',
        'anatomy:requires_grabbing',
      ];

      for (const weapon of [longswordData, rapierData, mainGaucheData]) {
        for (const component of requiredComponents) {
          expect(weapon.components[component]).toBeDefined();
        }
      }
    });
  });
});
