import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import damageTypeSchema from '../../../data/schemas/damage-type.schema.json';

/**
 * Tests the damage-type schema validation.
 *
 * Note: The global damage-type definition files (blunt.json, slashing.json, piercing.json)
 * have been removed as part of WEADAMCAPREF-010. Damage type data now lives inline on
 * weapon entities via the damage_capabilities component. These tests now use inline test data.
 */
describe('Damage Type Schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv();
    addFormats(ajv);
    validate = ajv.compile(damageTypeSchema);
  });

  test('should validate blunt damage type structure', () => {
    const bluntData = {
      id: 'blunt',
      name: 'Blunt',
      description: 'Damage from blunt force trauma.',
      penetration: 0.1,
      bleed: { enabled: false },
      fracture: { enabled: true, thresholdFraction: 0.5, stunChance: 0.3 },
    };
    const isValid = validate(bluntData);
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(isValid).toBe(true);
  });

  test('should validate slashing damage type structure', () => {
    const slashingData = {
      id: 'slashing',
      name: 'Slashing',
      description: 'Damage from slicing or cutting attacks.',
      penetration: 0.3,
      bleed: { enabled: true, severity: 'moderate', baseDurationTurns: 3 },
      dismember: { enabled: true, thresholdFraction: 0.8 },
    };
    const isValid = validate(slashingData);
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(isValid).toBe(true);
  });

  test('should validate piercing damage type structure', () => {
    const piercingData = {
      id: 'piercing',
      name: 'Piercing',
      description: 'Damage from stabbing or puncturing attacks.',
      penetration: 0.6,
      bleed: { enabled: true, severity: 'minor', baseDurationTurns: 2 },
    };
    const isValid = validate(piercingData);
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(isValid).toBe(true);
  });

  test('should reject invalid damage type (missing required fields)', () => {
    const invalidData = {
      id: 'invalid',
      // Missing name and description
    };
    const isValid = validate(invalidData);
    expect(isValid).toBe(false);
  });

  test('should reject invalid penetration value', () => {
    const invalidData = {
      id: 'invalid_penetration',
      name: 'Invalid Penetration',
      description: 'Test',
      penetration: 1.5, // > 1
    };
    const isValid = validate(invalidData);
    expect(isValid).toBe(false);
  });

  test('should validate with optional fields missing (defaults)', () => {
    const minimalData = {
      id: 'minimal',
      name: 'Minimal',
      description: 'Minimal description',
    };
    const isValid = validate(minimalData);
    expect(isValid).toBe(true);
  });
});
