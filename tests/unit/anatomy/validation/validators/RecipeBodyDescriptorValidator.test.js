import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RecipeBodyDescriptorValidator } from '../../../../../src/anatomy/validation/validators/RecipeBodyDescriptorValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createDescriptorProperties = (overrides = {}) => ({
  'descriptors:size_category': {
    enum: ['small', 'medium', 'large'],
    type: 'string',
  },
  'descriptors:texture': {
    type: 'string',
  },
  ...overrides,
});

const createBodyComponent = (descriptorProperties = createDescriptorProperties()) => ({
  dataSchema: {
    properties: {
      body: {
        properties: {
          descriptors: {
            properties: descriptorProperties,
          },
        },
      },
    },
  },
});

const createRecipe = (overrides = {}) => ({
  recipeId: 'core:test_recipe',
  bodyDescriptors: {
    'descriptors:size_category': 'medium',
    'descriptors:texture': 'rough',
  },
  ...overrides,
});

describe('RecipeBodyDescriptorValidator', () => {
  let logger;

  beforeEach(() => {
    const testBed = createTestBed();
    logger = testBed.logger;
    jest.clearAllMocks();
  });

  const createValidator = (options = {}) => {
    const { component: providedComponent, dataRegistryImpl } = options;
    const hasComponentOverride = Object.prototype.hasOwnProperty.call(
      options,
      'component'
    );
    const component = hasComponentOverride
      ? providedComponent
      : createBodyComponent();
    const dataRegistry =
      dataRegistryImpl ||
      {
        get: jest.fn().mockImplementation((collection, id) => {
          if (collection === 'components' && id === 'anatomy:body') {
            return component;
          }
          return undefined;
        }),
      };

    const validator = new RecipeBodyDescriptorValidator({
      logger,
      dataRegistry,
    });

    return { validator, dataRegistry };
  };

  describe('constructor', () => {
    it('configures base metadata and exposes name/priority', () => {
      const { validator } = createValidator();

      expect(validator.name).toBe('recipe-body-descriptor');
      expect(validator.priority).toBe(15);
      expect(validator.failFast).toBe(false);
    });

    it('validates data registry dependency', () => {
      expect(
        () =>
          new RecipeBodyDescriptorValidator({
            logger,
            dataRegistry: {},
          })
      ).toThrow(
        "Invalid or missing method 'get' on dependency 'IDataRegistry'."
      );
    });
  });

  describe('performValidation', () => {
    it('loads anatomy:body component from registry', async () => {
      const { validator, dataRegistry } = createValidator();
      const result = await validator.validate(createRecipe());

      expect(dataRegistry.get).toHaveBeenCalledWith('components', 'anatomy:body');
      expect(result.passed).toHaveLength(1);
    });

    it('warns and skips validation when anatomy:body component is missing', async () => {
      const { validator } = createValidator({ component: undefined });
      const result = await validator.validate(createRecipe());

      expect(logger.warn).toHaveBeenCalledWith(
        'anatomy:body component not found, skipping bodyDescriptors validation'
      );
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toHaveLength(0);
    });

    it('warns and skips validation when descriptors schema is missing', async () => {
      const componentWithoutDescriptors = {
        dataSchema: { properties: { body: { properties: {} } } },
      };
      const { validator } = createValidator({
        component: componentWithoutDescriptors,
      });
      const result = await validator.validate(createRecipe());

      expect(logger.warn).toHaveBeenCalledWith(
        'anatomy:body component missing descriptors schema, skipping bodyDescriptors validation'
      );
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toHaveLength(0);
    });

    it('records passed message when recipe has no bodyDescriptors object', async () => {
      const { validator } = createValidator();
      const result = await validator.validate(createRecipe({ bodyDescriptors: undefined }));

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toEqual([
        {
          message: 'No bodyDescriptors to validate',
          check: 'body_descriptors',
        },
      ]);
    });

    it('treats non-object bodyDescriptors as empty payload', async () => {
      const { validator } = createValidator();
      const recipe = createRecipe({ bodyDescriptors: 'invalid' });

      const result = await validator.validate(recipe);

      expect(result.passed[0]).toEqual({
        message: 'No bodyDescriptors to validate',
        check: 'body_descriptors',
      });
    });

    it('passes validation for empty bodyDescriptors object', async () => {
      const { validator } = createValidator();
      const result = await validator.validate(createRecipe({ bodyDescriptors: {} }));

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toEqual([
        {
          message: 'All 0 body descriptor(s) valid',
          check: 'body_descriptors',
        },
      ]);
    });

    it('passes validation when all descriptors match schema', async () => {
      const { validator } = createValidator();
      const result = await validator.validate(createRecipe());

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toEqual([
        {
          message: 'All 2 body descriptor(s) valid',
          check: 'body_descriptors',
        },
      ]);
    });

    it('reports unknown descriptors with allowed descriptor metadata', async () => {
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:unknown': 'mystery',
        },
      });
      const { validator } = createValidator();

      const result = await validator.validate(recipe);

      expect(result.errors).toEqual([
        {
          type: 'UNKNOWN_BODY_DESCRIPTOR',
          severity: 'error',
          message: "Unknown body descriptor 'descriptors:unknown'",
          check: 'body_descriptors',
          field: 'descriptors:unknown',
          value: 'mystery',
          fix: "Remove 'descriptors:unknown' from bodyDescriptors or add it to the anatomy:body component schema",
          allowedDescriptors: [
            'descriptors:size_category',
            'descriptors:texture',
          ],
        },
      ]);
    });

    it('reports invalid enum values', async () => {
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:size_category': 'gigantic',
        },
      });
      const { validator } = createValidator();

      const result = await validator.validate(recipe);

      expect(result.errors).toEqual([
        {
          type: 'INVALID_BODY_DESCRIPTOR_VALUE',
          severity: 'error',
          message: "Invalid value 'gigantic' for body descriptor 'descriptors:size_category'",
          check: 'body_descriptors',
          field: 'descriptors:size_category',
          value: 'gigantic',
          fix: 'Use one of the allowed values: small, medium, large',
          allowedValues: ['small', 'medium', 'large'],
        },
      ]);
    });

    it('reports invalid descriptor types including null payloads', async () => {
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:size_category': 'medium',
          'descriptors:texture': null,
        },
      });
      const { validator } = createValidator();

      const result = await validator.validate(recipe);

      expect(result.errors).toEqual([
        {
          type: 'INVALID_BODY_DESCRIPTOR_TYPE',
          severity: 'error',
          message: "Invalid type for body descriptor 'descriptors:texture': expected one of [string], got null",
          check: 'body_descriptors',
          field: 'descriptors:texture',
          value: null,
          fix: 'Change value to one of these types: string',
          expectedTypes: ['string'],
          actualType: 'null',
        },
      ]);
    });

    it('aggregates multiple descriptor issues', async () => {
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:size_category': 'gigantic',
          'descriptors:texture': 42,
          'descriptors:ghost': 'ectoplasm',
        },
      });
      const { validator } = createValidator();

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(3);
      expect(result.errors.map((error) => error.type)).toEqual([
        'INVALID_BODY_DESCRIPTOR_VALUE',
        'INVALID_BODY_DESCRIPTOR_TYPE',
        'UNKNOWN_BODY_DESCRIPTOR',
      ]);
    });

    it('handles schema definitions without enum constraints', async () => {
      const properties = createDescriptorProperties({
        'descriptors:texture': { type: 'string' },
      });
      const { validator } = createValidator({
        component: createBodyComponent(properties),
      });
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:texture': 'silky',
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed[0].message).toBe('All 1 body descriptor(s) valid');
    });

    it('handles complex schema type definitions without false positives', async () => {
      const properties = createDescriptorProperties({
        'descriptors:phase': {
          type: ['string', 'null'],
        },
      });
      const { validator } = createValidator({
        component: createBodyComponent(properties),
      });
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:phase': 'liquid',
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed[0].message).toBe('All 1 body descriptor(s) valid');
    });

    it('rejects invalid types for union type schemas (number)', async () => {
      const properties = createDescriptorProperties({
        'descriptors:phase': {
          type: ['string', 'null'],
        },
      });
      const { validator } = createValidator({
        component: createBodyComponent(properties),
      });
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:phase': 42, // Invalid: number not in ['string', 'null']
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('INVALID_BODY_DESCRIPTOR_TYPE');
      expect(result.errors[0].message).toContain('expected one of [string, null]');
      expect(result.errors[0].message).toContain('got number');
      expect(result.errors[0].field).toBe('descriptors:phase');
      expect(result.errors[0].expectedTypes).toEqual(['string', 'null']);
      expect(result.errors[0].actualType).toBe('number');
    });

    it('accepts valid null for union type schemas', async () => {
      const properties = createDescriptorProperties({
        'descriptors:phase': {
          type: ['string', 'null'],
        },
      });
      const { validator } = createValidator({
        component: createBodyComponent(properties),
      });
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:phase': null, // Valid: null is in ['string', 'null']
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed[0].message).toBe('All 1 body descriptor(s) valid');
    });

    it('rejects invalid types for union type schemas (object)', async () => {
      const properties = createDescriptorProperties({
        'descriptors:density': {
          type: ['string', 'number'],
        },
      });
      const { validator } = createValidator({
        component: createBodyComponent(properties),
      });
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:density': { value: 'high' }, // Invalid: object not in ['string', 'number']
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('INVALID_BODY_DESCRIPTOR_TYPE');
      expect(result.errors[0].message).toContain('expected one of [string, number]');
      expect(result.errors[0].message).toContain('got object');
      expect(result.errors[0].field).toBe('descriptors:density');
      expect(result.errors[0].expectedTypes).toEqual(['string', 'number']);
      expect(result.errors[0].actualType).toBe('object');
    });

    it('handles single string type schema (backward compatibility)', async () => {
      const properties = createDescriptorProperties({
        'descriptors:color': {
          type: 'string', // Single type as string, not array
        },
      });
      const { validator } = createValidator({
        component: createBodyComponent(properties),
      });
      const recipe = createRecipe({
        bodyDescriptors: {
          'descriptors:color': 42, // Invalid: number when expecting string
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('INVALID_BODY_DESCRIPTOR_TYPE');
      expect(result.errors[0].message).toContain('expected one of [string]');
      expect(result.errors[0].message).toContain('got number');
      expect(result.errors[0].expectedTypes).toEqual(['string']);
      expect(result.errors[0].actualType).toBe('number');
    });

    it('converts registry exceptions into validation errors', async () => {
      const registryError = new Error('Registry offline');
      const dataRegistry = {
        get: jest.fn().mockImplementation(() => {
          throw registryError;
        }),
      };
      const validator = new RecipeBodyDescriptorValidator({
        logger,
        dataRegistry,
      });

      const result = await validator.validate(createRecipe());

      expect(logger.error).toHaveBeenCalledWith(
        'Body descriptors check failed',
        registryError
      );
      expect(result.errors).toEqual([
        {
          type: 'VALIDATION_ERROR',
          severity: 'error',
          message: 'Failed to validate body descriptors',
          check: 'body_descriptors',
          error: 'Registry offline',
        },
      ]);
    });
  });
});
