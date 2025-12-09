// tests/unit/schemas/jsonLogicSchemaObjectArgs.test.js
// -----------------------------------------------------------------------------
// Unit tests for json-logic.schema.json supporting object arguments.
// Tests that custom operators can accept options objects as arguments.
// Created to fix validation failures for seduction action prerequisites.
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';

describe('json-logic.schema.json - Object Arguments Support', () => {
  /** @type {import('ajv').Ajv} */
  let ajv;
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    // Add schemas in dependency order
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    ajv.addSchema(
      jsonLogicSchema,
      'schema://living-narrative-engine/json-logic.schema.json'
    );
    ajv.addSchema(
      conditionContainerSchema,
      'schema://living-narrative-engine/condition-container.schema.json'
    );
    validate = ajv.compile({
      $ref: 'schema://living-narrative-engine/json-logic.schema.json',
    });
  });

  describe('custom operators with object arguments', () => {
    test('should accept isSlotExposed with options object', () => {
      const rule = {
        isSlotExposed: [
          'actor',
          'torso_lower',
          { includeUnderwear: true, includeAccessories: true },
        ],
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });

    test('should accept negated isSlotExposed with options object', () => {
      const rule = {
        '!': {
          isSlotExposed: [
            'actor',
            'torso_lower',
            { includeUnderwear: true, includeAccessories: true },
          ],
        },
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });

    test('should accept custom operator with empty options object', () => {
      const rule = {
        customOperator: ['arg1', 'arg2', {}],
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });

    test('should accept custom operator with nested options object', () => {
      const rule = {
        customOperator: [
          'arg1',
          { nested: { deeply: { value: true } }, anotherKey: 'string' },
        ],
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });
  });

  describe('seduction action prerequisite structures', () => {
    test('should validate draw_attention_to_ass prerequisite logic', () => {
      // Actual structure from draw_attention_to_ass.action.json
      const rule = {
        '!': {
          isSlotExposed: [
            'actor',
            'torso_lower',
            { includeUnderwear: true, includeAccessories: true },
          ],
        },
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });

    test('should validate draw_attention_to_breasts prerequisite logic', () => {
      // Actual structure from draw_attention_to_breasts.action.json
      const rule = {
        '!': {
          isSlotExposed: [
            'actor',
            'torso_upper',
            { includeUnderwear: true, includeAccessories: true },
          ],
        },
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });

    test('should validate grab_crotch_draw_attention prerequisite logic', () => {
      // Actual structure from grab_crotch_draw_attention.action.json
      const rule = {
        '!': {
          isSlotExposed: [
            'actor',
            'torso_lower',
            { includeUnderwear: true, includeAccessories: true },
          ],
        },
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });
  });

  describe('combined with other valid rule_logic types', () => {
    test('should accept objects alongside primitives in arrays', () => {
      const rule = {
        customOp: ['string', 123, true, null, { option: 'value' }],
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });

    test('should accept objects in deeply nested structures', () => {
      const rule = {
        and: [
          { hasPartOfType: ['actor', 'penis'] },
          {
            '!': {
              isSlotExposed: [
                'actor',
                'torso_lower',
                { includeUnderwear: true },
              ],
            },
          },
          { hasOtherActorsAtLocation: ['actor'] },
        ],
      };
      const valid = validate(rule);
      expect(valid).toBe(true);
    });
  });

  describe('existing functionality preserved', () => {
    test('should still accept primitives', () => {
      const rules = [
        { var: 'actor.name' },
        { '==': [{ var: 'health' }, 100] },
        { '>': [{ var: 'count' }, 0] },
      ];
      for (const rule of rules) {
        expect(validate(rule)).toBe(true);
      }
    });

    test('should still accept arrays', () => {
      const rule = {
        and: [
          { var: 'condition1' },
          { var: 'condition2' },
          { or: [{ var: 'a' }, { var: 'b' }] },
        ],
      };
      expect(validate(rule)).toBe(true);
    });

    test('should still reject invalid structures', () => {
      // Multiple operators at root level (maxProperties: 1)
      const invalidRule = {
        and: [{ var: 'a' }],
        or: [{ var: 'b' }],
      };
      expect(validate(invalidRule)).toBe(false);
    });
  });
});
