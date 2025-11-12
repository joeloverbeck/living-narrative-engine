import { describe, it, expect, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { resolve } from 'path';

describe('Belt Entities - Blocking Component', () => {
  let blackBelt;
  let brownBelt;
  let tacticalBelt;

  beforeEach(async () => {
    // Load belt entity definitions from files
    const blackBeltPath = resolve(
      'data/mods/clothing/entities/definitions/black_calfskin_belt.entity.json'
    );
    const brownBeltPath = resolve(
      'data/mods/clothing/entities/definitions/dark_brown_leather_belt.entity.json'
    );
    const tacticalBeltPath = resolve(
      'data/mods/clothing/entities/definitions/black_tactical_work_belt.entity.json'
    );

    blackBelt = JSON.parse(await fs.readFile(blackBeltPath, 'utf-8'));
    brownBelt = JSON.parse(await fs.readFile(brownBeltPath, 'utf-8'));
    tacticalBelt = JSON.parse(await fs.readFile(tacticalBeltPath, 'utf-8'));
  });

  describe('Black Calfskin Belt', () => {
    it('should have blocking component defined', () => {
      expect(blackBelt.components['clothing:blocks_removal']).toBeDefined();
    });

    it('should block legs slot with base and outer layers', () => {
      const blocking = blackBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots).toHaveLength(1);
      expect(blocking.blockedSlots[0].slot).toBe('legs');
      expect(blocking.blockedSlots[0].layers).toContain('base');
      expect(blocking.blockedSlots[0].layers).toContain('outer');
    });

    it('should use must_remove_first block type', () => {
      const blocking = blackBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
    });

    it('should have descriptive reason', () => {
      const blocking = blackBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].reason).toBe(
        'Belt secures pants at waist'
      );
    });
  });

  describe('Dark Brown Leather Belt', () => {
    it('should have blocking component defined', () => {
      expect(brownBelt.components['clothing:blocks_removal']).toBeDefined();
    });

    it('should block legs slot with base and outer layers', () => {
      const blocking = brownBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots).toHaveLength(1);
      expect(blocking.blockedSlots[0].slot).toBe('legs');
      expect(blocking.blockedSlots[0].layers).toContain('base');
      expect(blocking.blockedSlots[0].layers).toContain('outer');
    });

    it('should use must_remove_first block type', () => {
      const blocking = brownBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
    });
  });

  describe('Black Tactical Work Belt', () => {
    it('should have blocking component defined', () => {
      expect(tacticalBelt.components['clothing:blocks_removal']).toBeDefined();
    });

    it('should block legs slot with base and outer layers', () => {
      const blocking = tacticalBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots).toHaveLength(1);
      expect(blocking.blockedSlots[0].slot).toBe('legs');
      expect(blocking.blockedSlots[0].layers).toContain('base');
      expect(blocking.blockedSlots[0].layers).toContain('outer');
    });

    it('should use must_remove_first block type', () => {
      const blocking = tacticalBelt.components['clothing:blocks_removal'];
      expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
    });
  });

  describe('All Belts Consistency', () => {
    it('should all have consistent blocking configuration', () => {
      const belts = [blackBelt, brownBelt, tacticalBelt];

      for (const belt of belts) {
        const blocking = belt.components['clothing:blocks_removal'];
        expect(blocking).toBeDefined();
        expect(blocking.blockedSlots).toHaveLength(1);
        expect(blocking.blockedSlots[0].slot).toBe('legs');
        expect(blocking.blockedSlots[0].layers).toEqual(['base', 'outer']);
        expect(blocking.blockedSlots[0].blockType).toBe('must_remove_first');
      }
    });
  });
});
