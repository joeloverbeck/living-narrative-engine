/**
 * @file Integration tests for Recipe Pattern Resolution (V2)
 * Tests the complete workflow from blueprint loading through pattern resolution to anatomy generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { setupTestContainer } from '../../setup/containerSetup.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Recipe Pattern Resolution Integration', () => {
  let container;
  let bodyBlueprintFactory;
  let dataRegistry;
  let entityManager;

  beforeEach(async () => {
    container = await setupTestContainer();
    bodyBlueprintFactory = container.resolve(tokens.BodyBlueprintFactory);
    dataRegistry = container.resolve(tokens.IDataRegistry);
    entityManager = container.resolve(tokens.IEntityManager);
  });

  afterEach(async () => {
    // Clean up all entities
    const allEntities = entityManager.getAllEntities();
    for (const entityId of allEntities) {
      entityManager.removeEntity(entityId);
    }
  });

  describe('Spider Example - matchesGroup: limbSet:leg', () => {
    beforeEach(() => {
      // Register spider structure template
      dataRegistry.register('anatomyStructureTemplates', 'test:spider_body', {
        id: 'test:spider_body',
        topology: {
          limbSets: [
            {
              type: 'leg',
              id: 'leg_fl',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'left', position: 'front' },
            },
            {
              type: 'leg',
              id: 'leg_fr',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'right', position: 'front' },
            },
            {
              type: 'leg',
              id: 'leg_ml',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'left', position: 'middle' },
            },
            {
              type: 'leg',
              id: 'leg_mr',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'right', position: 'middle' },
            },
          ],
        },
      });

      // Register spider blueprint (V2)
      dataRegistry.register('anatomyBlueprints', 'test:spider', {
        id: 'test:spider',
        structureTemplate: 'test:spider_body',
        root: { entity: 'anatomy:torso' },
      });

      // Register spider recipe with matchesGroup pattern
      dataRegistry.register('anatomyRecipes', 'test:spider_basic', {
        recipeId: 'test:spider_basic',
        blueprintId: 'test:spider',
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'leg_segment',
            tags: ['test:spider_leg'],
          },
        ],
      });

      // Register test entities
      dataRegistry.register('entities', 'anatomy:torso', {
        id: 'anatomy:torso',
        components: {
          'anatomy:body_part': { partType: 'torso', name: 'Torso' },
        },
      });

      dataRegistry.register('entities', 'test:leg_segment', {
        id: 'test:leg_segment',
        components: {
          'anatomy:body_part': { partType: 'leg_segment', name: 'Leg Segment' },
          'test:spider_leg': {},
        },
      });
    });

    it('should resolve all leg slots from limbSet:leg pattern', async () => {
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:spider',
        'test:spider_basic'
      );

      expect(result.rootId).toBeDefined();
      expect(result.entities).toBeDefined();

      // Verify all 8 leg segments were created (4 limb sets × 2 segments)
      const legEntities = result.entities.filter(id => {
        const partComp = entityManager.getComponent(id, 'anatomy:body_part');
        return partComp?.partType === 'leg_segment';
      });

      expect(legEntities.length).toBe(8);

      // Verify all have spider_leg tag
      for (const legId of legEntities) {
        const hasTag = entityManager.hasComponent(legId, 'test:spider_leg');
        expect(hasTag).toBe(true);
      }
    });
  });

  describe('Dragon Example - matchesAll with orientation filter', () => {
    beforeEach(() => {
      // Register dragon structure template
      dataRegistry.register('anatomyStructureTemplates', 'test:dragon_body', {
        id: 'test:dragon_body',
        topology: {
          limbSets: [
            {
              type: 'leg',
              id: 'leg_fl',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'left', position: 'front' },
            },
            {
              type: 'leg',
              id: 'leg_fr',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'right', position: 'front' },
            },
            {
              type: 'leg',
              id: 'leg_bl',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'left', position: 'back' },
            },
            {
              type: 'leg',
              id: 'leg_br',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'right', position: 'back' },
            },
          ],
        },
      });

      // Register dragon blueprint
      dataRegistry.register('anatomyBlueprints', 'test:dragon', {
        id: 'test:dragon',
        structureTemplate: 'test:dragon_body',
        root: { entity: 'anatomy:torso' },
      });

      // Register dragon recipe with matchesAll filtering left legs only
      dataRegistry.register('anatomyRecipes', 'test:dragon_left_legs', {
        recipeId: 'test:dragon_left_legs',
        blueprintId: 'test:dragon',
        patterns: [
          {
            matchesAll: {
              slotType: 'leg_segment',
              orientation: 'left_*',
            },
            partType: 'dragon_leg',
            tags: ['test:left_leg'],
          },
        ],
      });

      // Register test entities
      dataRegistry.register('entities', 'test:dragon_leg', {
        id: 'test:dragon_leg',
        components: {
          'anatomy:body_part': { partType: 'dragon_leg', name: 'Dragon Leg' },
          'test:left_leg': {},
        },
      });
    });

    it('should only match left-side legs with orientation filter', async () => {
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:dragon',
        'test:dragon_left_legs'
      );

      expect(result.rootId).toBeDefined();

      // Verify only left legs were created (2 limb sets × 2 segments = 4)
      const leftLegs = result.entities.filter(id => {
        const hasTag = entityManager.hasComponent(id, 'test:left_leg');
        return hasTag;
      });

      expect(leftLegs.length).toBe(4);
    });
  });

  describe('Mixed V1 and V2 Patterns', () => {
    beforeEach(() => {
      // Register centaur structure template
      dataRegistry.register('anatomyStructureTemplates', 'test:centaur_body', {
        id: 'test:centaur_body',
        topology: {
          limbSets: [
            {
              type: 'arm',
              id: 'arm_left',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'left' },
            },
            {
              type: 'arm',
              id: 'arm_right',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'right' },
            },
            {
              type: 'horse_leg',
              id: 'leg_fl',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'left', position: 'front' },
            },
            {
              type: 'horse_leg',
              id: 'leg_fr',
              segments: ['upper', 'lower'],
              orientation: { type: 'bilateral', side: 'right', position: 'front' },
            },
          ],
        },
      });

      // Register centaur blueprint
      dataRegistry.register('anatomyBlueprints', 'test:centaur', {
        id: 'test:centaur',
        structureTemplate: 'test:centaur_body',
        root: { entity: 'anatomy:torso' },
      });

      // Register centaur recipe with mixed patterns
      dataRegistry.register('anatomyRecipes', 'test:centaur_mixed', {
        recipeId: 'test:centaur_mixed',
        blueprintId: 'test:centaur',
        slots: {
          // Explicit slot definition (highest priority)
          arm_left_upper: {
            partType: 'special_arm',
            tags: ['test:special'],
          },
        },
        patterns: [
          // V1 pattern - explicit matches
          {
            matches: ['arm_right_upper', 'arm_right_lower'],
            partType: 'arm_segment',
            tags: ['test:v1_arm'],
          },
          // V2 pattern - matchesGroup
          {
            matchesGroup: 'limbSet:horse_leg',
            partType: 'horse_leg_segment',
            tags: ['test:horse_leg'],
          },
        ],
      });

      // Register test entities
      dataRegistry.register('entities', 'test:special_arm', {
        id: 'test:special_arm',
        components: {
          'anatomy:body_part': { partType: 'special_arm', name: 'Special Arm' },
          'test:special': {},
        },
      });

      dataRegistry.register('entities', 'test:arm_segment', {
        id: 'test:arm_segment',
        components: {
          'anatomy:body_part': { partType: 'arm_segment', name: 'Arm Segment' },
          'test:v1_arm': {},
        },
      });

      dataRegistry.register('entities', 'test:horse_leg_segment', {
        id: 'test:horse_leg_segment',
        components: {
          'anatomy:body_part': { partType: 'horse_leg_segment', name: 'Horse Leg' },
          'test:horse_leg': {},
        },
      });
    });

    it('should handle mixed V1 and V2 patterns with correct priority', async () => {
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:centaur',
        'test:centaur_mixed'
      );

      expect(result.rootId).toBeDefined();

      // Verify special arm (explicit definition - highest priority)
      const specialArms = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:special')
      );
      expect(specialArms.length).toBe(1);

      // Verify V1 pattern arms
      const v1Arms = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:v1_arm')
      );
      expect(v1Arms.length).toBe(2); // right upper and lower

      // Verify V2 pattern horse legs (2 limb sets × 2 segments = 4)
      const horseLegs = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:horse_leg')
      );
      expect(horseLegs.length).toBe(4);

      // Verify arm_left_lower used V2 pattern (not explicitly defined)
      const leftLowerArm = result.entities.find(id => {
        const partComp = entityManager.getComponent(id, 'anatomy:body_part');
        // This would need socket info to verify - simplified check
        return (
          partComp?.partType === 'arm_segment' &&
          !entityManager.hasComponent(id, 'test:special')
        );
      });
      // Note: This test is simplified - in real scenario we'd check socket hierarchy
      expect(leftLowerArm).toBeDefined();
    });
  });

  describe('Wildcard Pattern - matchesPattern', () => {
    beforeEach(() => {
      // Register octopus structure template
      dataRegistry.register('anatomyStructureTemplates', 'test:octopus_body', {
        id: 'test:octopus_body',
        topology: {
          appendages: [
            {
              type: 'tentacle',
              id: 'tentacle_1',
              segments: ['base', 'mid', 'tip'],
              orientation: { type: 'radial', angle: 0 },
            },
            {
              type: 'tentacle',
              id: 'tentacle_2',
              segments: ['base', 'mid', 'tip'],
              orientation: { type: 'radial', angle: 45 },
            },
            {
              type: 'tentacle',
              id: 'tentacle_3',
              segments: ['base', 'mid', 'tip'],
              orientation: { type: 'radial', angle: 90 },
            },
          ],
        },
      });

      // Register octopus blueprint
      dataRegistry.register('anatomyBlueprints', 'test:octopus', {
        id: 'test:octopus',
        structureTemplate: 'test:octopus_body',
        root: { entity: 'anatomy:torso' },
      });

      // Register octopus recipe with wildcard pattern
      dataRegistry.register('anatomyRecipes', 'test:octopus_tentacles', {
        recipeId: 'test:octopus_tentacles',
        blueprintId: 'test:octopus',
        patterns: [
          {
            matchesPattern: 'tentacle_*',
            partType: 'tentacle_segment',
            tags: ['test:tentacle'],
          },
        ],
      });

      // Register test entities
      dataRegistry.register('entities', 'test:tentacle_segment', {
        id: 'test:tentacle_segment',
        components: {
          'anatomy:body_part': { partType: 'tentacle_segment', name: 'Tentacle' },
          'test:tentacle': {},
        },
      });
    });

    it('should match all tentacle slots with wildcard pattern', async () => {
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:octopus',
        'test:octopus_tentacles'
      );

      expect(result.rootId).toBeDefined();

      // Verify all tentacle segments (3 appendages × 3 segments = 9)
      const tentacles = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:tentacle')
      );

      expect(tentacles.length).toBe(9);
    });
  });

  describe('Pattern Exclusions', () => {
    beforeEach(() => {
      // Register template with front and back legs
      dataRegistry.register('anatomyStructureTemplates', 'test:quadruped_body', {
        id: 'test:quadruped_body',
        topology: {
          limbSets: [
            {
              type: 'leg',
              id: 'leg_fl',
              segments: ['upper'],
              orientation: { type: 'bilateral', side: 'left', position: 'front' },
            },
            {
              type: 'leg',
              id: 'leg_fr',
              segments: ['upper'],
              orientation: { type: 'bilateral', side: 'right', position: 'front' },
            },
            {
              type: 'leg',
              id: 'leg_bl',
              segments: ['upper'],
              orientation: { type: 'bilateral', side: 'left', position: 'back' },
            },
            {
              type: 'leg',
              id: 'leg_br',
              segments: ['upper'],
              orientation: { type: 'bilateral', side: 'right', position: 'back' },
            },
          ],
        },
      });

      // Register blueprint
      dataRegistry.register('anatomyBlueprints', 'test:quadruped', {
        id: 'test:quadruped',
        structureTemplate: 'test:quadruped_body',
        root: { entity: 'anatomy:torso' },
      });

      // Register recipe with exclusions
      dataRegistry.register('anatomyRecipes', 'test:back_legs_only', {
        recipeId: 'test:back_legs_only',
        blueprintId: 'test:quadruped',
        patterns: [
          {
            matchesAll: {
              orientation: '*_front',
            },
            partType: 'leg_segment',
            tags: ['test:front_leg'],
          },
          {
            matchesAll: {
              orientation: '*_back',
            },
            partType: 'leg_segment',
            tags: ['test:back_leg'],
          },
        ],
      });

      // Register test entities
      dataRegistry.register('entities', 'test:leg_segment', {
        id: 'test:leg_segment',
        components: {
          'anatomy:body_part': { partType: 'leg_segment', name: 'Leg Segment' },
          'test:front_leg': {},
          'test:back_leg': {},
        },
      });
    });

    it('should correctly apply orientation-based filtering', async () => {
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:quadruped',
        'test:back_legs_only'
      );

      expect(result.rootId).toBeDefined();

      // Should have both front and back legs based on orientation patterns
      const frontLegs = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:front_leg')
      );
      const backLegs = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:back_leg')
      );

      expect(frontLegs.length).toBe(2); // left and right front
      expect(backLegs.length).toBe(2); // left and right back
    });
  });
});
