/**
 * @file Test suite to validate damage_capabilities component on beak entities
 * @see data/mods/anatomy-creatures/entities/definitions/beak.entity.json
 * @see data/mods/anatomy-creatures/entities/definitions/chicken_beak.entity.json
 * @see data/mods/anatomy-creatures/entities/definitions/tortoise_beak.entity.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import damageCapabilitiesComponent from '../../../../../data/mods/damage-types/components/damage_capabilities.component.json';
import damageCapabilityEntrySchema from '../../../../../data/schemas/damage-capability-entry.schema.json';

// --- Beak entity files to validate ---
import beakEntity from '../../../../../data/mods/anatomy-creatures/entities/definitions/beak.entity.json';
import chickenBeakEntity from '../../../../../data/mods/anatomy-creatures/entities/definitions/chicken_beak.entity.json';
import tortoiseBeakEntity from '../../../../../data/mods/anatomy-creatures/entities/definitions/tortoise_beak.entity.json';

/**
 * Test suite – Beak Damage Capabilities Validation.
 *
 * This suite validates that beak entities have the damage-types:damage_capabilities
 * component correctly configured according to the schema.
 */
describe('Beak Entity Damage Capabilities', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateDamageCapabilities;

  beforeAll(() => {
    const ajv = new Ajv({
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    // Add referenced schema so validation can resolve $ref
    ajv.addSchema(
      damageCapabilityEntrySchema,
      'schema://living-narrative-engine/damage-capability-entry.schema.json'
    );

    validateDamageCapabilities = ajv.compile(
      damageCapabilitiesComponent.dataSchema
    );
  });

  describe('anatomy-creatures:beak (Kraken Beak)', () => {
    const componentData =
      beakEntity.components['damage-types:damage_capabilities'];

    test('should have damage-types:damage_capabilities component', () => {
      expect(componentData).toBeDefined();
    });

    test('should pass schema validation', () => {
      const valid = validateDamageCapabilities(componentData);
      if (!valid) {
        console.error(
          'Validation errors:',
          JSON.stringify(validateDamageCapabilities.errors, null, 2)
        );
      }
      expect(valid).toBe(true);
    });

    test('should have piercing damage type', () => {
      expect(componentData.entries).toHaveLength(1);
      expect(componentData.entries[0].name).toBe('piercing');
    });

    test('should have correct damage amount', () => {
      expect(componentData.entries[0].amount).toBe(15);
    });

    test('should have penetration between 0 and 1', () => {
      const penetration = componentData.entries[0].penetration;
      expect(penetration).toBeGreaterThanOrEqual(0);
      expect(penetration).toBeLessThanOrEqual(1);
    });

    test('should have bleed effect enabled', () => {
      expect(componentData.entries[0].bleed).toBeDefined();
      expect(componentData.entries[0].bleed.enabled).toBe(true);
    });
  });

  describe('anatomy-creatures:chicken_beak (Chicken Beak)', () => {
    const componentData =
      chickenBeakEntity.components['damage-types:damage_capabilities'];

    test('should have damage-types:damage_capabilities component', () => {
      expect(componentData).toBeDefined();
    });

    test('should pass schema validation', () => {
      const valid = validateDamageCapabilities(componentData);
      if (!valid) {
        console.error(
          'Validation errors:',
          JSON.stringify(validateDamageCapabilities.errors, null, 2)
        );
      }
      expect(valid).toBe(true);
    });

    test('should have piercing damage type', () => {
      expect(componentData.entries).toHaveLength(1);
      expect(componentData.entries[0].name).toBe('piercing');
    });

    test('should have minimal damage amount', () => {
      expect(componentData.entries[0].amount).toBe(2);
    });

    test('should have penetration between 0 and 1', () => {
      const penetration = componentData.entries[0].penetration;
      expect(penetration).toBeGreaterThanOrEqual(0);
      expect(penetration).toBeLessThanOrEqual(1);
    });

    test('should have low penetration value', () => {
      expect(componentData.entries[0].penetration).toBeLessThanOrEqual(0.2);
    });
  });

  describe('anatomy-creatures:tortoise_beak (Tortoise Beak)', () => {
    const componentData =
      tortoiseBeakEntity.components['damage-types:damage_capabilities'];

    test('should have damage-types:damage_capabilities component', () => {
      expect(componentData).toBeDefined();
    });

    test('should pass schema validation', () => {
      const valid = validateDamageCapabilities(componentData);
      if (!valid) {
        console.error(
          'Validation errors:',
          JSON.stringify(validateDamageCapabilities.errors, null, 2)
        );
      }
      expect(valid).toBe(true);
    });

    test('should have piercing damage type', () => {
      expect(componentData.entries).toHaveLength(1);
      expect(componentData.entries[0].name).toBe('piercing');
    });

    test('should have moderate damage amount', () => {
      expect(componentData.entries[0].amount).toBe(6);
    });

    test('should have penetration between 0 and 1', () => {
      const penetration = componentData.entries[0].penetration;
      expect(penetration).toBeGreaterThanOrEqual(0);
      expect(penetration).toBeLessThanOrEqual(1);
    });

    test('should have fracture effect enabled', () => {
      expect(componentData.entries[0].fracture).toBeDefined();
      expect(componentData.entries[0].fracture.enabled).toBe(true);
    });

    test('should have fracture thresholdFraction between 0 and 1', () => {
      const threshold = componentData.entries[0].fracture.thresholdFraction;
      expect(threshold).toBeGreaterThanOrEqual(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });
  });

  describe('Existing Component Integrity', () => {
    test('beak should preserve anatomy:part component', () => {
      expect(beakEntity.components['anatomy:part']).toBeDefined();
      expect(beakEntity.components['anatomy:part'].subType).toBe('beak');
    });

    test('chicken_beak should preserve anatomy:part component', () => {
      expect(chickenBeakEntity.components['anatomy:part']).toBeDefined();
      expect(chickenBeakEntity.components['anatomy:part'].subType).toBe(
        'chicken_beak'
      );
    });

    test('tortoise_beak should preserve anatomy:part component', () => {
      expect(tortoiseBeakEntity.components['anatomy:part']).toBeDefined();
      expect(tortoiseBeakEntity.components['anatomy:part'].subType).toBe(
        'tortoise_beak'
      );
    });

    test('beak should preserve anatomy:part_health component', () => {
      expect(beakEntity.components['anatomy:part_health']).toBeDefined();
      expect(beakEntity.components['anatomy:part_health'].maxHealth).toBe(35);
    });

    test('chicken_beak should preserve anatomy:part_health component', () => {
      expect(chickenBeakEntity.components['anatomy:part_health']).toBeDefined();
      expect(
        chickenBeakEntity.components['anatomy:part_health'].maxHealth
      ).toBe(5);
    });

    test('tortoise_beak should preserve anatomy:part_health component', () => {
      expect(
        tortoiseBeakEntity.components['anatomy:part_health']
      ).toBeDefined();
      expect(
        tortoiseBeakEntity.components['anatomy:part_health'].maxHealth
      ).toBe(8);
    });

    test('beak should preserve core:weight component', () => {
      expect(beakEntity.components['core:weight']).toBeDefined();
      expect(beakEntity.components['core:weight'].weight).toBe(5);
    });

    test('chicken_beak should preserve core:weight component', () => {
      expect(chickenBeakEntity.components['core:weight']).toBeDefined();
      expect(chickenBeakEntity.components['core:weight'].weight).toBe(0.005);
    });

    test('tortoise_beak should preserve core:weight component', () => {
      expect(tortoiseBeakEntity.components['core:weight']).toBeDefined();
      expect(tortoiseBeakEntity.components['core:weight'].weight).toBe(0.05);
    });
  });
});
