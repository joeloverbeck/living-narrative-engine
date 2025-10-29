import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import {
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories/index.js';

// Mock helper modules used internally
jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn().mockResolvedValue({
    qualifiedId: 'core:human',
    didOverride: false,
  }),
}));

jest.mock('../../../src/utils/idUtils.js', () => {
  const actual = jest.requireActual('../../../src/utils/idUtils.js');
  return {
    ...actual,
    parseAndValidateId: jest
      .fn()
      .mockReturnValue({ fullId: 'core:human', baseId: 'human' }),
  };
});

import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../../../src/utils/idUtils.js';

describe('AnatomyRecipeLoader._processFetchedItem', () => {
  let loader;
  let logger;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
    const dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomyRecipeLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    jest.clearAllMocks();
  });

  it('processes a valid recipe and stores it', async () => {
    const data = {
      recipeId: 'core:human',
      includes: ['macro1'],
      constraints: {
        requires: [
          {
            components: ['core:heart', 'core:lung'],
          },
        ],
        excludes: [
          {
            partTypes: ['wing_primary', 'tentacle_primary'],
          },
        ],
      },
    };

    const validateSpy = jest.spyOn(loader, '_validateConstraints');

    const result = await loader._processFetchedItem(
      'core',
      'human.recipe.json',
      '/tmp/human.recipe.json',
      data,
      'anatomyRecipes'
    );

    expect(parseAndValidateId).toHaveBeenCalledWith(
      data,
      'recipeId',
      'core',
      'human.recipe.json',
      logger
    );
    expect(validateSpy).toHaveBeenCalledWith(
      data.constraints,
      'core',
      'human.recipe.json'
    );
    expect(processAndStoreItem).toHaveBeenCalledWith(
      loader,
      expect.objectContaining({
        data,
        idProp: 'recipeId',
        category: 'anatomyRecipes',
        modId: 'core',
        filename: 'human.recipe.json',
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "AnatomyRecipeLoader [core]: Recipe 'human' includes 1 macro(s)"
    );
    expect(result).toEqual({ qualifiedId: 'core:human', didOverride: false });
  });

  it('skips constraint validation when none are present', async () => {
    const data = { recipeId: 'core:human' };
    const validateSpy = jest.spyOn(loader, '_validateConstraints');

    await loader._processFetchedItem(
      'core',
      'human.json',
      '/tmp/human.json',
      data,
      'anatomyRecipes'
    );

    expect(validateSpy).not.toHaveBeenCalled();
  });

  it('propagates errors from constraint validation', async () => {
    const data = { recipeId: 'core:human', constraints: { requires: ['bad'] } };
    jest.spyOn(loader, '_validateConstraints').mockImplementation(() => {
      throw new ValidationError('bad');
    });

    await expect(
      loader._processFetchedItem(
        'core',
        'human.json',
        '/tmp/human.json',
        data,
        'anatomyRecipes'
      )
    ).rejects.toThrow(ValidationError);
  });
});

describe('AnatomyRecipeLoader._validateConstraints', () => {
  let loader;

  beforeEach(() => {
    loader = new AnatomyRecipeLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      createMockSchemaValidator(),
      createSimpleMockDataRegistry(),
      createMockLogger()
    );
  });

  it('throws when requires is not an array', () => {
    expect(() =>
      loader._validateConstraints({ requires: 'foo' }, 'core', 'file')
    ).toThrow(ValidationError);
  });

  it('throws when a requires group is not an object', () => {
    const constraints = { requires: [['onlyOne']] };
    expect(() =>
      loader._validateConstraints(constraints, 'core', 'file')
    ).toThrow(ValidationError);
  });

  it('throws when requires group omits both components and partTypes', () => {
    const constraints = { requires: [{}] };
    expect(() =>
      loader._validateConstraints(constraints, 'core', 'file')
    ).toThrow(/Specify at least one of 'components' or 'partTypes'/);
  });

  it('throws when requires components array is too small', () => {
    const constraints = {
      requires: [
        {
          components: ['only-one'],
        },
      ],
    };
    expect(() =>
      loader._validateConstraints(constraints, 'core', 'file')
    ).toThrow(/must contain at least 2 items/);
  });

  it('throws when excludes partTypes entries are not strings', () => {
    const constraints = {
      excludes: [
        {
          partTypes: ['leg', 123],
        },
      ],
    };
    expect(() =>
      loader._validateConstraints(constraints, 'core', 'file')
    ).toThrow(/entries must all be strings/);
  });

  it('does not throw for valid V2 constraint objects', () => {
    const constraints = {
      requires: [
        {
          components: ['anatomy:wing', 'anatomy:arm_socket'],
        },
        {
          partTypes: ['leg_front_left', 'leg_front_right'],
        },
      ],
      excludes: [
        {
          components: ['anatomy:wing', 'anatomy:tentacle'],
          partTypes: ['wing_primary', 'tentacle_primary'],
        },
      ],
    };

    expect(() =>
      loader._validateConstraints(constraints, 'core', 'file')
    ).not.toThrow();
  });
});
