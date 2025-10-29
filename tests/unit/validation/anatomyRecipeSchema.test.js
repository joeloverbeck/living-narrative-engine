/**
 * @file Tests for anatomy.recipe.schema.json validation
 * @see data/schemas/anatomy.recipe.schema.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import createTestAjv from '../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import recipeSchema from '../../../data/schemas/anatomy.recipe.schema.json';

const SCHEMA_ID = 'schema://living-narrative-engine/anatomy.recipe.schema.json';

describe('Anatomy Recipe Schema - V1 Pattern Compatibility', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate V1 pattern with explicit matches array', () => {
    const v1Recipe = {
      recipeId: 'anatomy:human_adult',
      blueprintId: 'anatomy:human',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matches: ['left_arm', 'right_arm'],
          partType: 'arm',
          tags: ['anatomy:muscular'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, v1Recipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate V1 pattern with all optional properties', () => {
    const v1Recipe = {
      recipeId: 'anatomy:warrior',
      blueprintId: 'anatomy:human',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matches: ['left_leg', 'right_leg'],
          partType: 'leg',
          preferId: 'anatomy:strong_leg',
          tags: ['anatomy:muscular', 'anatomy:athletic'],
          notTags: ['anatomy:weak'],
          properties: {
            'descriptors:strength': { level: 'high' },
          },
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, v1Recipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate V1 pattern with single slot match', () => {
    const v1Recipe = {
      recipeId: 'anatomy:simple',
      blueprintId: 'anatomy:simple',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matches: ['torso'],
          partType: 'torso',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, v1Recipe);
    expect(result.isValid).toBe(true);
  });

  it('should reject V1 pattern with empty matches array', () => {
    const invalidRecipe = {
      recipeId: 'anatomy:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matches: [],
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject V1 pattern missing required partType', () => {
    const invalidRecipe = {
      recipeId: 'anatomy:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matches: ['left_arm', 'right_arm'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Anatomy Recipe Schema - V2 Slot Group Patterns', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate matchesGroup with limbSet type', () => {
    const groupRecipe = {
      recipeId: 'creatures:spider',
      blueprintId: 'anatomy:spider',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:chitinous'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, groupRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate matchesGroup with appendage type', () => {
    const groupRecipe = {
      recipeId: 'creatures:scorpion',
      blueprintId: 'anatomy:scorpion',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'appendage:tail',
          partType: 'tail',
          tags: ['anatomy:stinger'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, groupRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate matchesGroup with numeric identifier', () => {
    const groupRecipe = {
      recipeId: 'creatures:test',
      blueprintId: 'anatomy:test',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:wing_123',
          partType: 'wing',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, groupRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate matchesGroup with underscore in identifier', () => {
    const groupRecipe = {
      recipeId: 'creatures:test',
      blueprintId: 'anatomy:test',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:rear_leg',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, groupRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should reject matchesGroup missing type prefix', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'leg',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject matchesGroup with empty identifier', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject matchesGroup with invalid type prefix', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'invalidType:leg',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject matchesGroup with uppercase characters', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:Leg',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject matchesGroup with special characters', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg-front',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Anatomy Recipe Schema - V2 Wildcard Patterns', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate suffix wildcard pattern', () => {
    const wildcardRecipe = {
      recipeId: 'creatures:dragon',
      blueprintId: 'anatomy:dragon',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'wing_*',
          partType: 'wing',
          tags: ['anatomy:scaled'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, wildcardRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate exact match pattern (no wildcard)', () => {
    const exactRecipe = {
      recipeId: 'creatures:simple',
      blueprintId: 'anatomy:simple',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'torso',
          partType: 'torso',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, exactRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate pattern with underscores and wildcard', () => {
    const patternRecipe = {
      recipeId: 'creatures:octopus',
      blueprintId: 'anatomy:octopus',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'tentacle_*',
          partType: 'tentacle',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, patternRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate pattern with numbers', () => {
    const patternRecipe = {
      recipeId: 'creatures:test',
      blueprintId: 'anatomy:test',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'leg123',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, patternRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate pattern with leading wildcard', () => {
    const patternRecipe = {
      recipeId: 'creatures:gryphon',
      blueprintId: 'anatomy:gryphon',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: '*_left',
          partType: 'left_appendage',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, patternRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate pattern with infix wildcard', () => {
    const patternRecipe = {
      recipeId: 'creatures:eldritch',
      blueprintId: 'anatomy:eldritch',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: '*tentacle*',
          partType: 'tentacle',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, patternRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate pattern with multiple wildcard segments', () => {
    const patternRecipe = {
      recipeId: 'creatures:hydra',
      blueprintId: 'anatomy:hydra',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'neck_*_segment*',
          partType: 'hydra_neck',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, patternRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should reject pattern with hyphens', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'leg-*',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern with uppercase characters', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'LEG_*',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern with spaces', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'leg *',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern composed only of wildcard character', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: '*',
          partType: 'any',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern with consecutive wildcards', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: '**',
          partType: 'any',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Anatomy Recipe Schema - V2 Property Filter Patterns', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate matchesAll with slotType filter', () => {
    const filterRecipe = {
      recipeId: 'creatures:test',
      blueprintId: 'anatomy:test',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesAll: {
            slotType: 'leg',
          },
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, filterRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate matchesAll with orientation filter', () => {
    const filterRecipe = {
      recipeId: 'creatures:test',
      blueprintId: 'anatomy:test',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesAll: {
            orientation: 'left_*',
          },
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, filterRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate matchesAll with socketId filter', () => {
    const filterRecipe = {
      recipeId: 'creatures:test',
      blueprintId: 'anatomy:test',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesAll: {
            socketId: 'shoulder',
          },
          partType: 'arm',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, filterRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate matchesAll with multiple properties', () => {
    const filterRecipe = {
      recipeId: 'creatures:centaur',
      blueprintId: 'anatomy:centaur',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesAll: {
            slotType: 'leg',
            orientation: 'front_*',
            socketId: 'hip_socket',
          },
          partType: 'leg',
          tags: ['anatomy:equine'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, filterRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should reject empty matchesAll object', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesAll: {},
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject matchesAll with unknown properties', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesAll: {
            unknownProperty: 'value',
          },
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Anatomy Recipe Schema - Pattern Mutual Exclusivity', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should reject pattern with both matches and matchesGroup', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matches: ['left_leg', 'right_leg'],
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern with both matchesGroup and matchesPattern', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          matchesPattern: 'leg_*',
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern with both matchesPattern and matchesAll', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesPattern: 'leg_*',
          matchesAll: { slotType: 'leg' },
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern with all three matchers', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          matchesPattern: 'leg_*',
          matchesAll: { slotType: 'leg' },
          partType: 'leg',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject pattern with no matcher at all', () => {
    const invalidRecipe = {
      recipeId: 'creatures:invalid',
      blueprintId: 'anatomy:invalid',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          partType: 'leg',
          tags: ['anatomy:muscular'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, invalidRecipe);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Anatomy Recipe Schema - Mixed V1 and V2 Patterns', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate recipe with both V1 and V2 patterns', () => {
    const mixedRecipe = {
      recipeId: 'creatures:mixed',
      blueprintId: 'anatomy:mixed',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matches: ['torso'],
          partType: 'torso',
        },
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
        },
        {
          matchesPattern: 'wing_*',
          partType: 'wing',
        },
        {
          matchesAll: { slotType: 'arm' },
          partType: 'arm',
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, mixedRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate V2 pattern with all optional properties', () => {
    const completeV2Recipe = {
      recipeId: 'creatures:dragon',
      blueprintId: 'anatomy:dragon',
      slots: {
        head: { partType: 'head' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:wing',
          partType: 'wing',
          preferId: 'anatomy:dragon_wing_scaled',
          tags: ['anatomy:scaled', 'anatomy:membranous'],
          notTags: ['anatomy:feathered'],
          properties: {
            'descriptors:wingspan': { size: 'massive' },
          },
          exclude: {
            slotGroups: ['limbSet:arm'],
            properties: {
              orientation: 'ventral',
            },
          },
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, completeV2Recipe);
    expect(result.isValid).toBe(true);
  });
});

describe('Anatomy Recipe Schema - Real-World Integration Examples', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(recipeSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate spider recipe with 8-leg group pattern', () => {
    const spiderRecipe = {
      recipeId: 'creatures:giant_spider',
      blueprintId: 'anatomy:giant_spider_8leg',
      slots: {
        cephalothorax: { partType: 'cephalothorax' },
      },
      patterns: [
        {
          matchesGroup: 'limbSet:leg',
          partType: 'leg',
          tags: ['anatomy:chitinous', 'anatomy:hairy', 'anatomy:jointed'],
          properties: {
            'descriptors:length': { size: 'long' },
            'descriptors:segments': { count: 7 },
          },
        },
        {
          matchesGroup: 'appendage:pedipalp',
          partType: 'pedipalp',
          tags: ['anatomy:sensory'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, spiderRecipe);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate dragon recipe with mixed wildcard patterns', () => {
    const dragonRecipe = {
      recipeId: 'creatures:red_dragon',
      blueprintId: 'anatomy:red_dragon_quadruped',
      slots: {
        torso: { partType: 'dragon_torso' },
      },
      patterns: [
        {
          matchesPattern: 'front_*',
          partType: 'leg',
          tags: ['anatomy:clawed', 'anatomy:front_leg'],
          properties: {
            'descriptors:claws': { sharpness: 'razor' },
          },
        },
        {
          matchesPattern: 'rear_*',
          partType: 'leg',
          tags: ['anatomy:clawed', 'anatomy:rear_leg'],
          properties: {
            'descriptors:strength': { level: 'powerful' },
          },
        },
        {
          matchesGroup: 'limbSet:wing',
          partType: 'wing',
          tags: ['anatomy:scaled', 'anatomy:membranous'],
          properties: {
            'descriptors:wingspan': { size: 'massive' },
          },
        },
        {
          matchesGroup: 'appendage:tail',
          partType: 'tail',
          tags: ['anatomy:spiked'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, dragonRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate centaur recipe with property-based filters', () => {
    const centaurRecipe = {
      recipeId: 'creatures:centaur',
      blueprintId: 'anatomy:centaur_composite',
      slots: {
        torso_upper: { partType: 'human_torso' },
        torso_lower: { partType: 'horse_torso' },
      },
      patterns: [
        {
          matchesAll: {
            slotType: 'leg',
            orientation: 'front_*',
          },
          partType: 'leg',
          tags: ['anatomy:equine', 'anatomy:front'],
          properties: {
            'descriptors:hooves': { type: 'cloven' },
          },
        },
        {
          matchesAll: {
            slotType: 'leg',
            orientation: 'rear_*',
          },
          partType: 'leg',
          tags: ['anatomy:equine', 'anatomy:rear'],
          properties: {
            'descriptors:strength': { level: 'powerful' },
          },
        },
        {
          matches: ['left_arm', 'right_arm'],
          partType: 'arm',
          tags: ['anatomy:humanoid'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, centaurRecipe);
    expect(result.isValid).toBe(true);
  });

  it('should validate octopoid recipe with radial tentacles', () => {
    const octopusRecipe = {
      recipeId: 'creatures:giant_octopus',
      blueprintId: 'anatomy:octopoid_8arm',
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
            'descriptors:length': { size: 'very_long' },
          },
        },
        {
          matchesPattern: 'siphon',
          partType: 'siphon',
          tags: ['anatomy:respiratory'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, octopusRecipe);
    expect(result.isValid).toBe(true);
  });
});
