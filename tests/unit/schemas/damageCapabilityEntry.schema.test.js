/**
 * @file Test suite for validating damage capability entry against damage-capability-entry.schema.json
 * @see data/schemas/damage-capability-entry.schema.json
 * @see specs/weapon-damage-capabilities-refactoring.md
 */

import { describe, expect, beforeAll, test } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import damageCapabilityEntrySchema from '../../../data/schemas/damage-capability-entry.schema.json';

describe('Damage Capability Entry Schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    validate = ajv.compile(damageCapabilityEntrySchema);
  });

  describe('Valid entries', () => {
    test('should accept valid entry with only required fields (name, amount)', () => {
      const entry = {
        name: 'slashing',
        amount: 4,
      };

      const ok = validate(entry);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should accept valid entry with all optional fields', () => {
      const entry = {
        name: 'slashing',
        amount: 4,
        penetration: 0.3,
        bleed: {
          enabled: true,
          severity: 'moderate',
          baseDurationTurns: 3,
        },
        fracture: {
          enabled: false,
          thresholdFraction: 0.5,
          stunChance: 0.2,
        },
        burn: {
          enabled: false,
          dps: 1,
          durationTurns: 2,
          canStack: false,
        },
        poison: {
          enabled: false,
          tickDamage: 1,
          durationTurns: 3,
          scope: 'part',
        },
        dismember: {
          enabled: true,
          thresholdFraction: 0.6,
        },
        flags: ['magical', 'holy'],
      };

      const ok = validate(entry);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should accept entry with amount of 0', () => {
      const entry = {
        name: 'poison',
        amount: 0,
      };

      expect(validate(entry)).toBe(true);
    });

    test('should accept entry with penetration at boundary values', () => {
      expect(validate({ name: 'test', amount: 1, penetration: 0 })).toBe(true);
      expect(validate({ name: 'test', amount: 1, penetration: 1 })).toBe(true);
      expect(validate({ name: 'test', amount: 1, penetration: 0.5 })).toBe(
        true
      );
    });

    test('should accept empty flags array', () => {
      const entry = {
        name: 'slashing',
        amount: 3,
        flags: [],
      };

      expect(validate(entry)).toBe(true);
    });
  });

  describe('Required fields validation', () => {
    test('should reject entry with missing name', () => {
      const entry = {
        amount: 4,
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: expect.objectContaining({ missingProperty: 'name' }),
          }),
        ])
      );
    });

    test('should reject entry with missing amount', () => {
      const entry = {
        name: 'slashing',
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: expect.objectContaining({ missingProperty: 'amount' }),
          }),
        ])
      );
    });

    test('should reject empty name', () => {
      const entry = {
        name: '',
        amount: 4,
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minLength',
          }),
        ])
      );
    });
  });

  describe('Penetration constraints', () => {
    test('should reject penetration > 1', () => {
      const entry = {
        name: 'piercing',
        amount: 3,
        penetration: 1.1,
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'maximum',
          }),
        ])
      );
    });

    test('should reject penetration < 0', () => {
      const entry = {
        name: 'piercing',
        amount: 3,
        penetration: -0.1,
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minimum',
          }),
        ])
      );
    });
  });

  describe('Amount constraints', () => {
    test('should reject negative amount', () => {
      const entry = {
        name: 'slashing',
        amount: -1,
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minimum',
          }),
        ])
      );
    });
  });

  describe('Bleed effect validation', () => {
    test('should reject invalid bleed.severity enum value', () => {
      const entry = {
        name: 'slashing',
        amount: 4,
        bleed: {
          enabled: true,
          severity: 'extreme',
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
          }),
        ])
      );
    });

    test('should accept valid bleed severity values', () => {
      const severities = ['minor', 'moderate', 'severe'];

      severities.forEach((severity) => {
        const entry = {
          name: 'slashing',
          amount: 4,
          bleed: {
            enabled: true,
            severity,
          },
        };

        expect(validate(entry)).toBe(true);
      });
    });

    test('should require enabled field in bleed', () => {
      const entry = {
        name: 'slashing',
        amount: 4,
        bleed: {
          severity: 'moderate',
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: expect.objectContaining({ missingProperty: 'enabled' }),
          }),
        ])
      );
    });

    test('should reject unknown properties in bleed', () => {
      const entry = {
        name: 'slashing',
        amount: 4,
        bleed: {
          enabled: true,
          unknownProperty: 'value',
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
          }),
        ])
      );
    });

    test('should reject baseDurationTurns < 1', () => {
      const entry = {
        name: 'slashing',
        amount: 4,
        bleed: {
          enabled: true,
          baseDurationTurns: 0,
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minimum',
          }),
        ])
      );
    });
  });

  describe('Fracture effect validation', () => {
    test('should accept valid fracture configuration', () => {
      const entry = {
        name: 'blunt',
        amount: 5,
        fracture: {
          enabled: true,
          thresholdFraction: 0.4,
          stunChance: 0.3,
        },
      };

      expect(validate(entry)).toBe(true);
    });

    test('should reject thresholdFraction > 1', () => {
      const entry = {
        name: 'blunt',
        amount: 5,
        fracture: {
          enabled: true,
          thresholdFraction: 1.5,
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'maximum',
          }),
        ])
      );
    });

    test('should reject unknown properties in fracture', () => {
      const entry = {
        name: 'blunt',
        amount: 5,
        fracture: {
          enabled: true,
          unknownField: true,
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
          }),
        ])
      );
    });
  });

  describe('Burn effect validation', () => {
    test('should accept valid burn configuration', () => {
      const entry = {
        name: 'fire',
        amount: 3,
        burn: {
          enabled: true,
          dps: 1.5,
          durationTurns: 3,
          canStack: false,
        },
      };

      expect(validate(entry)).toBe(true);
    });

    test('should reject negative dps', () => {
      const entry = {
        name: 'fire',
        amount: 3,
        burn: {
          enabled: true,
          dps: -1,
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minimum',
          }),
        ])
      );
    });

    test('should reject unknown properties in burn', () => {
      const entry = {
        name: 'fire',
        amount: 3,
        burn: {
          enabled: true,
          extraField: 'value',
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
          }),
        ])
      );
    });
  });

  describe('Poison effect validation', () => {
    test('should accept valid poison configuration', () => {
      const entry = {
        name: 'poison',
        amount: 0,
        poison: {
          enabled: true,
          tickDamage: 2,
          durationTurns: 5,
          scope: 'entity',
        },
      };

      expect(validate(entry)).toBe(true);
    });

    test('should reject invalid scope value', () => {
      const entry = {
        name: 'poison',
        amount: 0,
        poison: {
          enabled: true,
          scope: 'invalid',
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
          }),
        ])
      );
    });

    test('should accept valid scope values', () => {
      const scopes = ['part', 'entity'];

      scopes.forEach((scope) => {
        const entry = {
          name: 'poison',
          amount: 0,
          poison: {
            enabled: true,
            scope,
          },
        };

        expect(validate(entry)).toBe(true);
      });
    });

    test('should reject unknown properties in poison', () => {
      const entry = {
        name: 'poison',
        amount: 0,
        poison: {
          enabled: true,
          unknownField: 'value',
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
          }),
        ])
      );
    });
  });

  describe('Dismember effect validation', () => {
    test('should accept valid dismember configuration', () => {
      const entry = {
        name: 'slashing',
        amount: 6,
        dismember: {
          enabled: true,
          thresholdFraction: 0.5,
        },
      };

      expect(validate(entry)).toBe(true);
    });

    test('should reject thresholdFraction outside 0-1 range', () => {
      const entry = {
        name: 'slashing',
        amount: 6,
        dismember: {
          enabled: true,
          thresholdFraction: 1.2,
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'maximum',
          }),
        ])
      );
    });

    test('should reject unknown properties in dismember', () => {
      const entry = {
        name: 'slashing',
        amount: 6,
        dismember: {
          enabled: true,
          extraField: true,
        },
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
          }),
        ])
      );
    });
  });

  describe('Flags validation', () => {
    test('should accept array of strings', () => {
      const entry = {
        name: 'holy',
        amount: 3,
        flags: ['magical', 'holy', 'silver'],
      };

      expect(validate(entry)).toBe(true);
    });

    test('should reject non-string items in flags', () => {
      const entry = {
        name: 'slashing',
        amount: 3,
        flags: ['valid', 123],
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'type',
          }),
        ])
      );
    });
  });

  describe('Additional properties validation', () => {
    test('should reject unknown top-level properties', () => {
      const entry = {
        name: 'slashing',
        amount: 4,
        unknownProperty: 'value',
      };

      const ok = validate(entry);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
          }),
        ])
      );
    });
  });

  describe('Anoxic damage type (oxygen deprivation)', () => {
    test('should accept anoxic damage with bypass flags', () => {
      const entry = {
        name: 'anoxic',
        amount: 5,
        flags: ['bypasses_armor', 'internal_only'],
      };

      expect(validate(entry)).toBe(true);
    });
  });

  describe('Multi-effect weapon examples', () => {
    test('should accept flaming sword configuration', () => {
      const entry = {
        name: 'slashing',
        amount: 3,
        bleed: { enabled: true, severity: 'minor', baseDurationTurns: 2 },
      };

      expect(validate(entry)).toBe(true);
    });

    test('should accept fire damage configuration', () => {
      const entry = {
        name: 'fire',
        amount: 2,
        burn: { enabled: true, dps: 1.5, durationTurns: 3, canStack: false },
      };

      expect(validate(entry)).toBe(true);
    });

    test('should accept assassin dagger configuration', () => {
      const entry = {
        name: 'piercing',
        amount: 2,
        penetration: 0.9,
        bleed: { enabled: true, severity: 'minor', baseDurationTurns: 2 },
      };

      expect(validate(entry)).toBe(true);
    });

    test('should accept executioner axe configuration', () => {
      const entry = {
        name: 'slashing',
        amount: 6,
        penetration: 0.2,
        bleed: { enabled: true, severity: 'severe', baseDurationTurns: 4 },
        dismember: { enabled: true, thresholdFraction: 0.5 },
      };

      expect(validate(entry)).toBe(true);
    });
  });
});
