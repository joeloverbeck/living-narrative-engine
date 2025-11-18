import { describe, it, expect, jest } from '@jest/globals';
import ValidationResultBuilder from '../../../../src/anatomy/validation/core/ValidationResultBuilder.js';
import { ComponentExistenceValidator } from '../../../../src/anatomy/validation/validators/ComponentExistenceValidator.js';
import { PropertySchemaValidator } from '../../../../src/anatomy/validation/validators/PropertySchemaValidator.js';
import { RecipeBodyDescriptorValidator } from '../../../../src/anatomy/validation/validators/RecipeBodyDescriptorValidator.js';
import { BlueprintExistenceValidator } from '../../../../src/anatomy/validation/validators/BlueprintExistenceValidator.js';
import { SocketSlotCompatibilityValidator } from '../../../../src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js';
import { PartAvailabilityValidator } from '../../../../src/anatomy/validation/validators/PartAvailabilityValidator.js';
import { GeneratedSlotPartsValidator } from '../../../../src/anatomy/validation/validators/GeneratedSlotPartsValidator.js';
import { PatternMatchingValidator } from '../../../../src/anatomy/validation/validators/PatternMatchingValidator.js';
import { DescriptorCoverageValidator } from '../../../../src/anatomy/validation/validators/DescriptorCoverageValidator.js';
import { LoadFailureValidator } from '../../../../src/anatomy/validation/validators/LoadFailureValidator.js';
import { RecipeUsageValidator } from '../../../../src/anatomy/validation/validators/RecipeUsageValidator.js';

/**
 *
 */
function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('Validator logging contract', () => {
  const baseRecipe = {
    recipeId: 'test:recipe',
    blueprintId: 'test:blueprint',
    slots: {
      head: {
        tags: ['core:missing'],
        properties: {
          'core:component': { foo: 'bar' },
        },
      },
    },
    patterns: [
      {
        matchesPattern: '*',
        properties: {
          'core:component': { foo: 'bar' },
        },
      },
    ],
  };

  const patternRecipe = {
    ...baseRecipe,
    patterns: [
      {
        matchesPattern: '*',
        tags: ['core:missing'],
      },
    ],
  };

  const descriptorRecipe = {
    recipeId: 'test:descriptor',
    blueprintId: 'test:blueprint',
    slots: {
      torso: {
        properties: new Proxy(
          {},
          {
            ownKeys() {
              throw new Error('descriptor coverage property failure');
            },
          }
        ),
      },
    },
  };

  const validatorCases = [
    {
      name: 'component-existence',
      create: (logger) =>
        new ComponentExistenceValidator({
          logger,
          dataRegistry: {
            get: () => {
              throw new Error('registry failure');
            },
            getAll: () => ({}),
          },
        }),
      recipe: baseRecipe,
    },
    {
      name: 'property-schemas',
      create: (logger) =>
        new PropertySchemaValidator({
          logger,
          dataRegistry: {
            get: () => {
              throw new Error('component lookup failed');
            },
            getAll: () => ({}),
          },
          schemaValidator: {
            validate: () => ({ isValid: true, errors: null }),
          },
        }),
      recipe: baseRecipe,
    },
    {
      name: 'body-descriptors',
      create: (logger) =>
        new RecipeBodyDescriptorValidator({
          logger,
          dataRegistry: {
            get: () => {
              throw new Error('body lookup failed');
            },
          },
        }),
      recipe: { ...baseRecipe, bodyDescriptors: { stature: 'tall' } },
    },
    {
      name: 'blueprint-existence',
      create: (logger) =>
        new BlueprintExistenceValidator({
          logger,
          anatomyBlueprintRepository: {
            getBlueprint: () => {
              throw new Error('blueprint store offline');
            },
          },
        }),
      recipe: baseRecipe,
    },
    {
      name: 'socket-slot-compatibility',
      create: (logger) =>
        new SocketSlotCompatibilityValidator({
          logger,
          dataRegistry: {
            get: () => ({}),
          },
          anatomyBlueprintRepository: {
            getBlueprint: () => {
              throw new Error('socket blueprint missing');
            },
          },
        }),
      recipe: baseRecipe,
    },
    {
      name: 'part-availability',
      create: (logger) =>
        new PartAvailabilityValidator({
          logger,
          dataRegistry: {
            getAll: () => {
              throw new Error('entity registry failure');
            },
          },
          entityMatcherService: {
            findMatchingEntities: () => [],
          },
        }),
      recipe: baseRecipe,
    },
    {
      name: 'generated-slot-parts',
      create: (logger) =>
        new GeneratedSlotPartsValidator({
          logger,
          slotGenerator: {
            generateBlueprintSlots: () => ({}),
            extractSlotKeysFromLimbSet: () => [],
            extractSlotKeysFromAppendage: () => [],
          },
          dataRegistry: {
            get: () => ({}),
            getAll: () => [],
          },
          entityMatcherService: {
            findMatchingEntitiesForSlot: () => [],
            mergePropertyRequirements: () => ({}),
          },
          anatomyBlueprintRepository: {
            getBlueprint: () => {
              throw new Error('generated slot blueprint error');
            },
          },
        }),
      recipe: patternRecipe,
    },
    {
      name: 'pattern-matching',
      create: (logger) =>
        new PatternMatchingValidator({
          logger,
          dataRegistry: {
            get: () => ({}),
          },
          slotGenerator: {
            extractSlotKeysFromLimbSet: () => [],
            extractSlotKeysFromAppendage: () => [],
            generateBlueprintSlots: () => ({}),
          },
          anatomyBlueprintRepository: {
            getBlueprint: () => {
              throw new Error('pattern blueprint error');
            },
          },
        }),
      recipe: patternRecipe,
    },
    {
      name: 'descriptor-coverage',
      create: (logger) =>
        new DescriptorCoverageValidator({
          logger,
          dataRegistry: {
            getAll: () => [],
          },
        }),
      recipe: descriptorRecipe,
    },
    {
      name: 'load-failures',
      create: (logger) => new LoadFailureValidator({ logger }),
      recipe: baseRecipe,
      options: (() => {
        const failures = new Proxy([], {
          get(target, prop, receiver) {
            if (prop === 'length') {
              throw new Error('loader snapshot unavailable');
            }
            return Reflect.get(target, prop, receiver);
          },
        });
        return {
          loadFailures: {
            entityDefinitions: { failures },
          },
        };
      })(),
    },
    {
      name: 'recipe-usage',
      create: (logger) =>
        new RecipeUsageValidator({
          logger,
          dataRegistry: {
            getAll: () => {
              throw new Error('usage registry failure');
            },
          },
        }),
      recipe: baseRecipe,
    },
  ];

  it.each(validatorCases)('logs %s check failures consistently', async ({
    name,
    create,
    recipe,
    options,
  }) => {
    const logger = createLogger();
    const validator = create(logger);
    const builder = new ValidationResultBuilder(recipe.recipeId);

    await validator.performValidation(recipe, options ?? {}, builder);

    expect(logger.error).toHaveBeenCalledWith(
      `${name} check failed`,
      expect.any(Error)
    );
  });
});
