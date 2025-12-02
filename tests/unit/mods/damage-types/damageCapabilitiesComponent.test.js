/**
 * @file Test suite for validating damage_capabilities component against its schema
 * @see data/mods/damage-types/components/damage_capabilities.component.json
 */

import { describe, expect, beforeAll, test } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import damageCapabilitiesComponent from '../../../../data/mods/damage-types/components/damage_capabilities.component.json';
import damageCapabilityEntrySchema from '../../../../data/schemas/damage-capability-entry.schema.json';

describe('damage_capabilities Component', () => {
  /** @type {import('ajv').Ajv} */
  let ajv;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    // Add referenced schema so validation can resolve $ref
    ajv.addSchema(
      damageCapabilityEntrySchema,
      'schema://living-narrative-engine/damage-capability-entry.schema.json'
    );
  });

  describe('Component structure', () => {
    test('should have correct component id', () => {
      expect(damageCapabilitiesComponent.id).toBe('damage-types:damage_capabilities');
    });

    test('should have description', () => {
      expect(damageCapabilitiesComponent.description).toBeDefined();
      expect(typeof damageCapabilitiesComponent.description).toBe('string');
    });

    test('should have valid dataSchema', () => {
      expect(damageCapabilitiesComponent.dataSchema).toBeDefined();
      expect(damageCapabilitiesComponent.dataSchema.type).toBe('object');
    });

    test('should require entries array', () => {
      expect(damageCapabilitiesComponent.dataSchema.required).toContain('entries');
    });

    test('should enforce minItems: 1 on entries array', () => {
      expect(damageCapabilitiesComponent.dataSchema.properties.entries.minItems).toBe(1);
    });
  });

  describe('Data validation', () => {
    /** @type {import('ajv').ValidateFunction} */
    let validateData;

    beforeAll(() => {
      validateData = ajv.compile(damageCapabilitiesComponent.dataSchema);
    });

    test('should accept valid data with single entry', () => {
      const data = {
        entries: [
          { name: 'slashing', amount: 4 },
        ],
      };
      expect(validateData(data)).toBe(true);
    });

    test('should accept valid data with multiple entries', () => {
      const data = {
        entries: [
          { name: 'slashing', amount: 4 },
          { name: 'fire', amount: 2, burn: { enabled: true } },
        ],
      };
      expect(validateData(data)).toBe(true);
    });

    test('should accept entry with full effect configuration', () => {
      const data = {
        entries: [
          {
            name: 'slashing',
            amount: 5,
            penetration: 0.3,
            bleed: { enabled: true, severity: 'moderate', baseDurationTurns: 3 },
          },
        ],
      };
      expect(validateData(data)).toBe(true);
    });

    test('should reject empty entries array', () => {
      const data = {
        entries: [],
      };
      expect(validateData(data)).toBe(false);
    });

    test('should reject missing entries field', () => {
      const data = {};
      expect(validateData(data)).toBe(false);
    });

    test('should reject additional properties', () => {
      const data = {
        entries: [{ name: 'slashing', amount: 4 }],
        unknown: true,
      };
      expect(validateData(data)).toBe(false);
    });
  });
});
