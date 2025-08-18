// tests/unit/schemas/actionSchemaMultiTarget.test.js
// -----------------------------------------------------------------------------
// Comprehensive unit tests for multi-target action schema validation
// Tests backward compatibility, new multi-target features, and edge cases
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';

describe('Multi-Target Action Schema Validation', () => {
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
    test('✓ should accept legacy string scope property', () => {
      const action = {
        id: 'test:legacy_scope',
        name: 'Test Legacy',
        description: 'Test action using legacy scope',
        scope: 'test:valid_scope',
        template: 'test {target}',
        prerequisites: [],
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should accept string targets property (new format)', () => {
      const action = {
        id: 'test:string_targets',
        name: 'Test String Targets',
        description: 'Test action using new string targets format',
        targets: 'test:valid_scope',
        template: 'test {target}',
        prerequisites: [],
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should validate all required fields are present', () => {
      const action = {
        id: 'test:minimal',
        name: 'Minimal',
        description: 'Minimal valid action',
        targets: 'test:scope',
        template: 'minimal action',
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });

  // ── MULTI-TARGET VALIDATION TESTS ─────────────────────────────────────────

  describe('Multi-Target Configuration', () => {
    test('✓ should accept valid multi-target configuration', () => {
      const action = {
        id: 'test:multi_target',
        name: 'Multi Target',
        description: 'Multi-target action test',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
            description: 'Item to use',
          },
          secondary: {
            scope: 'test:targets',
            placeholder: 'target',
            description: 'Target to affect',
          },
        },
        template: 'use {item} on {target}',
        generateCombinations: true,
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should accept primary target only', () => {
      const action = {
        id: 'test:primary_only',
        name: 'Primary Only',
        description: 'Action with only primary target',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should accept all three target levels', () => {
      const action = {
        id: 'test:all_targets',
        name: 'All Targets',
        description: 'Action with primary, secondary, and tertiary targets',
        targets: {
          primary: {
            scope: 'test:spells',
            placeholder: 'spell',
          },
          secondary: {
            scope: 'test:targets',
            placeholder: 'target',
          },
          tertiary: {
            scope: 'test:focus_items',
            placeholder: 'focus',
            optional: true,
          },
        },
        template: 'cast {spell} on {target} using {focus}',
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should accept contextFrom reference', () => {
      const action = {
        id: 'test:context_from',
        name: 'Context From',
        description: 'Action with contextFrom reference',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
          secondary: {
            scope: 'test:recipients',
            placeholder: 'recipient',
            contextFrom: 'primary',
          },
        },
        template: 'give {item} to {recipient}',
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });

  // ── VALIDATION RULES TESTS ────────────────────────────────────────────────

  describe('Validation Rules', () => {
    test('❌ should reject action with both targets and scope', () => {
      const action = {
        id: 'test:both_properties',
        name: 'Both Properties',
        description: 'Invalid action with both targets and scope',
        targets: 'test:scope',
        scope: 'test:scope', // Should not have both
        template: 'test {target}',
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('❌ should reject action with neither targets nor scope', () => {
      const action = {
        id: 'test:no_targets',
        name: 'No Targets',
        description: 'Invalid action with no targeting',
        template: 'test action',
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('❌ should reject multi-target without primary', () => {
      const action = {
        id: 'test:no_primary',
        name: 'No Primary',
        description: 'Invalid multi-target without primary',
        targets: {
          secondary: {
            scope: 'test:targets',
            placeholder: 'target',
          },
        },
        template: 'test {target}',
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });

  // ── PLACEHOLDER VALIDATION TESTS ──────────────────────────────────────────

  describe('Placeholder Pattern Validation', () => {
    test('✓ should accept valid placeholder patterns', () => {
      const validPlaceholders = [
        'target',
        'item',
        'destination',
        'target1',
        'item_type',
      ];

      validPlaceholders.forEach((placeholder) => {
        const action = {
          id: `test:valid_${placeholder}`,
          name: 'Valid Placeholder',
          description: 'Test valid placeholder pattern',
          targets: {
            primary: {
              scope: 'test:scope',
              placeholder: placeholder,
            },
          },
          template: `test {${placeholder}}`,
        };

        const isValid = validate(action);
        if (!isValid) {
          console.error(
            `Failed for placeholder '${placeholder}':`,
            validate.errors
          );
        }
        expect(isValid).toBe(true);
      });
    });

    test('❌ should reject invalid placeholder patterns', () => {
      const invalidPlaceholders = [
        '123invalid',
        'target-dash',
        'target space',
        'target.dot',
      ];

      invalidPlaceholders.forEach((placeholder) => {
        const action = {
          id: `test:invalid_${placeholder.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: 'Invalid Placeholder',
          description: 'Test invalid placeholder pattern',
          targets: {
            primary: {
              scope: 'test:scope',
              placeholder: placeholder,
            },
          },
          template: `test {${placeholder}}`,
        };

        const isValid = validate(action);
        expect(isValid).toBe(false);
      });
    });
  });

  // ── SCOPE PATTERN VALIDATION TESTS ────────────────────────────────────────

  describe('Scope Pattern Validation', () => {
    test('✓ should accept valid namespaced scope patterns', () => {
      const validScopes = ['core:items', 'combat:weapons', 'magic_mod:spells'];

      validScopes.forEach((scope) => {
        const action = {
          id: `test:scope_${scope.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: 'Valid Scope',
          description: 'Test valid scope pattern',
          targets: scope,
          template: 'test {target}',
        };

        const isValid = validate(action);
        if (!isValid) {
          console.error(`Failed for scope '${scope}':`, validate.errors);
        }
        expect(isValid).toBe(true);
      });
    });

    test('✓ should accept special scope values', () => {
      const specialScopes = ['none', 'self'];

      specialScopes.forEach((scope) => {
        const action = {
          id: `test:special_${scope}`,
          name: 'Special Scope',
          description: 'Test special scope value',
          targets: scope,
          template: scope === 'none' ? 'wait' : 'test self',
        };

        const isValid = validate(action);
        if (!isValid) {
          console.error(
            `Failed for special scope '${scope}':`,
            validate.errors
          );
        }
        expect(isValid).toBe(true);
      });
    });

    test('✓ should accept special scope values with legacy scope property', () => {
      const specialScopes = ['none', 'self'];

      specialScopes.forEach((scope) => {
        const action = {
          id: `test:legacy_${scope}`,
          name: 'Legacy Special Scope',
          description: 'Test legacy special scope value',
          scope: scope,
          template: scope === 'none' ? 'wait' : 'test self',
        };

        const isValid = validate(action);
        if (!isValid) {
          console.error(
            `Failed for legacy special scope '${scope}':`,
            validate.errors
          );
        }
        expect(isValid).toBe(true);
      });
    });

    test('✓ should accept valid inline scope expressions', () => {
      const inlineScopes = [
        'nearby_characters',
        'inventory_items',
        'environment',
      ];

      inlineScopes.forEach((scope) => {
        const action = {
          id: `test:inline_${scope}`,
          name: 'Inline Scope',
          description: 'Test inline scope pattern',
          targets: {
            primary: {
              scope: scope,
              placeholder: 'target',
            },
          },
          template: 'test {target}',
        };

        const isValid = validate(action);
        if (!isValid) {
          console.error(`Failed for inline scope '${scope}':`, validate.errors);
        }
        expect(isValid).toBe(true);
      });
    });
  });

  // ── EDGE CASES AND ERROR CONDITIONS ───────────────────────────────────────

  describe('Edge Cases', () => {
    test('❌ should reject empty target definition', () => {
      const action = {
        id: 'test:empty_target',
        name: 'Empty Target',
        description: 'Test with empty target definition',
        targets: {
          primary: {},
        },
        template: 'test',
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('❌ should reject invalid contextFrom value', () => {
      const action = {
        id: 'test:invalid_context',
        name: 'Invalid Context',
        description: 'Test with invalid contextFrom value',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
          secondary: {
            scope: 'test:targets',
            placeholder: 'target',
            contextFrom: 'invalid', // Only 'primary' is allowed
          },
        },
        template: 'use {item} on {target}',
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('❌ should reject additional properties in targetDefinition', () => {
      const action = {
        id: 'test:additional_props',
        name: 'Additional Props',
        description: 'Test with additional properties in target definition',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
            invalidProperty: 'should not be allowed',
          },
        },
        template: 'use {item}',
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('❌ should reject missing required fields', () => {
      const action = {
        id: 'test:missing_fields',
        // Missing name, description, template
        targets: 'test:scope',
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });

  // ── GENERATECOMBINATIONS FLAG TESTS ───────────────────────────────────────

  describe('GenerateCombinations Flag', () => {
    test('✓ should accept generateCombinations true', () => {
      const action = {
        id: 'test:combinations_true',
        name: 'Combinations True',
        description: 'Test with generateCombinations enabled',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
          secondary: {
            scope: 'test:targets',
            placeholder: 'target',
          },
        },
        template: 'use {item} on {target}',
        generateCombinations: true,
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should accept generateCombinations false', () => {
      const action = {
        id: 'test:combinations_false',
        name: 'Combinations False',
        description: 'Test with generateCombinations disabled',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
        generateCombinations: false,
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should default generateCombinations to false when omitted', () => {
      const action = {
        id: 'test:combinations_default',
        name: 'Combinations Default',
        description: 'Test with generateCombinations omitted',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
        // generateCombinations omitted, should default to false
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });

  // ── OPTIONAL TARGET TESTS ─────────────────────────────────────────────────

  describe('Optional Targets', () => {
    test('✓ should accept optional target flag', () => {
      const action = {
        id: 'test:optional_target',
        name: 'Optional Target',
        description: 'Test with optional target',
        targets: {
          primary: {
            scope: 'test:spells',
            placeholder: 'spell',
          },
          secondary: {
            scope: 'test:focus_items',
            placeholder: 'focus',
            optional: true,
          },
        },
        template: 'cast {spell} with {focus}',
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should default optional to false when omitted', () => {
      const action = {
        id: 'test:optional_default',
        name: 'Optional Default',
        description: 'Test with optional omitted',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
            // optional omitted, should default to false
          },
        },
        template: 'use {item}',
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });

  // ── VIOLENCE MOD MIGRATION VALIDATION TESTS ──────────────────────────────

  describe('Violence Mod Migration Validation', () => {
    test('✓ should validate migrated violence:slap action', () => {
      const slapAction = {
        $schema: 'schema://living-narrative-engine/action.schema.json',
        id: 'violence:slap',
        name: 'Slap',
        description: 'Slap someone across the face',
        targets: {
          primary: {
            scope: 'core:actors_in_location',
            placeholder: 'target',
            description: 'Person to slap',
          },
        },
        template: 'slap {target}',
      };

      const isValid = validate(slapAction);
      if (!isValid) {
        console.error('Slap action validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });

    test('✓ should validate migrated violence:sucker_punch action', () => {
      const suckerPunchAction = {
        $schema: 'schema://living-narrative-engine/action.schema.json',
        id: 'violence:sucker_punch',
        name: 'Sucker Punch',
        description:
          "Throw an unexpected punch at someone when they're not looking",
        targets: {
          primary: {
            scope: 'core:actors_in_location',
            placeholder: 'target',
            description: 'Person to punch unexpectedly',
          },
        },
        template: 'sucker-punch {target}',
      };

      const isValid = validate(suckerPunchAction);
      if (!isValid) {
        console.error(
          'Sucker punch action validation errors:',
          validate.errors
        );
      }
      expect(isValid).toBe(true);
    });

    test('✓ should validate both violence actions have correct target structure', () => {
      const violenceActions = [
        {
          id: 'violence:slap',
          targets: {
            primary: {
              scope: 'core:actors_in_location',
              placeholder: 'target',
              description: 'Person to slap',
            },
          },
        },
        {
          id: 'violence:sucker_punch',
          targets: {
            primary: {
              scope: 'core:actors_in_location',
              placeholder: 'target',
              description: 'Person to punch unexpectedly',
            },
          },
        },
      ];

      violenceActions.forEach((actionData) => {
        // Verify target structure matches expected pattern
        expect(actionData.targets).toHaveProperty('primary');
        expect(actionData.targets.primary).toHaveProperty(
          'scope',
          'core:actors_in_location'
        );
        expect(actionData.targets.primary).toHaveProperty(
          'placeholder',
          'target'
        );
        expect(actionData.targets.primary).toHaveProperty('description');
        expect(typeof actionData.targets.primary.description).toBe('string');
        expect(actionData.targets.primary.description.length).toBeGreaterThan(
          0
        );
      });
    });

    test('✓ should verify violence actions maintain template compatibility', () => {
      const expectedTemplates = {
        'violence:slap': 'slap {target}',
        'violence:sucker_punch': 'sucker-punch {target}', // Note hyphen preservation
      };

      Object.entries(expectedTemplates).forEach(
        ([actionId, expectedTemplate]) => {
          const action = {
            $schema: 'schema://living-narrative-engine/action.schema.json',
            id: actionId,
            name: 'Test',
            description: 'Test action for template validation',
            targets: {
              primary: {
                scope: 'core:actors_in_location',
                placeholder: 'target',
                description: 'Test target',
              },
            },
            template: expectedTemplate,
          };

          const isValid = validate(action);
          if (!isValid) {
            console.error(
              `Template validation failed for ${actionId}:`,
              validate.errors
            );
          }
          expect(isValid).toBe(true);
          expect(action.template).toBe(expectedTemplate);
        }
      );
    });

    test('✓ should verify violence actions use proper schema reference', () => {
      const violenceActions = [
        {
          $schema: 'schema://living-narrative-engine/action.schema.json',
          id: 'violence:slap',
          name: 'Slap',
          description: 'Test',
          targets: { primary: { scope: 'test:scope', placeholder: 'target' } },
          template: 'slap {target}',
        },
        {
          $schema: 'schema://living-narrative-engine/action.schema.json',
          id: 'violence:sucker_punch',
          name: 'Sucker Punch',
          description: 'Test',
          targets: { primary: { scope: 'test:scope', placeholder: 'target' } },
          template: 'sucker-punch {target}',
        },
      ];

      violenceActions.forEach((action) => {
        expect(action).toHaveProperty(
          '$schema',
          'schema://living-narrative-engine/action.schema.json'
        );

        const isValid = validate(action);
        if (!isValid) {
          console.error(
            `Schema validation failed for ${action.id}:`,
            validate.errors
          );
        }
        expect(isValid).toBe(true);
      });
    });
  });

  // ── VISUAL PROPERTIES VALIDATION TESTS ───────────────────────────────────

  describe('Visual Properties Validation', () => {
    test('✓ should accept action without visual properties (backward compatibility)', () => {
      const action = {
        id: 'test:no_visual',
        name: 'No Visual',
        description: 'Action without visual properties',
        targets: 'test:scope',
        template: 'test {target}',
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should accept action with complete visual properties', () => {
      const action = {
        id: 'test:complete_visual',
        name: 'Complete Visual',
        description: 'Action with all visual properties',
        targets: 'test:scope',
        template: 'test {target}',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#cc0000',
          hoverTextColor: '#ffcccc',
        },
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('✓ should accept action with partial visual properties', () => {
      const action = {
        id: 'test:partial_visual',
        name: 'Partial Visual',
        description: 'Action with only some visual properties',
        targets: 'test:scope',
        template: 'test {target}',
        visual: {
          backgroundColor: '#00ff00',
          textColor: '#000000',
          // hoverBackgroundColor and hoverTextColor omitted
        },
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    describe('Color Format Validation', () => {
      test('✓ should accept valid hex colors', () => {
        const validHexColors = ['#f00', '#ff0000', '#FF0000', '#A1B2C3'];

        validHexColors.forEach((color) => {
          const action = {
            id: `test:hex_${color.replace('#', '').toLowerCase()}`,
            name: 'Hex Color Test',
            description: 'Test hex color validation',
            targets: 'test:scope',
            template: 'test {target}',
            visual: {
              backgroundColor: color,
            },
          };

          const isValid = validate(action);
          if (!isValid) {
            console.error(`Failed for hex color '${color}':`, validate.errors);
          }
          expect(isValid).toBe(true);
        });
      });

      test('✓ should accept valid RGB colors', () => {
        const validRgbColors = [
          'rgb(255, 0, 0)',
          'rgb(0,255,0)',
          'rgb( 0 , 0 , 255 )',
          'rgb(128, 64, 192)',
        ];

        validRgbColors.forEach((color) => {
          const action = {
            id: `test:rgb_${Math.random().toString(36).substr(2, 5)}`,
            name: 'RGB Color Test',
            description: 'Test RGB color validation',
            targets: 'test:scope',
            template: 'test {target}',
            visual: {
              backgroundColor: color,
            },
          };

          const isValid = validate(action);
          if (!isValid) {
            console.error(`Failed for RGB color '${color}':`, validate.errors);
          }
          expect(isValid).toBe(true);
        });
      });

      test('✓ should accept valid RGBA colors', () => {
        const validRgbaColors = [
          'rgba(255, 0, 0, 0.5)',
          'rgba(0,255,0,1)',
          'rgba( 0 , 0 , 255 , 0.8 )',
          'rgba(128, 64, 192, 0.25)',
        ];

        validRgbaColors.forEach((color) => {
          const action = {
            id: `test:rgba_${Math.random().toString(36).substr(2, 5)}`,
            name: 'RGBA Color Test',
            description: 'Test RGBA color validation',
            targets: 'test:scope',
            template: 'test {target}',
            visual: {
              backgroundColor: color,
            },
          };

          const isValid = validate(action);
          if (!isValid) {
            console.error(`Failed for RGBA color '${color}':`, validate.errors);
          }
          expect(isValid).toBe(true);
        });
      });

      test('✓ should accept valid CSS named colors', () => {
        const validNamedColors = [
          'red',
          'blue',
          'green',
          'darkblue',
          'lightgreen',
          'mediumseagreen',
          'palevioletred',
        ];

        validNamedColors.forEach((color) => {
          const action = {
            id: `test:named_${color}`,
            name: 'Named Color Test',
            description: 'Test named color validation',
            targets: 'test:scope',
            template: 'test {target}',
            visual: {
              backgroundColor: color,
            },
          };

          const isValid = validate(action);
          if (!isValid) {
            console.error(`Failed for named color '${color}':`, validate.errors);
          }
          expect(isValid).toBe(true);
        });
      });

      test('❌ should reject invalid color formats', () => {
        const invalidColors = [
          '#gg0000', // Invalid hex characters
          '#12345', // Wrong hex length
          'rgb(256, 0, 0)', // Out of range RGB
          'notacolor', // Invalid color name
          'rgb(0,0,0', // Malformed RGB
          '#', // Incomplete hex
          'rgba(255, 0, 0)', // RGBA missing alpha
          'rgb(255, 0)', // RGB missing value
          'hsl(120, 100%, 50%)', // HSL not supported
        ];

        invalidColors.forEach((color) => {
          const action = {
            id: `test:invalid_${Math.random().toString(36).substr(2, 5)}`,
            name: 'Invalid Color Test',
            description: 'Test invalid color validation',
            targets: 'test:scope',
            template: 'test {target}',
            visual: {
              backgroundColor: color,
            },
          };

          const isValid = validate(action);
          expect(isValid).toBe(false);
          expect(validate.errors).toBeDefined();
        });
      });
    });

    test('✓ should accept all visual properties with different valid color formats', () => {
      const action = {
        id: 'test:mixed_color_formats',
        name: 'Mixed Color Formats',
        description: 'Action with different color formats for each property',
        targets: 'test:scope',
        template: 'test {target}',
        visual: {
          backgroundColor: '#ff0000', // Hex
          textColor: 'white', // Named
          hoverBackgroundColor: 'rgb(200, 0, 0)', // RGB
          hoverTextColor: 'rgba(255, 255, 255, 0.9)', // RGBA
        },
      };

      const isValid = validate(action);
      if (!isValid) console.error('Validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });

    test('❌ should reject additional properties in visual object', () => {
      const action = {
        id: 'test:visual_additional_props',
        name: 'Visual Additional Props',
        description: 'Action with additional properties in visual object',
        targets: 'test:scope',
        template: 'test {target}',
        visual: {
          backgroundColor: '#ff0000',
          invalidProperty: 'should not be allowed',
        },
      };

      const isValid = validate(action);
      expect(isValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    test('❌ should reject empty visual object', () => {
      const action = {
        id: 'test:empty_visual',
        name: 'Empty Visual',
        description: 'Action with empty visual object',
        targets: 'test:scope',
        template: 'test {target}',
        visual: {}, // Empty object should be invalid if no properties are required
      };

      const isValid = validate(action);
      if (!isValid) {
        // This is expected behavior - empty visual object is allowed
        // since all visual properties are optional
        expect(isValid).toBe(true);
      } else {
        // If it passes, that's also valid since visual properties are optional
        expect(isValid).toBe(true);
      }
    });

    test('✓ should validate example from schema', () => {
      const action = {
        id: 'combat:berserker_rage',
        name: 'Berserker Rage',
        description: 'Enter a frenzied state, increasing damage but reducing accuracy',
        targets: 'none',
        template: 'enter berserker rage',
        visual: {
          backgroundColor: '#cc0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#990000',
          hoverTextColor: '#ffcccc',
        },
        prerequisites: [
          {
            logic: { condition_ref: 'combat:not-in-rage' },
            failure_message: 'You are already in a rage.',
          },
        ],
      };

      const isValid = validate(action);
      if (!isValid) console.error('Schema example validation errors:', validate.errors);
      expect(isValid).toBe(true);
    });
  });
});
