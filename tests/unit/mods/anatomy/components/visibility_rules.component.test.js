/**
 * @file Validates the anatomy:visibility_rules component definition and data schema.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';
import visibilityRulesComponent from '../../../../../data/mods/anatomy/components/visibility_rules.component.json';

describe('anatomy:visibility_rules component schema', () => {
  let validateComponentDefinition;
  let validateComponentData;

  beforeAll(() => {
    const ajv = new Ajv({ schemas: [commonSchema], strict: true, allErrors: true });
    addFormats(ajv);

    validateComponentDefinition = ajv.compile(componentSchema);
    validateComponentData = ajv.compile(visibilityRulesComponent.dataSchema);
  });

  describe('definition structure', () => {
    test('conforms to component definition schema', () => {
      const ok = validateComponentDefinition(visibilityRulesComponent);
      if (!ok) {
        console.error(validateComponentDefinition.errors);
      }
      expect(ok).toBe(true);
    });

    test('uses expected component id', () => {
      expect(visibilityRulesComponent.id).toBe('anatomy:visibility_rules');
    });
  });

  describe('data validation', () => {
    test('accepts valid rule with allowed layers', () => {
      const data = {
        clothingSlotId: 'torso_lower',
        nonBlockingLayers: ['underwear', 'accessories'],
        reason: 'Genital coverage rules per spec',
      };

      expect(validateComponentData(data)).toBe(true);
    });

    test('allows empty nonBlockingLayers when everything blocks', () => {
      const data = {
        clothingSlotId: 'torso_upper',
        nonBlockingLayers: [],
      };

      expect(validateComponentData(data)).toBe(true);
    });

    test('rejects invalid layer values', () => {
      const data = {
        clothingSlotId: 'torso_lower',
        nonBlockingLayers: ['cape'],
      };

      expect(validateComponentData(data)).toBe(false);
    });

    test('rejects missing clothingSlotId', () => {
      const data = { nonBlockingLayers: ['underwear'] };
      expect(validateComponentData(data)).toBe(false);
    });

    test('rejects duplicate layers', () => {
      const data = {
        clothingSlotId: 'torso_lower',
        nonBlockingLayers: ['underwear', 'underwear'],
      };

      expect(validateComponentData(data)).toBe(false);
    });

    test('rejects additional properties', () => {
      const data = {
        clothingSlotId: 'torso_lower',
        nonBlockingLayers: ['underwear'],
        extra: true,
      };

      expect(validateComponentData(data)).toBe(false);
    });
  });
});
