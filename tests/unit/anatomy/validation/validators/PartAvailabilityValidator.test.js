import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PartAvailabilityValidator } from '../../../../../src/anatomy/validation/validators/PartAvailabilityValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createRecipe = (overrides = {}) => ({
  recipeId: 'core:test_recipe',
  slots: {},
  patterns: [],
  ...overrides,
});

describe('PartAvailabilityValidator', () => {
  let logger;

  beforeEach(() => {
    const testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  const createValidator = ({
    entityDefinitions = [],
    matcherImpl,
    dataRegistryOverrides = {},
    matcherOverrides = {},
  } = {}) => {
    const dataRegistry = {
      getAll: jest.fn().mockReturnValue(entityDefinitions),
      ...dataRegistryOverrides,
    };

    const entityMatcherService = {
      findMatchingEntities: jest
        .fn()
        .mockImplementation(
          matcherImpl || (() => (entityDefinitions.length > 0 ? [{}] : []))
        ),
      ...matcherOverrides,
    };

    const validator = new PartAvailabilityValidator({
      logger,
      dataRegistry,
      entityMatcherService,
    });

    return { validator, dataRegistry, entityMatcherService };
  };

  describe('constructor', () => {
    it('initializes with part availability defaults', () => {
      const { validator } = createValidator();

      expect(validator.name).toBe('part-availability');
      expect(validator.priority).toBe(25);
      expect(validator.failFast).toBe(false);
    });

    it('validates data registry dependency', () => {
      expect(
        () =>
          new PartAvailabilityValidator({
            logger,
            dataRegistry: {},
            entityMatcherService: { findMatchingEntities: jest.fn() },
          })
      ).toThrow("Invalid or missing method 'getAll' on dependency 'IDataRegistry'.");
    });

    it('validates entity matcher dependency', () => {
      expect(
        () =>
          new PartAvailabilityValidator({
            logger,
            dataRegistry: { getAll: jest.fn() },
            entityMatcherService: {},
          })
      ).toThrow(
        "Invalid or missing method 'findMatchingEntities' on dependency 'IEntityMatcherService'."
      );
    });
  });

  describe('performValidation', () => {
    it('adds passed message when every slot and pattern has matches', async () => {
      const recipe = createRecipe({
        slots: {
          head: { partType: 'core:head' },
        },
        patterns: [{ partType: 'core:limb' }],
      });

      const entityDefinitions = [{ id: 'core:head' }];
      const matcher = jest.fn().mockReturnValue([{ id: 'match' }]);
      const { validator, dataRegistry, entityMatcherService } = createValidator({
        entityDefinitions,
        matcherImpl: matcher,
      });

      const result = await validator.validate(recipe);

      expect(dataRegistry.getAll).toHaveBeenCalledWith('entityDefinitions');
      expect(entityMatcherService.findMatchingEntities).toHaveBeenCalledTimes(2);
      expect(entityMatcherService.findMatchingEntities).toHaveBeenNthCalledWith(
        1,
        recipe.slots.head,
        entityDefinitions
      );
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual({
        message: 'All slots and patterns have matching entity definitions',
        check: 'part_availability',
      });
    });

    it('records PART_UNAVAILABLE error when a slot has no matches', async () => {
      const recipe = createRecipe({
        slots: {
          arm: {
            partType: 'core:arm',
            tags: ['anatomy:limb'],
            properties: { strength: 'high' },
          },
        },
      });

      const { validator } = createValidator({ matcherImpl: () => [] });

      const result = await validator.validate(recipe);

      expect(result.errors).toEqual([
        {
          type: 'PART_UNAVAILABLE',
          severity: 'error',
          location: { type: 'slot', name: 'arm' },
          message: "No entity definitions found for slot 'arm'",
          details: {
            partType: 'core:arm',
            requiredTags: ['anatomy:limb'],
            requiredProperties: ['strength'],
            totalEntitiesChecked: 0,
          },
        },
      ]);
      expect(result.passed).toHaveLength(0);
    });

    it('aggregates multiple slot and pattern errors', async () => {
      const recipe = createRecipe({
        slots: {
          torso: { partType: 'core:torso' },
        },
        patterns: [
          {
            partType: 'core:wing',
            tags: ['flying'],
            properties: { span: 'wide' },
          },
        ],
      });

      const { validator } = createValidator({ matcherImpl: () => [] });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(2);
      expect(result.errors).toEqual([
        expect.objectContaining({
          location: { type: 'slot', name: 'torso' },
          message: "No entity definitions found for slot 'torso'",
        }),
        expect.objectContaining({
          location: { type: 'pattern', index: 0 },
          message: 'No entity definitions found for pattern 0',
          details: expect.objectContaining({
            requiredTags: ['flying'],
            requiredProperties: ['span'],
          }),
        }),
      ]);
    });

    it('treats missing slots and patterns as success', async () => {
      const recipe = createRecipe({ slots: undefined, patterns: undefined });
      const { validator } = createValidator();

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toEqual([
        {
          message: 'All slots and patterns have matching entity definitions',
          check: 'part_availability',
        },
      ]);
    });

    it('handles recipes that only declare patterns', async () => {
      const recipe = createRecipe({
        slots: {},
        patterns: [{ partType: 'core:horn' }],
      });

      const { validator, entityMatcherService } = createValidator();
      await validator.validate(recipe);

      expect(entityMatcherService.findMatchingEntities).toHaveBeenCalledTimes(1);
      expect(entityMatcherService.findMatchingEntities).toHaveBeenCalledWith(
        recipe.patterns[0],
        expect.any(Array)
      );
    });

    it('handles matcher exceptions by recording VALIDATION_ERROR', async () => {
      const matcherError = new Error('matcher failed');
      const { validator, entityMatcherService } = createValidator({
        matcherImpl: () => {
          throw matcherError;
        },
      });

      const recipe = createRecipe({
        slots: {
          head: { partType: 'core:head' },
        },
      });

      const result = await validator.validate(recipe);

      expect(entityMatcherService.findMatchingEntities).toHaveBeenCalled();
      expect(result.errors).toContainEqual({
        type: 'VALIDATION_ERROR',
        severity: 'error',
        message: 'Failed to validate part availability',
        check: 'part_availability',
        error: 'matcher failed',
      });
    });

    it('records validation error when the registry throws inside performValidation', async () => {
      const registryError = new Error('registry failure');
      const { validator } = createValidator({
        dataRegistryOverrides: {
          getAll: jest.fn(() => {
            throw registryError;
          }),
        },
      });

      const builder = {
        addError: jest.fn(),
        addIssues: jest.fn(),
        addPassed: jest.fn(),
      };

      await validator.performValidation(createRecipe(), {}, builder);

      expect(builder.addIssues).not.toHaveBeenCalled();
      expect(builder.addPassed).not.toHaveBeenCalled();
      expect(builder.addError).toHaveBeenCalledWith(
        'VALIDATION_ERROR',
        'Failed to validate part availability',
        { check: 'part_availability', error: 'registry failure' }
      );
    });
  });
});
