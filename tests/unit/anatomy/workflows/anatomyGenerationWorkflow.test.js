import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('AnatomyGenerationWorkflow', () => {
  let workflow;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockBodyBlueprintFactory;

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

    // Create workflow instance
    workflow = new AnatomyGenerationWorkflow({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
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
