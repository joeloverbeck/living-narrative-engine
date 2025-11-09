/**
 * @file Integration tests for property schema validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PropertySchemaValidationRule } from '../../../../src/anatomy/validation/rules/propertySchemaValidationRule.js';
import { LoadTimeValidationContext } from '../../../../src/anatomy/validation/loadTimeValidationContext.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';

describe('PropertySchemaValidation Integration', () => {
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

    dataRegistry = new InMemoryDataRegistry();
    schemaValidator = new AjvSchemaValidator({ logger });

    rule = new PropertySchemaValidationRule({
      logger,
      dataRegistry,
      schemaValidator,
    });
  });

  describe('with real component schemas', () => {
    it('should validate against registered component dataSchema', async () => {
      // Register a component with a dataSchema
      const componentDataSchema = {
        type: 'object',
        properties: {
          length: {
            type: 'string',
            enum: ['short', 'medium', 'long'],
            description: 'Length category',
          },
        },
        required: ['length'],
      };

      // Add the dataSchema to the schema validator
      await schemaValidator.addSchema(
        componentDataSchema,
        'descriptors:length_category'
      );

      // Store the component in the registry
      const component = {
        id: 'descriptors:length_category',
        dataSchema: componentDataSchema,
        description: 'Describes the length of a body part',
      };

      dataRegistry.store('components', 'descriptors:length_category', component);

      // Create a recipe with valid property values
      const recipe = {
        slots: {
          horns: {
            properties: {
              'descriptors:length_category': {
                length: 'medium',
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await rule.validate(context);
      expect(issues).toHaveLength(0);
    });

    it('should detect invalid enum value with real component', async () => {
      const componentDataSchema = {
        type: 'object',
        properties: {
          length: {
            type: 'string',
            enum: ['short', 'medium', 'long'],
          },
        },
        required: ['length'],
      };

      await schemaValidator.addSchema(
        componentDataSchema,
        'descriptors:length_category'
      );

      const component = {
        id: 'descriptors:length_category',
        dataSchema: componentDataSchema,
      };

      dataRegistry.store('components', 'descriptors:length_category', component);

      // Create a recipe with INVALID property value
      const recipe = {
        slots: {
          horns: {
            properties: {
              'descriptors:length_category': {
                length: 'vast', // Invalid!
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await rule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('INVALID_PROPERTY_VALUE');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].context.componentId).toBe('descriptors:length_category');
      expect(issues[0].context.location.name).toBe('horns');

      const schemaError = issues[0].context.schemaErrors[0];
      expect(schemaError.property).toBe('length');
      expect(schemaError.currentValue).toBe('vast');
      expect(schemaError.validValues).toEqual(['short', 'medium', 'long']);
      // "vast" has equal distance to both "short" and "long", picks first
      expect(schemaError.suggestion).toBe('short');
    });

    it('should validate multiple components in same slot', async () => {
      // Component 1: color descriptor
      const colorSchema = {
        type: 'object',
        properties: {
          hue: {
            type: 'string',
            enum: ['red', 'blue', 'green', 'gold'],
          },
        },
      };

      await schemaValidator.addSchema(colorSchema, 'descriptors:color');
      dataRegistry.store('components', 'descriptors:color', {
        id: 'descriptors:color',
        dataSchema: colorSchema,
      });

      // Component 2: size descriptor
      const sizeSchema = {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            enum: ['tiny', 'small', 'medium', 'large', 'huge'],
          },
        },
      };

      await schemaValidator.addSchema(sizeSchema, 'descriptors:size');
      dataRegistry.store('components', 'descriptors:size', {
        id: 'descriptors:size',
        dataSchema: sizeSchema,
      });

      // Recipe with both components
      const recipe = {
        slots: {
          scales: {
            properties: {
              'descriptors:color': {
                hue: 'red', // Valid
              },
              'descriptors:size': {
                value: 'xlarge', // Invalid!
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await rule.validate(context);

      // Should only report error for invalid size, not color
      expect(issues).toHaveLength(1);
      expect(issues[0].context.componentId).toBe('descriptors:size');
      expect(issues[0].context.schemaErrors[0].currentValue).toBe('xlarge');
      expect(issues[0].context.schemaErrors[0].validValues).toContain('large');
    });

    it('should validate patterns with real components', async () => {
      const shapeSchema = {
        type: 'object',
        properties: {
          form: {
            type: 'string',
            enum: ['curved', 'straight', 'twisted'],
          },
        },
      };

      await schemaValidator.addSchema(shapeSchema, 'anatomy:horn_shape');
      dataRegistry.store('components', 'anatomy:horn_shape', {
        id: 'anatomy:horn_shape',
        dataSchema: shapeSchema,
      });

      const recipe = {
        patterns: [
          {
            matchesPattern: 'horn_*',
            properties: {
              'anatomy:horn_shape': {
                form: 'spiral', // Invalid!
              },
            },
          },
        ],
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await rule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].context.location.type).toBe('pattern');
      expect(issues[0].context.location.name).toBe('horn_*');
      expect(issues[0].context.schemaErrors[0].validValues).toEqual([
        'curved',
        'straight',
        'twisted',
      ]);
    });

    it('should detect type mismatches', async () => {
      const numericalSchema = {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            minimum: 1,
            maximum: 10,
          },
        },
      };

      await schemaValidator.addSchema(numericalSchema, 'descriptors:count');
      dataRegistry.store('components', 'descriptors:count', {
        id: 'descriptors:count',
        dataSchema: numericalSchema,
      });

      const recipe = {
        slots: {
          teeth: {
            properties: {
              'descriptors:count': {
                count: 'many', // Should be number!
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:dragon': recipe },
      });

      const issues = await rule.validate(context);

      expect(issues).toHaveLength(1);
      const schemaError = issues[0].context.schemaErrors[0];
      expect(schemaError.expectedType).toBe('number');
      expect(schemaError.actualType).toBe('string');
    });

    it('should detect missing required properties', async () => {
      const requiredSchema = {
        type: 'object',
        properties: {
          mandatory: {
            type: 'string',
          },
          optional: {
            type: 'string',
          },
        },
        required: ['mandatory'],
      };

      await schemaValidator.addSchema(requiredSchema, 'test:required');
      dataRegistry.store('components', 'test:required', {
        id: 'test:required',
        dataSchema: requiredSchema,
      });

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:required': {
                optional: 'present',
                // mandatory is missing!
              },
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'anatomy:test': recipe },
      });

      const issues = await rule.validate(context);

      expect(issues).toHaveLength(1);
      const schemaError = issues[0].context.schemaErrors[0];
      expect(schemaError.missingField).toBe('mandatory');
    });
  });

  describe('with multiple recipes', () => {
    it('should validate all recipes independently', async () => {
      const colorSchema = {
        type: 'object',
        properties: {
          hue: { type: 'string', enum: ['red', 'blue', 'green'] },
        },
      };

      await schemaValidator.addSchema(colorSchema, 'descriptors:color');
      dataRegistry.store('components', 'descriptors:color', {
        id: 'descriptors:color',
        dataSchema: colorSchema,
      });

      const recipe1 = {
        slots: {
          scales: {
            properties: {
              'descriptors:color': { hue: 'red' }, // Valid
            },
          },
        },
      };

      const recipe2 = {
        slots: {
          feathers: {
            properties: {
              'descriptors:color': { hue: 'yellow' }, // Invalid
            },
          },
        },
      };

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: {
          'anatomy:dragon': recipe1,
          'anatomy:phoenix': recipe2,
        },
      });

      const issues = await rule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].context.recipeId).toBe('anatomy:phoenix');
    });
  });

  describe('edge cases', () => {
    it('should handle empty properties object', async () => {
      const schema = {
        type: 'object',
        properties: {},
      };

      await schemaValidator.addSchema(schema, 'test:empty');
      dataRegistry.store('components', 'test:empty', {
        id: 'test:empty',
        dataSchema: schema,
      });

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:empty': {},
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

    it('should skip validation when component does not exist', async () => {
      const recipe = {
        slots: {
          body: {
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

    it('should handle nested property paths', async () => {
      const nestedSchema = {
        type: 'object',
        properties: {
          color: {
            type: 'object',
            properties: {
              primary: { type: 'string', enum: ['red', 'blue'] },
            },
            required: ['primary'],
          },
        },
      };

      await schemaValidator.addSchema(nestedSchema, 'test:nested');
      dataRegistry.store('components', 'test:nested', {
        id: 'test:nested',
        dataSchema: nestedSchema,
      });

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:nested': {
                color: {
                  primary: 'green', // Invalid
                },
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
      expect(issues[0].context.schemaErrors[0].property).toBe('color/primary');
    });
  });

  describe('suggestion quality', () => {
    it('should suggest "immense" for typo "imense"', async () => {
      const sizeSchema = {
        type: 'object',
        properties: {
          magnitude: {
            type: 'string',
            enum: ['tiny', 'small', 'immense'],
          },
        },
      };

      await schemaValidator.addSchema(sizeSchema, 'test:size');
      dataRegistry.store('components', 'test:size', {
        id: 'test:size',
        dataSchema: sizeSchema,
      });

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:size': {
                magnitude: 'imense', // Typo
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

    it('should suggest closest match case-insensitively', async () => {
      const schema = {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            enum: ['Alpha', 'Beta', 'Gamma'],
          },
        },
      };

      await schemaValidator.addSchema(schema, 'test:greek');
      dataRegistry.store('components', 'test:greek', {
        id: 'test:greek',
        dataSchema: schema,
      });

      const recipe = {
        slots: {
          body: {
            properties: {
              'test:greek': {
                value: 'alpha', // Wrong case
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
      expect(issues[0].context.schemaErrors[0].suggestion).toBe('Alpha');
    });
  });
});
