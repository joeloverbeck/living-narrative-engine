// tests/unit/schemas/actionSchemaTargetForbiddenComponents.test.js
// -----------------------------------------------------------------------------
// Unit tests for target forbidden components in action schema validation
// Tests target validation, multi-target role validation, and backward compatibility
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';

describe('Action Schema Target Forbidden Components', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Add common schema for base definitions
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );

    // Add JSON Logic schema
    ajv.addSchema(
      jsonLogicSchema,
      'schema://living-narrative-engine/json-logic.schema.json'
    );

    // Add condition container schema
    ajv.addSchema(
      conditionContainerSchema,
      'schema://living-narrative-engine/condition-container.schema.json'
    );

    validate = ajv.compile(actionSchema);
  });

  // ── BACKWARD COMPATIBILITY TESTS ──────────────────────────────────────────

  describe('Backward Compatibility', () => {
    test('✓ should maintain backward compatibility with actor-only validation', () => {
      const action = {
        id: 'test:actor_only',
        name: 'Test Actor Only',
        description: 'Test action with actor-only forbidden components',
        template: 'test action',
        targets: 'test:scope',
        forbidden_components: {
          actor: ['positioning:kneeling_before', 'positioning:sitting_on'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✓ should accept actions without forbidden_components', () => {
      const action = {
        id: 'test:no_forbidden',
        name: 'Test No Forbidden',
        description: 'Test action without forbidden components',
        template: 'test action',
        targets: 'test:scope',
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✓ should accept empty forbidden_components object', () => {
      const action = {
        id: 'test:empty_forbidden',
        name: 'Test Empty Forbidden',
        description: 'Test action with empty forbidden components',
        template: 'test action',
        targets: 'test:scope',
        forbidden_components: {},
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  // ── SINGLE TARGET VALIDATION TESTS ────────────────────────────────────────

  describe('Single Target Validation', () => {
    test('✓ should validate action with target forbidden components', () => {
      const action = {
        id: 'test:target_forbidden',
        name: 'Test Target Forbidden',
        description: 'Test action with target forbidden components',
        template: 'test {target}',
        targets: 'test:scope',
        forbidden_components: {
          target: ['positioning:sitting_on', 'positioning:laying_down'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✓ should validate action with both actor and target forbidden components', () => {
      const action = {
        id: 'test:both_forbidden',
        name: 'Test Both Forbidden',
        description:
          'Test action with both actor and target forbidden components',
        template: 'test {target}',
        targets: 'test:scope',
        forbidden_components: {
          actor: ['positioning:kneeling_before'],
          target: ['positioning:sitting_on'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✗ should reject invalid component format in target forbidden components', () => {
      const action = {
        id: 'test:invalid_format',
        name: 'Test Invalid Format',
        description: 'Test action with invalid format',
        template: 'test {target}',
        targets: 'test:scope',
        forbidden_components: {
          target: ['invalid-format', 'also:invalid:format'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].schemaPath).toContain('pattern');
    });
  });

  // ── MULTI-TARGET ROLE VALIDATION TESTS ────────────────────────────────────

  describe('Multi-Target Role Validation', () => {
    test('✓ should validate multi-target action with primary forbidden components', () => {
      const action = {
        id: 'test:multi_primary',
        name: 'Test Multi Primary',
        description: 'Test multi-target action with primary forbidden',
        template: 'test {primary}',
        targets: {
          primary: {
            scope: 'test:primary_scope',
            placeholder: 'primary',
          },
        },
        forbidden_components: {
          primary: ['positioning:kneeling_before', 'positioning:sitting_on'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✓ should validate multi-target action with all role forbidden components', () => {
      const action = {
        id: 'test:multi_all_roles',
        name: 'Test Multi All Roles',
        description: 'Test multi-target action with all roles',
        template: 'test {primary} {secondary} {tertiary}',
        targets: {
          primary: {
            scope: 'test:primary_scope',
            placeholder: 'primary',
          },
          secondary: {
            scope: 'test:secondary_scope',
            placeholder: 'secondary',
          },
          tertiary: {
            scope: 'test:tertiary_scope',
            placeholder: 'tertiary',
          },
        },
        forbidden_components: {
          actor: ['positioning:running'],
          primary: ['positioning:kneeling_before'],
          secondary: ['positioning:sitting_on'],
          tertiary: ['positioning:laying_down'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✓ should validate multi-target action with partial role forbidden components', () => {
      const action = {
        id: 'test:multi_partial',
        name: 'Test Multi Partial',
        description: 'Test multi-target action with partial roles',
        template: 'test {primary} {secondary}',
        targets: {
          primary: {
            scope: 'test:primary_scope',
            placeholder: 'primary',
          },
          secondary: {
            scope: 'test:secondary_scope',
            placeholder: 'secondary',
          },
        },
        forbidden_components: {
          primary: ['positioning:kneeling_before'],
          // secondary has no forbidden components
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✗ should reject invalid component format in role forbidden components', () => {
      const action = {
        id: 'test:invalid_role_format',
        name: 'Test Invalid Role Format',
        description: 'Test invalid role format',
        template: 'test {primary}',
        targets: {
          primary: {
            scope: 'test:primary_scope',
            placeholder: 'primary',
          },
        },
        forbidden_components: {
          primary: ['invalid_no_colon', 'too:many:colons'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].schemaPath).toContain('pattern');
    });
  });

  // ── SCHEMA INTEGRITY TESTS ────────────────────────────────────────────────

  describe('Schema Integrity', () => {
    test('✗ should reject unknown properties in forbidden_components', () => {
      const action = {
        id: 'test:unknown_property',
        name: 'Test Unknown Property',
        description: 'Test unknown property',
        template: 'test action',
        targets: 'test:scope',
        forbidden_components: {
          actor: ['positioning:kneeling_before'],
          unknownProperty: ['some:component'],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('additional properties');
    });

    test('✓ should accept empty arrays for forbidden component lists', () => {
      const action = {
        id: 'test:empty_arrays',
        name: 'Test Empty Arrays',
        description: 'Test empty arrays',
        template: 'test action',
        targets: 'test:scope',
        forbidden_components: {
          actor: [],
          target: [],
          primary: [],
          secondary: [],
          tertiary: [],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('✗ should reject non-array values for forbidden component properties', () => {
      const action = {
        id: 'test:non_array',
        name: 'Test Non Array',
        description: 'Test non-array value',
        template: 'test action',
        targets: 'test:scope',
        forbidden_components: {
          target: 'not_an_array',
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('array');
    });

    test('✗ should reject non-string items in forbidden component arrays', () => {
      const action = {
        id: 'test:non_string_items',
        name: 'Test Non String Items',
        description: 'Test non-string items',
        template: 'test action',
        targets: 'test:scope',
        forbidden_components: {
          target: [123, true, { not: 'a string' }],
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('string');
    });
  });

  // ── COMPONENT ID PATTERN VALIDATION TESTS ─────────────────────────────────

  describe('Component ID Pattern Validation', () => {
    test('✓ should accept valid component ID patterns', () => {
      const validPatterns = [
        'mod:component',
        'core:actor',
        'positioning:kneeling_before',
        'mod_name:component_name',
        'mod-name:component-name',
        'MOD123:COMPONENT456',
        'a:b',
        'very_long_mod_name:very_long_component_name',
      ];

      validPatterns.forEach((pattern) => {
        const action = {
          id: 'test:pattern_test',
          name: 'Test Pattern',
          description: 'Test valid pattern',
          template: 'test action',
          targets: 'test:scope',
          forbidden_components: {
            target: [pattern],
          },
        };

        const isValid = validate(action);
        expect(isValid).toBe(true);
        expect(validate.errors).toBeNull();
      });
    });

    test('✗ should reject invalid component ID patterns', () => {
      const invalidPatterns = [
        'no_colon',
        'too:many:colons',
        ':starts_with_colon',
        'ends_with_colon:',
        'has space:component',
        'component:has space',
        'has.dot:component',
        'component:has.dot',
        '',
        ':',
        'mod:',
        ':component',
      ];

      invalidPatterns.forEach((pattern) => {
        const action = {
          id: 'test:pattern_test',
          name: 'Test Pattern',
          description: 'Test invalid pattern',
          template: 'test action',
          targets: 'test:scope',
          forbidden_components: {
            target: [pattern],
          },
        };

        const isValid = validate(action);
        expect(isValid).toBe(false);
        expect(validate.errors).toBeDefined();
        expect(validate.errors[0].schemaPath).toContain('pattern');
      });
    });
  });

  // ── MIXED USAGE TESTS ──────────────────────────────────────────────────────

  describe('Mixed Usage Scenarios', () => {
    test('✗ should not allow both target and primary in same action', () => {
      // This test verifies that single-target and multi-target patterns
      // shouldn't be mixed. However, the schema doesn't enforce this
      // at the schema level, so this test documents expected usage.
      const action = {
        id: 'test:mixed_target',
        name: 'Test Mixed Target',
        description: 'Test mixed target types',
        template: 'test action',
        targets: 'test:scope',
        forbidden_components: {
          target: ['positioning:sitting_on'],
          primary: ['positioning:kneeling_before'],
        },
      };

      // The schema allows this, but it's semantically incorrect
      // Runtime validation should handle this
      const isValid = validate(action);
      expect(isValid).toBe(true); // Schema allows it
      // Runtime validation in POSTARVAL-002 will prevent this
    });

    test('✓ should allow multi-target roles without corresponding targets', () => {
      // Schema validation is permissive - runtime will enforce consistency
      const action = {
        id: 'test:role_without_target',
        name: 'Test Role Without Target',
        description: 'Test role without corresponding target',
        template: 'test action',
        targets: 'test:scope', // single target
        forbidden_components: {
          secondary: ['positioning:sitting_on'], // multi-target role
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true); // Schema allows it
      // Runtime validation in POSTARVAL-002 will handle consistency
    });
  });

  // ── COMPREHENSIVE VALIDATION TEST ──────────────────────────────────────────

  describe('Comprehensive Validation', () => {
    test('✓ should validate a complex real-world action configuration', () => {
      const action = {
        $schema: 'schema://living-narrative-engine/action.schema.json',
        id: 'test:complex_action',
        name: 'Complex Test Action',
        description:
          'A complex action testing all forbidden component features',
        targets: {
          primary: {
            scope: 'test:primary_scope',
            placeholder: 'target1',
            description: 'Primary target',
          },
          secondary: {
            scope: 'test:secondary_scope',
            placeholder: 'target2',
            description: 'Secondary target',
          },
        },
        required_components: {
          actor: ['core:actor', 'positioning:positioned'],
        },
        forbidden_components: {
          actor: ['positioning:kneeling_before', 'positioning:sitting_on'],
          primary: ['positioning:laying_down', 'positioning:running'],
          secondary: ['positioning:invisible', 'positioning:immobile'],
        },
        template: 'perform complex action on {target1} and {target2}',
        prerequisites: [
          {
            logic: {
              condition_ref: 'core:actor-mouth-available',
            },
            failure_message: 'Cannot perform action while mouth is engaged',
          },
        ],
        visual: {
          backgroundColor: '#1976d2',
          textColor: '#ffffff',
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });
});
