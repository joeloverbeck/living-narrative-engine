/**
 * @file Unit tests for PropertySchemaValidationRule
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PropertySchemaValidationRule } from '../../../../../src/anatomy/validation/rules/propertySchemaValidationRule.js';
import { LoadTimeValidationContext } from '../../../../../src/anatomy/validation/loadTimeValidationContext.js';

describe('PropertySchemaValidationRule', () => {
  let logger;
  let dataRegistry;
  let schemaValidator;
  let rule;

  beforeEach(() => {
    logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    dataRegistry = {
      get: () => {},
      getAll: () => [],
    };

    schemaValidator = {
      validate: () => ({ isValid: true, errors: null }),
    };

    rule = new PropertySchemaValidationRule({
      logger,
      dataRegistry,
      schemaValidator,
    });
  });

  describe('rule metadata', () => {
    it('should have correct ruleId', () => {
      expect(rule.ruleId).toBe('property-schema-validation');
    });

    it('should have correct ruleName', () => {
      expect(rule.ruleName).toBe('Property Schema Validation');
    });
  });

  describe('shouldApply', () => {
    it('should return true when context has recipes', () => {
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': {} },
      });

      expect(rule.shouldApply(context)).toBe(true);
    });

    it('should return false when context has no recipes', () => {
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: {},
      });

      expect(rule.shouldApply(context)).toBe(false);
    });
  });

  describe('validate - slot properties', () => {
    it('should pass validation for valid property values', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'blue', 'green'] },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = (schemaId) => {
        if (schemaId === 'test:component') {
          return { isValid: true, errors: null };
        }
        return { isValid: false, errors: [] };
      };

      const recipe = {
        slots: {
          head: {
            properties: {
              'test:component': {
                color: 'red',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(0);
    });

    it('should report error for invalid enum value in slot properties', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'blue', 'green'] },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = (schemaId) => {
        if (schemaId === 'test:component') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '/color',
                keyword: 'enum',
                message: 'must be equal to one of the allowed values',
                params: { allowedValues: ['red', 'blue', 'green'] },
              },
            ],
          };
        }
        return { isValid: true, errors: null };
      };

      const recipe = {
        slots: {
          head: {
            properties: {
              'test:component': {
                color: 'purple',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('INVALID_PROPERTY_VALUE');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].context.componentId).toBe('test:component');
      expect(issues[0].context.location.type).toBe('slot');
      expect(issues[0].context.location.name).toBe('head');
      expect(issues[0].context.schemaErrors).toHaveLength(1);
      expect(issues[0].context.schemaErrors[0].validValues).toEqual([
        'red',
        'blue',
        'green',
      ]);
      expect(issues[0].context.schemaErrors[0].currentValue).toBe('purple');
    });

    it('should suggest closest matching value for enum errors', async () => {
      const component = {
        id: 'descriptors:length',
        dataSchema: {
          type: 'object',
          properties: {
            size: {
              type: 'string',
              enum: ['short', 'medium', 'long'],
            },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'descriptors:length') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = (schemaId) => {
        if (schemaId === 'descriptors:length') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '/size',
                keyword: 'enum',
                message: 'must be equal to one of the allowed values',
                params: { allowedValues: ['short', 'medium', 'long'] },
              },
            ],
          };
        }
        return { isValid: true, errors: null };
      };

      const recipe = {
        slots: {
          head: {
            properties: {
              'descriptors:length': {
                size: 'vast', // Should suggest "long"
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(1);
      // "vast" has equal distance to both "short" and "long" (distance 4)
      // Algorithm picks first match, which is "short"
      expect(issues[0].context.schemaErrors[0].suggestion).toBe('short');
    });

    it('should report type mismatch errors', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            count: { type: 'number' },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = (schemaId) => {
        if (schemaId === 'test:component') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '/count',
                keyword: 'type',
                message: 'must be number',
                params: { type: 'number' },
              },
            ],
          };
        }
        return { isValid: true, errors: null };
      };

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:component': {
                count: 'five', // Wrong type
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(1);
      expect(issues[0].context.schemaErrors[0].expectedType).toBe('number');
      expect(issues[0].context.schemaErrors[0].actualType).toBe('string');
    });

    it('should report missing required properties', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            required: { type: 'string' },
          },
          required: ['required'],
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = (schemaId) => {
        if (schemaId === 'test:component') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '',
                keyword: 'required',
                message: "must have required property 'required'",
                params: { missingProperty: 'required' },
              },
            ],
          };
        }
        return { isValid: true, errors: null };
      };

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:component': {
                optional: 'value',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(1);
      expect(issues[0].context.schemaErrors[0].missingField).toBe('required');
    });

    it('should skip validation for non-existent components', async () => {
      dataRegistry.get = () => undefined;

      const recipe = {
        slots: {
          head: {
            properties: {
              'missing:component': {
                value: 'test',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(0);
    });
  });

  describe('validate - pattern properties', () => {
    it('should validate pattern properties', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            shape: { type: 'string', enum: ['circle', 'square'] },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = (schemaId) => {
        if (schemaId === 'test:component') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '/shape',
                keyword: 'enum',
                message: 'must be equal to one of the allowed values',
                params: { allowedValues: ['circle', 'square'] },
              },
            ],
          };
        }
        return { isValid: true, errors: null };
      };

      const recipe = {
        patterns: [
          {
            matchesPattern: 'leg_*',
            properties: {
              'test:component': {
                shape: 'triangle',
              },
            },
          },
        ],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(1);
      expect(issues[0].context.location.type).toBe('pattern');
      expect(issues[0].context.location.name).toBe('leg_*');
      expect(issues[0].context.location.index).toBe(0);
    });

    it('should handle patterns with matchesGroup', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = () => ({ isValid: true, errors: null });

      const recipe = {
        patterns: [
          {
            matchesGroup: 'limbs',
            properties: {
              'test:component': {
                value: 42,
              },
            },
          },
        ],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(0);
    });

    it('should handle patterns with matches array (v1)', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = () => ({ isValid: true, errors: null });

      const recipe = {
        patterns: [
          {
            matches: ['leg_left', 'leg_right'],
            properties: {
              'test:component': {
                value: 42,
              },
            },
          },
        ],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(0);
    });
  });

  describe('fallback inline validation', () => {
    it('should fall back to inline validation when schema not registered', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'blue'] },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      // Simulate schema not found
      schemaValidator.validate = () => {
        throw new Error('Schema not found');
      };

      const recipe = {
        slots: {
          head: {
            properties: {
              'test:component': {
                color: 'green', // Invalid value
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('INVALID_PROPERTY_VALUE');
      expect(issues[0].context.schemaErrors).toHaveLength(1);
    });

    it('should pass inline validation for valid properties', async () => {
      const component = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'blue'] },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:component') {
          return component;
        }
        return undefined;
      };

      // Simulate schema not found, forcing inline validation
      schemaValidator.validate = () => {
        throw new Error('Schema not found');
      };

      const recipe = {
        slots: {
          head: {
            properties: {
              'test:component': {
                color: 'red', // Valid value
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(0);
    });
  });

  describe('suggestion algorithm', () => {
    it('should suggest "immense" for "imense"', async () => {
      const component = {
        id: 'test:size',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string', enum: ['tiny', 'small', 'immense'] },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'test:size') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = () => ({
        isValid: false,
        errors: [
          {
            instancePath: '/value',
            keyword: 'enum',
            message: 'must be equal to one of the allowed values',
            params: { allowedValues: ['tiny', 'small', 'immense'] },
          },
        ],
      });

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:size': {
                value: 'imense',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues[0].context.schemaErrors[0].suggestion).toBe('immense');
    });
  });

  describe('component source derivation', () => {
    it('should derive correct component source path', async () => {
      const component = {
        id: 'anatomy:horned',
        dataSchema: {
          type: 'object',
          properties: {
            style: { type: 'string', enum: ['crown', 'ram'] },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components' && id === 'anatomy:horned') {
          return component;
        }
        return undefined;
      };

      schemaValidator.validate = () => ({
        isValid: false,
        errors: [
          {
            instancePath: '/style',
            keyword: 'enum',
            message: 'must be equal to one of the allowed values',
            params: { allowedValues: ['crown', 'ram'] },
          },
        ],
      });

      const recipe = {
        slots: {
          head: {
            properties: {
              'anatomy:horned': {
                style: 'antlers',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues[0].context.componentSource).toBe(
        'data/mods/anatomy/components/horned.component.json'
      );
    });
  });

  describe('multiple errors', () => {
    it('should report all errors from multiple properties', async () => {
      const component1 = {
        id: 'test:component1',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'blue'] },
          },
        },
      };

      const component2 = {
        id: 'test:component2',
        dataSchema: {
          type: 'object',
          properties: {
            size: { type: 'number' },
          },
        },
      };

      dataRegistry.get = (type, id) => {
        if (type === 'components') {
          if (id === 'test:component1') return component1;
          if (id === 'test:component2') return component2;
        }
        return undefined;
      };

      schemaValidator.validate = (schemaId) => {
        if (schemaId === 'test:component1') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '/color',
                keyword: 'enum',
                message: 'must be equal to one of the allowed values',
                params: { allowedValues: ['red', 'blue'] },
              },
            ],
          };
        }
        if (schemaId === 'test:component2') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '/size',
                keyword: 'type',
                message: 'must be number',
                params: { type: 'number' },
              },
            ],
          };
        }
        return { isValid: true, errors: null };
      };

      const recipe = {
        slots: {
          head: {
            properties: {
              'test:component1': {
                color: 'green',
              },
              'test:component2': {
                size: 'large',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(2);
    });
  });
});
