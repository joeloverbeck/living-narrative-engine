/**
 * @file Integration tests for structure template and blueprint schema interaction
 * @see data/schemas/anatomy.structure-template.schema.json
 * @see data/schemas/anatomy.blueprint.schema.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import createTestAjv from '../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import structureTemplateSchema from '../../../data/schemas/anatomy.structure-template.schema.json';
import blueprintSchema from '../../../data/schemas/anatomy.blueprint.schema.json';

const TEMPLATE_SCHEMA_ID =
  'schema://living-narrative-engine/anatomy.structure-template.schema.json';
const BLUEPRINT_SCHEMA_ID =
  'schema://living-narrative-engine/anatomy.blueprint.schema.json';

describe('Template-Blueprint Integration - Spider (8 Legs)', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate spider structure template with 8-leg radial arrangement', () => {
    const spiderTemplate = {
      id: 'anatomy:structure_arachnid_8leg',
      description: 'Eight-legged arachnid body structure with radial arrangement',
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
              nameTpl: 'leg {{index}}',
            },
          },
        ],
        appendages: [
          {
            type: 'torso',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'posterior_abdomen',
              allowedTypes: ['torso', 'spider_abdomen'],
            },
          },
        ],
      },
    };

    const result = validator.validate(TEMPLATE_SCHEMA_ID, spiderTemplate);
    if (!result.isValid) {
      console.log('Template validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate spider blueprint referencing 8-leg template', () => {
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
        spinneret: {
          socket: 'spinneret',
          requirements: {
            partType: 'spinneret',
          },
          optional: true,
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, spiderBlueprint);
    if (!result.isValid) {
      console.log('Blueprint validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate complete spider anatomy system (template + blueprint)', () => {
    const template = {
      id: 'anatomy:structure_arachnid_8leg',
      description: 'Eight-legged arachnid body structure',
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

    const templateResult = validator.validate(TEMPLATE_SCHEMA_ID, template);
    const blueprintResult = validator.validate(BLUEPRINT_SCHEMA_ID, blueprint);

    expect(templateResult.isValid).toBe(true);
    expect(blueprintResult.isValid).toBe(true);
  });
});

describe('Template-Blueprint Integration - Dragon (Winged Quadruped)', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate dragon structure template with quadruped legs and wings', () => {
    const dragonTemplate = {
      id: 'anatomy:structure_winged_quadruped',
      description: 'Four-legged creature with bilateral wings - classic western dragon body plan',
      topology: {
        rootType: 'dragon_torso',
        limbSets: [
          {
            type: 'leg',
            count: 4,
            arrangement: 'quadrupedal',
            socketPattern: {
              idTemplate: 'leg_{{position}}',
              orientationScheme: 'custom',
              allowedTypes: ['leg', 'dragon_leg'],
              positions: ['front_left', 'front_right', 'rear_left', 'rear_right'],
            },
          },
          {
            type: 'wing',
            count: 2,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'wing_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['wing', 'dragon_wing'],
            },
          },
        ],
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'anterior_head',
              allowedTypes: ['head', 'dragon_head'],
            },
          },
          {
            type: 'tail',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'posterior_tail',
              allowedTypes: ['tail', 'dragon_tail'],
            },
          },
        ],
      },
    };

    const result = validator.validate(TEMPLATE_SCHEMA_ID, dragonTemplate);
    if (!result.isValid) {
      console.log('Template validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate dragon blueprint with additional fire gland slot', () => {
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
        treasure_pouch: {
          socket: 'treasure_pouch',
          requirements: {
            partType: 'storage_organ',
          },
          optional: true,
        },
      },
      clothingSlotMappings: {
        saddle: {
          anatomySockets: ['back_mount'],
          allowedLayers: ['accessory'],
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, dragonBlueprint);
    if (!result.isValid) {
      console.log('Blueprint validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });
});

describe('Template-Blueprint Integration - Octopoid (Radial Tentacles)', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate octopoid structure template with 8 radial tentacles', () => {
    const octopusTemplate = {
      id: 'anatomy:structure_octopoid_8arm',
      description: 'Eight-armed cephalopod body structure with radial symmetry',
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
              nameTpl: 'tentacle {{index}}',
            },
          },
        ],
        appendages: [
          {
            type: 'siphon',
            count: 1,
            attachment: 'ventral',
            socketPattern: {
              idTemplate: 'ventral_siphon',
              allowedTypes: ['siphon'],
            },
          },
        ],
      },
    };

    const result = validator.validate(TEMPLATE_SCHEMA_ID, octopusTemplate);
    if (!result.isValid) {
      console.log('Template validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate octopus blueprint with beak slot', () => {
    const octopusBlueprint = {
      id: 'anatomy:giant_octopus',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_octopoid_8arm',
      root: 'anatomy:octopus_mantle',
      additionalSlots: {
        beak: {
          socket: 'beak_socket',
          requirements: {
            partType: 'beak',
            components: ['anatomy:part', 'anatomy:chitinous'],
          },
        },
        ink_sac: {
          socket: 'ink_sac',
          requirements: {
            partType: 'gland',
            components: ['anatomy:part', 'anatomy:ink_producing'],
          },
          optional: true,
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, octopusBlueprint);
    if (!result.isValid) {
      console.log('Blueprint validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });
});

describe('Template-Blueprint Integration - Error Cases', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate blueprint schema even with non-existent template reference', () => {
    // Note: Schema validation doesn't check if referenced templates exist,
    // only that the blueprint structure is valid
    const blueprintWithInvalidRef = {
      id: 'anatomy:test_creature',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:non_existent_template',
      root: 'anatomy:test_torso',
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, blueprintWithInvalidRef);
    // Schema validation passes - runtime would handle missing template
    expect(result.isValid).toBe(true);
  });

  it('should reject v2 blueprint missing required structureTemplate', () => {
    const invalidBlueprint = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      root: 'anatomy:torso',
      // Missing structureTemplate
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, invalidBlueprint);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject v1 blueprint with structureTemplate field', () => {
    const invalidBlueprint = {
      id: 'anatomy:invalid',
      schemaVersion: '1.0',
      structureTemplate: 'anatomy:some_template',
      root: 'anatomy:torso',
      slots: {
        head: {
          socket: 'neck',
          requirements: { partType: 'head' },
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, invalidBlueprint);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Template-Blueprint Integration - AdditionalSlots Validation', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate blueprint with multiple additionalSlots', () => {
    const blueprint = {
      id: 'anatomy:complex_creature',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_base',
      root: 'anatomy:creature_torso',
      additionalSlots: {
        extra_eye: {
          socket: 'eye_socket_3',
          requirements: {
            partType: 'eye',
            components: ['anatomy:part', 'anatomy:sensory'],
          },
          optional: true,
        },
        venom_gland: {
          socket: 'venom_socket',
          requirements: {
            partType: 'gland',
            components: ['anatomy:part', 'anatomy:venom'],
          },
        },
        defensive_spine: {
          socket: 'spine_socket',
          requirements: {
            partType: 'spine',
          },
          optional: true,
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, blueprint);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate blueprint with both additionalSlots and clothingSlotMappings', () => {
    const blueprint = {
      id: 'anatomy:rideable_dragon',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_winged_quadruped',
      root: 'anatomy:dragon_torso',
      additionalSlots: {
        fire_gland: {
          socket: 'fire_gland',
          requirements: {
            partType: 'gland',
            components: ['anatomy:part', 'anatomy:fire_breathing'],
          },
        },
      },
      clothingSlotMappings: {
        saddle: {
          anatomySockets: ['back_mount'],
          allowedLayers: ['accessory'],
        },
        reins: {
          anatomySockets: ['neck_mount'],
          allowedLayers: ['accessory'],
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, blueprint);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should reject additionalSlots with invalid slot key pattern (uppercase)', () => {
    const invalidBlueprint = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_base',
      root: 'anatomy:torso',
      additionalSlots: {
        InvalidSlot: {
          // Uppercase not allowed
          socket: 'test_socket',
          requirements: {
            partType: 'test',
          },
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, invalidBlueprint);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject additionalSlots missing required socket', () => {
    const invalidBlueprint = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_base',
      root: 'anatomy:torso',
      additionalSlots: {
        extra_part: {
          // Missing socket
          requirements: {
            partType: 'test',
          },
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, invalidBlueprint);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject additionalSlots missing required requirements', () => {
    const invalidBlueprint = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_base',
      root: 'anatomy:torso',
      additionalSlots: {
        extra_part: {
          socket: 'test_socket',
          // Missing requirements
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, invalidBlueprint);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject requirements missing required partType', () => {
    const invalidBlueprint = {
      id: 'anatomy:invalid',
      schemaVersion: '2.0',
      structureTemplate: 'anatomy:structure_base',
      root: 'anatomy:torso',
      additionalSlots: {
        extra_part: {
          socket: 'test_socket',
          requirements: {
            // Missing partType
            components: ['anatomy:part'],
          },
        },
      },
    };

    const result = validator.validate(BLUEPRINT_SCHEMA_ID, invalidBlueprint);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Template-Blueprint Integration - Complex Structures', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();
    ajv.addSchema(structureTemplateSchema, TEMPLATE_SCHEMA_ID);
    ajv.addSchema(blueprintSchema, BLUEPRINT_SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate centaur template with dual torso sections', () => {
    const centaurTemplate = {
      id: 'anatomy:structure_centaur',
      description: 'Centaur body structure: humanoid upper torso merged with equine lower body',
      topology: {
        rootType: 'composite_torso',
        limbSets: [
          {
            type: 'arm',
            count: 2,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'arm_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['arm', 'humanoid_arm'],
            },
          },
          {
            type: 'leg',
            count: 4,
            arrangement: 'quadrupedal',
            socketPattern: {
              idTemplate: 'leg_{{position}}',
              orientationScheme: 'custom',
              allowedTypes: ['leg', 'equine_leg'],
              positions: ['front_left', 'front_right', 'rear_left', 'rear_right'],
            },
          },
        ],
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'anterior_head',
              allowedTypes: ['head', 'humanoid_head'],
            },
          },
          {
            type: 'tail',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'posterior_tail',
              allowedTypes: ['tail', 'horse_tail'],
            },
          },
        ],
      },
    };

    const result = validator.validate(TEMPLATE_SCHEMA_ID, centaurTemplate);
    if (!result.isValid) {
      console.log('Template validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate insectoid template with 6 legs and optional wings', () => {
    const insectTemplate = {
      id: 'anatomy:structure_insectoid',
      description: 'Six-legged insect body with optional wings',
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
          {
            type: 'wing',
            count: 4,
            arrangement: 'bilateral',
            optional: true,
            socketPattern: {
              idTemplate: 'wing_{{orientation}}_{{index}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['wing', 'insect_wing'],
            },
          },
        ],
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'anterior_head',
              allowedTypes: ['head', 'insect_head'],
            },
          },
          {
            type: 'torso',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'posterior_abdomen',
              allowedTypes: ['torso', 'insect_abdomen'],
            },
          },
        ],
      },
    };

    const result = validator.validate(TEMPLATE_SCHEMA_ID, insectTemplate);
    if (!result.isValid) {
      console.log('Template validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });
});
