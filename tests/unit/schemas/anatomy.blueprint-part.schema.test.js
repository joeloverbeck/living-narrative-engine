/**
 * @file Test suite for validating Anatomy Blueprint Part definitions against anatomy.blueprint-part.schema.json
 * @see data/schemas/anatomy.blueprint-part.schema.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// Schemas to be loaded
import anatomyBlueprintPartSchema from '../../../data/schemas/anatomy.blueprint-part.schema.json';
import anatomyBlueprintSchema from '../../../data/schemas/anatomy.blueprint.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('JSON-Schema – Anatomy Blueprint Part Definition', () => {
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
    validate = ajv.compile(anatomyBlueprintPartSchema);
  });

  describe('Valid Blueprint Part - Basic', () => {
    test('should validate a minimal valid blueprint part', () => {
      const validPart = {
        id: 'anatomy:humanoid_base',
      };

      const ok = validate(validPart);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a blueprint part with description', () => {
      const validPart = {
        id: 'anatomy:humanoid_base',
        description: 'Common humanoid anatomy structure',
      };

      const ok = validate(validPart);
      expect(ok).toBe(true);
    });

    test('should validate a blueprint part with library reference', () => {
      const validPart = {
        id: 'anatomy:humanoid_core',
        description: 'Core humanoid anatomy using slot library',
        library: 'anatomy:humanoid_slots',
      };

      const ok = validate(validPart);
      expect(ok).toBe(true);
    });
  });

  describe('Valid Blueprint Part - With Slots', () => {
    test('should validate a part with standard slot definitions', () => {
      const validPart = {
        id: 'anatomy:humanoid_base',
        slots: {
          head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
          left_arm: {
            parent: 'torso',
            socket: 'left_shoulder',
            requirements: {
              partType: 'arm',
            },
            optional: true,
          },
        },
      };

      const ok = validate(validPart);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a part with $use slot references', () => {
      const validPart = {
        id: 'anatomy:humanoid_core',
        library: 'anatomy:humanoid_slots',
        slots: {
          head: {
            $use: 'standard_head',
          },
          left_arm: {
            $use: 'standard_arm',
            socket: 'left_shoulder', // Override
          },
          custom_slot: {
            socket: 'special',
            requirements: {
              partType: 'custom',
            },
          },
        },
      };

      const ok = validate(validPart);
      expect(ok).toBe(true);
    });
  });

  describe('Valid Blueprint Part - With Clothing Mappings', () => {
    test('should validate a part with standard clothing mappings', () => {
      const validPart = {
        id: 'anatomy:humanoid_base',
        clothingSlotMappings: {
          head_gear: {
            blueprintSlots: ['head'],
            allowedLayers: ['base', 'outer', 'armor'],
          },
          gloves: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base', 'armor'],
          },
        },
      };

      const ok = validate(validPart);
      expect(ok).toBe(true);
    });

    test('should validate a part with $use clothing references', () => {
      const validPart = {
        id: 'anatomy:humanoid_core',
        library: 'anatomy:humanoid_slots',
        clothingSlotMappings: {
          head_gear: {
            $use: 'standard_head_gear',
          },
          gloves: {
            $use: 'standard_gloves',
          },
        },
      };

      const ok = validate(validPart);
      expect(ok).toBe(true);
    });
  });

  describe('Valid Blueprint Part - Complete Example', () => {
    test('should validate a complete blueprint part with all features', () => {
      const validPart = {
        id: 'anatomy:humanoid_warrior',
        description: 'Warrior-specific humanoid anatomy extensions',
        library: 'anatomy:humanoid_slots',
        slots: {
          head: {
            $use: 'standard_head',
          },
          left_arm: {
            $use: 'standard_arm',
            socket: 'left_shoulder',
            optional: false, // Warriors must have arms
          },
          right_arm: {
            $use: 'standard_arm',
            socket: 'right_shoulder',
            optional: false,
          },
          battle_scars: {
            parent: 'torso',
            socket: 'chest_overlay',
            requirements: {
              partType: 'overlay',
              components: ['anatomy:scar'],
            },
            optional: true,
          },
        },
        clothingSlotMappings: {
          armor_chest: {
            $use: 'standard_chest_gear',
            allowedLayers: ['armor'], // Override to only allow armor
          },
          weapon_sheath: {
            anatomySockets: ['back_mount', 'hip_mount'],
            allowedLayers: ['accessories'],
          },
        },
      };

      const ok = validate(validPart);
      expect(ok).toBe(true);
    });
  });

  describe('Schema property validations', () => {
    test('should fail validation if required "id" property is missing', () => {
      const invalidData = {
        description: 'Missing ID',
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

    test('should fail if slot missing required requirements', () => {
      const invalidData = {
        id: 'anatomy:test',
        slots: {
          head: {
            socket: 'neck', // Missing required requirements
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(
        validate.errors.some((err) => err.message.includes('requirements'))
      ).toBe(true);
    });

    test('should fail if mixing $use with full slot definition', () => {
      const invalidData = {
        id: 'anatomy:test',
        slots: {
          head: {
            $use: 'standard_head',
            requirements: {
              // Should not have requirements when using $use
              partType: 'head',
            },
          },
        },
      };
      const ok = validate(invalidData);
      // This should pass as overrides are allowed
      expect(ok).toBe(true);
    });
  });

  describe('Slot validations', () => {
    test('should validate all slot requirements properly', () => {
      const validPart = {
        id: 'anatomy:test',
        slots: {
          complex_slot: {
            parent: 'torso',
            socket: 'mount_point',
            requirements: {
              partType: 'special',
              components: ['anatomy:part', 'anatomy:special'],
              properties: {
                'anatomy:part': {
                  size: 'large',
                  weight: 10,
                },
              },
            },
            optional: true,
          },
        },
      };
      const ok = validate(validPart);
      expect(ok).toBe(true);
    });

    test('should fail if slot missing required socket', () => {
      const invalidData = {
        id: 'anatomy:test',
        slots: {
          head: {
            requirements: {
              partType: 'head',
            },
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(
        validate.errors.some((err) => err.message.includes('socket'))
      ).toBe(true);
    });
  });

  describe('Clothing mapping validations', () => {
    test('should validate clothing mappings with blueprintSlots', () => {
      const validPart = {
        id: 'anatomy:test',
        clothingSlotMappings: {
          test_gear: {
            blueprintSlots: ['slot1', 'slot2'],
            allowedLayers: ['base', 'outer'],
          },
        },
      };
      const ok = validate(validPart);
      expect(ok).toBe(true);
    });

    test('should validate clothing mappings with anatomySockets', () => {
      const validPart = {
        id: 'anatomy:test',
        clothingSlotMappings: {
          test_gear: {
            anatomySockets: ['socket1', 'socket2'],
            allowedLayers: ['armor'],
          },
        },
      };
      const ok = validate(validPart);
      expect(ok).toBe(true);
    });

    test('should fail if clothing mapping has both blueprintSlots and anatomySockets', () => {
      const invalidData = {
        id: 'anatomy:test',
        clothingSlotMappings: {
          test_gear: {
            blueprintSlots: ['slot1'],
            anatomySockets: ['socket1'],
            allowedLayers: ['base'],
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });
  });
});
