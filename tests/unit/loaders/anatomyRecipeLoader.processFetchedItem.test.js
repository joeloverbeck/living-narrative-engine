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

// Create a mock implementation that can be reconfigured per test
const mockValidateRecipeDescriptors = jest.fn().mockReturnValue({
  valid: true,
  errors: [],
  warnings: []
});

jest.mock('../../../src/anatomy/validators/bodyDescriptorValidator.js', () => ({
  BodyDescriptorValidator: jest.fn().mockImplementation(() => ({
    validateRecipeDescriptors: mockValidateRecipeDescriptors
  }))
}));

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

  it('validates body descriptors when provided', async () => {
    const data = {
      recipeId: 'core:human',
      bodyDescriptors: { build: 'athletic' },
    };
    const descriptorSpy = jest.spyOn(loader, '_validateBodyDescriptors');

    await loader._processFetchedItem(
      'core',
      'human.recipe.json',
      '/tmp/human.recipe.json',
      data,
      'anatomyRecipes'
    );

    expect(descriptorSpy).toHaveBeenCalledWith(
      data.bodyDescriptors,
      'human',
      'human.recipe.json'
    );
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
    jest.clearAllMocks();
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

  it('throws when a group includes unexpected properties', () => {
    const constraints = {
      requires: [
        {
          components: ['core:heart', 'core:lung'],
          unexpected: true,
        },
      ],
    };

    expect(() =>
      loader._validateConstraints(constraints, 'core', 'file')
    ).toThrow(/Unexpected properties: unexpected/);
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

  describe('Enhanced Constraint Error Messages', () => {
    describe('Requires Constraints', () => {
      it('includes business rule explanation for requires partTypes', () => {
        const constraints = {
          requires: [{ partTypes: ['single-part'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(
          expect.objectContaining({
            message: expect.stringMatching(/Business Rule:/),
          })
        );

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Co-presence constraints ensure multiple part types or components exist together/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/wings require tail for balance/);
      });

      it('includes example for requires partTypes', () => {
        const constraints = {
          requires: [{ partTypes: ['single-part'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Example:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/"partTypes": \["dragon_wing", "dragon_tail"\]/);
      });

      it('includes current invalid value for requires partTypes', () => {
        const constraints = {
          requires: [{ partTypes: ['single-part'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Current:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/\["single-part"\]/);
      });

      it('includes business rule explanation for requires components', () => {
        const constraints = {
          requires: [{ components: ['anatomy:single'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Business Rule:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Co-presence constraints ensure multiple part types or components exist together/);
      });

      it('includes example for requires components', () => {
        const constraints = {
          requires: [{ components: ['anatomy:single'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Example:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/"components": \["anatomy:wing", "anatomy:arm_socket"\]/);
      });

      it('includes current invalid value for requires components', () => {
        const constraints = {
          requires: [{ components: ['anatomy:single'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Current:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/\["anatomy:single"\]/);
      });

      it('includes all context fields (mod, file, index, field, type)', () => {
        const constraints = {
          requires: [{ partTypes: ['single'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'test-mod', 'dragon.recipe.json')
        ).toThrow(/test-mod/);

        expect(() =>
          loader._validateConstraints(constraints, 'test-mod', 'dragon.recipe.json')
        ).toThrow(/dragon.recipe.json/);

        expect(() =>
          loader._validateConstraints(constraints, 'test-mod', 'dragon.recipe.json')
        ).toThrow(/index 0/);

        expect(() =>
          loader._validateConstraints(constraints, 'test-mod', 'dragon.recipe.json')
        ).toThrow(/'partTypes'/);

        expect(() =>
          loader._validateConstraints(constraints, 'test-mod', 'dragon.recipe.json')
        ).toThrow(/'requires'/);
      });
    });

    describe('Excludes Constraints', () => {
      it('includes business rule explanation for excludes partTypes', () => {
        const constraints = {
          excludes: [{ partTypes: ['single-part'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Business Rule:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Mutual exclusion constraints prevent incompatible parts from coexisting/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/gills vs lungs/);
      });

      it('includes example for excludes partTypes', () => {
        const constraints = {
          excludes: [{ partTypes: ['single-part'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Example:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/"partTypes": \["gills", "lungs"\]/);
      });

      it('includes current invalid value for excludes partTypes', () => {
        const constraints = {
          excludes: [{ partTypes: ['single-part'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Current:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/\["single-part"\]/);
      });

      it('includes business rule explanation for excludes components', () => {
        const constraints = {
          excludes: [{ components: ['anatomy:single'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Business Rule:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Mutual exclusion constraints prevent incompatible parts from coexisting/);
      });

      it('includes example for excludes components', () => {
        const constraints = {
          excludes: [{ components: ['anatomy:single'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Example:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/"components": \["anatomy:gills", "anatomy:lungs"\]/);
      });

      it('includes current invalid value for excludes components', () => {
        const constraints = {
          excludes: [{ components: ['anatomy:single'] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Current:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/\["anatomy:single"\]/);
      });
    });

    describe('Empty Arrays', () => {
      it('throws enhanced error for empty requires partTypes array', () => {
        const constraints = {
          requires: [{ partTypes: [] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Business Rule:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Example:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Current: \[\]/);
      });

      it('throws enhanced error for empty excludes components array', () => {
        const constraints = {
          excludes: [{ components: [] }],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Business Rule:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Example:/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/Current: \[\]/);
      });
    });

    describe('Multiple Constraint Groups', () => {
      it('reports correct index for second constraint group', () => {
        const constraints = {
          requires: [
            { partTypes: ['valid1', 'valid2'] },
            { partTypes: ['invalid-single'] },
          ],
        };

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/index 1/);

        expect(() =>
          loader._validateConstraints(constraints, 'core', 'test.recipe.json')
        ).toThrow(/\["invalid-single"\]/);
      });
    });
  });

  it('throws when components is not declared as an array', () => {
    const constraints = {
      requires: [
        {
          components: 'core:heart',
        },
      ],
    };

    expect(() =>
      loader._validateConstraints(constraints, 'core', 'file')
    ).toThrow(/'components' must be an array of strings/);
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

describe('AnatomyRecipeLoader._validateBodyDescriptors', () => {
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

  describe('Valid Descriptors', () => {
    it('should process recipe with valid body descriptors', () => {
      mockValidateRecipeDescriptors.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      expect(() =>
        loader._validateBodyDescriptors({ build: 'athletic' }, 'human', 'human.json')
      ).not.toThrow();

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Descriptors', () => {
    it('should log errors and fail in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockValidateRecipeDescriptors.mockReturnValue({
        valid: false,
        errors: ['Invalid height descriptor: \'invalid\''],
        warnings: []
      });

      expect(() =>
        loader._validateBodyDescriptors({ height: 'invalid' }, 'human', 'human.json')
      ).toThrow(ValidationError);

      expect(logger.error).toHaveBeenCalled();
      expect(logger.error.mock.calls[0][0]).toContain('human');
      expect(logger.error.mock.calls[0][0]).toContain('human.json');

      process.env.NODE_ENV = originalEnv;
    });

    it('should log errors but not fail in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockValidateRecipeDescriptors.mockReturnValue({
        valid: false,
        errors: ['Invalid height descriptor'],
        warnings: []
      });

      expect(() =>
        loader._validateBodyDescriptors({ height: 'invalid' }, 'human', 'human.json')
      ).not.toThrow();

      expect(logger.error).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Unknown Descriptors', () => {
    it('should log warnings for unknown descriptors', () => {
      mockValidateRecipeDescriptors.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Unknown body descriptor \'unknownDescriptor\'']
      });

      expect(() =>
        loader._validateBodyDescriptors({ unknownDescriptor: 'value' }, 'human', 'human.json')
      ).not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn.mock.calls[0][0]).toContain('Unknown body descriptor');
    });
  });
});
