import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyOrchestrator } from '../../../../src/anatomy/orchestration/anatomyOrchestrator.js';
import { AnatomyUnitOfWork } from '../../../../src/anatomy/orchestration/anatomyUnitOfWork.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

// Mock the AnatomyUnitOfWork
jest.mock('../../../../src/anatomy/orchestration/anatomyUnitOfWork.js');

describe('AnatomyOrchestrator', () => {
  let orchestrator;
  let mockEntityManager;
  let mockLogger;
  let mockGenerationWorkflow;
  let mockDescriptionWorkflow;
  let mockGraphBuildingWorkflow;
  let mockErrorHandler;
  let mockUnitOfWork;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock dependencies
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockGenerationWorkflow = {
      generate: jest.fn(),
      validateRecipe: jest.fn(),
    };

    mockDescriptionWorkflow = {
      generateAll: jest.fn(),
    };

    mockGraphBuildingWorkflow = {
      buildCache: jest.fn(),
    };

    mockErrorHandler = {
      handle: jest.fn(),
    };

    // Create mock unit of work
    mockUnitOfWork = {
      execute: jest.fn(),
      trackEntities: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      trackedEntityCount: 0,
      isRolledBack: false,
    };

    // Mock the AnatomyUnitOfWork constructor
    AnatomyUnitOfWork.mockImplementation(() => mockUnitOfWork);

    // Create orchestrator instance
    orchestrator = new AnatomyOrchestrator({
      entityManager: mockEntityManager,
      logger: mockLogger,
      generationWorkflow: mockGenerationWorkflow,
      descriptionWorkflow: mockDescriptionWorkflow,
      graphBuildingWorkflow: mockGraphBuildingWorkflow,
      errorHandler: mockErrorHandler,
    });
  });

  describe('orchestrateGeneration', () => {
    const entityId = 'test-entity';
    const recipeId = 'test-recipe';
    const blueprintId = 'test-blueprint';
    const rootId = 'root-entity';
    const partIds = ['part-1', 'part-2'];

    beforeEach(() => {
      // Setup default successful workflow
      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);

      const graphResult = {
        rootId,
        entities: [rootId, ...partIds],
        partsMap: { left_arm: 'part-1', right_arm: 'part-2' },
      };

      // Make execute return the operation result
      mockUnitOfWork.execute.mockImplementation(async (operation) => {
        const result = await operation();
        return result;
      });

      mockGenerationWorkflow.generate.mockResolvedValue(graphResult);
      mockDescriptionWorkflow.generateAll.mockResolvedValue();
      mockGraphBuildingWorkflow.buildCache.mockResolvedValue();

      // Mock entity for update
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ recipeId }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    });

    it('should successfully orchestrate anatomy generation', async () => {
      const result = await orchestrator.orchestrateGeneration(
        entityId,
        recipeId
      );

      expect(result).toEqual({
        success: true,
        entityCount: 3,
        rootId: rootId,
      });

      // Verify workflow order
      expect(mockGenerationWorkflow.validateRecipe).toHaveBeenCalledWith(
        recipeId
      );
      expect(mockGenerationWorkflow.generate).toHaveBeenCalledWith(
        blueprintId,
        recipeId,
        { ownerId: entityId }
      );
      expect(mockUnitOfWork.trackEntities).toHaveBeenCalledWith([
        rootId,
        ...partIds,
      ]);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        ANATOMY_BODY_COMPONENT_ID,
        expect.objectContaining({
          recipeId,
          body: expect.objectContaining({
            root: rootId,
            parts: { left_arm: 'part-1', right_arm: 'part-2' },
          }),
        })
      );
      expect(mockGraphBuildingWorkflow.buildCache).toHaveBeenCalledWith(rootId);
      expect(mockDescriptionWorkflow.generateAll).toHaveBeenCalledWith(
        entityId
      );
      expect(mockUnitOfWork.commit).toHaveBeenCalled();
    });

    it('should handle recipe validation failure', async () => {
      const error = new Error('Recipe not found');
      mockGenerationWorkflow.validateRecipe.mockImplementation(() => {
        throw error;
      });
      mockErrorHandler.handle.mockReturnValue(error);

      await expect(
        orchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow('Recipe not found');

      expect(mockUnitOfWork.execute).not.toHaveBeenCalled();
      expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
    });

    it('should rollback on generation failure', async () => {
      const error = new Error('Generation failed');
      mockUnitOfWork.execute.mockRejectedValueOnce(error);
      mockErrorHandler.handle.mockReturnValue(error);
      mockUnitOfWork.isRolledBack = true;

      await expect(
        orchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow('Generation failed');

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error, {
        operation: 'orchestration',
        entityId,
        recipeId,
      });
      expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
    });

    it('should rollback on description generation failure', async () => {
      const error = new Error('Description generation failed');

      // First two executes succeed, third fails
      mockUnitOfWork.execute
        .mockImplementationOnce(async (op) => await op()) // generation
        .mockImplementationOnce(async (op) => await op()) // graph building
        .mockRejectedValueOnce(error); // description generation

      mockErrorHandler.handle.mockReturnValue(error);
      mockUnitOfWork.isRolledBack = true;

      await expect(
        orchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow('Description generation failed');

      expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate anatomy'),
        expect.objectContaining({ wasRolledBack: true })
      );
    });

    it('should preserve existing anatomy data when updating', async () => {
      const existingData = {
        recipeId,
        customField: 'preserved',
        anotherField: 42,
      };

      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue(existingData),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      await orchestrator.orchestrateGeneration(entityId, recipeId);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        ANATOMY_BODY_COMPONENT_ID,
        expect.objectContaining({
          recipeId,
          customField: 'preserved',
          anotherField: 42,
          body: expect.any(Object),
        })
      );
    });
  });

  describe('checkGenerationNeeded', () => {
    it('should return false when entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = orchestrator.checkGenerationNeeded('missing-entity');

      expect(result).toEqual({
        needsGeneration: false,
        reason: 'Entity not found',
      });
    });

    it('should return false when entity has no anatomy:body component', () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(false),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = orchestrator.checkGenerationNeeded('entity-1');

      expect(result).toEqual({
        needsGeneration: false,
        reason: 'Entity has no anatomy:body component',
      });
    });

    it('should return false when anatomy:body has no recipeId', () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({}),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = orchestrator.checkGenerationNeeded('entity-1');

      expect(result).toEqual({
        needsGeneration: false,
        reason: 'anatomy:body component has no recipeId',
      });
    });

    it('should return false when anatomy already generated', () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
          body: { root: 'existing-root' },
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = orchestrator.checkGenerationNeeded('entity-1');

      expect(result).toEqual({
        needsGeneration: false,
        reason: 'Anatomy already generated',
      });
    });

    it('should return true when ready for generation', () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
        }),
      };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = orchestrator.checkGenerationNeeded('entity-1');

      expect(result).toEqual({
        needsGeneration: true,
        reason: 'Ready for generation',
      });
    });
  });
});
