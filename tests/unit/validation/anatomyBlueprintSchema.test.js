/**
 * @file Tests for anatomy.blueprint.schema.json validation
 * @see data/schemas/anatomy.blueprint.schema.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import createTestAjv from '../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import blueprintSchema from '../../../data/schemas/anatomy.blueprint.schema.json';

const SCHEMA_ID =
  'schema://living-narrative-engine/anatomy.blueprint.schema.json';

describe('Anatomy Blueprint Schema - Valid V1 Blueprints', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();

    // Add the blueprint schema
    ajv.addSchema(blueprintSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate minimal v1 blueprint (implicit version, no schemaVersion)', () => {
    const implicitV1 = {
      id: 'anatomy:human_male',
      root: 'anatomy:human_male_torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: { partType: 'head' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, implicitV1);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate v1 blueprint with explicit schemaVersion: "1.0"', () => {
    const explicitV1 = {
      id: 'anatomy:human_female',
      schemaVersion: '1.0',
      root: 'anatomy:human_female_torso',
      slots: {
        vagina: {
          socket: 'vagina',
          requirements: { partType: 'vagina' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, explicitV1);
    expect(result.isValid).toBe(true);
  });

  it('should validate v1 blueprint with compose', () => {
    const v1WithCompose = {
      id: 'anatomy:human_male',
      root: 'anatomy:human_male_torso',
      compose: [
        {
          part: 'anatomy:humanoid_core',
          include: ['slots'],
        },
      ],
      slots: {
        penis: {
          socket: 'penis',
          requirements: { partType: 'penis' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v1WithCompose);
    expect(result.isValid).toBe(true);
  });

  it('should validate v1 blueprint with parts array', () => {
    const v1WithParts = {
      id: 'anatomy:simple',
      root: 'anatomy:torso',
      parts: ['anatomy:humanoid_core', 'anatomy:standard_limbs'],
    };

    const result = validator.validate(SCHEMA_ID, v1WithParts);
    expect(result.isValid).toBe(true);
  });

  it('should validate v1 blueprint with clothingSlotMappings', () => {
    const v1WithClothing = {
      id: 'anatomy:clothed',
      root: 'anatomy:torso',
      slots: {
        torso: {
          socket: 'torso',
          requirements: { partType: 'torso' },
        },
      },
      clothingSlotMappings: {
        chest: {
          blueprintSlots: ['torso'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v1WithClothing);
    expect(result.isValid).toBe(true);
  });

  it('should validate v1 blueprint with optional slot', () => {
    const v1WithOptional = {
      id: 'anatomy:optional_parts',
      root: 'anatomy:torso',
      slots: {
        wings: {
          socket: 'back',
          requirements: { partType: 'wing' },
          optional: true,
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v1WithOptional);
    expect(result.isValid).toBe(true);
  });

  it('should validate v1 blueprint with component requirements', () => {
    const v1WithComponents = {
      id: 'anatomy:advanced',
      root: 'anatomy:torso',
      slots: {
        special_arm: {
          socket: 'shoulder',
          requirements: {
            partType: 'arm',
            components: ['anatomy:part', 'anatomy:enhanced'],
          },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v1WithComponents);
    expect(result.isValid).toBe(true);
  });
});

describe('Anatomy Blueprint Schema - Valid V2 Blueprints', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();

    // Add the blueprint schema
    ajv.addSchema(blueprintSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate minimal v2 blueprint (only required fields)', () => {
    const minimalV2 = {
      id: 'anatomy:giant_spider',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_arachnid_8leg',
      root: 'anatomy:spider_cephalothorax',
    };

    const result = validator.validate(SCHEMA_ID, minimalV2);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate v2 blueprint with additionalSlots', () => {
    const v2WithAdditionalSlots = {
      id: 'anatomy:red_dragon',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_winged_quadruped',
      root: 'anatomy:dragon_torso',
      additionalSlots: {
        fire_gland: {
          socket: 'fire_gland',
          requirements: {
            partType: 'gland',
            components: ['anatomy:fire_breathing'],
          },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v2WithAdditionalSlots);
    expect(result.isValid).toBe(true);
  });

  it('should validate v2 blueprint with optional additionalSlots', () => {
    const v2WithOptional = {
      id: 'anatomy:dragon_variant',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_dragon',
      root: 'anatomy:dragon_torso',
      additionalSlots: {
        venom_gland: {
          socket: 'venom_gland',
          requirements: {
            partType: 'gland',
            components: ['anatomy:part', 'anatomy:venom'],
          },
          optional: true,
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v2WithOptional);
    expect(result.isValid).toBe(true);
  });

  it('should validate v2 blueprint with clothingSlotMappings', () => {
    const v2WithClothing = {
      id: 'anatomy:clothed_creature',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      clothingSlotMappings: {
        chest: {
          blueprintSlots: ['torso'],
          allowedLayers: ['base', 'outer'],
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v2WithClothing);
    expect(result.isValid).toBe(true);
  });

  it('should validate v2 blueprint with multiple additionalSlots', () => {
    const v2Complex = {
      id: 'anatomy:complex_creature',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_base',
      root: 'anatomy:creature_torso',
      additionalSlots: {
        extra_eye: {
          socket: 'eye_socket_3',
          requirements: { partType: 'eye' },
          optional: true,
        },
        tail_spikes: {
          socket: 'tail_spike_socket',
          requirements: {
            partType: 'spike',
            components: ['anatomy:defensive'],
          },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v2Complex);
    expect(result.isValid).toBe(true);
  });

  it('should validate v2 blueprint with both additionalSlots and clothingSlotMappings', () => {
    const v2Full = {
      id: 'anatomy:full_featured',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_humanoid_bilateral',
      root: 'anatomy:human_torso',
      additionalSlots: {
        cybernetic_arm: {
          socket: 'shoulder_mount',
          requirements: {
            partType: 'arm',
            components: ['anatomy:cybernetic'],
          },
          optional: true,
        },
      },
      clothingSlotMappings: {
        torso: {
          blueprintSlots: ['chest', 'back'],
          allowedLayers: ['base', 'outer', 'armor'],
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v2Full);
    expect(result.isValid).toBe(true);
  });
});

describe('Anatomy Blueprint Schema - Invalid Blueprints', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();

    // Add the blueprint schema
    ajv.addSchema(blueprintSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should reject blueprint missing required id', () => {
    const missingId = {
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_test',
      root: 'anatomy:torso',
    };

    const result = validator.validate(SCHEMA_ID, missingId);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject blueprint missing required root', () => {
    const missingRoot = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_test',
    };

    const result = validator.validate(SCHEMA_ID, missingRoot);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject v2 blueprint without structureTemplate', () => {
    const v2WithoutTemplate = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      root: 'anatomy:torso',
    };

    const result = validator.validate(SCHEMA_ID, v2WithoutTemplate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject v1 blueprint with structureTemplate', () => {
    const v1WithTemplate = {
      id: 'anatomy:invalid',
      schemaVersion: '1.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: { partType: 'head' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v1WithTemplate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject v2 blueprint with slots property', () => {
    const v2WithSlots = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: { partType: 'head' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v2WithSlots);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject v2 blueprint with compose property', () => {
    const v2WithCompose = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      compose: [
        {
          part: 'anatomy:humanoid_core',
          include: ['slots'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, v2WithCompose);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject v2 blueprint with parts property', () => {
    const v2WithParts = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      parts: ['anatomy:humanoid_core'],
    };

    const result = validator.validate(SCHEMA_ID, v2WithParts);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject v1 blueprint with additionalSlots', () => {
    const v1WithAdditional = {
      id: 'anatomy:invalid',
      schemaVersion: '1.0',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: { partType: 'head' },
        },
      },
      additionalSlots: {
        extra_arm: {
          socket: 'shoulder',
          requirements: { partType: 'arm' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, v1WithAdditional);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject implicit v1 blueprint with structureTemplate', () => {
    const implicitV1WithTemplate = {
      id: 'anatomy:invalid',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
    };

    const result = validator.validate(SCHEMA_ID, implicitV1WithTemplate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject invalid schemaVersion value', () => {
    const invalidVersion = {
      id: 'anatomy:invalid',
      schemaVersion: '3.0',
      root: 'anatomy:torso',
    };

    const result = validator.validate(SCHEMA_ID, invalidVersion);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject blueprint with invalid structureTemplate pattern', () => {
    const invalidPattern = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'INVALID PATTERN!',
      root: 'anatomy:torso',
    };

    const result = validator.validate(SCHEMA_ID, invalidPattern);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject slot missing required socket', () => {
    const missingSocket = {
      id: 'anatomy:invalid',
      root: 'anatomy:torso',
      slots: {
        head: {
          requirements: { partType: 'head' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, missingSocket);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject slot missing required requirements', () => {
    const missingRequirements = {
      id: 'anatomy:invalid',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, missingRequirements);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject requirements missing required partType', () => {
    const missingPartType = {
      id: 'anatomy:invalid',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: {
            components: ['anatomy:part'],
          },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, missingPartType);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject blueprint with additional unknown properties', () => {
    const additionalProperties = {
      id: 'anatomy:invalid',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: { partType: 'head' },
        },
      },
      unknownProperty: 'invalid',
    };

    const result = validator.validate(SCHEMA_ID, additionalProperties);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject additionalSlots with invalid pattern (uppercase not allowed)', () => {
    const invalidSlotPattern = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_test',
      root: 'anatomy:torso',
      additionalSlots: {
        InvalidSlot: {
          socket: 'test',
          requirements: { partType: 'test' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, invalidSlotPattern);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject clothingSlotMapping missing required allowedLayers', () => {
    const missingLayers = {
      id: 'anatomy:invalid',
      root: 'anatomy:torso',
      slots: {
        torso: {
          socket: 'torso',
          requirements: { partType: 'torso' },
        },
      },
      clothingSlotMappings: {
        chest: {
          blueprintSlots: ['torso'],
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, missingLayers);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject clothingSlotMapping with both blueprintSlots and anatomySockets', () => {
    const bothSlotTypes = {
      id: 'anatomy:invalid',
      root: 'anatomy:torso',
      slots: {
        torso: {
          socket: 'torso',
          requirements: { partType: 'torso' },
        },
      },
      clothingSlotMappings: {
        chest: {
          blueprintSlots: ['torso'],
          anatomySockets: ['socket1'],
          allowedLayers: ['base'],
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, bothSlotTypes);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Anatomy Blueprint Schema - Cross-Version Validation', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();

    // Add the blueprint schema
    ajv.addSchema(blueprintSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should reject mixing v1 slots with v2 structureTemplate', () => {
    const mixedFeatures1 = {
      id: 'anatomy:mixed',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: { partType: 'head' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, mixedFeatures1);
    expect(result.isValid).toBe(false);
  });

  it('should reject mixing v1 compose with v2 structureTemplate', () => {
    const mixedFeatures2 = {
      id: 'anatomy:mixed',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      compose: [
        {
          part: 'anatomy:humanoid_core',
          include: ['slots'],
        },
      ],
    };

    const result = validator.validate(SCHEMA_ID, mixedFeatures2);
    expect(result.isValid).toBe(false);
  });

  it('should reject v1 blueprint with both structureTemplate and additionalSlots', () => {
    const mixedFeatures3 = {
      id: 'anatomy:mixed',
      schemaVersion: '1.0',
      structureTemplate: 'anatomy:structure_humanoid',
      root: 'anatomy:torso',
      additionalSlots: {
        extra: {
          socket: 'test',
          requirements: { partType: 'test' },
        },
      },
    };

    const result = validator.validate(SCHEMA_ID, mixedFeatures3);
    expect(result.isValid).toBe(false);
  });
});
