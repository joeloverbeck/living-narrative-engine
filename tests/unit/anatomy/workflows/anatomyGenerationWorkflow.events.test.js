/**
 * @file Unit tests for AnatomyGenerationWorkflow event publication
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';

describe('AnatomyGenerationWorkflow - Events', () => {
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockBodyBlueprintFactory;
  let mockEventBus;
  let mockSocketIndex;
  let workflow;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
      createEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockBodyBlueprintFactory = {
      createAnatomyGraph: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    mockSocketIndex = {
      buildIndex: jest.fn().mockResolvedValue(),
      getEntitySockets: jest.fn(),
    };
  });

  describe('Event Publication', () => {
    it('should publish anatomy:anatomy_generated event when eventBus and socketIndex are provided', async () => {
      // Setup mocks
      const blueprintId = 'core:humanoid_body';
      const recipeId = 'core:adult_human';
      const ownerId = 'test-entity';

      const mockRecipe = {
        blueprintId: blueprintId,
      };

      const mockBlueprint = {
        id: blueprintId,
        slots: {},
      };

      const mockSockets = [
        { id: 'socket1', orientation: 'neutral' },
        { id: 'socket2', orientation: 'forward' },
      ];

      // Mock entity instance
      const mockEntity = {
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ text: 'test-part' })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyRecipes') return mockRecipe;
        if (type === 'anatomyBlueprints') return mockBlueprint;
        return null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'root-entity',
        entities: ['entity1', 'entity2'],
      });

      mockSocketIndex.getEntitySockets.mockResolvedValue(mockSockets);

      // Create workflow with eventBus and socketIndex
      workflow = new AnatomyGenerationWorkflow({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        bodyBlueprintFactory: mockBodyBlueprintFactory,
        eventBus: mockEventBus,
        socketIndex: mockSocketIndex,
      });

      // Execute generation
      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify event was published
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:anatomy_generated',
        expect.objectContaining({
          entityId: ownerId,
          blueprintId: blueprintId,
          sockets: mockSockets,
          timestamp: expect.any(Number),
          bodyParts: expect.arrayContaining(['entity1', 'entity2']),
        })
      );
    });

    it('should not publish event when eventBus is not provided', async () => {
      const blueprintId = 'core:humanoid_body';
      const recipeId = 'core:adult_human';
      const ownerId = 'test-entity';

      const mockRecipe = {
        blueprintId: blueprintId,
      };

      const mockBlueprint = {
        id: blueprintId,
        slots: {},
      };

      const mockEntity = {
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ text: 'test-part' })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyRecipes') return mockRecipe;
        if (type === 'anatomyBlueprints') return mockBlueprint;
        return null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'root-entity',
        entities: ['entity1', 'entity2'],
      });

      // Create workflow WITHOUT eventBus
      workflow = new AnatomyGenerationWorkflow({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        bodyBlueprintFactory: mockBodyBlueprintFactory,
      });

      // Execute generation
      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify event was NOT published
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should not publish event when socketIndex is not provided', async () => {
      const blueprintId = 'core:humanoid_body';
      const recipeId = 'core:adult_human';
      const ownerId = 'test-entity';

      const mockRecipe = {
        blueprintId: blueprintId,
      };

      const mockBlueprint = {
        id: blueprintId,
        slots: {},
      };

      const mockEntity = {
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ text: 'test-part' })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyRecipes') return mockRecipe;
        if (type === 'anatomyBlueprints') return mockBlueprint;
        return null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'root-entity',
        entities: ['entity1', 'entity2'],
      });

      // Create workflow WITHOUT socketIndex
      workflow = new AnatomyGenerationWorkflow({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        bodyBlueprintFactory: mockBodyBlueprintFactory,
        eventBus: mockEventBus,
      });

      // Execute generation
      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify event was NOT published
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should not fail generation if event publication throws an error', async () => {
      const blueprintId = 'core:humanoid_body';
      const recipeId = 'core:adult_human';
      const ownerId = 'test-entity';

      const mockRecipe = {
        blueprintId: blueprintId,
      };

      const mockBlueprint = {
        id: blueprintId,
        slots: {},
      };

      const mockEntity = {
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ text: 'test-part' })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyRecipes') return mockRecipe;
        if (type === 'anatomyBlueprints') return mockBlueprint;
        return null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'root-entity',
        entities: ['entity1', 'entity2'],
      });

      // Make socketIndex throw an error
      mockSocketIndex.getEntitySockets.mockRejectedValue(
        new Error('Socket lookup failed')
      );

      workflow = new AnatomyGenerationWorkflow({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        bodyBlueprintFactory: mockBodyBlueprintFactory,
        eventBus: mockEventBus,
        socketIndex: mockSocketIndex,
      });

      // Execute generation - should not throw
      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      // Verify generation completed successfully
      expect(result).toBeDefined();
      expect(result.rootId).toBe('root-entity');

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish anatomy:anatomy_generated event'),
        expect.any(Error)
      );
    });

    it('should include partsMap and slotEntityMappings in event payload', async () => {
      const blueprintId = 'core:humanoid_body';
      const recipeId = 'core:adult_human';
      const ownerId = 'test-entity';

      const mockRecipe = {
        blueprintId: blueprintId,
      };

      const mockBlueprint = {
        id: blueprintId,
        slots: {
          slot1: { socket: 'socket1' },
        },
      };

      const mockSockets = [{ id: 'socket1', orientation: 'neutral' }];

      // Mock entity for parts
      const mockPartEntity = {
        hasComponent: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') return true;
          if (componentId === 'core:name') return true;
          if (componentId === 'anatomy:blueprintSlot') return false;
          return false;
        }),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') return { text: 'head' };
          return null;
        }),
      };

      // Mock entity for slot
      const mockSlotEntity = {
        hasComponent: jest.fn((componentId) => {
          if (componentId === 'anatomy:blueprintSlot') return true;
          return false;
        }),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:blueprintSlot')
            return { slotId: 'slot1', socketId: 'socket1' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-entity-1') return mockPartEntity;
        if (id.startsWith('slot-entity')) return mockSlotEntity;
        return mockPartEntity;
      });

      mockEntityManager.createEntityInstance.mockResolvedValue(
        'slot-entity-1'
      );

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyRecipes') return mockRecipe;
        if (type === 'anatomyBlueprints') return mockBlueprint;
        return null;
      });

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        rootId: 'root-entity',
        entities: ['part-entity-1'],
      });

      mockSocketIndex.getEntitySockets.mockResolvedValue(mockSockets);

      workflow = new AnatomyGenerationWorkflow({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        bodyBlueprintFactory: mockBodyBlueprintFactory,
        eventBus: mockEventBus,
        socketIndex: mockSocketIndex,
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify event payload includes partsMap and slotEntityMappings
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:anatomy_generated',
        expect.objectContaining({
          partsMap: expect.any(Object),
          slotEntityMappings: expect.any(Object),
        })
      );

      // Verify partsMap structure
      const dispatchCall = mockEventBus.dispatch.mock.calls[0];
      const payload = dispatchCall[1];
      expect(payload.partsMap).toHaveProperty('head');
    });
  });
});
