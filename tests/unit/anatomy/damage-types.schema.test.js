import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import damageTypeSchema from '../../../data/schemas/damage-type.schema.json';
import bluntData from '../../../data/mods/anatomy/damage-types/blunt.json';
import slashingData from '../../../data/mods/anatomy/damage-types/slashing.json';
import piercingData from '../../../data/mods/anatomy/damage-types/piercing.json';

describe('Damage Type Schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv();
    addFormats(ajv);
    validate = ajv.compile(damageTypeSchema);
  });

  test('should validate blunt.json', () => {
    const isValid = validate(bluntData);
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(isValid).toBe(true);
  });

  test('should validate slashing.json', () => {
    const isValid = validate(slashingData);
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(isValid).toBe(true);
  });

  test('should validate piercing.json', () => {
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
      penetration: 1.5 // > 1
    };
    const isValid = validate(invalidData);
    expect(isValid).toBe(false);
  });

  test('should validate with optional fields missing (defaults)', () => {
    const minimalData = {
      id: 'minimal',
      name: 'Minimal',
      description: 'Minimal description'
    };
    const isValid = validate(minimalData);
    expect(isValid).toBe(true);
  });
});
