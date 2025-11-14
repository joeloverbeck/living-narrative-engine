import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RecipeUsageValidator } from '../../../../../src/anatomy/validation/validators/RecipeUsageValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createRecipe = (recipeId = 'test:recipe') => ({
  recipeId,
});

describe('RecipeUsageValidator', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  const createValidator = (entityDefinitions = [], overrides = {}) => {
    const dataRegistry = {
      getAll: jest.fn().mockReturnValue(entityDefinitions),
      ...overrides,
    };

    const validator = new RecipeUsageValidator({
      logger,
      dataRegistry,
    });

    return { validator, dataRegistry };
  };

  describe('constructor', () => {
    it('initializes with default configuration', () => {
      const dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
      const validator = new RecipeUsageValidator({ logger, dataRegistry });

      expect(validator.name).toBe('recipe-usage');
      expect(validator.priority).toBe(60);
      expect(validator.failFast).toBe(false);
    });

    it('throws when data registry is missing getAll', () => {
      expect(() => new RecipeUsageValidator({ logger, dataRegistry: {} })).toThrow(
        "Invalid or missing method 'getAll' on dependency 'IDataRegistry'."
      );
    });

    it('throws when logger is missing', () => {
      const dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
      expect(() => new RecipeUsageValidator({ logger: null, dataRegistry })).toThrow(
        'Missing required dependency: ILogger.'
      );
    });
  });

  describe('performValidation', () => {
    it('adds warning when recipe is unused', async () => {
      const recipe = createRecipe('core:unused');
      const { validator, dataRegistry } = createValidator([
        { id: 'core:entity', components: {} },
      ]);

      const result = await validator.validate(recipe);

      expect(dataRegistry.getAll).toHaveBeenCalledWith('entityDefinitions');
      expect(result.warnings).toHaveLength(1);
      const warning = result.warnings[0];
      expect(warning).toMatchObject({
        type: 'RECIPE_UNUSED',
        severity: 'warning',
        check: 'recipe_usage',
        suggestion: 'Verify that the recipeId matches what entity definitions expect',
      });
      expect(warning.details).toEqual({
        recipeId: 'core:unused',
        hint:
          'Entity definitions should have: "anatomy:body": { "recipeId": "core:unused" }',
      });
      expect(result.recipeUsage).toEqual({
        check: 'recipe_usage',
        details: { referencingEntities: [], totalCount: 0 },
      });
    });

    it('adds passed entry when recipe is referenced and limits metadata to five IDs', async () => {
      const recipe = createRecipe('core:used');
      const entityDefinitions = Array.from({ length: 6 }).map((_, index) => ({
        id: `core:entity_${index}`,
        components: {
          'anatomy:body': { recipeId: index < 5 ? 'core:used' : 'core:used' },
        },
      }));
      const { validator } = createValidator(entityDefinitions);

      const result = await validator.validate(recipe);

      expect(result.passed).toHaveLength(1);
      expect(result.passed[0].message).toBe(
        'Recipe is referenced by 6 entity definition(s)'
      );
      expect(result.warnings).toHaveLength(0);
      expect(result.recipeUsage).toEqual({
        check: 'recipe_usage',
        details: {
          referencingEntities: [
            'core:entity_0',
            'core:entity_1',
            'core:entity_2',
            'core:entity_3',
            'core:entity_4',
          ],
          totalCount: 6,
        },
      });
    });

    it('ignores entities without anatomy body component', async () => {
      const recipe = createRecipe('core:target');
      const { validator } = createValidator([
        { id: 'core:none', components: {} },
        { id: 'core:null', components: { 'anatomy:body': null } },
        {
          id: 'core:other',
          components: { 'anatomy:body': { recipeId: 'core:other' } },
        },
      ]);

      const result = await validator.validate(recipe);
      expect(result.warnings).toHaveLength(1);
      expect(result.recipeUsage.details.totalCount).toBe(0);
    });

    it('handles entity definitions with null recipeId', async () => {
      const recipe = createRecipe('core:target');
      const { validator } = createValidator([
        { id: 'core:nullRecipe', components: { 'anatomy:body': { recipeId: null } } },
        { id: 'core:valid', components: { 'anatomy:body': { recipeId: 'core:target' } } },
      ]);

      const result = await validator.validate(recipe);

      expect(result.passed).toHaveLength(1);
      expect(result.recipeUsage.details.totalCount).toBe(1);
      expect(result.recipeUsage.details.referencingEntities).toEqual(['core:valid']);
    });

    it('treats non-array registry responses as empty collections', async () => {
      const recipe = createRecipe('core:target');
      const dataRegistry = {
        getAll: jest.fn().mockReturnValue({ not: 'an array' }),
      };
      const validator = new RecipeUsageValidator({ logger, dataRegistry });

      const result = await validator.validate(recipe);
      expect(result.warnings).toHaveLength(1);
      expect(result.recipeUsage.details.totalCount).toBe(0);
    });

    it('logs and suppresses errors from the data registry', async () => {
      const recipe = createRecipe('core:target');
      const error = new Error('Registry failure');
      const dataRegistry = {
        getAll: jest.fn().mockImplementation(() => {
          throw error;
        }),
      };
      const validator = new RecipeUsageValidator({ logger, dataRegistry });

      const result = await validator.validate(recipe);
      expect(logger.error).toHaveBeenCalledWith('Recipe usage validation failed', error);
      expect(result.warnings).toHaveLength(0);
      expect(result.passed).toHaveLength(0);
      expect(result.recipeUsage).toBeUndefined();
    });
  });
});
