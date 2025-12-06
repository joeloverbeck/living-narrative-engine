/**
 * @file Tests for anatomy.structure-template.schema.json validation
 * @see data/schemas/anatomy.structure-template.schema.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import createTestAjv from '../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import structureTemplateSchema from '../../../data/schemas/anatomy.structure-template.schema.json';

const SCHEMA_ID =
  'schema://living-narrative-engine/anatomy.structure-template.schema.json';

describe('Anatomy Structure Template Schema - Valid Templates', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();

    // Add the structure template schema
    ajv.addSchema(structureTemplateSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should validate minimal valid template (only required fields)', () => {
    const minimalTemplate = {
      id: 'anatomy:structure_minimal',
      topology: {
        rootType: 'torso',
      },
    };

    const result = validator.validate(SCHEMA_ID, minimalTemplate);
    if (!result.isValid) {
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.isValid).toBe(true);
  });

  it('should validate template with description', () => {
    const templateWithDescription = {
      id: 'anatomy:structure_described',
      description: 'A basic humanoid body structure template',
      topology: {
        rootType: 'torso',
      },
    };

    const result = validator.validate(SCHEMA_ID, templateWithDescription);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with bilateral limb set', () => {
    const bilateralTemplate = {
      id: 'anatomy:structure_humanoid',
      description: 'Standard humanoid body with bilateral limbs',
      topology: {
        rootType: 'torso',
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
            count: 2,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'leg_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['leg', 'humanoid_leg'],
              nameTpl: '{{orientation}} {{type}}',
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, bilateralTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with radial limb arrangement', () => {
    const radialTemplate = {
      id: 'anatomy:structure_octopus',
      description: 'Eight-armed cephalopod body structure',
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

    const result = validator.validate(SCHEMA_ID, radialTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with quadrupedal arrangement', () => {
    const quadrupedalTemplate = {
      id: 'anatomy:structure_quadruped',
      description: 'Four-legged animal body structure',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 4,
            arrangement: 'quadrupedal',
            socketPattern: {
              idTemplate: 'leg_{{position}}',
              orientationScheme: 'custom',
              allowedTypes: ['leg'],
              positions: [
                'front_left',
                'front_right',
                'rear_left',
                'rear_right',
              ],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, quadrupedalTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with appendages', () => {
    const appendageTemplate = {
      id: 'anatomy:structure_with_appendages',
      description: 'Body with head and tail appendages',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'anterior_head',
              allowedTypes: ['head', 'skull'],
            },
          },
          {
            type: 'tail',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'posterior_tail',
              allowedTypes: ['tail'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, appendageTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with both limbs and appendages', () => {
    const fullTemplate = {
      id: 'anatomy:structure_arachnid',
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
              allowedTypes: ['torso'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, fullTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with optional limbs', () => {
    const optionalLimbsTemplate = {
      id: 'anatomy:structure_optional_wings',
      description: 'Body with optional wings',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 2,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'arm_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['arm'],
            },
          },
          {
            type: 'wing',
            count: 2,
            arrangement: 'bilateral',
            optional: true,
            socketPattern: {
              idTemplate: 'wing_{{orientation}}',
              orientationScheme: 'bilateral',
              allowedTypes: ['wing'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, optionalLimbsTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with custom arrangement hint', () => {
    const hintTemplate = {
      id: 'anatomy:structure_custom_hint',
      description: 'Template with custom arrangement hint',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'tentacle',
            count: 6,
            arrangement: 'custom',
            arrangementHint: 'hexagonal_radial',
            socketPattern: {
              idTemplate: 'tentacle_{{index}}',
              orientationScheme: 'indexed',
              allowedTypes: ['tentacle'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, hintTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with linear arrangement', () => {
    const linearTemplate = {
      id: 'anatomy:structure_linear',
      description: 'Linear arrangement of body segments',
      topology: {
        rootType: 'head_segment',
        limbSets: [
          {
            type: 'leg',
            count: 6,
            arrangement: 'linear',
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              orientationScheme: 'indexed',
              allowedTypes: ['insect_leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, linearTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with maximum limb count (100)', () => {
    const maxLimbsTemplate = {
      id: 'anatomy:structure_max_limbs',
      description: 'Template with maximum limb count',
      topology: {
        rootType: 'body',
        limbSets: [
          {
            type: 'cilia',
            count: 100,
            arrangement: 'custom',
            socketPattern: {
              idTemplate: 'cilia_{{index}}',
              orientationScheme: 'indexed',
              allowedTypes: ['cilium'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, maxLimbsTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with maximum appendage count (10)', () => {
    const maxAppendagesTemplate = {
      id: 'anatomy:structure_max_appendages',
      description: 'Template with maximum appendage count',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'eye_stalk',
            count: 10,
            attachment: 'dorsal',
            socketPattern: {
              idTemplate: 'eye_stalk_{{index}}',
              allowedTypes: ['eye_stalk'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, maxAppendagesTemplate);
    expect(result.isValid).toBe(true);
  });

  it('should validate template with all attachment types', () => {
    const allAttachmentsTemplate = {
      id: 'anatomy:structure_all_attachments',
      description: 'Template showcasing all attachment types',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'head',
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'anterior_head',
              allowedTypes: ['head'],
            },
          },
          {
            type: 'tail',
            count: 1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'posterior_tail',
              allowedTypes: ['tail'],
            },
          },
          {
            type: 'dorsal_fin',
            count: 1,
            attachment: 'dorsal',
            socketPattern: {
              idTemplate: 'dorsal_fin',
              allowedTypes: ['fin'],
            },
          },
          {
            type: 'ventral_fin',
            count: 1,
            attachment: 'ventral',
            socketPattern: {
              idTemplate: 'ventral_fin',
              allowedTypes: ['fin'],
            },
          },
          {
            type: 'side_appendage',
            count: 1,
            attachment: 'lateral',
            socketPattern: {
              idTemplate: 'lateral_appendage',
              allowedTypes: ['appendage'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, allAttachmentsTemplate);
    expect(result.isValid).toBe(true);
  });
});

describe('Anatomy Structure Template Schema - Invalid Templates', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    const ajv = createTestAjv();

    // Add the structure template schema
    ajv.addSchema(structureTemplateSchema, SCHEMA_ID);

    validator = new AjvSchemaValidator({
      logger: testBed.mockLogger,
      ajvInstance: ajv,
    });
  });

  it('should reject template missing required id', () => {
    const missingId = {
      topology: {
        rootType: 'torso',
      },
    };

    const result = validator.validate(SCHEMA_ID, missingId);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template missing required topology', () => {
    const missingTopology = {
      id: 'anatomy:invalid',
    };

    const result = validator.validate(SCHEMA_ID, missingTopology);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template missing required rootType', () => {
    const missingRootType = {
      id: 'anatomy:invalid',
      topology: {},
    };

    const result = validator.validate(SCHEMA_ID, missingRootType);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with description shorter than 10 characters', () => {
    const shortDescription = {
      id: 'anatomy:invalid',
      description: 'Too short',
      topology: {
        rootType: 'torso',
      },
    };

    const result = validator.validate(SCHEMA_ID, shortDescription);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with negative limb count', () => {
    const negativeLimbCount = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: -5,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, negativeLimbCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with zero limb count', () => {
    const zeroLimbCount = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 0,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, zeroLimbCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with limb count exceeding 100', () => {
    const excessiveLimbCount = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 101,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, excessiveLimbCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with negative appendage count', () => {
    const negativeAppendageCount = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'tail',
            count: -1,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'tail',
              allowedTypes: ['tail'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, negativeAppendageCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with zero appendage count', () => {
    const zeroAppendageCount = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'tail',
            count: 0,
            attachment: 'posterior',
            socketPattern: {
              idTemplate: 'tail',
              allowedTypes: ['tail'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, zeroAppendageCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with appendage count exceeding 10', () => {
    const excessiveAppendageCount = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'eye_stalk',
            count: 11,
            attachment: 'dorsal',
            socketPattern: {
              idTemplate: 'eye_stalk_{{index}}',
              allowedTypes: ['eye_stalk'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, excessiveAppendageCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject limb set missing required type', () => {
    const missingType = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            count: 2,
            socketPattern: {
              idTemplate: 'limb_{{index}}',
              allowedTypes: ['limb'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, missingType);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject limb set missing required count', () => {
    const missingCount = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, missingCount);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject limb set missing required socketPattern', () => {
    const missingSocketPattern = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, missingSocketPattern);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject appendage missing required type', () => {
    const missingType = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            count: 1,
            attachment: 'anterior',
            socketPattern: {
              idTemplate: 'appendage',
              allowedTypes: ['appendage'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, missingType);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject appendage missing required attachment', () => {
    const missingAttachment = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'tail',
            count: 1,
            socketPattern: {
              idTemplate: 'tail',
              allowedTypes: ['tail'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, missingAttachment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject socket pattern missing required idTemplate', () => {
    const missingIdTemplate = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, missingIdTemplate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject socket pattern missing required allowedTypes', () => {
    const missingAllowedTypes = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, missingAllowedTypes);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject socket pattern with empty allowedTypes array', () => {
    const emptyAllowedTypes = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: [],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, emptyAllowedTypes);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject socket pattern with invalid idTemplate (invalid characters)', () => {
    const invalidIdTemplate = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              idTemplate: 'LEG-SOCKET!',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, invalidIdTemplate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject invalid arrangement enum value', () => {
    const invalidArrangement = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            arrangement: 'invalid_arrangement',
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, invalidArrangement);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject invalid attachment enum value', () => {
    const invalidAttachment = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        appendages: [
          {
            type: 'tail',
            count: 1,
            attachment: 'invalid_attachment',
            socketPattern: {
              idTemplate: 'tail',
              allowedTypes: ['tail'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, invalidAttachment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject invalid orientationScheme enum value', () => {
    const invalidOrientationScheme = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              orientationScheme: 'invalid_scheme',
              allowedTypes: ['leg'],
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, invalidOrientationScheme);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject template with additional unknown properties', () => {
    const additionalProperties = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
      },
      unknownProperty: 'invalid',
    };

    const result = validator.validate(SCHEMA_ID, additionalProperties);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject limb set with additional unknown properties', () => {
    const additionalLimbProperties = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
            },
            unknownProperty: 'invalid',
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, additionalLimbProperties);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject socket pattern with additional unknown properties', () => {
    const additionalSocketProperties = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'leg',
            count: 2,
            socketPattern: {
              idTemplate: 'leg_{{index}}',
              allowedTypes: ['leg'],
              unknownProperty: 'invalid',
            },
          },
        ],
      },
    };

    const result = validator.validate(SCHEMA_ID, additionalSocketProperties);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject topology with additional unknown properties', () => {
    const additionalTopologyProperties = {
      id: 'anatomy:invalid',
      topology: {
        rootType: 'torso',
        unknownProperty: 'invalid',
      },
    };

    const result = validator.validate(SCHEMA_ID, additionalTopologyProperties);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
