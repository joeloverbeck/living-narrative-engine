import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionData from '../../../data/mods/core/actions/dismiss.action.json';
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';

describe("Action Definition: 'core:dismiss'", () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema, jsonLogicSchema, conditionContainerSchema],
    });
    addFormats(ajv); // <-- FIX: Add format validators
    validate = ajv.compile(actionSchema);
  });

  test('should be a valid action definition', () => {
    const isValid = validate(actionData);
    if (!isValid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(isValid).toBe(true);
  });

  describe('Multi-target structure validation', () => {
    test('should have targets property with primary target', () => {
      expect(actionData).toHaveProperty('targets');
      expect(actionData.targets).toHaveProperty('primary');
    });

    test('should have correct primary target structure', () => {
      const primaryTarget = actionData.targets.primary;
      expect(primaryTarget).toHaveProperty('scope', 'core:followers');
      expect(primaryTarget).toHaveProperty('placeholder', 'follower');
      expect(primaryTarget).toHaveProperty(
        'description',
        'The follower to dismiss from service'
      );
    });

    test('should have semantic template placeholder', () => {
      expect(actionData.template).toBe('dismiss {follower}');
    });

    test('should not have deprecated scope property', () => {
      expect(actionData).not.toHaveProperty('scope');
    });

    test('should maintain required_components for actor', () => {
      expect(actionData.required_components).toEqual({
        actor: ['core:leading'],
      });
    });
  });

  describe('Validation edge cases', () => {
    test('should reject invalid target structure', () => {
      const invalidAction = {
        ...actionData,
        targets: {
          primary: {
            scope: 'core:followers',
            // Missing required placeholder
            description: 'The follower to dismiss from service',
          },
        },
      };

      const isValid = validate(invalidAction);
      expect(isValid).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instancePath: '/targets/primary',
            message: expect.stringContaining('placeholder'),
          }),
        ])
      );
    });

    test('should reject invalid placeholder format', () => {
      const invalidAction = {
        ...actionData,
        targets: {
          primary: {
            scope: 'core:followers',
            placeholder: '123invalid', // Should start with letter
            description: 'The follower to dismiss from service',
          },
        },
      };

      const isValid = validate(invalidAction);
      expect(isValid).toBe(false);
    });

    test('should reject missing primary target', () => {
      const invalidAction = {
        ...actionData,
        targets: {
          // Missing primary target
          secondary: {
            scope: 'core:followers',
            placeholder: 'follower',
            description: 'The follower to dismiss from service',
          },
        },
      };

      const isValid = validate(invalidAction);
      expect(isValid).toBe(false);
    });
  });
});
