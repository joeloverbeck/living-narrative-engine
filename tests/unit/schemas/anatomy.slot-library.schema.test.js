/**
 * @file Test suite for validating Anatomy Slot Library definitions against anatomy.slot-library.schema.json
 * @see data/schemas/anatomy.slot-library.schema.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// Schemas to be loaded
import anatomySlotLibrarySchema from '../../../data/schemas/anatomy.slot-library.schema.json';
import anatomyBlueprintSchema from '../../../data/schemas/anatomy.blueprint.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('JSON-Schema – Anatomy Slot Library Definition', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Add referenced schemas to AJV instance
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    ajv.addSchema(
      anatomyBlueprintSchema,
      'schema://living-narrative-engine/anatomy.blueprint.schema.json'
    );

    // Compile the main schema we want to test
    validate = ajv.compile(anatomySlotLibrarySchema);
  });

  describe('Valid Slot Library - Basic', () => {
    test('should validate a minimal valid slot library', () => {
      const validLibrary = {
        id: 'anatomy:humanoid_slots',
      };

      const ok = validate(validLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a library with description', () => {
      const validLibrary = {
        id: 'anatomy:humanoid_slots',
        description: 'Standard humanoid anatomy slot definitions',
      };

      const ok = validate(validLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('Valid Slot Library - With Slot Definitions', () => {
    test('should validate a library with basic slot definitions', () => {
      const validLibrary = {
        id: 'anatomy:humanoid_slots',
        slotDefinitions: {
          standard_head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
          standard_arm: {
            socket: 'shoulder', // Generic socket, will be overridden when used
            requirements: {
              partType: 'arm',
              components: ['anatomy:part'],
            },
          },
        },
      };

      const ok = validate(validLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a library with complex slot definitions', () => {
      const validLibrary = {
        id: 'anatomy:creature_slots',
        description: 'Slot definitions for various creature types',
        slotDefinitions: {
          standard_head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
            optional: false,
          },
          standard_wing: {
            parent: 'back',
            socket: 'wing_mount',
            requirements: {
              partType: 'wing',
              components: ['anatomy:part', 'anatomy:flight_capable'],
              properties: {
                'anatomy:part': {
                  size: 'large',
                },
              },
            },
            optional: true,
          },
          tentacle_base: {
            socket: 'tentacle_mount',
            requirements: {
              partType: 'tentacle',
            },
          },
        },
      };

      const ok = validate(validLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('Valid Slot Library - With Clothing Definitions', () => {
    test('should validate a library with basic clothing definitions', () => {
      const validLibrary = {
        id: 'anatomy:humanoid_slots',
        clothingDefinitions: {
          standard_head_gear: {
            blueprintSlots: ['head'],
            allowedLayers: ['base', 'outer', 'armor'],
          },
          standard_gloves: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base', 'armor'],
          },
        },
      };

      const ok = validate(validLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a library with complex clothing definitions', () => {
      const validLibrary = {
        id: 'anatomy:armor_slots',
        clothingDefinitions: {
          full_plate_chest: {
            blueprintSlots: ['torso', 'shoulders'],
            allowedLayers: ['armor'],
          },
          magic_cloak: {
            anatomySockets: ['back_mount', 'neck_clasp'],
            allowedLayers: ['outer', 'accessories'],
          },
        },
      };

      const ok = validate(validLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('Valid Slot Library - Complete Example', () => {
    test('should validate a complete slot library with all features', () => {
      const validLibrary = {
        id: 'anatomy:complete_humanoid',
        description: 'Complete humanoid slot and clothing definitions',
        slotDefinitions: {
          // Head and sensory organs
          standard_head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
          standard_eye: {
            parent: 'head',
            socket: 'eye_socket',
            requirements: {
              partType: 'eye',
              components: ['anatomy:part', 'anatomy:sensory_organ'],
            },
          },
          standard_ear: {
            parent: 'head',
            socket: 'ear_socket',
            requirements: {
              partType: 'ear',
              components: ['anatomy:part', 'anatomy:sensory_organ'],
            },
          },
          // Limbs
          standard_arm: {
            socket: 'shoulder', // Generic socket, will be overridden when used
            requirements: {
              partType: 'arm',
              components: ['anatomy:part'],
            },
          },
          standard_leg: {
            socket: 'hip',
            requirements: {
              partType: 'leg',
              components: ['anatomy:part'],
            },
          },
          // Extremities
          standard_hand: {
            parent: 'arm',
            socket: 'wrist',
            requirements: {
              partType: 'hand',
              components: ['anatomy:part', 'anatomy:manipulator'],
            },
          },
          standard_foot: {
            parent: 'leg',
            socket: 'ankle',
            requirements: {
              partType: 'foot',
              components: ['anatomy:part'],
            },
          },
        },
        clothingDefinitions: {
          // Head gear
          standard_head_gear: {
            blueprintSlots: ['head'],
            allowedLayers: ['base', 'outer', 'armor'],
          },
          // Hand gear
          standard_gloves: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base', 'armor'],
          },
          // Foot gear
          standard_footwear: {
            blueprintSlots: ['left_foot', 'right_foot'],
            allowedLayers: ['base', 'armor'],
          },
          // Torso gear
          standard_chest_gear: {
            blueprintSlots: ['torso'],
            allowedLayers: ['underwear', 'base', 'outer', 'armor'],
          },
          // Leg gear
          standard_leg_gear: {
            blueprintSlots: ['left_leg', 'right_leg'],
            allowedLayers: ['underwear', 'base', 'outer', 'armor'],
          },
        },
      };

      const ok = validate(validLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('Schema property validations', () => {
    test('should fail validation if required "id" property is missing', () => {
      const invalidData = {
        description: 'Missing ID',
        slotDefinitions: {},
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'id'",
        })
      );
    });

    test('should fail validation if extra properties are included', () => {
      const invalidData = {
        id: 'anatomy:test',
        unknownProperty: 'value',
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
          params: { additionalProperty: 'unknownProperty' },
        })
      );
    });
  });

  describe('Slot definition validations', () => {
    test('should fail if slot definition missing required socket', () => {
      const invalidData = {
        id: 'anatomy:test',
        slotDefinitions: {
          bad_slot: {
            requirements: {
              partType: 'head',
            },
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should fail if slot definition missing required requirements', () => {
      const invalidData = {
        id: 'anatomy:test',
        slotDefinitions: {
          bad_slot: {
            socket: 'neck',
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should validate slot definition with all optional properties', () => {
      const validData = {
        id: 'anatomy:test',
        slotDefinitions: {
          complex_slot: {
            parent: 'torso',
            socket: 'mount',
            requirements: {
              partType: 'special',
              components: ['anatomy:part', 'anatomy:unique'],
              properties: {
                'anatomy:part': {
                  subType: 'mechanical',
                  material: 'steel',
                },
                'anatomy:unique': {
                  rarity: 'legendary',
                },
              },
            },
            optional: true,
          },
        },
      };
      const ok = validate(validData);
      expect(ok).toBe(true);
    });
  });

  describe('Clothing definition validations', () => {
    test('should fail if clothing definition missing required properties', () => {
      const invalidData = {
        id: 'anatomy:test',
        clothingDefinitions: {
          bad_clothing: {
            blueprintSlots: ['head'],
            // Missing allowedLayers
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should fail if clothing has both blueprintSlots and anatomySockets', () => {
      const invalidData = {
        id: 'anatomy:test',
        clothingDefinitions: {
          bad_clothing: {
            blueprintSlots: ['head'],
            anatomySockets: ['neck'],
            allowedLayers: ['base'],
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should validate clothing definition with all layer types', () => {
      const validData = {
        id: 'anatomy:test',
        clothingDefinitions: {
          all_layers: {
            blueprintSlots: ['torso'],
            allowedLayers: ['underwear', 'base', 'outer', 'armor', 'accessories'],
          },
        },
      };
      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should fail with invalid layer type', () => {
      const invalidData = {
        id: 'anatomy:test',
        clothingDefinitions: {
          bad_layer: {
            blueprintSlots: ['head'],
            allowedLayers: ['invalid_layer'],
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });
  });

  describe('Mixed content validations', () => {
    test('should validate library with both slots and clothing', () => {
      const validData = {
        id: 'anatomy:mixed',
        description: 'Library with both slot and clothing definitions',
        slotDefinitions: {
          slot1: {
            socket: 'mount1',
            requirements: { partType: 'type1' },
          },
          slot2: {
            socket: 'mount2',
            requirements: { partType: 'type2' },
          },
        },
        clothingDefinitions: {
          clothing1: {
            blueprintSlots: ['slot1'],
            allowedLayers: ['base'],
          },
          clothing2: {
            anatomySockets: ['socket1'],
            allowedLayers: ['armor'],
          },
        },
      };
      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate empty definitions objects', () => {
      const validData = {
        id: 'anatomy:empty',
        slotDefinitions: {},
        clothingDefinitions: {},
      };
      const ok = validate(validData);
      expect(ok).toBe(true);
    });
  });
});
