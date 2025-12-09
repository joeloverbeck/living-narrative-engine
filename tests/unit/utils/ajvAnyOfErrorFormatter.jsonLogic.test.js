/**
 * @file Tests that JSON Logic rules are not misidentified as missing operation types
 * by the AJV anyOf error formatter.
 *
 * This test was created to reproduce and verify the fix for the bug where
 * seduction action files with valid JSON Logic prerequisites were incorrectly
 * flagged with "Missing operation type" errors.
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatAjvErrorsEnhanced,
  formatAnyOfErrors,
} from '../../../src/utils/ajvAnyOfErrorFormatter.js';

describe('ajvAnyOfErrorFormatter - JSON Logic Detection', () => {
  // Simulate the error array that would be generated when validating
  // a JSON Logic rule against an operation schema (many anyOf failures)
  const generateMockAnyOfErrors = (count) => {
    const errors = [];
    for (let i = 0; i < count; i++) {
      errors.push({
        keyword: 'const',
        instancePath: '',
        schemaPath: `#/anyOf/${i}/properties/type/const`,
        params: { allowedValue: `OPERATION_TYPE_${i}` },
        message: `must be equal to constant`,
      });
    }
    // Add the anyOf wrapper error
    errors.push({
      keyword: 'anyOf',
      instancePath: '',
      schemaPath: '#/anyOf',
      params: {},
      message: 'must match a schema in anyOf',
    });
    return errors;
  };

  describe('formatAjvErrorsEnhanced', () => {
    it('should NOT return "Missing operation type" for JSON Logic with negation operator (!)', () => {
      const jsonLogicRule = {
        '!': {
          isSlotExposed: [
            'actor',
            'torso_lower',
            { includeUnderwear: true, includeAccessories: true },
          ],
        },
      };
      const errors = generateMockAnyOfErrors(55);

      const result = formatAjvErrorsEnhanced(errors, jsonLogicRule);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });

    it('should NOT return "Missing operation type" for JSON Logic with "and" operator', () => {
      const jsonLogicRule = {
        and: [
          { hasPartOfType: ['actor', 'penis'] },
          { hasOtherActorsAtLocation: ['actor'] },
        ],
      };
      const errors = generateMockAnyOfErrors(55);

      const result = formatAjvErrorsEnhanced(errors, jsonLogicRule);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });

    it('should NOT return "Missing operation type" for JSON Logic with "or" operator', () => {
      const jsonLogicRule = {
        or: [
          { '==': [{ var: 'actor.position' }, 'standing'] },
          { '==': [{ var: 'actor.position' }, 'sitting'] },
        ],
      };
      const errors = generateMockAnyOfErrors(55);

      const result = formatAjvErrorsEnhanced(errors, jsonLogicRule);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });

    it('should NOT return "Missing operation type" for JSON Logic with custom operator', () => {
      const jsonLogicRule = {
        isSlotExposed: [
          'actor',
          'torso_lower',
          { includeUnderwear: true, includeAccessories: true },
        ],
      };
      const errors = generateMockAnyOfErrors(55);

      const result = formatAjvErrorsEnhanced(errors, jsonLogicRule);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });

    it('should NOT return "Missing operation type" for JSON Logic with "var" operator', () => {
      const jsonLogicRule = {
        var: 'actor.components.positioning:position.value',
      };
      const errors = generateMockAnyOfErrors(55);

      const result = formatAjvErrorsEnhanced(errors, jsonLogicRule);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });

    it('should NOT return "Missing operation type" for JSON Logic with comparison operators', () => {
      const jsonLogicRule = {
        '==': [{ var: 'actor.health' }, 100],
      };
      const errors = generateMockAnyOfErrors(55);

      const result = formatAjvErrorsEnhanced(errors, jsonLogicRule);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });

    it('should still return "Missing operation type" for objects without type/macro AND without JSON Logic operators', () => {
      // This is an actual malformed operation - should still trigger the error
      const malformedOperation = {
        parameters: {
          entity_ref: 'actor',
          component_id: 'test:component',
        },
      };
      const errors = generateMockAnyOfErrors(55);

      const result = formatAjvErrorsEnhanced(errors, malformedOperation);

      expect(result).toContain('Missing operation type');
    });
  });

  describe('Real-world seduction action prerequisite scenarios', () => {
    it('should handle draw_attention_to_ass prerequisite structure', () => {
      // This is the actual structure from draw_attention_to_ass.action.json
      const prerequisite = {
        logic: {
          '!': {
            isSlotExposed: [
              'actor',
              'torso_lower',
              { includeUnderwear: true, includeAccessories: true },
            ],
          },
        },
        failure_message:
          'You need to be wearing clothing on your lower torso to draw attention to your ass.',
      };

      // The validation would fail on the 'logic' field's value
      const errors = generateMockAnyOfErrors(55);

      // Test that the logic object itself is not flagged
      const result = formatAjvErrorsEnhanced(errors, prerequisite.logic);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });

    it('should handle grab_crotch_draw_attention prerequisite structure', () => {
      // Structure from grab_crotch_draw_attention.action.json
      const prerequisite = {
        logic: {
          '!': {
            isSlotExposed: [
              'actor',
              'torso_lower',
              { includeUnderwear: true, includeAccessories: true },
            ],
          },
        },
        failure_message:
          'Your crotch needs to be covered to emphasize the bulge.',
      };

      const errors = generateMockAnyOfErrors(55);
      const result = formatAjvErrorsEnhanced(errors, prerequisite.logic);

      expect(result).not.toContain('Missing operation type');
      expect(result).not.toContain('needs a "type" field');
    });
  });
});
