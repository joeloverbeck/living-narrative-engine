/**
 * @file Integration tests for recipe pattern resolution with blueprints
 * @see data/schemas/anatomy.recipe.schema.json
 * @see data/schemas/anatomy.blueprint.schema.json
 * @see data/schemas/anatomy.structure-template.schema.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import createTestAjv from '../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import recipeSchema from '../../../data/schemas/anatomy.recipe.schema.json';
import blueprintSchema from '../../../data/schemas/anatomy.blueprint.schema.json';
import structureTemplateSchema from '../../../data/schemas/anatomy.structure-template.schema.json';

const RECIPE_SCHEMA_ID = 'schema://living-narrative-engine/anatomy.recipe.schema.json';
const BLUEPRINT_SCHEMA_ID =
  'schema://living-narrative-engine/anatomy.blueprint.schema.json';
const TEMPLATE_SCHEMA_ID =
  'schema://living-narrative-engine/anatomy.structure-template.schema.json';

describe('Recipe Pattern Resolution - Spider (8 Legs with Group Patterns)', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, RECIPE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate spider recipe with limbSet:leg group pattern', () => {
    const spiderRecipe = {
      recipeId: 'creatures:giant_spider',
      blueprintId: 'anatomy:giant_spider',
      slots: {
        cephalothorax: {
          partType: 'cephalothorax',
          preferId: 'anatomy:spider_cephalothorax_hairy',
          tags: ['anatomy:chitinous'],
        },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:chitinous', 'anatomy:hairy', 'anatomy:jointed'],
          properties: {
            'descriptors:segments': { count: 7 },
            'descriptors:length': { size: 'long' },
          },
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, spiderRecipe);
    if (!result.isValid) {
      console.log('Recipe validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate spider blueprint compatible with group pattern', () => {
    const spiderBlueprint = {
      id: 'anatomy:giant_spider',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_arachnid_8leg',
      root: 'anatomy:spider_cephalothorax',
      additionalSlots: {
        venom_gland: {
          socket: 'venom_gland',
          requirements: {
            partType: 'gland',
            components: ['anatomy:part', 'anatomy:venom'],
          },
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, spiderBlueprint);
    expect(result.isValid).toBe(true);
  });

  it('should validate complete spider system (template + blueprint + recipe)', () => {
    const template = {
      id: 'anatomy:structure_arachnid_8leg',
      description: 'Eight-legged arachnid structure',
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
              allowedTypes: ['leg', 'arachnid_leg'],
            },
          },
        ],
      },
    };

    const blueprint = {
      id: 'anatomy:giant_spider',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_arachnid_8leg',
      root: 'anatomy:spider_cephalothorax',
    };

    const recipe = {
      recipeId: 'creatures:giant_spider',
      blueprintId: 'anatomy:giant_spider',
      slots: {
        cephalothorax: { partType: 'cephalothorax' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:chitinous'],
        },
      ],
    };

    const templateResult = validator.validate(TEMPLATE_SCHEMA_ID, template);
    const blueprintResult = validator.validate(BLUEPRINT_SCHEMA_ID, blueprint);
    const recipeResult = validator.validate(RECIPE_SCHEMA_ID, recipe);

    expect(templateResult.isValid).toBe(true);
    expect(blueprintResult.isValid).toBe(true);
    expect(recipeResult.isValid).toBe(true);
  });

  it('should validate spider recipe with multiple group patterns', () => {
    const spiderRecipe = {
      recipeId: 'creatures:complex_spider',
      blueprintId: 'anatomy:giant_spider',
      slots: {
        cephalothorax: { partType: 'cephalothorax' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:chitinous', 'anatomy:hairy'],
        },
        {
          matchesGroup: 'appendage:pedipalp',
          partType: 'pedipalp',
          tags: ['anatomy:sensory'],
        },
        {
          matchesGroup: 'appendage:abdomen',
          partType: 'abdomen',
          tags: ['anatomy:silk_producing'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, spiderRecipe);
    expect(result.isValid).toBe(true);
  });
});

describe('Recipe Pattern Resolution - Dragon (Wildcard Patterns)', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, RECIPE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate dragon recipe with wildcard patterns', () => {
    const dragonRecipe = {
      recipeId: 'creatures:red_dragon',
      blueprintId: 'anatomy:red_dragon',
      slots: {
        torso: {
          partType: 'dragon_torso',
          preferId: 'anatomy:dragon_torso_red_scaled',
        },
      },
      patterns: [
        {
          matchesPattern: 'front_*',
          partType: 'leg',
          tags: ['anatomy:clawed', 'anatomy:front_leg', 'anatomy:scaled'],
        },
        {
          matchesPattern: 'rear_*',
          partType: 'leg',
          tags: ['anatomy:clawed', 'anatomy:rear_leg', 'anatomy:scaled'],
        },
        {
          matchesPattern: 'wing_*',
          partType: 'wing',
          tags: ['anatomy:scaled', 'anatomy:membranous'],
          properties: {
            'descriptors:wingspan': { size: 'massive' },
          },
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, dragonRecipe);
    if (!result.isValid) {
      console.log('Recipe validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate dragon blueprint with quadruped template', () => {
    const dragonBlueprint = {
      id: 'anatomy:red_dragon',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_winged_quadruped',
      root: 'anatomy:dragon_torso_red',
      additionalSlots: {
        fire_gland: {
          socket: 'fire_gland',
          requirements: {
            partType: 'gland',
            components: ['anatomy:part', 'anatomy:fire_breathing'],
          },
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, dragonBlueprint);
    expect(result.isValid).toBe(true);
  });

  it('should validate dragon recipe with mixed group and wildcard patterns', () => {
    const dragonRecipe = {
      recipeId: 'creatures:ancient_dragon',
      blueprintId: 'anatomy:red_dragon',
      slots: {
        torso: { partType: 'dragon_torso' },
      },
      patterns: [
        {
          matchesPattern: 'front_*',
          partType: 'leg',
          tags: ['anatomy:front_leg'],
        },
        {
          matchesPattern: 'rear_*',
          partType: 'leg',
          tags: ['anatomy:rear_leg'],
        },
        {
          matchesGroup: 'limbSet:wing',
          partType: 'wing',
          tags: ['anatomy:ancient'],
          properties: {
            'descriptors:power': { level: 'legendary' },
          },
        },
        {
          matchesGroup: 'appendage:tail',
          partType: 'tail',
          tags: ['anatomy:spiked'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, dragonRecipe);
    expect(result.isValid).toBe(true);
  });
});

describe('Recipe Pattern Resolution - Mixed V1 and V2 Patterns', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, RECIPE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate recipe with V1 explicit matches and V2 group patterns', () => {
    const mixedRecipe = {
      recipeId: 'creatures:hybrid_creature',
      blueprintId: 'anatomy:hybrid',
      slots: {
        torso: {
          partType: 'torso',
          preferId: 'anatomy:composite_torso',
        },
        head: {
          partType: 'head',
        },
      },
      patterns: [
        {
          matches: ['left_arm', 'right_arm'],
          partType: 'arm',
          tags: ['anatomy:humanoid'],
        },
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:bestial'],
        },
        {
          matchesPattern: 'wing_*',
          partType: 'wing',
          tags: ['anatomy:feathered'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, mixedRecipe);
    if (!result.isValid) {
      console.log('Recipe validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate recipe with V1 and V2 patterns plus property filters', () => {
    const complexRecipe = {
      recipeId: 'creatures:centaur',
      blueprintId: 'anatomy:centaur',
      slots: {
        torso_upper: { partType: 'humanoid_torso' },
        torso_lower: { partType: 'equine_torso' },
      },
      patterns: [
        {
          matches: ['left_arm', 'right_arm'],
          partType: 'arm',
          tags: ['anatomy:humanoid', 'anatomy:muscular'],
        },
        {
          matchesAll: {
            slotType: 'leg',
            orientation: 'front_*',
          },
          partType: 'leg',
          tags: ['anatomy:equine', 'anatomy:front'],
        },
        {
          matchesAll: {
            slotType: 'leg',
            orientation: 'rear_*',
          },
          partType: 'leg',
          tags: ['anatomy:equine', 'anatomy:rear'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, complexRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate all pattern types in single recipe', () => {
    const allPatternsRecipe = {
      recipeId: 'creatures:all_pattern_types',
      blueprintId: 'anatomy:complex',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matches: ['head'],
          partType: 'head',
          tags: ['anatomy:central'],
        },
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:walking'],
        },
        {
          matchesPattern: 'tentacle_*',
          partType: 'tentacle',
          tags: ['anatomy:grasping'],
        },
        {
          matchesAll: {
            slotType: 'wing',
          },
          partType: 'wing',
          tags: ['anatomy:flying'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, allPatternsRecipe);
    expect(result.isValid).toBe(true);
  });
});

describe('Recipe Pattern Resolution - Property-Based Filtering', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, RECIPE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate recipe with orientation-based filtering', () => {
    const orientationRecipe = {
      recipeId: 'creatures:asymmetric',
      blueprintId: 'anatomy:asymmetric',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesAll: {
            orientation: 'left_*',
          },
          partType: 'limb',
          tags: ['anatomy:left_sided'],
          properties: {
            'descriptors:strength': { level: 'enhanced' },
          },
        },
        {
          matchesAll: {
            orientation: 'right_*',
          },
          partType: 'limb',
          tags: ['anatomy:right_sided'],
          properties: {
            'descriptors:dexterity': { level: 'enhanced' },
          },
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, orientationRecipe);
    if (!result.isValid) {
      console.log('Recipe validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate recipe with slotType filtering', () => {
    const typeFilterRecipe = {
      recipeId: 'creatures:uniform_limbs',
      blueprintId: 'anatomy:multi_limbed',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesAll: {
            slotType: 'leg',
          },
          partType: 'leg',
          tags: ['anatomy:uniform', 'anatomy:strong'],
        },
        {
          matchesAll: {
            slotType: 'arm',
          },
          partType: 'arm',
          tags: ['anatomy:uniform', 'anatomy:dexterous'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, typeFilterRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate recipe with socketId filtering', () => {
    const socketFilterRecipe = {
      recipeId: 'creatures:socket_specific',
      blueprintId: 'anatomy:complex',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesAll: {
            socketId: 'shoulder',
          },
          partType: 'arm',
          tags: ['anatomy:shoulder_mounted'],
        },
        {
          matchesAll: {
            socketId: 'hip',
          },
          partType: 'leg',
          tags: ['anatomy:hip_mounted'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, socketFilterRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate recipe with multiple property filters combined', () => {
    const multiFilterRecipe = {
      recipeId: 'creatures:multi_filtered',
      blueprintId: 'anatomy:complex',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesAll: {
            slotType: 'leg',
            orientation: 'front_*',
            socketId: 'front_hip',
          },
          partType: 'leg',
          tags: ['anatomy:front_leg', 'anatomy:powerful'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, multiFilterRecipe);
    expect(result.isValid).toBe(true);
  });
});

describe('Recipe Pattern Resolution - Pattern Exclusions', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, RECIPE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate pattern with slotGroups exclusion', () => {
    const exclusionRecipe = {
      recipeId: 'creatures:selective',
      blueprintId: 'anatomy:selective',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:limb',
          partType: 'limb',
          tags: ['anatomy:standard'],
          exclude: {
            slotGroups: ['limbSet:wing', 'limbSet:tentacle'],
          },
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, exclusionRecipe);
    if (!result.isValid) {
      console.log('Recipe validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate pattern with property-based exclusion', () => {
    const exclusionRecipe = {
      recipeId: 'creatures:property_exclude',
      blueprintId: 'anatomy:complex',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:normal'],
          exclude: {
            properties: {
              orientation: 'ventral',
              socketId: 'special_mount',
            },
          },
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, exclusionRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate pattern with both slotGroups and property exclusions', () => {
    const exclusionRecipe = {
      recipeId: 'creatures:complex_exclude',
      blueprintId: 'anatomy:complex',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesAll: {
            slotType: 'limb',
          },
          partType: 'limb',
          tags: ['anatomy:standard'],
          exclude: {
            slotGroups: ['limbSet:special'],
            properties: {
              orientation: 'unique',
            },
          },
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, exclusionRecipe);
    expect(result.isValid).toBe(true);
  });
});

describe('Recipe Pattern Resolution - Error Cases', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, RECIPE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate recipe schema even with non-existent group reference', () => {
    // Note: Schema validation doesn't check if referenced groups exist,
    // only that the recipe structure is valid
    const recipeWithInvalidGroup = {
      recipeId: 'creatures:test',
      blueprintId: 'anatomy:test',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:non_existent',
          partType: 'limb',
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, recipeWithInvalidGroup);
    // Schema validation passes - runtime would handle missing group
    expect(result.isValid).toBe(true);
  });

  it('should reject recipe with invalid group format', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesGroup: 'invalid_format',
          partType: 'limb',
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject recipe with multiple matchers in same pattern', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          matchesPattern: 'leg_*',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject recipe pattern with no matcher', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        torso: { partType: 'torso' },
      },
      patterns: [
        {
          partType: 'leg',
          tags: ['anatomy:test'],
        },
      ],
    };

    const result = validator.validate(RECIPE_SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Recipe Pattern Resolution - Complete Integration Examples', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, RECIPE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate complete octopus system (template + blueprint + recipe)', () => {
    const template = {
      id: 'anatomy:structure_octopoid_8arm',
      description: 'Eight-armed cephalopod body',
      topology: {
        rootType: 'mantle',
        limbSets: [
          {
            type: 'tentacle',
            count: 8,
            arrangement: 'radial',
            socketPattern: {
              idTemplate: 'tentacle_{{index}}',
              orientationScheme: 'radial',
              allowedTypes: ['tentacle', 'arm'],
            },
          },
        ],
      },
    };

    const blueprint = {
      id: 'anatomy:giant_octopus',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_octopoid_8arm',
      root: 'anatomy:octopus_mantle',
    };

    const recipe = {
      recipeId: 'creatures:giant_octopus',
      blueprintId: 'anatomy:giant_octopus',
      slots: {
        mantle: { partType: 'cephalopod_mantle' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:tentacle',
          partType: 'tentacle',
          tags: ['anatomy:suckered', 'anatomy:flexible'],
          properties: {
            'descriptors:suckers': { rows: 2 },
          },
        },
      ],
    };

    const templateResult = validator.validate(TEMPLATE_SCHEMA_ID, template);
    const blueprintResult = validator.validate(BLUEPRINT_SCHEMA_ID, blueprint);
    const recipeResult = validator.validate(RECIPE_SCHEMA_ID, recipe);

    expect(templateResult.isValid).toBe(true);
    expect(blueprintResult.isValid).toBe(true);
    expect(recipeResult.isValid).toBe(true);
  });

  it('should validate insectoid creature with all three schemas', () => {
    const template = {
      id: 'anatomy:structure_insectoid_6leg',
      description: 'Six-legged insect body',
      topology: {
        rootType: 'thorax',
        limbSets: [
          {
            type: 'leg',
            count: 6,
            arrangement: 'linear',
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              orientationScheme: 'indexed',
              allowedTypes: ['leg', 'insect_leg'],
            },
          },
        ],
      },
    };

    const blueprint = {
      id: 'anatomy:beetle',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_insectoid_6leg',
      root: 'anatomy:beetle_thorax',
      additionalSlots: {
        elytra: {
          socket: 'wing_covers',
          requirements: {
            partType: 'elytra',
          },
        },
      },
    };

    const recipe = {
      recipeId: 'creatures:giant_beetle',
      blueprintId: 'anatomy:beetle',
      slots: {
        thorax: { partType: 'thorax' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:chitinous', 'anatomy:jointed'],
        },
      ],
    };

    const templateResult = validator.validate(TEMPLATE_SCHEMA_ID, template);
    const blueprintResult = validator.validate(BLUEPRINT_SCHEMA_ID, blueprint);
    const recipeResult = validator.validate(RECIPE_SCHEMA_ID, recipe);

    expect(templateResult.isValid).toBe(true);
    expect(blueprintResult.isValid).toBe(true);
    expect(recipeResult.isValid).toBe(true);
  });
});
