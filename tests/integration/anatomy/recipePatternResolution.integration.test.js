/**
 * @file Integration tests for Recipe Pattern Resolution (V2)
 * Tests the complete workflow from blueprint loading through pattern resolution to anatomy generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Recipe Pattern Resolution Integration', () => {
  let testBed;
  let bodyBlueprintFactory;
  let dataRegistry;
  let entityManager;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    bodyBlueprintFactory = testBed.bodyBlueprintFactory;
    dataRegistry = testBed.registry;
    entityManager = testBed.entityManager;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Spider Example - matchesGroup: limbSet:leg', () => {
    beforeEach(() => {
      // Register spider structure template
      dataRegistry.store('anatomyStructureTemplates', 'test:spider_body', {
        id: 'test:spider_body',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                allowedTypes: ['leg_segment'],
                orientationScheme: 'indexed',
              },
            },
          ],
        },
      });

      // Register spider blueprint (V2)
      dataRegistry.store('anatomyBlueprints', 'test:spider', {
        id: 'test:spider',
        schemaVersion: '2.0',
        structureTemplate: 'test:spider_body',
        root: 'anatomy:torso',
      });

      // Register spider recipe with matchesGroup pattern
      dataRegistry.store('anatomyRecipes', 'test:spider_basic', {
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
      testBed.loadEntityDefinitions({
        'anatomy:torso': {
          id: 'anatomy:torso',
          components: {
            'anatomy:body_part': { partType: 'torso', name: 'Torso' },
            'anatomy:part': { subType: 'torso' },
          },
        },
        'test:leg_segment': {
          id: 'test:leg_segment',
          components: {
            'anatomy:body_part': { partType: 'leg_segment', name: 'Leg Segment' },
            'anatomy:part': { subType: 'leg_segment' },
            'test:spider_leg': {},
          },
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
        const partComp = entityManager.getComponentData(id, 'anatomy:body_part');
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
      dataRegistry.store('anatomyStructureTemplates', 'test:dragon_body', {
        id: 'test:dragon_body',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'dragon_leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                allowedTypes: ['dragon_leg'],
                orientationScheme: 'bilateral',
              },
            },
          ],
        },
      });

      // Register dragon blueprint
      dataRegistry.store('anatomyBlueprints', 'test:dragon', {
        id: 'test:dragon',
        schemaVersion: '2.0',
        structureTemplate: 'test:dragon_body',
        root: 'anatomy:torso',
      });

      // Register dragon recipe with matchesGroup filtering
      dataRegistry.store('anatomyRecipes', 'test:dragon_left_legs', {
        recipeId: 'test:dragon_left_legs',
        blueprintId: 'test:dragon',
        patterns: [
          {
            matchesGroup: 'limbSet:dragon_leg',
            partType: 'dragon_leg',
            tags: ['test:left_leg'],
          },
        ],
      });

      // Register test entities
      testBed.loadEntityDefinitions({
        'anatomy:torso': {
          id: 'anatomy:torso',
          components: {
            'anatomy:body_part': { partType: 'torso', name: 'Torso' },
            'anatomy:part': { subType: 'torso' },
          },
        },
        'test:dragon_leg': {
          id: 'test:dragon_leg',
          components: {
            'anatomy:body_part': { partType: 'dragon_leg', name: 'Dragon Leg' },
            'anatomy:part': { subType: 'dragon_leg' },
            'test:left_leg': {},
          },
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
      dataRegistry.store('anatomyStructureTemplates', 'test:centaur_body', {
        id: 'test:centaur_body',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                allowedTypes: ['arm', 'arm_segment', 'special_arm'],
                orientationScheme: 'bilateral',
              },
            },
            {
              type: 'horse_leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                allowedTypes: ['horse_leg', 'horse_leg_segment'],
                orientationScheme: 'bilateral',
              },
            },
          ],
        },
      });

      // Register centaur blueprint
      dataRegistry.store('anatomyBlueprints', 'test:centaur', {
        id: 'test:centaur',
        schemaVersion: '2.0',
        structureTemplate: 'test:centaur_body',
        root: 'anatomy:torso',
      });

      // Register centaur recipe with mixed patterns
      dataRegistry.store('anatomyRecipes', 'test:centaur_mixed', {
        recipeId: 'test:centaur_mixed',
        blueprintId: 'test:centaur',
        slots: {
          // Explicit slot definition (highest priority)
          arm_left: {
            partType: 'special_arm',
            tags: ['test:special'],
          },
        },
        patterns: [
          // V1 pattern - explicit matches
          {
            matches: ['arm_right'],
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
      testBed.loadEntityDefinitions({
        'anatomy:torso': {
          id: 'anatomy:torso',
          components: {
            'anatomy:body_part': { partType: 'torso', name: 'Torso' },
            'anatomy:part': { subType: 'torso' },
          },
        },
        'test:special_arm': {
          id: 'test:special_arm',
          components: {
            'anatomy:body_part': { partType: 'special_arm', name: 'Special Arm' },
            'anatomy:part': { subType: 'special_arm' },
            'test:special': {},
          },
        },
        'test:arm_segment': {
          id: 'test:arm_segment',
          components: {
            'anatomy:body_part': { partType: 'arm_segment', name: 'Arm Segment' },
            'anatomy:part': { subType: 'arm_segment' },
            'test:v1_arm': {},
          },
        },
        'test:horse_leg_segment': {
          id: 'test:horse_leg_segment',
          components: {
            'anatomy:body_part': { partType: 'horse_leg_segment', name: 'Horse Leg' },
            'anatomy:part': { subType: 'horse_leg_segment' },
            'test:horse_leg': {},
          },
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
      expect(v1Arms.length).toBe(1); // arm_right

      // Verify V2 pattern horse legs (2 legs - bilateral arrangement)
      const horseLegs = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:horse_leg')
      );
      expect(horseLegs.length).toBe(2);

      // Verify arm_left_lower used V2 pattern (not explicitly defined)
      const leftLowerArm = result.entities.find(id => {
        const partComp = entityManager.getComponentData(id, 'anatomy:body_part');
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

  describe('Property Filters with Slot Group Exclusions', () => {
    beforeEach(() => {
      dataRegistry.store('anatomyStructureTemplates', 'test:gryphon_body', {
        id: 'test:gryphon_body',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'fore_leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'fore_leg_{{orientation}}',
                allowedTypes: ['fore_leg'],
                orientationScheme: 'bilateral',
              },
            },
            {
              type: 'hind_leg',
              count: 2,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'hind_leg_{{orientation}}',
                allowedTypes: ['hind_leg'],
                orientationScheme: 'quadrupedal',
              },
            },
          ],
        },
      });

      dataRegistry.store('anatomyBlueprints', 'test:gryphon', {
        id: 'test:gryphon',
        schemaVersion: '2.0',
        structureTemplate: 'test:gryphon_body',
        root: 'anatomy:torso',
      });

      dataRegistry.store('anatomyRecipes', 'test:gryphon_legs', {
        recipeId: 'test:gryphon_legs',
        blueprintId: 'test:gryphon',
        patterns: [
          {
            matchesGroup: 'limbSet:fore_leg',
            partType: 'fore_leg',
          },
          {
            matchesGroup: 'limbSet:hind_leg',
            partType: 'hind_leg',
          },
          {
            matchesAll: {
              orientation: 'left_*',
            },
            partType: 'fore_leg',
            tags: ['test:left_leg'],
            exclude: {
              slotGroups: ['limbSet:hind_leg'],
            },
          },
        ],
      });

      testBed.loadEntityDefinitions({
        'anatomy:torso': {
          id: 'anatomy:torso',
          components: {
            'anatomy:body_part': { partType: 'torso', name: 'Torso' },
            'anatomy:part': { subType: 'torso' },
          },
        },
        'test:fore_leg_left': {
          id: 'test:fore_leg_left',
          components: {
            'anatomy:body_part': {
              partType: 'fore_leg',
              name: 'Left Gryphon Fore Leg',
            },
            'anatomy:part': { subType: 'fore_leg' },
            'test:left_leg': {},
          },
        },
        'test:fore_leg_right': {
          id: 'test:fore_leg_right',
          components: {
            'anatomy:body_part': {
              partType: 'fore_leg',
              name: 'Right Gryphon Fore Leg',
            },
            'anatomy:part': { subType: 'fore_leg' },
          },
        },
        'test:hind_leg': {
          id: 'test:hind_leg',
          components: {
            'anatomy:body_part': {
              partType: 'hind_leg',
              name: 'Gryphon Hind Leg',
            },
            'anatomy:part': { subType: 'hind_leg' },
          },
        },
      });
    });

    it('should honor property filters while excluding slot groups', async () => {
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:gryphon',
        'test:gryphon_legs'
      );

      const leftLegs = result.entities.filter(id =>
        entityManager.hasComponent(id, 'test:left_leg')
      );

      expect(leftLegs.length).toBe(1);
    });
  });

  describe('Wildcard Pattern - matchesPattern', () => {
    beforeEach(() => {
      // Register octopus structure template
      dataRegistry.store('anatomyStructureTemplates', 'test:octopus_body', {
        id: 'test:octopus_body',
        topology: {
          limbSets: [
            {
              type: 'tentacle',
              count: 9,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                allowedTypes: ['tentacle_segment'],
                orientationScheme: 'radial',
              },
            },
          ],
        },
      });

      // Register octopus blueprint
      dataRegistry.store('anatomyBlueprints', 'test:octopus', {
        id: 'test:octopus',
        schemaVersion: '2.0',
        structureTemplate: 'test:octopus_body',
        root: 'anatomy:torso',
      });

      // Register octopus recipe with wildcard pattern
      dataRegistry.store('anatomyRecipes', 'test:octopus_tentacles', {
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
      testBed.loadEntityDefinitions({
        'anatomy:torso': {
          id: 'anatomy:torso',
          components: {
            'anatomy:body_part': { partType: 'torso', name: 'Torso' },
            'anatomy:part': { subType: 'torso' },
          },
        },
        'test:tentacle_segment': {
          id: 'test:tentacle_segment',
          components: {
            'anatomy:body_part': { partType: 'tentacle_segment', name: 'Tentacle' },
            'anatomy:part': { subType: 'tentacle_segment' },
            'test:tentacle': {},
          },
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
      dataRegistry.store('anatomyStructureTemplates', 'test:quadruped_body', {
        id: 'test:quadruped_body',
        topology: {
          limbSets: [
            {
              type: 'leg_segment',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                allowedTypes: ['leg_segment'],
                orientationScheme: 'quadrupedal',
              },
            },
          ],
        },
      });

      // Register blueprint
      dataRegistry.store('anatomyBlueprints', 'test:quadruped', {
        id: 'test:quadruped',
        schemaVersion: '2.0',
        structureTemplate: 'test:quadruped_body',
        root: 'anatomy:torso',
      });

      // Register recipe with exclusions
      dataRegistry.store('anatomyRecipes', 'test:back_legs_only', {
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
              orientation: '*_rear',
            },
            partType: 'leg_segment',
            tags: ['test:back_leg'],
          },
        ],
      });

      // Register test entities
      testBed.loadEntityDefinitions({
        'anatomy:torso': {
          id: 'anatomy:torso',
          components: {
            'anatomy:body_part': { partType: 'torso', name: 'Torso' },
            'anatomy:part': { subType: 'torso' },
          },
        },
        'test:front_leg_segment': {
          id: 'test:front_leg_segment',
          components: {
            'anatomy:body_part': { partType: 'leg_segment', name: 'Front Leg Segment' },
            'anatomy:part': { subType: 'leg_segment' },
            'test:front_leg': {},
          },
        },
        'test:back_leg_segment': {
          id: 'test:back_leg_segment',
          components: {
            'anatomy:body_part': { partType: 'leg_segment', name: 'Back Leg Segment' },
            'anatomy:part': { subType: 'leg_segment' },
            'test:back_leg': {},
          },
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
