/**
 * @file Integration test for fantasy weapon entity grabbing requirements
 * Validates that weapon entities have correct anatomy:requires_grabbing component data
 * Related ticket: APPGRAOCCSYS-008
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Fantasy Weapon Grabbing Requirements - Integration Validation', () => {
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

  describe('Vespera Rapier', () => {
    it('should have anatomy:requires_grabbing component', () => {
      expect(rapierData.components['anatomy:requires_grabbing']).toBeDefined();
    });

    it('should require 1 hand to wield (one-handed fencing weapon)', () => {
      expect(
        rapierData.components['anatomy:requires_grabbing'].handsRequired
      ).toBe(1);
    });

    it('should retain weapon component', () => {
      expect(rapierData.components['weapons:weapon']).toBeDefined();
    });

    it('should retain item components', () => {
      expect(rapierData.components['items:item']).toBeDefined();
      expect(rapierData.components['items:portable']).toBeDefined();
    });
  });

  describe('Vespera Main-Gauche', () => {
    it('should have anatomy:requires_grabbing component', () => {
      expect(
        mainGaucheData.components['anatomy:requires_grabbing']
      ).toBeDefined();
    });

    it('should require 1 hand to wield (parrying dagger)', () => {
      expect(
        mainGaucheData.components['anatomy:requires_grabbing'].handsRequired
      ).toBe(1);
    });

    it('should retain weapon component', () => {
      expect(mainGaucheData.components['weapons:weapon']).toBeDefined();
    });

    it('should retain item components', () => {
      expect(mainGaucheData.components['items:item']).toBeDefined();
      expect(mainGaucheData.components['items:portable']).toBeDefined();
    });
  });

  describe('Threadscar Melissa Longsword', () => {
    it('should have anatomy:requires_grabbing component', () => {
      expect(
        longswordData.components['anatomy:requires_grabbing']
      ).toBeDefined();
    });

    it('should require 2 hands to wield (two-handed weapon)', () => {
      expect(
        longswordData.components['anatomy:requires_grabbing'].handsRequired
      ).toBe(2);
    });

    it('should retain weapon component', () => {
      expect(longswordData.components['weapons:weapon']).toBeDefined();
    });

    it('should retain item components', () => {
      expect(longswordData.components['items:item']).toBeDefined();
      expect(longswordData.components['items:portable']).toBeDefined();
    });
  });

  describe('Hand Requirement Consistency', () => {
    it('should have one-handed weapons requiring 1 hand', () => {
      const oneHandedWeapons = [rapierData, mainGaucheData];
      for (const weapon of oneHandedWeapons) {
        expect(
          weapon.components['anatomy:requires_grabbing'].handsRequired
        ).toBe(1);
      }
    });

    it('should have two-handed weapons requiring 2 hands', () => {
      expect(
        longswordData.components['anatomy:requires_grabbing'].handsRequired
      ).toBe(2);
    });

    it('should not have minGripStrength set (optional field)', () => {
      expect(
        rapierData.components['anatomy:requires_grabbing'].minGripStrength
      ).toBeUndefined();
      expect(
        mainGaucheData.components['anatomy:requires_grabbing'].minGripStrength
      ).toBeUndefined();
      expect(
        longswordData.components['anatomy:requires_grabbing'].minGripStrength
      ).toBeUndefined();
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
});
