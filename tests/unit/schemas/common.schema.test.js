// tests/unit/schemas/common.schema.test.js
// -----------------------------------------------------------------------------
// Unit tests for common.schema.json template string definitions.
// Tests for INV-2: Template Pattern Consistency Invariant (SCHVALTESINT-006)
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import commonSchema from '../../../data/schemas/common.schema.json';

describe('common.schema.json - Template Definitions', () => {
  /** @type {import('ajv').Ajv} */
  let ajv;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
  });

  /**
   * Helper to validate data against a specific definition from common.schema.json
   *
   * @param {string} definitionName - The definition name (e.g., 'templateString')
   * @param {unknown} data - The data to validate
   * @returns {boolean} - Whether validation passed
   */
  function validateDefinition(definitionName, data) {
    const wrapperSchema = {
      $ref: `schema://living-narrative-engine/common.schema.json#/definitions/${definitionName}`,
    };
    const validate = ajv.compile(wrapperSchema);
    return validate(data);
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * TEMPLATE STRING DEFINITION
   * Pattern: ^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('templateString definition', () => {
    describe('valid template strings', () => {
      test.each([
        ['{context.value}', 'simple dot notation'],
        ['{event.payload.actorId}', 'multiple nested properties'],
        ['{context.targetGrabbingReqs.handsRequired}', 'deeply nested'],
        ['{actor_stats.strength}', 'underscore in path'],
        ['{x}', 'single character'],
        ['{_private}', 'starts with underscore'],
        ['{abc123}', 'alphanumeric'],
        ['{a.b.c.d.e}', 'many levels of nesting'],
        ['{Context.Value}', 'mixed case'],
        ['{UPPERCASE}', 'all uppercase'],
      ])('✓ should accept "%s" (%s)', (input) => {
        expect(validateDefinition('templateString', input)).toBe(true);
      });
    });

    describe('invalid template strings', () => {
      test('✗ should reject empty template {}', () => {
        expect(validateDefinition('templateString', '{}')).toBe(false);
      });

      test('✗ should reject template with leading space { context.value}', () => {
        expect(validateDefinition('templateString', '{ context.value}')).toBe(
          false
        );
      });

      test('✗ should reject template with trailing space {context.value }', () => {
        expect(validateDefinition('templateString', '{context.value }')).toBe(
          false
        );
      });

      test('✗ should reject template with spaces { context.value }', () => {
        expect(validateDefinition('templateString', '{ context.value }')).toBe(
          false
        );
      });

      test('✗ should reject double braces {{context.value}}', () => {
        expect(validateDefinition('templateString', '{{context.value}}')).toBe(
          false
        );
      });

      test('✗ should reject trailing dot {context.}', () => {
        expect(validateDefinition('templateString', '{context.}')).toBe(false);
      });

      test('✗ should reject leading dot {.value}', () => {
        expect(validateDefinition('templateString', '{.value}')).toBe(false);
      });

      test('✗ should reject starting with number {123abc}', () => {
        expect(validateDefinition('templateString', '{123abc}')).toBe(false);
      });

      test('✗ should reject hyphen {context-value}', () => {
        expect(validateDefinition('templateString', '{context-value}')).toBe(
          false
        );
      });

      test('✗ should reject consecutive dots {context..value}', () => {
        expect(validateDefinition('templateString', '{context..value}')).toBe(
          false
        );
      });

      test('✗ should reject plain string without braces', () => {
        expect(validateDefinition('templateString', 'context.value')).toBe(
          false
        );
      });

      test('✗ should reject missing closing brace', () => {
        expect(validateDefinition('templateString', '{context.value')).toBe(
          false
        );
      });

      test('✗ should reject missing opening brace', () => {
        expect(validateDefinition('templateString', 'context.value}')).toBe(
          false
        );
      });

      test('✗ should reject number', () => {
        expect(validateDefinition('templateString', 42)).toBe(false);
      });

      test('✗ should reject null', () => {
        expect(validateDefinition('templateString', null)).toBe(false);
      });
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * INTEGER OR TEMPLATE DEFINITION
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('integerOrTemplate definition', () => {
    test('✓ should accept positive integer', () => {
      expect(validateDefinition('integerOrTemplate', 5)).toBe(true);
    });

    test('✓ should accept zero', () => {
      expect(validateDefinition('integerOrTemplate', 0)).toBe(true);
    });

    test('✓ should accept negative integer', () => {
      expect(validateDefinition('integerOrTemplate', -10)).toBe(true);
    });

    test('✓ should accept valid template string', () => {
      expect(validateDefinition('integerOrTemplate', '{context.count}')).toBe(
        true
      );
    });

    test('✗ should reject plain string', () => {
      expect(validateDefinition('integerOrTemplate', 'five')).toBe(false);
    });

    test('✗ should reject decimal number', () => {
      expect(validateDefinition('integerOrTemplate', 5.5)).toBe(false);
    });

    test('✗ should reject boolean', () => {
      expect(validateDefinition('integerOrTemplate', true)).toBe(false);
    });

    test('✗ should reject invalid template', () => {
      expect(validateDefinition('integerOrTemplate', '{}')).toBe(false);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * POSITIVE INTEGER OR TEMPLATE DEFINITION
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('positiveIntegerOrTemplate definition', () => {
    test('✓ should accept positive integer (1)', () => {
      expect(validateDefinition('positiveIntegerOrTemplate', 1)).toBe(true);
    });

    test('✓ should accept positive integer (100)', () => {
      expect(validateDefinition('positiveIntegerOrTemplate', 100)).toBe(true);
    });

    test('✓ should accept valid template string', () => {
      expect(
        validateDefinition(
          'positiveIntegerOrTemplate',
          '{context.handsRequired}'
        )
      ).toBe(true);
    });

    test('✗ should reject zero', () => {
      expect(validateDefinition('positiveIntegerOrTemplate', 0)).toBe(false);
    });

    test('✗ should reject negative integer', () => {
      expect(validateDefinition('positiveIntegerOrTemplate', -1)).toBe(false);
    });

    test('✗ should reject plain string', () => {
      expect(validateDefinition('positiveIntegerOrTemplate', 'one')).toBe(
        false
      );
    });

    test('✗ should reject decimal', () => {
      expect(validateDefinition('positiveIntegerOrTemplate', 1.5)).toBe(false);
    });

    test('✗ should reject invalid template (empty)', () => {
      expect(validateDefinition('positiveIntegerOrTemplate', '{}')).toBe(false);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * STRING OR TEMPLATE DEFINITION
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('stringOrTemplate definition', () => {
    test('✓ should accept plain string', () => {
      expect(validateDefinition('stringOrTemplate', 'hello world')).toBe(true);
    });

    test('✓ should accept valid template string', () => {
      expect(
        validateDefinition('stringOrTemplate', '{event.payload.message}')
      ).toBe(true);
    });

    test('✓ should accept single character string', () => {
      expect(validateDefinition('stringOrTemplate', 'a')).toBe(true);
    });

    test('✗ should reject empty string', () => {
      expect(validateDefinition('stringOrTemplate', '')).toBe(false);
    });

    test('✗ should reject number', () => {
      expect(validateDefinition('stringOrTemplate', 42)).toBe(false);
    });

    test('✗ should reject boolean', () => {
      expect(validateDefinition('stringOrTemplate', true)).toBe(false);
    });

    test('✗ should reject object', () => {
      expect(validateDefinition('stringOrTemplate', { key: 'value' })).toBe(
        false
      );
    });

    test('✗ should reject null', () => {
      expect(validateDefinition('stringOrTemplate', null)).toBe(false);
    });

    test('✗ should reject invalid template (empty braces)', () => {
      expect(validateDefinition('stringOrTemplate', '{}')).toBe(false);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * BOOLEAN OR TEMPLATE DEFINITION
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('booleanOrTemplate definition', () => {
    test('✓ should accept true', () => {
      expect(validateDefinition('booleanOrTemplate', true)).toBe(true);
    });

    test('✓ should accept false', () => {
      expect(validateDefinition('booleanOrTemplate', false)).toBe(true);
    });

    test('✓ should accept valid template string', () => {
      expect(
        validateDefinition('booleanOrTemplate', '{context.isEnabled}')
      ).toBe(true);
    });

    test('✗ should reject string "true"', () => {
      expect(validateDefinition('booleanOrTemplate', 'true')).toBe(false);
    });

    test('✗ should reject string "false"', () => {
      expect(validateDefinition('booleanOrTemplate', 'false')).toBe(false);
    });

    test('✗ should reject number 1', () => {
      expect(validateDefinition('booleanOrTemplate', 1)).toBe(false);
    });

    test('✗ should reject number 0', () => {
      expect(validateDefinition('booleanOrTemplate', 0)).toBe(false);
    });

    test('✗ should reject invalid template', () => {
      expect(validateDefinition('booleanOrTemplate', '{}')).toBe(false);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * ENTITY ID OR TEMPLATE DEFINITION
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('entityIdOrTemplate definition', () => {
    test('✓ should accept valid entity ID "core:actor"', () => {
      expect(validateDefinition('entityIdOrTemplate', 'core:actor')).toBe(true);
    });

    test('✓ should accept valid entity ID "weapons:sword_iron"', () => {
      expect(
        validateDefinition('entityIdOrTemplate', 'weapons:sword_iron')
      ).toBe(true);
    });

    test('✓ should accept valid entity ID with numbers "mod1:item2"', () => {
      expect(validateDefinition('entityIdOrTemplate', 'mod1:item2')).toBe(true);
    });

    test('✓ should accept valid template string', () => {
      expect(
        validateDefinition('entityIdOrTemplate', '{event.payload.targetId}')
      ).toBe(true);
    });

    test('✗ should reject ID without namespace', () => {
      expect(validateDefinition('entityIdOrTemplate', 'actor')).toBe(false);
    });

    test('✗ should reject ID with uppercase (modId)', () => {
      expect(validateDefinition('entityIdOrTemplate', 'Core:actor')).toBe(
        false
      );
    });

    test('✗ should reject ID with uppercase (identifier)', () => {
      expect(validateDefinition('entityIdOrTemplate', 'core:Actor')).toBe(
        false
      );
    });

    test('✗ should reject ID starting with number', () => {
      expect(validateDefinition('entityIdOrTemplate', '1core:actor')).toBe(
        false
      );
    });

    test('✗ should reject ID with hyphen', () => {
      expect(validateDefinition('entityIdOrTemplate', 'core:my-actor')).toBe(
        false
      );
    });

    test('✗ should reject invalid template (empty)', () => {
      expect(validateDefinition('entityIdOrTemplate', '{}')).toBe(false);
    });

    test('✗ should reject number', () => {
      expect(validateDefinition('entityIdOrTemplate', 123)).toBe(false);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * CROSS-DEFINITION CONSISTENCY
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('cross-definition consistency', () => {
    const validTemplates = [
      '{context.value}',
      '{event.payload.actorId}',
      '{context.targetGrabbingReqs.handsRequired}',
    ];

    test('all *OrTemplate definitions should accept the same valid templates', () => {
      const orTemplateDefinitions = [
        'integerOrTemplate',
        'positiveIntegerOrTemplate',
        'stringOrTemplate',
        'booleanOrTemplate',
        'entityIdOrTemplate',
      ];

      for (const definition of orTemplateDefinitions) {
        for (const template of validTemplates) {
          expect(validateDefinition(definition, template)).toBe(true);
        }
      }
    });

    test('all definitions should reject invalid templates consistently', () => {
      const invalidTemplates = ['{}', '{ space }', '{123start}', '{dash-here}'];
      const orTemplateDefinitions = [
        'integerOrTemplate',
        'positiveIntegerOrTemplate',
        'stringOrTemplate',
        'booleanOrTemplate',
        'entityIdOrTemplate',
      ];

      for (const definition of orTemplateDefinitions) {
        for (const template of invalidTemplates) {
          expect(validateDefinition(definition, template)).toBe(false);
        }
      }
    });
  });
});
