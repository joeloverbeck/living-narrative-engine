import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('AnatomyGenerationService', () => {
  let service;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockBodyBlueprintFactory;
  let mockAnatomyDescriptionService;
  let mockBodyGraphService;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
      removeEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
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

    mockAnatomyDescriptionService = {
      generateAllDescriptions: jest.fn(),
    };

    mockBodyGraphService = {
      buildAdjacencyCache: jest.fn(),
    };

    // Create service instance
    service = new AnatomyGenerationService({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
      anatomyDescriptionService: mockAnatomyDescriptionService,
      bodyGraphService: mockBodyGraphService,
    });
  });

  describe('constructor', () => {
    it('should throw error if entityManager is not provided', () => {
      expect(
        () =>
          new AnatomyGenerationService({
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            bodyBlueprintFactory: mockBodyBlueprintFactory,
            anatomyDescriptionService: mockAnatomyDescriptionService,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if dataRegistry is not provided', () => {
      expect(
        () =>
          new AnatomyGenerationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            bodyBlueprintFactory: mockBodyBlueprintFactory,
            anatomyDescriptionService: mockAnatomyDescriptionService,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if logger is not provided', () => {
      expect(
        () =>
          new AnatomyGenerationService({
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            bodyBlueprintFactory: mockBodyBlueprintFactory,
            anatomyDescriptionService: mockAnatomyDescriptionService,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if bodyBlueprintFactory is not provided', () => {
      expect(
        () =>
          new AnatomyGenerationService({
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            anatomyDescriptionService: mockAnatomyDescriptionService,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if anatomyDescriptionService is not provided', () => {
      expect(
        () =>
          new AnatomyGenerationService({
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            bodyBlueprintFactory: mockBodyBlueprintFactory,
            bodyGraphService: mockBodyGraphService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if bodyGraphService is not provided', () => {
      expect(
        () =>
          new AnatomyGenerationService({
            entityManager: mockEntityManager,
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            bodyBlueprintFactory: mockBodyBlueprintFactory,
            anatomyDescriptionService: mockAnatomyDescriptionService,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('generateAnatomyIfNeeded', () => {
    it('should return false if entity not found', async () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = await service.generateAnatomyIfNeeded('missing-entity');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AnatomyGenerationService: Entity 'missing-entity' not found"
      );
    });

    it('should return false if entity has no anatomy:body component', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(false),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateAnatomyIfNeeded('entity-1');

      expect(result).toBe(false);
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );
    });

    it('should return false if anatomy:body has no recipeId', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({}), // No recipeId
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateAnatomyIfNeeded('entity-1');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AnatomyGenerationService: Entity 'entity-1' has anatomy:body component but no recipeId"
      );
    });

    it('should return false if anatomy already generated', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
          body: { root: 'existing-root' }, // Already has body
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateAnatomyIfNeeded('entity-1');

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyGenerationService: Entity 'entity-1' already has generated anatomy"
      );
    });

    it('should throw error if recipe not found', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'missing-recipe',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockReturnValue(null);

      await expect(service.generateAnatomyIfNeeded('entity-1')).rejects.toThrow(
        "Recipe 'missing-recipe' not found"
      );
    });

    it('should throw error if recipe has no blueprintId', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockReturnValue({
        // Recipe without blueprintId
      });

      await expect(service.generateAnatomyIfNeeded('entity-1')).rejects.toThrow(
        "Recipe 'test-recipe' does not specify a blueprintId"
      );
    });

    it('should successfully generate anatomy', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const mockGraphResult = {
        rootId: 'root-1',
        entities: ['root-1', 'part-1', 'part-2'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        mockGraphResult
      );

      // Mock part entities without names
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') return mockEntity;
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await service.generateAnatomyIfNeeded('entity-1');

      expect(result).toBe(true);
      expect(mockBodyBlueprintFactory.createAnatomyGraph).toHaveBeenCalledWith(
        'test-blueprint',
        'test-recipe',
        { ownerId: 'entity-1' }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        ANATOMY_BODY_COMPONENT_ID,
        expect.objectContaining({
          recipeId: 'test-recipe',
          body: {
            root: 'root-1',
            parts: {},
          },
        })
      );
      // Verify adjacency cache is built before descriptions
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'root-1'
      );
      expect(
        mockAnatomyDescriptionService.generateAllDescriptions
      ).toHaveBeenCalledWith(mockEntity);
    });

    it('should handle part entities with names', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const mockGraphResult = {
        rootId: 'root-1',
        entities: ['root-1', 'arm-1', 'arm-2'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        mockGraphResult
      );

      // Mock part entities with names
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') return mockEntity;
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await service.generateAnatomyIfNeeded('entity-1');

      expect(result).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        ANATOMY_BODY_COMPONENT_ID,
        expect.objectContaining({
          body: {
            root: 'root-1',
            parts: {
              left_arm: 'arm-1',
              right_arm: 'arm-2',
            },
          },
        })
      );
    });

    it('should handle description generation failure with rollback', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const mockGraphResult = {
        rootId: 'root-1',
        entities: ['root-1'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        mockGraphResult
      );

      // Make description generation fail
      mockAnatomyDescriptionService.generateAllDescriptions.mockImplementation(
        () => {
          throw new Error('Description generation failed');
        }
      );

      // The new architecture properly propagates errors and triggers rollback
      await expect(
        service.generateAnatomyIfNeeded('entity-1')
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AnatomyGenerationService: Failed to generate anatomy for entity 'entity-1'",
        expect.any(Object)
      );
    });

    it('should handle null entity during update phase', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const mockGraphResult = {
        rootId: 'root-1',
        entities: ['root-1'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        mockGraphResult
      );

      // Setup to return entity for initial checks but null during update
      let callCount = 0;
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        callCount++;
        // Return null when trying to update parent entity (after graph generation)
        if (callCount > 2) {
          return null;
        }
        return mockEntity;
      });

      // Should throw error when entity not found during update
      await expect(service.generateAnatomyIfNeeded('entity-1')).rejects.toThrow(
        "Entity 'entity-1' not found after anatomy generation"
      );
    });

    it('should build adjacency cache before generating descriptions', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const mockGraphResult = {
        rootId: 'root-1',
        entities: ['root-1'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        mockGraphResult
      );

      const callOrder = [];
      mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
        callOrder.push('buildAdjacencyCache');
      });
      mockAnatomyDescriptionService.generateAllDescriptions.mockImplementation(
        () => {
          callOrder.push('generateAllDescriptions');
        }
      );

      await service.generateAnatomyIfNeeded('entity-1');

      // Verify the order of calls
      expect(callOrder).toEqual([
        'buildAdjacencyCache',
        'generateAllDescriptions',
      ]);
      expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith(
        'root-1'
      );
    });

    it('should handle null name data for parts', async () => {
      // Mock removeEntityInstance to prevent rollback failures
      mockEntityManager.removeEntityInstance.mockImplementation(() => {});
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const mockGraphResult = {
        rootId: 'root-1',
        entities: ['root-1', 'part-1'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        mockGraphResult
      );

      // Mock part entity with name component but null data
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') return mockEntity;
        if (id === 'part-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue(null), // Null name data
          };
        }
        if (id === 'root-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'anatomy:part'),
          };
        }
        return null;
      });

      const result = await service.generateAnatomyIfNeeded('entity-1');

      expect(result).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        ANATOMY_BODY_COMPONENT_ID,
        expect.objectContaining({
          body: {
            root: 'root-1',
            parts: {}, // No parts added due to null name data
          },
        })
      );
    });

    it('should handle empty name in name data', async () => {
      // Mock removeEntityInstance to prevent rollback failures
      mockEntityManager.removeEntityInstance.mockImplementation(() => {});
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const mockGraphResult = {
        rootId: 'root-1',
        entities: ['root-1', 'part-1'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        mockGraphResult
      );

      // Mock part entity with empty name
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') return mockEntity;
        if (id === 'part-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ name: '' }), // Empty name
          };
        }
        if (id === 'root-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'anatomy:part'),
          };
        }
        return null;
      });

      const result = await service.generateAnatomyIfNeeded('entity-1');

      expect(result).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        ANATOMY_BODY_COMPONENT_ID,
        expect.objectContaining({
          body: {
            root: 'root-1',
            parts: {}, // No parts added due to empty name
          },
        })
      );
    });

    it('should propagate errors from bodyBlueprintFactory', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      const error = new Error('Blueprint creation failed');
      mockBodyBlueprintFactory.createAnatomyGraph.mockRejectedValue(error);

      await expect(service.generateAnatomyIfNeeded('entity-1')).rejects.toThrow(
        'Blueprint creation failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AnatomyGenerationService: Failed to generate anatomy for entity 'entity-1'",
        expect.objectContaining({ error: expect.any(Object) })
      );
    });
  });

  describe('generateAnatomyForEntities', () => {
    it('should process multiple entities successfully', async () => {
      // Mock first entity - will be generated
      const mockEntity1 = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };

      // Mock second entity - already has anatomy
      const mockEntity2 = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
          body: { root: 'existing' },
        }),
      };

      // Mock third entity - no anatomy component
      const mockEntity3 = {
        hasComponent: jest.fn().mockReturnValue(false),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') return mockEntity1;
        if (id === 'entity-2') return mockEntity2;
        if (id === 'entity-3') return mockEntity3;
        if (id === 'root-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'anatomy:part'),
          };
        }
        return null;
      });

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'root-1',
        entities: ['root-1'],
      });

      const result = await service.generateAnatomyForEntities([
        'entity-1',
        'entity-2',
        'entity-3',
      ]);

      expect(result).toEqual({
        generated: ['entity-1'],
        skipped: ['entity-2', 'entity-3'],
        failed: [],
      });
    });

    it('should handle failures gracefully', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockReturnValue(null); // Will cause validation error

      const result = await service.generateAnatomyForEntities(['entity-1']);

      expect(result).toEqual({
        generated: [],
        skipped: [],
        failed: [
          {
            entityId: 'entity-1',
            error: expect.stringContaining("Recipe 'test-recipe' not found"),
          },
        ],
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AnatomyGenerationService: Failed to process entity 'entity-1'",
        expect.any(Object)
      );
    });

    it('should handle empty entity list', async () => {
      const result = await service.generateAnatomyForEntities([]);

      expect(result).toEqual({
        generated: [],
        skipped: [],
        failed: [],
      });
    });

    it('should continue processing after failure', async () => {
      const mockEntity1 = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'bad-recipe',
        }),
      };

      const mockEntity2 = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'good-recipe',
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') return mockEntity1;
        if (id === 'entity-2') return mockEntity2;
        if (id === 'root-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'anatomy:part'),
          };
        }
        return null;
      });

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (id === 'bad-recipe') return null; // Will fail
        if (id === 'good-recipe') return { blueprintId: 'test-blueprint' };
        return null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'root-1',
        entities: ['root-1'],
      });

      const result = await service.generateAnatomyForEntities([
        'entity-1',
        'entity-2',
      ]);

      expect(result).toEqual({
        generated: ['entity-2'],
        skipped: [],
        failed: [
          {
            entityId: 'entity-1',
            error: expect.stringContaining("Recipe 'bad-recipe' not found"),
          },
        ],
      });
    });
  });
});
