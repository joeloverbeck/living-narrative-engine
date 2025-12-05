// tests/unit/schemas/action.chanceBased.schema.test.js
// -----------------------------------------------------------------------------
// Unit tests for action.schema.json chanceBased property.
// Tests for NONDETACTSYS-009: Extend action.schema.json with chanceBased Property
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';

describe('action.schema.json - chanceBased Property', () => {
  /** @type {import('ajv').Ajv} */
  let ajv;
  /** @type {import('ajv').ValidateFunction} */
  let validateAction;

  /**
   * Creates a minimal valid action for testing
   *
   * @param {object} overrides - Properties to override or add
   * @returns {object} A valid action object
   */
  function createValidAction(overrides = {}) {
    return {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test:action',
      name: 'Test Action',
      description: 'A test action for schema validation',
      template: 'test action on {target}',
      targets: 'core:nearby_actors',
      ...overrides,
    };
  }

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true, strict: false });
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
    ajv.addSchema(
      actionSchema,
      'schema://living-narrative-engine/action.schema.json'
    );

    validateAction = ajv.getSchema(
      'schema://living-narrative-engine/action.schema.json'
    );
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * BACKWARD COMPATIBILITY
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('backward compatibility', () => {
    test('action without chanceBased property should validate', () => {
      const action = createValidAction();
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('existing action with visual property but no chanceBased should validate', () => {
      const action = createValidAction({
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * VALID CHANCEBASED CONFIGURATIONS
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('valid chanceBased configurations', () => {
    test('minimal chanceBased configuration should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('full chanceBased configuration with all properties should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
            property: 'value',
            default: 10,
          },
          targetSkill: {
            component: 'skills:defense_skill',
            property: 'value',
            default: 0,
          },
          formula: 'ratio',
          bounds: { min: 5, max: 95 },
          outcomes: {
            criticalSuccessThreshold: 5,
            criticalFailureThreshold: 95,
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('fixed_difficulty contestType should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: {
            component: 'skills:lockpicking',
          },
          fixedDifficulty: 50,
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('logistic formula should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:persuasion',
          },
          formula: 'logistic',
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('linear formula should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: {
            component: 'skills:athletics',
          },
          formula: 'linear',
          fixedDifficulty: 30,
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('chanceBased with enabled:false should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: false,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:stealth',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('chanceBased with difficultyModifier should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:archery',
          },
          difficultyModifier: -10,
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('chanceBased with modifiers array and condition_ref should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:target-is-prone',
              },
              value: 20,
              tag: 'target prone',
              description: 'Bonus against prone targets',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('chanceBased with modifiers using inline JSON Logic should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                '==': [{ var: 'actor.position' }, 'elevated'],
              },
              value: 15,
              tag: 'elevated',
              description: 'Height advantage bonus',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('bounds at minimum values (0) should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          bounds: { min: 0, max: 100 },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('bounds at maximum values (100) should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          bounds: { min: 0, max: 100 },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('outcomes with custom thresholds should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          outcomes: {
            criticalSuccessThreshold: 10,
            criticalFailureThreshold: 90,
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * INVALID CHANCEBASED CONFIGURATIONS - MISSING REQUIRED FIELDS
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('invalid chanceBased - missing required fields', () => {
    test('missing enabled should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: expect.objectContaining({ missingProperty: 'enabled' }),
          }),
        ])
      );
    });

    test('missing contestType should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          actorSkill: {
            component: 'skills:melee_skill',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: expect.objectContaining({ missingProperty: 'contestType' }),
          }),
        ])
      );
    });

    test('missing actorSkill should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: expect.objectContaining({ missingProperty: 'actorSkill' }),
          }),
        ])
      );
    });

    test('missing actorSkill.component should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            property: 'value',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'required',
            params: expect.objectContaining({ missingProperty: 'component' }),
          }),
        ])
      );
    });

    test('missing modifier condition in modifiers should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              modifier: 20,
              description: 'Missing condition',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });

    test('missing value in modifiers should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:test',
              },
              tag: 'test tag',
              description: 'Missing value',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });

    test('missing tag in modifiers should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:test',
              },
              value: 20,
              description: 'Missing tag',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * INVALID CHANCEBASED CONFIGURATIONS - INVALID VALUES
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('invalid chanceBased - invalid values', () => {
    test('invalid contestType enum value should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'invalid_type',
          actorSkill: {
            component: 'skills:melee_skill',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
          }),
        ])
      );
    });

    test('invalid formula enum value should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          formula: 'invalid_formula',
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
          }),
        ])
      );
    });

    test('bounds.min below 0 should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          bounds: { min: -5, max: 95 },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minimum',
          }),
        ])
      );
    });

    test('bounds.max above 100 should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          bounds: { min: 5, max: 150 },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'maximum',
          }),
        ])
      );
    });

    test('criticalSuccessThreshold below 1 should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          outcomes: {
            criticalSuccessThreshold: 0,
            criticalFailureThreshold: 95,
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });

    test('criticalFailureThreshold above 100 should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          outcomes: {
            criticalSuccessThreshold: 5,
            criticalFailureThreshold: 101,
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });

    test('fixedDifficulty as negative should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: {
            component: 'skills:test',
          },
          fixedDifficulty: -10,
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });

    test('enabled as string should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: 'true',
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });

    test('modifier value as float should validate (numbers allowed)', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:test',
              },
              value: 20.5,
              tag: 'test',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('invalid modifier type enum should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:test',
              },
              type: 'invalid_type',
              value: 20,
              tag: 'test',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
          }),
        ])
      );
    });

    test('tag exceeding maxLength (30) should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:test',
              },
              value: 20,
              tag: 'this tag is way too long and exceeds thirty characters',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'maxLength',
          }),
        ])
      );
    });

    test('empty tag should fail validation (minLength: 1)', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:test',
              },
              value: 20,
              tag: '',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'minLength',
          }),
        ])
      );
    });

    test('invalid targetRole enum should fail validation', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:test',
              },
              value: 20,
              tag: 'test',
              targetRole: 'invalid_role',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'enum',
          }),
        ])
      );
    });

    test('modifier with all new properties should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:elevated_position',
              },
              type: 'percentage',
              value: 15,
              tag: 'elevated position',
              targetRole: 'actor',
              description: 'Bonus from being in an elevated position',
              stackId: 'position_bonus',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('modifier with type flat should validate', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          modifiers: [
            {
              condition: {
                condition_ref: 'combat:prone',
              },
              type: 'flat',
              value: -10,
              tag: 'prone',
            },
          ],
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(true);
    });

    test('modifier with valid targetRole values should validate', () => {
      const validRoles = ['actor', 'primary', 'secondary', 'tertiary', 'location'];
      for (const role of validRoles) {
        const action = createValidAction({
          chanceBased: {
            enabled: true,
            contestType: 'opposed',
            actorSkill: {
              component: 'skills:melee_skill',
            },
            modifiers: [
              {
                condition: {
                  condition_ref: 'combat:test',
                },
                value: 10,
                tag: 'test',
                targetRole: role,
              },
            ],
          },
        });
        const isValid = validateAction(action);
        expect(isValid).toBe(true);
      }
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * ADDITIONAL PROPERTIES
   * ══════════════════════════════════════════════════════════════════════════ */
  describe('additional properties handling', () => {
    test('unknown property in chanceBased should fail (additionalProperties: false)', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
          },
          unknownProperty: 'should fail',
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
      expect(validateAction.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            keyword: 'additionalProperties',
          }),
        ])
      );
    });

    test('unknown property in actorSkill should fail', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
            extraField: 'invalid',
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });

    test('unknown property in bounds should fail', () => {
      const action = createValidAction({
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:test',
          },
          bounds: {
            min: 5,
            max: 95,
            extraField: 50,
          },
        },
      });
      const isValid = validateAction(action);
      expect(isValid).toBe(false);
    });
  });
});
