/**
 * @file Tests for human futa anatomy blueprint
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Human Futa Blueprint', () => {
  let blueprint;
  let torsoEntity;
  let recipe;

  beforeEach(() => {
    // Load the blueprint
    const blueprintPath = path.join(
      process.cwd(),
      'data/mods/anatomy/blueprints/human_futa.blueprint.json'
    );
    blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

    // Load the torso entity
    const torsoPath = path.join(
      process.cwd(),
      'data/mods/anatomy/entities/definitions/human_futa_torso.entity.json'
    );
    torsoEntity = JSON.parse(fs.readFileSync(torsoPath, 'utf8'));

    // Load the recipe
    const recipePath = path.join(
      process.cwd(),
      'data/mods/anatomy/recipes/human_futa.recipe.json'
    );
    recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
  });

  describe('Blueprint Structure', () => {
    it('should have correct id and root', () => {
      expect(blueprint.id).toBe('anatomy:human_futa');
      expect(blueprint.root).toBe('anatomy:human_futa_torso');
    });

    it('should compose from humanoid_core', () => {
      expect(blueprint.compose).toBeDefined();
      expect(blueprint.compose[0].part).toBe('anatomy:humanoid_core');
      expect(blueprint.compose[0].include).toContain('slots');
      expect(blueprint.compose[0].include).toContain('clothingSlotMappings');
    });

    it('should define breast slots from female anatomy', () => {
      expect(blueprint.slots.left_breast).toBeDefined();
      expect(blueprint.slots.left_breast.socket).toBe('left_chest');
      expect(blueprint.slots.left_breast.requirements.partType).toBe('breast');

      expect(blueprint.slots.right_breast).toBeDefined();
      expect(blueprint.slots.right_breast.socket).toBe('right_chest');
      expect(blueprint.slots.right_breast.requirements.partType).toBe('breast');
    });

    it('should define genital slots from male anatomy', () => {
      expect(blueprint.slots.penis).toBeDefined();
      expect(blueprint.slots.penis.socket).toBe('penis');
      expect(blueprint.slots.penis.requirements.partType).toBe('penis');

      expect(blueprint.slots.left_testicle).toBeDefined();
      expect(blueprint.slots.left_testicle.socket).toBe('left_testicle');
      expect(blueprint.slots.left_testicle.requirements.partType).toBe(
        'testicle'
      );

      expect(blueprint.slots.right_testicle).toBeDefined();
      expect(blueprint.slots.right_testicle.socket).toBe('right_testicle');
      expect(blueprint.slots.right_testicle.requirements.partType).toBe(
        'testicle'
      );
    });
  });

  describe('Clothing Slot Mappings', () => {
    it('should define torso_upper with breast coverage (female-style)', () => {
      const torsoUpper = blueprint.clothingSlotMappings.torso_upper;
      expect(torsoUpper).toBeDefined();
      expect(torsoUpper.anatomySockets).toContain('left_chest');
      expect(torsoUpper.anatomySockets).toContain('right_chest');
      expect(torsoUpper.anatomySockets).toContain('left_shoulder');
      expect(torsoUpper.anatomySockets).toContain('right_shoulder');
      expect(torsoUpper.allowedLayers).toContain('underwear');
      expect(torsoUpper.allowedLayers).toContain('base');
      expect(torsoUpper.allowedLayers).toContain('outer');
      expect(torsoUpper.allowedLayers).toContain('armor');
    });

    it('should define torso_lower with male genital coverage', () => {
      const torsoLower = blueprint.clothingSlotMappings.torso_lower;
      expect(torsoLower).toBeDefined();
      expect(torsoLower.anatomySockets).toContain('penis');
      expect(torsoLower.anatomySockets).toContain('left_testicle');
      expect(torsoLower.anatomySockets).toContain('right_testicle');
      expect(torsoLower.anatomySockets).toContain('left_hip');
      expect(torsoLower.anatomySockets).toContain('right_hip');
      expect(torsoLower.allowedLayers).toContain('underwear');
      expect(torsoLower.allowedLayers).toContain('base');
    });

    it('should include breasts in full_body coverage', () => {
      const fullBody = blueprint.clothingSlotMappings.full_body;
      expect(fullBody).toBeDefined();
      expect(fullBody.blueprintSlots).toContain('left_breast');
      expect(fullBody.blueprintSlots).toContain('right_breast');
      expect(fullBody.blueprintSlots).toContain('head');
      expect(fullBody.blueprintSlots).toContain('left_arm');
      expect(fullBody.blueprintSlots).toContain('right_arm');
    });
  });

  describe('Torso Entity', () => {
    it('should have correct id and description', () => {
      expect(torsoEntity.id).toBe('anatomy:human_futa_torso');
      expect(torsoEntity.description).toContain('futanari');
      expect(torsoEntity.description).toContain('breasts');
      expect(torsoEntity.description).toContain('male genitalia');
    });

    it('should have torso part component', () => {
      expect(torsoEntity.components['anatomy:part']).toBeDefined();
      expect(torsoEntity.components['anatomy:part'].subType).toBe('torso');
    });

    it('should have breast sockets from female anatomy', () => {
      const sockets = torsoEntity.components['anatomy:sockets'].sockets;

      const leftChest = sockets.find((s) => s.id === 'left_chest');
      expect(leftChest).toBeDefined();
      expect(leftChest.allowedTypes).toContain('breast');

      const rightChest = sockets.find((s) => s.id === 'right_chest');
      expect(rightChest).toBeDefined();
      expect(rightChest.allowedTypes).toContain('breast');
    });

    it('should have genital sockets from male anatomy', () => {
      const sockets = torsoEntity.components['anatomy:sockets'].sockets;

      const penis = sockets.find((s) => s.id === 'penis');
      expect(penis).toBeDefined();
      expect(penis.allowedTypes).toContain('penis');

      const leftTesticle = sockets.find((s) => s.id === 'left_testicle');
      expect(leftTesticle).toBeDefined();
      expect(leftTesticle.allowedTypes).toContain('testicle');

      const rightTesticle = sockets.find((s) => s.id === 'right_testicle');
      expect(rightTesticle).toBeDefined();
      expect(rightTesticle.allowedTypes).toContain('testicle');
    });

    it('should have standard humanoid sockets', () => {
      const sockets = torsoEntity.components['anatomy:sockets'].sockets;

      expect(sockets.find((s) => s.id === 'neck')).toBeDefined();
      expect(sockets.find((s) => s.id === 'left_shoulder')).toBeDefined();
      expect(sockets.find((s) => s.id === 'right_shoulder')).toBeDefined();
      expect(sockets.find((s) => s.id === 'left_hip')).toBeDefined();
      expect(sockets.find((s) => s.id === 'right_hip')).toBeDefined();
      expect(sockets.find((s) => s.id === 'asshole')).toBeDefined();
    });
  });

  describe('Recipe', () => {
    it('should reference the correct blueprint', () => {
      expect(recipe.recipeId).toBe('anatomy:human_futa');
      expect(recipe.blueprintId).toBe('anatomy:human_futa');
    });

    it('should specify the futa torso', () => {
      expect(recipe.slots.torso).toBeDefined();
      expect(recipe.slots.torso.partType).toBe('torso');
      expect(recipe.slots.torso.preferId).toBe('anatomy:human_futa_torso');
    });

    it('should have patterns for breasts', () => {
      const breastPattern = recipe.patterns.find(
        (p) => p.matches && p.matches.includes('left_breast')
      );
      expect(breastPattern).toBeDefined();
      expect(breastPattern.matches).toContain('left_breast');
      expect(breastPattern.matches).toContain('right_breast');
      expect(breastPattern.partType).toBe('breast');
    });

    it('should have patterns for testicles', () => {
      const testiclePattern = recipe.patterns.find(
        (p) => p.matches && p.matches.includes('left_testicle')
      );
      expect(testiclePattern).toBeDefined();
      expect(testiclePattern.matches).toContain('left_testicle');
      expect(testiclePattern.matches).toContain('right_testicle');
      expect(testiclePattern.partType).toBe('testicle');
    });

    it('should have standard humanoid patterns', () => {
      const armPattern = recipe.patterns.find(
        (p) => p.matches && p.matches.includes('left_arm')
      );
      expect(armPattern).toBeDefined();
      expect(armPattern.partType).toBe('arm');

      const legPattern = recipe.patterns.find(
        (p) => p.matches && p.matches.includes('left_leg')
      );
      expect(legPattern).toBeDefined();
      expect(legPattern.partType).toBe('leg');
    });
  });
});
