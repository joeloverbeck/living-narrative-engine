import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DescriptorCoverageValidator } from '../../../../../src/anatomy/validation/validators/DescriptorCoverageValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createRecipe = (overrides = {}) => ({
  recipeId: 'core:test_recipe',
  slots: {},
  ...overrides,
});

describe('DescriptorCoverageValidator', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  const createValidator = ({
    entityDefinitions = [],
    dataRegistryOverrides = {},
  } = {}) => {
    const dataRegistry = {
      getAll: jest.fn().mockReturnValue(entityDefinitions),
      ...dataRegistryOverrides,
    };

    const validator = new DescriptorCoverageValidator({
      logger,
      dataRegistry,
    });

    return { validator, dataRegistry };
  };

  describe('constructor', () => {
    it('initializes with descriptor validator defaults', () => {
      const dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
      const validator = new DescriptorCoverageValidator({
        logger,
        dataRegistry,
      });

      expect(validator.name).toBe('descriptor-coverage');
      expect(validator.priority).toBe(40);
      expect(validator.failFast).toBe(false);
    });

    it('validates data registry dependency', () => {
      expect(
        () => new DescriptorCoverageValidator({ logger, dataRegistry: {} })
      ).toThrow(
        "Invalid or missing method 'getAll' on dependency 'IDataRegistry'."
      );
    });
  });

  describe('performValidation', () => {
    it('adds passed message when all slots have descriptors', async () => {
      const { validator, dataRegistry } = createValidator({
        entityDefinitions: [
          { id: 'core:hand', components: { 'descriptors:texture': true } },
        ],
      });
      const recipe = createRecipe({
        slots: {
          head: {
            properties: { 'descriptors:size_category': 'large' },
          },
          hand: {
            preferId: 'core:hand',
          },
        },
      });

      const result = await validator.validate(recipe);

      expect(dataRegistry.getAll).toHaveBeenCalledTimes(1);
      expect(result.suggestions).toHaveLength(0);
      expect(result.passed).toContainEqual({
        check: 'descriptor_coverage',
        message: 'All slots have descriptor components',
      });
    });

    it('adds suggestion when slot and preferred entity lack descriptors', async () => {
      const { validator } = createValidator({
        entityDefinitions: [
          { id: 'core:arm', components: { 'anatomy:limb': true } },
        ],
      });
      const recipe = createRecipe({
        slots: {
          arm: {
            properties: { 'anatomy:limb': true },
            preferId: 'core:arm',
          },
        },
      });

      const result = await validator.validate(recipe);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toEqual({
        check: 'descriptor_coverage',
        type: 'MISSING_DESCRIPTORS',
        location: { type: 'slot', name: 'arm' },
        message: "Slot 'arm' may not appear in descriptions",
        reason:
          "No descriptor components in slot properties, and preferred entity 'core:arm' has no descriptors",
        suggestion:
          'Add descriptor components (descriptors:size_category, descriptors:texture, etc.)',
        impact: 'Part will be excluded from anatomy description',
      });
    });

    it('adds suggestion when slot lacks descriptors and has no preferId', async () => {
      const { validator, dataRegistry } = createValidator();
      const recipe = createRecipe({
        slots: {
          torso: {
            properties: { 'anatomy:core': true },
          },
        },
      });

      const result = await validator.validate(recipe);

      expect(dataRegistry.getAll).not.toHaveBeenCalled();
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].reason).toBe(
        'No descriptor components in properties'
      );
    });

    it('respects descriptors from preferred entity when slot lacks them', async () => {
      const { validator } = createValidator({
        entityDefinitions: [
          {
            id: 'core:leg',
            components: {
              'descriptors:length': true,
              'anatomy:leg': true,
            },
          },
        ],
      });
      const recipe = createRecipe({
        slots: {
          leg: {
            preferId: 'core:leg',
            properties: { 'anatomy:leg': true },
          },
        },
      });

      const result = await validator.validate(recipe);

      expect(result.suggestions).toHaveLength(0);
      expect(result.passed).toHaveLength(1);
    });

    it('handles slots without properties by treating them as missing descriptors', async () => {
      const { validator } = createValidator();
      const recipe = createRecipe({
        slots: {
          wing: {},
        },
      });

      const result = await validator.validate(recipe);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].location).toEqual({
        type: 'slot',
        name: 'wing',
      });
    });

    it('handles recipes without slots by recording passed message', async () => {
      const { validator } = createValidator();
      const recipe = createRecipe({ slots: undefined });

      const result = await validator.validate(recipe);

      expect(result.suggestions).toHaveLength(0);
      expect(result.passed).toEqual([
        {
          check: 'descriptor_coverage',
          message: 'All slots have descriptor components',
        },
      ]);
    });

    it('treats non-array registry responses as empty collections', async () => {
      const errorRegistry = {
        getAll: jest.fn().mockReturnValue('not-an-array'),
      };
      const validator = new DescriptorCoverageValidator({
        logger,
        dataRegistry: errorRegistry,
      });
      const recipe = createRecipe({
        slots: {
          tail: {
            preferId: 'core:tail',
          },
        },
      });

      const result = await validator.validate(recipe);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].reason).toContain('preferred entity');
    });

    it('logs and suppresses registry errors during validation', async () => {
      const registryError = new Error('Registry failure');
      const dataRegistry = {
        getAll: jest.fn().mockImplementation(() => {
          throw registryError;
        }),
      };
      const validator = new DescriptorCoverageValidator({
        logger,
        dataRegistry,
      });
      const recipe = createRecipe({
        slots: {
          horn: {
            preferId: 'core:horn',
          },
        },
      });

      const result = await validator.validate(recipe);

      expect(logger.error).toHaveBeenCalledWith(
        "DescriptorCoverageValidator: Failed to check descriptors for preferred entity 'core:horn'",
        registryError
      );
      expect(result.suggestions).toHaveLength(1);
    });

    it('ignores patterns when generating suggestions', async () => {
      const { validator } = createValidator();
      const recipe = createRecipe({
        slots: {
          mouth: {
            properties: { 'descriptors:texture': 'rough' },
          },
        },
        patterns: [
          {
            preferId: 'core:patterned',
            properties: { 'anatomy:pattern': true },
          },
        ],
      });

      const result = await validator.validate(recipe);

      expect(result.suggestions).toHaveLength(0);
      expect(result.passed).toHaveLength(1);
    });
  });
});
