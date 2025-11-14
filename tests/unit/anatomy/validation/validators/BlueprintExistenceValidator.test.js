import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BlueprintExistenceValidator } from '../../../../../src/anatomy/validation/validators/BlueprintExistenceValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createRecipe = (overrides = {}) => ({
  recipeId: 'core:test_recipe',
  blueprintId: 'anatomy:test_blueprint',
  ...overrides,
});

describe('BlueprintExistenceValidator', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
  });

  const createValidator = (options = {}) => {
    const { blueprintResponse = null } = options;
    const anatomyBlueprintRepository = {
      getBlueprint: jest.fn().mockResolvedValue(blueprintResponse),
    };

    const validator = new BlueprintExistenceValidator({
      logger,
      anatomyBlueprintRepository,
    });

    return { validator, anatomyBlueprintRepository };
  };

  describe('constructor', () => {
    it('sets failFast metadata and exposes name/priority', () => {
      const { validator } = createValidator();

      expect(validator.name).toBe('blueprint-existence');
      expect(validator.priority).toBe(10);
      expect(validator.failFast).toBe(true);
    });

    it('validates blueprint repository dependency', () => {
      expect(
        () =>
          new BlueprintExistenceValidator({
            logger,
            anatomyBlueprintRepository: {},
          })
      ).toThrow(
        "Invalid or missing method 'getBlueprint' on dependency 'IAnatomyBlueprintRepository'."
      );
    });

    it('requires a logger dependency', () => {
      expect(
        () =>
          new BlueprintExistenceValidator({
            logger: undefined,
            anatomyBlueprintRepository: { getBlueprint: jest.fn() },
          })
      ).toThrow('Missing required dependency: ILogger.');
    });
  });

  describe('performValidation', () => {
    it('records a passed check when blueprint exists', async () => {
      const blueprint = {
        id: 'anatomy:arachnid',
        root: 'anatomy:root',
        structureTemplate: 'anatomy:structure_arachnid',
      };
      const { validator, anatomyBlueprintRepository } = createValidator({
        blueprintResponse: blueprint,
      });
      const recipe = createRecipe();

      const result = await validator.validate(recipe);

      expect(anatomyBlueprintRepository.getBlueprint).toHaveBeenCalledWith(
        recipe.blueprintId
      );
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toEqual([
        {
          message: `Blueprint '${recipe.blueprintId}' found`,
          check: 'blueprint_exists',
          blueprint: {
            id: blueprint.id,
            root: blueprint.root,
            structureTemplate: blueprint.structureTemplate,
          },
        },
      ]);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('emits error when blueprint is missing', async () => {
      const { validator } = createValidator({ blueprintResponse: null });
      const recipe = createRecipe();

      const result = await validator.validate(recipe);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        {
          type: 'BLUEPRINT_NOT_FOUND',
          severity: 'error',
          message: `Blueprint '${recipe.blueprintId}' does not exist`,
          blueprintId: recipe.blueprintId,
          fix: 'Create blueprint at data/mods/*/blueprints/test_blueprint.blueprint.json',
        },
      ]);
    });

    it('converts repository exceptions into validation errors', async () => {
      const repositoryError = new Error('Repository offline');
      const anatomyBlueprintRepository = {
        getBlueprint: jest.fn().mockRejectedValue(repositoryError),
      };
      const validator = new BlueprintExistenceValidator({
        logger,
        anatomyBlueprintRepository,
      });
      const recipe = createRecipe();

      const result = await validator.validate(recipe);

      expect(logger.error).toHaveBeenCalledWith(
        'Blueprint existence check failed',
        repositoryError
      );
      expect(result.errors).toEqual([
        {
          type: 'VALIDATION_ERROR',
          severity: 'error',
          message: 'Failed to check blueprint existence',
          check: 'blueprint_exists',
          error: 'Repository offline',
        },
      ]);
    });

    it('handles missing blueprintId without throwing and still suggests fix', async () => {
      const { validator, anatomyBlueprintRepository } = createValidator({
        blueprintResponse: null,
      });
      const recipe = createRecipe({ blueprintId: undefined });

      const result = await validator.validate(recipe);

      expect(anatomyBlueprintRepository.getBlueprint).toHaveBeenCalledWith(
        undefined
      );
      expect(result.errors[0].type).toBe('BLUEPRINT_NOT_FOUND');
      expect(result.errors[0]).toHaveProperty('blueprintId');
      expect(result.errors[0].blueprintId).toBeUndefined();
      expect(result.errors[0].fix).toBe(
        'Create blueprint at data/mods/*/blueprints/undefined.blueprint.json'
      );
    });

    it('preserves blueprint metadata even when structureTemplate is missing', async () => {
      const blueprint = { id: 'anatomy:v1_blueprint', root: 'anatomy:root' };
      const { validator } = createValidator({
        blueprintResponse: blueprint,
      });

      const result = await validator.validate(createRecipe());

      expect(result.passed[0].blueprint).toEqual({
        id: blueprint.id,
        root: blueprint.root,
        structureTemplate: undefined,
      });
    });
  });
});
