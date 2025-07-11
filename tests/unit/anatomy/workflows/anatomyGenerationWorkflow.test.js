import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('AnatomyGenerationWorkflow', () => {
  let workflow;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockBodyBlueprintFactory;
  let mockClothingInstantiationService;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyBlueprintFactory = {
      createAnatomyGraph: jest.fn(),
    };

    mockClothingInstantiationService = {
      instantiateRecipeClothing: jest.fn(),
    };

    // Create workflow instance
    workflow = new AnatomyGenerationWorkflow({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
      clothingInstantiationService: mockClothingInstantiationService,
    });
  });

  describe('generate', () => {
    const blueprintId = 'test-blueprint';
    const recipeId = 'test-recipe';
    const ownerId = 'owner-entity';
    const rootId = 'root-entity';
    const partIds = ['arm-1', 'arm-2'];

    beforeEach(() => {
      // Setup default successful generation
      const graphResult = {
        rootId,
        entities: [rootId, ...partIds],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );
    });

    it('should generate anatomy graph successfully', async () => {
      // Mock entities with names
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result).toEqual({
        rootId,
        entities: [rootId, ...partIds],
        partsMap: {
          left_arm: 'arm-1',
          right_arm: 'arm-2',
        },
      });

      expect(mockBodyBlueprintFactory.createAnatomyGraph).toHaveBeenCalledWith(
        blueprintId,
        recipeId,
        { ownerId }
      );
    });

    it('should handle parts without names', async () => {
      // Mock entities without names
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.partsMap).toEqual({});
    });

    it('should handle parts with null name data', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue(null),
          };
        }
        return null;
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.partsMap).toEqual({});
    });

    it('should handle parts with empty names', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: '' }),
          };
        }
        return null;
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.partsMap).toEqual({});
    });

    it('should propagate errors from bodyBlueprintFactory', async () => {
      const error = new Error('Blueprint creation failed');
      mockBodyBlueprintFactory.createAnatomyGraph.mockRejectedValue(error);

      await expect(
        workflow.generate(blueprintId, recipeId, { ownerId })
      ).rejects.toThrow('Blueprint creation failed');
    });

    describe('with clothing instantiation', () => {
      const mockClothingResult = {
        instantiated: [
          { id: 'clothing_1', definitionId: 'clothing:shirt' },
          { id: 'clothing_2', definitionId: 'clothing:pants' },
        ],
        equipped: ['clothing_1', 'clothing_2'],
        errors: [],
      };

      beforeEach(() => {
        // Mock successful clothing instantiation
        mockClothingInstantiationService.instantiateRecipeClothing.mockResolvedValue(
          mockClothingResult
        );

        // Mock entities with names for parts map
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'arm-1') {
            return {
              hasComponent: jest.fn((compId) => compId === 'core:name'),
              getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
            };
          }
          return {
            hasComponent: jest.fn().mockReturnValue(false),
          };
        });
      });

      it('should instantiate clothing when recipe contains clothingEntities', async () => {
        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [
            { entityId: 'clothing:shirt', equip: true },
            { entityId: 'clothing:pants', equip: true },
          ],
        };

        // Mock data registry to return recipe with clothing
        mockDataRegistry.get.mockReturnValue(recipeWithClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        // Verify clothing instantiation was called
        expect(
          mockClothingInstantiationService.instantiateRecipeClothing
        ).toHaveBeenCalledWith(ownerId, recipeWithClothing, expect.any(Map));

        // Verify the result includes clothing data
        expect(result).toEqual({
          rootId,
          entities: [rootId, ...partIds],
          partsMap: { left_arm: 'arm-1' },
          clothingResult: mockClothingResult,
        });
      });

      it('should pass correct parts map to clothing instantiation', async () => {
        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [{ entityId: 'clothing:shirt' }],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithClothing);

        await workflow.generate(blueprintId, recipeId, { ownerId });

        // Get the parts map that was passed
        const passedPartsMap =
          mockClothingInstantiationService.instantiateRecipeClothing.mock
            .calls[0][2];

        expect(passedPartsMap).toBeInstanceOf(Map);
        expect(passedPartsMap.get('left_arm')).toBe('arm-1');
      });

      it('should not call clothing instantiation when recipe has no clothingEntities', async () => {
        const recipeWithoutClothing = {
          blueprintId,
          // No clothingEntities
        };

        mockDataRegistry.get.mockReturnValue(recipeWithoutClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(
          mockClothingInstantiationService.instantiateRecipeClothing
        ).not.toHaveBeenCalled();
        expect(result.clothingResult).toBeUndefined();
      });

      it('should handle empty clothingEntities array', async () => {
        const recipeWithEmptyClothing = {
          blueprintId,
          clothingEntities: [],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithEmptyClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(
          mockClothingInstantiationService.instantiateRecipeClothing
        ).not.toHaveBeenCalled();
        expect(result.clothingResult).toBeUndefined();
      });

      it('should include clothing errors in result when instantiation has errors', async () => {
        const clothingWithErrors = {
          instantiated: [{ id: 'clothing_1', definitionId: 'clothing:shirt' }],
          equipped: [],
          errors: ['Failed to equip pants: slot occupied'],
        };

        mockClothingInstantiationService.instantiateRecipeClothing.mockResolvedValue(
          clothingWithErrors
        );

        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [
            { entityId: 'clothing:shirt' },
            { entityId: 'clothing:pants' },
          ],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.clothingResult.errors).toHaveLength(1);
        expect(result.clothingResult.errors[0]).toBe(
          'Failed to equip pants: slot occupied'
        );
      });

      it('should handle clothing instantiation failure gracefully', async () => {
        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [{ entityId: 'clothing:shirt' }],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithClothing);
        mockClothingInstantiationService.instantiateRecipeClothing.mockRejectedValue(
          new Error('Clothing service error')
        );

        // Should not throw - errors are logged but generation continues
        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.rootId).toBe(rootId);
        expect(result.entities).toEqual([rootId, ...partIds]);
        expect(result.clothingResult).toBeUndefined();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to instantiate clothing'),
          expect.any(Error)
        );
      });
    });
  });

  describe('validateRecipe', () => {
    it('should validate recipe successfully', () => {
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';

      mockDataRegistry.get.mockReturnValue({
        blueprintId,
        otherData: 'preserved',
      });

      const result = workflow.validateRecipe(recipeId);

      expect(result).toBe(blueprintId);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        recipeId
      );
    });

    it('should throw error if recipe not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      expect(() => workflow.validateRecipe('missing-recipe')).toThrow(
        ValidationError
      );
      expect(() => workflow.validateRecipe('missing-recipe')).toThrow(
        "Recipe 'missing-recipe' not found"
      );
    });

    it('should throw error if recipe has no blueprintId', () => {
      mockDataRegistry.get.mockReturnValue({
        otherData: 'exists',
        // No blueprintId
      });

      expect(() => workflow.validateRecipe('test-recipe')).toThrow(
        ValidationError
      );
      expect(() => workflow.validateRecipe('test-recipe')).toThrow(
        "Recipe 'test-recipe' does not specify a blueprintId"
      );
    });
  });
});
