/**
 * @file Integration tests for body descriptor validation across components
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { TestBedClass } from '../../common/entities/testBed.js';
import {
  BODY_BUILD_TYPES,
  BODY_HAIR_DENSITY,
  BODY_COMPOSITION_TYPES,
} from '../../../src/anatomy/constants/bodyDescriptorConstants.js';

// Import mock factories
import {
  createMockEntityManager,
  createStatefulMockDataRegistry,
} from '../../common/mockFactories/entities.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import {
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
  createSimpleMock,
} from '../../common/mockFactories/coreServices.js';

describe('Body Descriptor Validation Integration', () => {
  let testBed;
  let anatomyWorkflow;
  let recipeLoader;

  beforeEach(() => {
    testBed = new TestBedClass();

    // Create mock for BodyBlueprintFactory
    const mockBodyBlueprintFactory = createSimpleMock(['createAnatomyGraph'], {
      createAnatomyGraph: jest.fn().mockResolvedValue({
        rootId: 'test-root',
        entities: [],
        partsMap: new Map(),
      }),
    });

    // Create mock for ClothingInstantiationService
    const mockClothingInstantiationService = createSimpleMock(
      ['instantiateRecipeClothing'],
      {
        instantiateRecipeClothing: jest.fn().mockResolvedValue({
          instantiated: [],
          failed: [],
        }),
      }
    );

    // Create AnatomyGenerationWorkflow instance with mocked dependencies
    anatomyWorkflow = new AnatomyGenerationWorkflow({
      entityManager: createMockEntityManager(),
      dataRegistry: createStatefulMockDataRegistry(),
      logger: createMockLogger(),
      bodyBlueprintFactory: mockBodyBlueprintFactory,
      clothingInstantiationService: mockClothingInstantiationService,
    });

    // Create AnatomyRecipeLoader instance with mocked dependencies
    recipeLoader = new AnatomyRecipeLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      createMockSchemaValidator(),
      createStatefulMockDataRegistry(),
      createMockLogger()
    );
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('AnatomyGenerationWorkflow integration', () => {
    it('should validate body descriptors using centralized validation', () => {
      const validDescriptors = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        hairDensity: BODY_HAIR_DENSITY.MODERATE,
        composition: BODY_COMPOSITION_TYPES.LEAN,
        skinColor: 'pale',
      };

      expect(() =>
        anatomyWorkflow.validateBodyDescriptors(validDescriptors, 'test-recipe')
      ).not.toThrow();
    });

    it('should reject invalid build values', () => {
      const invalidDescriptors = {
        build: 'invalid-build-type',
      };

      expect(() =>
        anatomyWorkflow.validateBodyDescriptors(
          invalidDescriptors,
          'test-recipe'
        )
      ).toThrow(ValidationError);
    });

    it('should reject unknown descriptor properties', () => {
      const invalidDescriptors = {
        build: BODY_BUILD_TYPES.SLIM,
        unknownProperty: 'value',
      };

      expect(() =>
        anatomyWorkflow.validateBodyDescriptors(
          invalidDescriptors,
          'test-recipe'
        )
      ).toThrow(ValidationError);
    });

    it('should accept null/undefined body descriptors', () => {
      expect(() =>
        anatomyWorkflow.validateBodyDescriptors(null, 'test-recipe')
      ).not.toThrow();
      expect(() =>
        anatomyWorkflow.validateBodyDescriptors(undefined, 'test-recipe')
      ).not.toThrow();
    });

    it('should include recipe ID in error messages', () => {
      const invalidDescriptors = {
        build: 'invalid-build',
      };

      let thrownError;
      try {
        anatomyWorkflow.validateBodyDescriptors(
          invalidDescriptors,
          'test-recipe-id'
        );
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ValidationError);
      expect(thrownError.message).toContain('test-recipe-id');
    });
  });

  describe('AnatomyRecipeLoader integration', () => {
    it('should validate body descriptors during recipe processing', async () => {
      const validRecipeData = {
        recipeId: 'test-recipe',
        bodyDescriptors: {
          build: BODY_BUILD_TYPES.MUSCULAR,
          hairDensity: BODY_HAIR_DENSITY.HAIRY,
          skinColor: 'tan',
        },
      };

      // Mock the processAndStoreItem helper to avoid complex setup
      const mockProcessAndStoreItem = jest.fn().mockResolvedValue({
        qualifiedId: 'test-mod:test-recipe',
        didOverride: false,
      });

      // Temporarily replace the function for this test
      const processAndStoreItemModule = await import(
        '../../../src/loaders/helpers/processAndStoreItem.js'
      );
      const originalFunction = processAndStoreItemModule.processAndStoreItem;
      processAndStoreItemModule.processAndStoreItem = mockProcessAndStoreItem;

      try {
        const result = await recipeLoader._processFetchedItem(
          'test-mod',
          'test-recipe.json',
          '/path/to/test-recipe.json',
          validRecipeData,
          'anatomyRecipes'
        );

        expect(result.qualifiedId).toBe('test-mod:test-recipe');
        expect(mockProcessAndStoreItem).toHaveBeenCalled();
      } finally {
        // Restore original function
        processAndStoreItemModule.processAndStoreItem = originalFunction;
      }
    });

    it('should reject recipes with invalid body descriptors', async () => {
      const invalidRecipeData = {
        recipeId: 'test-recipe',
        bodyDescriptors: {
          build: 'invalid-build-type',
        },
      };

      await expect(
        recipeLoader._processFetchedItem(
          'test-mod',
          'test-recipe.json',
          '/path/to/test-recipe.json',
          invalidRecipeData,
          'anatomyRecipes'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should process recipes without body descriptors', async () => {
      const recipeWithoutDescriptors = {
        recipeId: 'test-recipe',
        // No bodyDescriptors field
      };

      // Mock the processAndStoreItem helper
      const mockProcessAndStoreItem = jest.fn().mockResolvedValue({
        qualifiedId: 'test-mod:test-recipe',
        didOverride: false,
      });

      const processAndStoreItemModule = await import(
        '../../../src/loaders/helpers/processAndStoreItem.js'
      );
      const originalFunction = processAndStoreItemModule.processAndStoreItem;
      processAndStoreItemModule.processAndStoreItem = mockProcessAndStoreItem;

      try {
        const result = await recipeLoader._processFetchedItem(
          'test-mod',
          'test-recipe.json',
          '/path/to/test-recipe.json',
          recipeWithoutDescriptors,
          'anatomyRecipes'
        );

        expect(result.qualifiedId).toBe('test-mod:test-recipe');
      } finally {
        processAndStoreItemModule.processAndStoreItem = originalFunction;
      }
    });
  });

  describe('Cross-component consistency', () => {
    it('should produce identical validation results across components', () => {
      const testDescriptors = {
        build: 'invalid-build',
        hairDensity: BODY_HAIR_DENSITY.MODERATE,
      };

      // Both components should throw ValidationError for the same invalid data
      let workflowError, loaderError;

      try {
        anatomyWorkflow.validateBodyDescriptors(testDescriptors, 'test-recipe');
      } catch (error) {
        workflowError = error;
      }

      try {
        recipeLoader._validateBodyDescriptors(
          testDescriptors,
          'test-recipe',
          'test-file'
        );
      } catch (error) {
        loaderError = error;
      }

      expect(workflowError).toBeInstanceOf(ValidationError);
      expect(loaderError).toBeInstanceOf(ValidationError);

      // Both should contain similar error information about invalid build
      expect(workflowError.message).toContain('build');
      expect(loaderError.message).toContain('build');
    });

    it('should handle edge cases consistently', () => {
      const edgeCases = [
        null,
        undefined,
        {},
        { skinColor: 'any-color-works' },
        {
          build: BODY_BUILD_TYPES.SKINNY,
          composition: BODY_COMPOSITION_TYPES.OBESE,
        },
      ];

      edgeCases.forEach((testCase) => {
        let workflowPassed = false;
        let loaderPassed = false;

        try {
          anatomyWorkflow.validateBodyDescriptors(testCase, 'test-recipe');
          workflowPassed = true;
        } catch {
          workflowPassed = false;
        }

        try {
          recipeLoader._validateBodyDescriptors(
            testCase,
            'test-recipe',
            'test-file'
          );
          loaderPassed = true;
        } catch {
          loaderPassed = false;
        }

        expect(workflowPassed).toBe(loaderPassed);
      });
    });
  });

  describe('Error message consistency', () => {
    it('should produce consistent error messages for same invalid data', () => {
      const invalidDescriptors = {
        unknownProperty: 'value',
      };

      let workflowErrorMessage, loaderErrorMessage;

      try {
        anatomyWorkflow.validateBodyDescriptors(
          invalidDescriptors,
          'test-recipe'
        );
      } catch (error) {
        workflowErrorMessage = error.message;
      }

      try {
        recipeLoader._validateBodyDescriptors(
          invalidDescriptors,
          'test-recipe',
          'test-file'
        );
      } catch (error) {
        loaderErrorMessage = error.message;
      }

      // Both should mention unknown properties and supported properties
      expect(workflowErrorMessage).toContain('Unknown body descriptor');
      expect(loaderErrorMessage).toContain('Unknown body descriptor');
      expect(workflowErrorMessage).toContain('unknownProperty');
      expect(loaderErrorMessage).toContain('unknownProperty');
    });
  });
});
