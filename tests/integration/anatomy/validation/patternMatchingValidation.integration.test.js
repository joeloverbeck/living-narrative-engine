/**
 * @file Integration tests for Pattern Matching Dry-Run Validator
 * Tests pattern matching validation with real blueprints and structure templates
 * @see src/anatomy/validation/patternMatchingValidator.js
 * @see workflows/ANASYSIMP-005-pattern-matching-dry-run.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validatePatternMatching } from '../../../../src/anatomy/validation/patternMatchingValidator.js';
import SlotGenerator from '../../../../src/anatomy/slotGenerator.js';

describe('Pattern Matching Validation - Integration Tests', () => {
  let logger;
  let dataRegistry;
  let slotGenerator;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    slotGenerator = new SlotGenerator({ logger });

    // Mock data registry with structure templates
    const templates = new Map();

    // Spider structure template (8 legs, indexed)
    templates.set('anatomy:structure_arachnid_8leg', {
      id: 'anatomy:structure_arachnid_8leg',
      description: 'Eight-legged arachnid body plan',
      topology: {
        rootType: 'cephalothorax',
        limbSets: [
          {
            type: 'leg',
            count: 8,
            arrangement: 'radial',
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              orientationScheme: 'indexed',
              allowedTypes: ['spider_leg'],
            },
          },
        ],
        appendages: [
          {
            type: 'pedipalp',
            count: 2,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'pedipalp_{{index}}',
              orientationScheme: 'indexed',
              allowedTypes: ['spider_pedipalp'],
            },
          },
          {
            type: 'torso',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'posterior_torso',
              allowedTypes: ['spider_abdomen'],
            },
          },
        ],
      },
    });

    // Dragon structure template (4 legs bilateral, 2 wings, head, tail)
    templates.set('anatomy:structure_winged_quadruped', {
      id: 'anatomy:structure_winged_quadruped',
      description: 'Winged quadruped body plan',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 4,
            arrangement: 'quadrupedal',
            socketPattern: {
              idTemplate: 'leg_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['dragon_leg'],
            },
          },
          {
            type: 'wing',
            count: 2,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'wing_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['dragon_wing'],
            },
          },
        ],
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'head',
              allowedTypes: ['dragon_head'],
            },
          },
          {
            type: 'tail',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'tail',
              allowedTypes: ['dragon_tail'],
            },
          },
        ],
      },
    });

    dataRegistry = {
      get: (type, id) => {
        if (type === 'anatomyStructureTemplates') {
          return templates.get(id);
        }
        return null;
      },
    };
  });

  describe('Real Blueprint & Structure Template Integration', () => {
    it('should validate spider recipe with matchesGroup pattern successfully', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:spider_recipe',
        blueprintId: 'anatomy-creatures:giant_spider',
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'spider_leg',
            tags: ['anatomy:part'],
          },
        ],
      };

      // Generate blueprint with structure template
      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_arachnid_8leg'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:giant_spider',
        schemaVersion: '2.0',
        root: 'anatomy-creatures:spider_cephalothorax',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toEqual([]);
    });

    it('should detect pattern with non-existent slot group', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:spider_recipe',
        blueprintId: 'anatomy-creatures:giant_spider',
        patterns: [
          {
            matchesGroup: 'limbSet:wing', // Spider has no wings!
            partType: 'wing',
            tags: ['anatomy:part'],
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_arachnid_8leg'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:giant_spider',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        type: 'NO_MATCHING_SLOTS',
        severity: 'warning',
        matcher: { type: 'matchesGroup', value: 'limbSet:wing' },
      });
      expect(warnings[0].reason).toContain('limbSet:wing');
      expect(warnings[0].fix).toContain('structure template');
    });

    it('should validate dragon recipe with multiple patterns', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:dragon_recipe',
        blueprintId: 'anatomy-creatures:red_dragon',
        patterns: [
          {
            matchesGroup: 'limbSet:leg',
            partType: 'dragon_leg',
            tags: ['anatomy:part', 'anatomy:scaled'],
          },
          {
            matchesGroup: 'limbSet:wing',
            partType: 'dragon_wing',
            tags: ['anatomy:part', 'anatomy:scaled'],
          },
          {
            matchesGroup: 'appendage:head',
            partType: 'dragon_head',
            tags: ['anatomy:part'],
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_winged_quadruped'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:red_dragon',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_winged_quadruped',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toEqual([]);
    });

    it('should detect some patterns matching and some not matching', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:dragon_recipe',
        blueprintId: 'anatomy-creatures:red_dragon',
        patterns: [
          {
            matchesGroup: 'limbSet:leg', // This exists
            partType: 'dragon_leg',
          },
          {
            matchesGroup: 'limbSet:tentacle', // This does not exist
            partType: 'tentacle',
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_winged_quadruped'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:red_dragon',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_winged_quadruped',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0].matcher.value).toBe('limbSet:tentacle');
    });
  });

  describe('matchesPattern with Generated Slots', () => {
    it('should validate matchesPattern with indexed slot keys', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:spider_recipe',
        blueprintId: 'anatomy-creatures:giant_spider',
        patterns: [
          {
            matchesPattern: 'leg_*', // Matches leg_1, leg_2, ..., leg_8
            partType: 'spider_leg',
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_arachnid_8leg'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:giant_spider',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toEqual([]);
    });

    it('should validate matchesPattern with bilateral orientation', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:dragon_recipe',
        blueprintId: 'anatomy-creatures:red_dragon',
        patterns: [
          {
            matchesPattern: 'leg_*', // Matches leg_left_front, leg_right_front, etc.
            partType: 'dragon_leg',
          },
          {
            matchesPattern: 'wing_*', // Matches wing_left, wing_right
            partType: 'dragon_wing',
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_winged_quadruped'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:red_dragon',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_winged_quadruped',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toEqual([]);
    });

    it('should detect pattern that does not match any slots', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:spider_recipe',
        blueprintId: 'anatomy-creatures:giant_spider',
        patterns: [
          {
            matchesPattern: 'tentacle_*', // Spider has no tentacles
            partType: 'tentacle',
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_arachnid_8leg'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:giant_spider',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0].matcher.value).toBe('tentacle_*');
      expect(warnings[0].availableSlots).toContain('leg_1');
    });
  });

  describe('matchesAll with Generated Slots', () => {
    it('should filter slots by slotType', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:dragon_recipe',
        blueprintId: 'anatomy-creatures:red_dragon',
        patterns: [
          {
            matchesAll: { slotType: 'leg' },
            partType: 'dragon_leg',
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_winged_quadruped'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:red_dragon',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_winged_quadruped',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toEqual([]);
    });

    it('should detect filter that matches no slots', () => {
      const recipe = {
        recipeId: 'anatomy-creatures:spider_recipe',
        blueprintId: 'anatomy-creatures:giant_spider',
        patterns: [
          {
            matchesAll: { slotType: 'tentacle' },
            partType: 'tentacle',
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_arachnid_8leg'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy-creatures:giant_spider',
        schemaVersion: '2.0',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0].matcher.value).toEqual({ slotType: 'tentacle' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle recipe with no patterns', () => {
      const recipe = {
        recipeId: 'anatomy:simple_recipe',
        blueprintId: 'anatomy:simple_blueprint',
        patterns: [],
      };

      const blueprint = {
        id: 'anatomy:simple_blueprint',
        slots: {},
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toEqual([]);
    });

    it('should handle blueprint with no slots', () => {
      const recipe = {
        recipeId: 'anatomy:test_recipe',
        blueprintId: 'anatomy:test_blueprint',
        patterns: [
          {
            matchesPattern: 'leg_*',
            partType: 'leg',
          },
        ],
      };

      const blueprint = {
        id: 'anatomy:test_blueprint',
        slots: {},
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0].availableSlots).toEqual([]);
    });

    it('should handle pattern without any matcher', () => {
      const recipe = {
        recipeId: 'anatomy:test_recipe',
        blueprintId: 'anatomy:test_blueprint',
        patterns: [
          {
            partType: 'leg', // No matcher!
          },
        ],
      };

      const structureTemplate = dataRegistry.get(
        'anatomyStructureTemplates',
        'anatomy:structure_arachnid_8leg'
      );
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      const blueprint = {
        id: 'anatomy:test_blueprint',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        slots,
      };

      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0].matcher.type).toBe('none');
      expect(warnings[0].fix).toContain('Add a matcher property');
    });
  });
});
