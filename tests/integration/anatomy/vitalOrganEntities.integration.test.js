/**
 * @file Integration tests for vital organ entity definitions
 * @see tickets/INJREPANDUSEINT-010-vital-organ-entities.md
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const ANATOMY_ENTITIES_PATH = path.join(
  process.cwd(),
  'data/mods/anatomy/entities/definitions'
);

const TORSO_ENTITIES = [
  'human_male_torso.entity.json',
  'human_female_torso.entity.json',
];

const HEAD_ENTITY = 'humanoid_head.entity.json';

const VITAL_ORGAN_ENTITIES = [
  'human_heart.entity.json',
  'human_brain.entity.json',
  'human_spine.entity.json',
];

describe('Vital Organ Entity Definitions', () => {
  describe('organ entity files', () => {
    it.each(VITAL_ORGAN_ENTITIES)(
      'should have valid structure for %s',
      (filename) => {
        const filePath = path.join(ANATOMY_ENTITIES_PATH, filename);
        expect(fs.existsSync(filePath)).toBe(true);

        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Verify required schema
        expect(content.$schema).toBe(
          'schema://living-narrative-engine/entity-definition.schema.json'
        );

        // Verify id format
        expect(content.id).toMatch(/^anatomy:human_/);

        // Verify required components
        expect(content.components).toBeDefined();
        expect(content.components['anatomy:part']).toBeDefined();
        expect(content.components['anatomy:part_health']).toBeDefined();
        expect(content.components['anatomy:vital_organ']).toBeDefined();
        expect(content.components['core:name']).toBeDefined();

        // Verify vital organ has valid organType
        const vitalOrgan = content.components['anatomy:vital_organ'];
        expect(['brain', 'heart', 'spine']).toContain(vitalOrgan.organType);
      }
    );

    it('should have heart with correct health values', () => {
      const filePath = path.join(
        ANATOMY_ENTITIES_PATH,
        'human_heart.entity.json'
      );
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      expect(content.components['anatomy:part_health'].maxHealth).toBe(50);
      expect(content.components['anatomy:vital_organ'].organType).toBe('heart');
    });

    it('should have brain with correct health values', () => {
      const filePath = path.join(
        ANATOMY_ENTITIES_PATH,
        'human_brain.entity.json'
      );
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      expect(content.components['anatomy:part_health'].maxHealth).toBe(40);
      expect(content.components['anatomy:vital_organ'].organType).toBe('brain');
    });

    it('should have spine with correct health values', () => {
      const filePath = path.join(
        ANATOMY_ENTITIES_PATH,
        'human_spine.entity.json'
      );
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      expect(content.components['anatomy:part_health'].maxHealth).toBe(60);
      expect(content.components['anatomy:vital_organ'].organType).toBe('spine');
    });
  });

  describe('torso entity damage propagation', () => {
    it.each(TORSO_ENTITIES)('should have organ sockets in %s', (filename) => {
      const filePath = path.join(ANATOMY_ENTITIES_PATH, filename);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const sockets = content.components['anatomy:sockets'].sockets;
      const socketIds = sockets.map((s) => s.id);

      expect(socketIds).toContain('heart_socket');
      expect(socketIds).toContain('spine_socket');
    });

    it.each(TORSO_ENTITIES)(
      'should have damage propagation rules in %s',
      (filename) => {
        const filePath = path.join(ANATOMY_ENTITIES_PATH, filename);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const propagation = content.components['anatomy:damage_propagation'];
        expect(propagation).toBeDefined();
        expect(propagation.rules).toBeDefined();
        expect(propagation.rules.length).toBeGreaterThanOrEqual(2);

        const ruleSocketIds = propagation.rules.map((r) => r.childSocketId);
        expect(ruleSocketIds).toContain('heart_socket');
        expect(ruleSocketIds).toContain('spine_socket');
      }
    );

    it.each(TORSO_ENTITIES)(
      'should have valid propagation parameters in %s',
      (filename) => {
        const filePath = path.join(ANATOMY_ENTITIES_PATH, filename);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const rules = content.components['anatomy:damage_propagation'].rules;

        for (const rule of rules) {
          expect(rule.baseProbability).toBeGreaterThan(0);
          expect(rule.baseProbability).toBeLessThanOrEqual(1);
          expect(rule.damageFraction).toBeGreaterThan(0);
          expect(rule.damageFraction).toBeLessThanOrEqual(1);
          expect(rule.damageTypeModifiers).toBeDefined();
        }
      }
    );
  });

  describe('head entity damage propagation', () => {
    it('should have brain socket in humanoid head', () => {
      const filePath = path.join(ANATOMY_ENTITIES_PATH, HEAD_ENTITY);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const sockets = content.components['anatomy:sockets'].sockets;
      const socketIds = sockets.map((s) => s.id);

      expect(socketIds).toContain('brain_socket');
    });

    it('should have damage propagation for brain', () => {
      const filePath = path.join(ANATOMY_ENTITIES_PATH, HEAD_ENTITY);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const propagation = content.components['anatomy:damage_propagation'];
      expect(propagation).toBeDefined();
      expect(propagation.rules).toBeDefined();

      const brainRule = propagation.rules.find(
        (r) => r.childSocketId === 'brain_socket'
      );
      expect(brainRule).toBeDefined();
      expect(brainRule.baseProbability).toBeGreaterThan(0);
      expect(brainRule.damageFraction).toBeGreaterThan(0);
    });
  });

  describe('slot library integration', () => {
    it('should have organ slot definitions in slot library', () => {
      const libraryPath = path.join(
        process.cwd(),
        'data/mods/anatomy/libraries/humanoid.slot-library.json'
      );
      const content = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

      const slotDefs = content.slotDefinitions;

      expect(slotDefs.standard_heart).toBeDefined();
      expect(slotDefs.standard_heart.socket).toBe('heart_socket');
      expect(slotDefs.standard_heart.requirements.partType).toBe('heart');
      expect(slotDefs.standard_heart.requirements.components).toContain(
        'anatomy:vital_organ'
      );

      expect(slotDefs.standard_spine).toBeDefined();
      expect(slotDefs.standard_spine.socket).toBe('spine_socket');
      expect(slotDefs.standard_spine.requirements.partType).toBe('spine');
      expect(slotDefs.standard_spine.requirements.components).toContain(
        'anatomy:vital_organ'
      );

      expect(slotDefs.standard_brain).toBeDefined();
      expect(slotDefs.standard_brain.socket).toBe('brain_socket');
      expect(slotDefs.standard_brain.requirements.partType).toBe('brain');
      expect(slotDefs.standard_brain.requirements.components).toContain(
        'anatomy:vital_organ'
      );
    });
  });

  describe('part file integration', () => {
    it('should have organ slots defined in humanoid core part', () => {
      const partPath = path.join(
        process.cwd(),
        'data/mods/anatomy/parts/humanoid_core.part.json'
      );
      const content = JSON.parse(fs.readFileSync(partPath, 'utf8'));

      expect(content.slots.heart).toBeDefined();
      expect(content.slots.heart.$use).toBe('standard_heart');

      expect(content.slots.spine).toBeDefined();
      expect(content.slots.spine.$use).toBe('standard_spine');

      expect(content.slots.brain).toBeDefined();
      expect(content.slots.brain.$use).toBe('standard_brain');
      expect(content.slots.brain.parent).toBe('head');
    });
  });
});
