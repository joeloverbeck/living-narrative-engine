/**
 * @file Test suite for validating Anatomy Blueprint definitions with composition support
 * @see data/schemas/anatomy.blueprint.schema.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// Schemas to be loaded
import anatomyBlueprintSchema from '../../../data/schemas/anatomy.blueprint.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('JSON-Schema – Anatomy Blueprint with Composition', () => {
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

    // Compile the main schema we want to test
    validate = ajv.compile(anatomyBlueprintSchema);
  });

  describe('Valid Blueprint - Traditional (no composition)', () => {
    test('should validate a minimal valid blueprint', () => {
      const validBlueprint = {
        id: 'anatomy:simple',
        root: 'anatomy:simple_torso',
      };

      const ok = validate(validBlueprint);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a traditional blueprint with slots and clothing', () => {
      const validBlueprint = {
        id: 'anatomy:human_male',
        root: 'anatomy:human_male_torso',
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
        clothingSlotMappings: {
          head_gear: {
            blueprintSlots: ['head'],
            allowedLayers: ['base', 'outer', 'armor'],
          },
        },
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });
  });

  describe('Valid Blueprint - With Parts (simple composition)', () => {
    test('should validate a blueprint with parts array', () => {
      const validBlueprint = {
        id: 'anatomy:human_male',
        root: 'anatomy:human_male_torso',
        parts: ['anatomy:humanoid_base', 'anatomy:male_specific'],
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });

    test('should validate a blueprint with parts and additional slots', () => {
      const validBlueprint = {
        id: 'anatomy:human_male',
        root: 'anatomy:human_male_torso',
        parts: ['anatomy:humanoid_base'],
        slots: {
          penis: {
            socket: 'groin',
            requirements: {
              partType: 'penis',
              components: ['anatomy:part'],
            },
          },
        },
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });
  });

  describe('Valid Blueprint - With Compose (advanced composition)', () => {
    test('should validate a blueprint with basic compose instructions', () => {
      const validBlueprint = {
        id: 'anatomy:human_male',
        root: 'anatomy:human_male_torso',
        compose: [
          {
            part: 'anatomy:humanoid_core',
            include: ['slots', 'clothingSlotMappings'],
          },
        ],
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });

    test('should validate a blueprint with compose exclusions', () => {
      const validBlueprint = {
        id: 'anatomy:custom_humanoid',
        root: 'anatomy:custom_torso',
        compose: [
          {
            part: 'anatomy:humanoid_core',
            include: ['slots'],
            excludeSlots: ['left_arm', 'right_arm'], // No arms
          },
          {
            part: 'anatomy:tentacle_pack',
            include: ['slots'],
          },
        ],
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });

    test('should validate compose with clothing exclusions', () => {
      const validBlueprint = {
        id: 'anatomy:armored_humanoid',
        root: 'anatomy:armored_torso',
        compose: [
          {
            part: 'anatomy:humanoid_core',
            include: ['slots', 'clothingSlotMappings'],
            excludeClothingSlots: ['underwear_top', 'underwear_bottom'],
          },
        ],
        clothingSlotMappings: {
          integrated_armor: {
            blueprintSlots: ['torso', 'arms', 'legs'],
            allowedLayers: ['armor'],
          },
        },
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });
  });

  describe('Valid Blueprint - Complex Composition Examples', () => {
    test('should validate blueprint using both parts and compose', () => {
      const validBlueprint = {
        id: 'anatomy:hybrid_creature',
        root: 'anatomy:hybrid_torso',
        parts: ['anatomy:basic_slots'],
        compose: [
          {
            part: 'anatomy:wing_system',
            include: ['slots'],
          },
          {
            part: 'anatomy:tail_system',
            include: ['slots', 'clothingSlotMappings'],
            excludeSlots: ['vestigial_tail'],
          },
        ],
        slots: {
          horn_left: {
            parent: 'head',
            socket: 'horn_mount_left',
            requirements: {
              partType: 'horn',
            },
          },
        },
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });

    test('should validate minimal compose instruction', () => {
      const validBlueprint = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        compose: [
          {
            part: 'anatomy:some_part',
            include: ['slots'],
          },
        ],
      };

      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });
  });

  describe('Schema property validations', () => {
    test('should fail if missing required id', () => {
      const invalidData = {
        root: 'anatomy:torso',
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'id'",
        })
      );
    });

    test('should fail if missing required root', () => {
      const invalidData = {
        id: 'anatomy:test',
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'root'",
        })
      );
    });

    test('should fail with invalid additional properties', () => {
      const invalidData = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        unknownProp: 'value',
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
        })
      );
    });
  });

  describe('Compose instruction validations', () => {
    test('should fail if compose missing required part', () => {
      const invalidData = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        compose: [
          {
            include: ['slots'],
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should fail if compose missing required include', () => {
      const invalidData = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        compose: [
          {
            part: 'anatomy:some_part',
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should fail if include array is empty', () => {
      const invalidData = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        compose: [
          {
            part: 'anatomy:some_part',
            include: [],
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should fail if include has invalid value', () => {
      const invalidData = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        compose: [
          {
            part: 'anatomy:some_part',
            include: ['invalidSection'],
          },
        ],
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });

    test('should validate all valid include options', () => {
      const validBlueprint = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        compose: [
          {
            part: 'anatomy:part1',
            include: ['slots'],
          },
          {
            part: 'anatomy:part2',
            include: ['clothingSlotMappings'],
          },
          {
            part: 'anatomy:part3',
            include: ['slots', 'clothingSlotMappings'],
          },
        ],
      };
      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });
  });

  describe('Slot validations with composition', () => {
    test('should validate slots alongside composition', () => {
      const validBlueprint = {
        id: 'anatomy:extended',
        root: 'anatomy:extended_root',
        parts: ['anatomy:base'],
        slots: {
          extra_slot: {
            socket: 'special_mount',
            requirements: {
              partType: 'special',
            },
          },
        },
      };
      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });

    test('should validate complex slot requirements', () => {
      const validBlueprint = {
        id: 'anatomy:complex',
        root: 'anatomy:complex_root',
        slots: {
          complex_slot: {
            parent: 'torso',
            socket: 'mount',
            requirements: {
              partType: 'augment',
              components: ['anatomy:cybernetic', 'anatomy:powered'],
              properties: {
                'anatomy:cybernetic': {
                  techLevel: 5,
                  compatible: true,
                },
              },
            },
            optional: false,
          },
        },
      };
      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });
  });

  describe('Clothing slot mapping validations', () => {
    test('should validate clothing mappings with all features', () => {
      const validBlueprint = {
        id: 'anatomy:clothing_test',
        root: 'anatomy:test_root',
        clothingSlotMappings: {
          complex_gear: {
            blueprintSlots: ['slot1', 'slot2'],
            allowedLayers: [
              'underwear',
              'base',
              'outer',
              'armor',
              'accessories',
            ],
          },
        },
      };
      const ok = validate(validBlueprint);
      expect(ok).toBe(true);
    });

    test('should enforce oneOf for blueprintSlots vs anatomySockets', () => {
      const invalidData = {
        id: 'anatomy:test',
        root: 'anatomy:test_root',
        clothingSlotMappings: {
          bad_mapping: {
            blueprintSlots: ['slot1'],
            anatomySockets: ['socket1'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
        },
      };
      const ok = validate(invalidData);
      expect(ok).toBe(false);
    });
  });
});
