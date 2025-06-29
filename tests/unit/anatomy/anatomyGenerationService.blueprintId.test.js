/**
 * @file Test for blueprint ID support in anatomy generation service
 */

import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('AnatomyGenerationService - Blueprint ID Support', () => {
  let service;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockBodyBlueprintFactory;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      updateComponent: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockBodyBlueprintFactory = {
      createAnatomyGraph: jest.fn(),
    };

    service = new AnatomyGenerationService({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
    });
  });

  test('should use blueprintId from recipe when generating anatomy', async () => {
    const entityId = 'test-entity';
    const recipeId = 'anatomy:humanoid_standard';
    const blueprintId = 'anatomy:humanoid_base';

    const mockEntity = {
      id: entityId,
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockReturnValue({
        recipeId: recipeId,
        body: null,
      }),
    };

    const mockRecipe = {
      recipeId: recipeId,
      blueprintId: blueprintId,
      slots: {},
    };

    const mockGraphResult = {
      rootId: 'root-entity',
      entities: ['root-entity', 'head-entity', 'arm1', 'arm2'],
    };

    // Mock main entity and part entities
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === entityId) {
        return mockEntity;
      }
      // Mock part entities from the graph result
      return {
        id: id,
        hasComponent: jest.fn().mockReturnValue(false), // Parts don't have names in this test
        getComponentData: jest.fn().mockReturnValue(null),
      };
    });
    
    mockDataRegistry.get.mockImplementation((registry, id) => {
      if (registry === 'anatomyRecipes' && id === recipeId) {
        return mockRecipe;
      }
      return null;
    });
    mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
      mockGraphResult
    );

    const result = await service.generateAnatomyIfNeeded(entityId);

    expect(result).toBe(true);
    expect(mockBodyBlueprintFactory.createAnatomyGraph).toHaveBeenCalledWith(
      blueprintId, // Should use blueprintId from recipe
      recipeId,
      { ownerId: entityId }
    );
  });

  test('should throw error if recipe does not specify blueprintId', async () => {
    const entityId = 'test-entity';
    const recipeId = 'anatomy:old_recipe';

    const mockEntity = {
      id: entityId,
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockReturnValue({
        recipeId: recipeId,
        body: null,
      }),
    };

    const mockRecipeWithoutBlueprintId = {
      recipeId: recipeId,
      // Missing blueprintId
      slots: {},
    };

    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockDataRegistry.get.mockImplementation((registry, id) => {
      if (registry === 'anatomyRecipes' && id === recipeId) {
        return mockRecipeWithoutBlueprintId;
      }
      return null;
    });

    await expect(service.generateAnatomyIfNeeded(entityId)).rejects.toThrow(
      ValidationError
    );
    await expect(service.generateAnatomyIfNeeded(entityId)).rejects.toThrow(
      `Recipe '${recipeId}' does not specify a blueprintId`
    );
  });
});