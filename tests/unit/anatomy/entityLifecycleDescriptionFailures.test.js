/**
 * @file Test suite for entity lifecycle during description failures
 * @description Tests to ensure proper rollback behavior when description generation fails
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyOrchestrator } from '../../../src/anatomy/orchestration/anatomyOrchestrator.js';
import { AnatomyUnitOfWork } from '../../../src/anatomy/orchestration/anatomyUnitOfWork.js';
import { DescriptionGenerationError } from '../../../src/anatomy/orchestration/anatomyErrorHandler.js';

describe('Entity Lifecycle During Description Failures', () => {
  let mockEntityManager;
  let mockLogger;
  let mockGenerationWorkflow;
  let mockDescriptionWorkflow;
  let mockGraphBuildingWorkflow;
  let mockErrorHandler;
  let anatomyOrchestrator;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
      removeEntityInstance: jest.fn(), // Add this method for rollback
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockGenerationWorkflow = {
      validateRecipe: jest.fn(),
      generate: jest.fn(),
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

    anatomyOrchestrator = new AnatomyOrchestrator({
      entityManager: mockEntityManager,
      logger: mockLogger,
      generationWorkflow: mockGenerationWorkflow,
      descriptionWorkflow: mockDescriptionWorkflow,
      graphBuildingWorkflow: mockGraphBuildingWorkflow,
      errorHandler: mockErrorHandler,
    });
  });

  describe('Description Generation Failure Rollback', () => {
    it('should rollback all entities when description generation fails', async () => {
      // Arrange
      const entityId = 'test-entity';
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';
      const mockEntity = {
        id: entityId,
        getComponentData: jest.fn().mockReturnValue({ recipeId }),
      };

      // Mock successful anatomy generation
      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);
      mockGenerationWorkflow.generate.mockResolvedValue({
        rootId: 'root-1',
        entities: ['entity-1', 'entity-2', 'entity-3'],
        partsMap: new Map([['part-1', 'entity-1']]),
      });

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntityManager.removeEntityInstance.mockResolvedValue(); // Mock successful entity deletion
      mockGraphBuildingWorkflow.buildCache.mockResolvedValue();

      // Mock description generation failure
      const descriptionError = new DescriptionGenerationError(
        'Failed to generate descriptions',
        entityId
      );
      mockDescriptionWorkflow.generateAll.mockRejectedValue(descriptionError);

      // Mock error handler
      mockErrorHandler.handle.mockReturnValue(descriptionError);

      // Act & Assert
      await expect(
        anatomyOrchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow(descriptionError);

      // Verify that anatomy generation was attempted
      expect(mockGenerationWorkflow.generate).toHaveBeenCalledWith(
        blueprintId,
        recipeId,
        { ownerId: entityId }
      );

      // Verify that graph building was attempted
      expect(mockGraphBuildingWorkflow.buildCache).toHaveBeenCalledWith(
        'root-1'
      );

      // Verify that description generation was attempted
      expect(mockDescriptionWorkflow.generateAll).toHaveBeenCalledWith(
        entityId
      );

      // Verify error handling was triggered
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(descriptionError, {
        operation: 'orchestration',
        entityId,
        recipeId,
      });
    });

    it('should track entities for rollback when description generation fails', async () => {
      // Arrange
      const entityId = 'test-entity';
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';
      const generatedEntities = ['entity-1', 'entity-2', 'entity-3'];
      const mockEntity = {
        id: entityId,
        getComponentData: jest.fn().mockReturnValue({ recipeId }),
      };

      // Mock successful anatomy generation
      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);
      mockGenerationWorkflow.generate.mockResolvedValue({
        rootId: 'root-1',
        entities: generatedEntities,
        partsMap: new Map([['part-1', 'entity-1']]),
      });

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockGraphBuildingWorkflow.buildCache.mockResolvedValue();

      // Mock description generation failure
      const descriptionError = new DescriptionGenerationError(
        'Failed to generate descriptions',
        entityId
      );
      mockDescriptionWorkflow.generateAll.mockRejectedValue(descriptionError);
      mockErrorHandler.handle.mockReturnValue(descriptionError);

      // Act & Assert
      await expect(
        anatomyOrchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow(descriptionError);

      // Verify that the error contains information about tracked entities
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate anatomy'),
        expect.objectContaining({
          error: descriptionError.message,
          trackedEntities: expect.any(Number),
          wasRolledBack: true,
        })
      );
    });

    it('should handle description generation failure in early stage', async () => {
      // Arrange
      const entityId = 'test-entity';
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';
      const mockEntity = {
        id: entityId,
        getComponentData: jest.fn().mockReturnValue({ recipeId }),
      };

      // Mock successful anatomy generation
      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);
      mockGenerationWorkflow.generate.mockResolvedValue({
        rootId: 'root-1',
        entities: ['entity-1', 'entity-2'],
        partsMap: new Map([['part-1', 'entity-1']]),
      });

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntityManager.removeEntityInstance.mockResolvedValue(); // Mock successful entity deletion

      // Mock graph building failure (before description generation)
      const graphError = new Error('Graph building failed');
      mockGraphBuildingWorkflow.buildCache.mockRejectedValue(graphError);
      mockErrorHandler.handle.mockReturnValue(graphError);

      // Act & Assert
      await expect(
        anatomyOrchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow(graphError);

      // Verify that description generation was never attempted
      expect(mockDescriptionWorkflow.generateAll).not.toHaveBeenCalled();

      // Verify that error handling was triggered
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(graphError, {
        operation: 'orchestration',
        entityId,
        recipeId,
      });
    });

    it('should succeed when all phases complete successfully', async () => {
      // Arrange
      const entityId = 'test-entity';
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';
      const generatedEntities = ['entity-1', 'entity-2', 'entity-3'];
      const mockEntity = {
        id: entityId,
        getComponentData: jest.fn().mockReturnValue({ recipeId }),
      };

      // Mock successful anatomy generation
      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);
      mockGenerationWorkflow.generate.mockResolvedValue({
        rootId: 'root-1',
        entities: generatedEntities,
        partsMap: new Map([['part-1', 'entity-1']]),
      });

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockGraphBuildingWorkflow.buildCache.mockResolvedValue();

      // Mock successful description generation
      mockDescriptionWorkflow.generateAll.mockResolvedValue();

      // Act
      const result = await anatomyOrchestrator.orchestrateGeneration(
        entityId,
        recipeId
      );

      // Assert
      expect(result).toEqual({
        success: true,
        entityCount: generatedEntities.length,
        rootId: 'root-1',
      });

      // Verify all phases were executed
      expect(mockGenerationWorkflow.generate).toHaveBeenCalledWith(
        blueprintId,
        recipeId,
        { ownerId: entityId }
      );
      expect(mockGraphBuildingWorkflow.buildCache).toHaveBeenCalledWith(
        'root-1'
      );
      expect(mockDescriptionWorkflow.generateAll).toHaveBeenCalledWith(
        entityId
      );

      // Verify parent entity was updated
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        'anatomy:body',
        expect.objectContaining({
          recipeId,
          body: expect.objectContaining({
            root: 'root-1',
            parts: { 'part-1': 'entity-1' },
            slotToPartMappings: {},
          }),
        })
      );

      // Verify no error handling was triggered
      expect(mockErrorHandler.handle).not.toHaveBeenCalled();
    });
  });

  describe('Entity State Consistency', () => {
    it('should maintain entity state consistency during rollback', async () => {
      // Arrange
      const entityId = 'test-entity';
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';
      const mockEntity = {
        id: entityId,
        getComponentData: jest.fn().mockReturnValue({ recipeId }),
      };

      // Mock successful anatomy generation
      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);
      mockGenerationWorkflow.generate.mockResolvedValue({
        rootId: 'root-1',
        entities: ['entity-1', 'entity-2'],
        partsMap: new Map([['part-1', 'entity-1']]),
      });

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockGraphBuildingWorkflow.buildCache.mockResolvedValue();

      // Mock description generation failure after some processing
      const descriptionError = new DescriptionGenerationError(
        'Async description generation failed',
        entityId
      );
      mockDescriptionWorkflow.generateAll.mockRejectedValue(descriptionError);
      mockErrorHandler.handle.mockReturnValue(descriptionError);

      // Act & Assert
      await expect(
        anatomyOrchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow(descriptionError);

      // Verify that the parent entity was updated but then rolled back
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        'anatomy:body',
        expect.objectContaining({
          recipeId,
          body: expect.objectContaining({
            root: 'root-1',
            parts: { 'part-1': 'entity-1' },
            slotToPartMappings: {},
          }),
        })
      );
    });

    it('should handle multiple entity failures gracefully', async () => {
      // Arrange
      const entityId = 'test-entity';
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';
      const mockEntity = {
        id: entityId,
        getComponentData: jest.fn().mockReturnValue({ recipeId }),
      };

      // Mock successful anatomy generation
      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);
      mockGenerationWorkflow.generate.mockResolvedValue({
        rootId: 'root-1',
        entities: ['entity-1', 'entity-2', 'entity-3', 'entity-4'],
        partsMap: new Map([
          ['part-1', 'entity-1'],
          ['part-2', 'entity-2'],
          ['part-3', 'entity-3'],
          ['part-4', 'entity-4'],
        ]),
      });

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntityManager.removeEntityInstance.mockResolvedValue(); // Mock successful entity deletion
      mockGraphBuildingWorkflow.buildCache.mockResolvedValue();

      // Mock description generation failure with multiple entity issues
      const descriptionError = new DescriptionGenerationError(
        'Multiple entity description failures',
        entityId,
        ['entity-1', 'entity-3'] // Failed entities
      );
      mockDescriptionWorkflow.generateAll.mockRejectedValue(descriptionError);
      mockErrorHandler.handle.mockReturnValue(descriptionError);

      // Act & Assert
      await expect(
        anatomyOrchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow(descriptionError);

      // Verify that rollback was attempted for all tracked entities
      // The first call is about the rollback operation, second is about final failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed, triggering rollback'),
        expect.objectContaining({
          error: descriptionError.message,
          trackedEntities: 4, // All entities should be tracked
        })
      );
    });
  });

  describe('Generation Workflow Integration', () => {
    it('should handle entity not found after generation', async () => {
      // Arrange
      const entityId = 'test-entity';
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';

      mockGenerationWorkflow.validateRecipe.mockReturnValue(blueprintId);
      mockGenerationWorkflow.generate.mockResolvedValue({
        rootId: 'root-1',
        entities: ['entity-1'],
        partsMap: new Map([['part-1', 'entity-1']]),
      });

      // Mock entity not found during parent entity update
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const expectedError = new Error(
        "Entity 'test-entity' not found after anatomy generation"
      );
      mockErrorHandler.handle.mockReturnValue(expectedError);

      // Act & Assert
      await expect(
        anatomyOrchestrator.orchestrateGeneration(entityId, recipeId)
      ).rejects.toThrow(expectedError);

      // Verify error handling was triggered
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(expect.any(Error), {
        operation: 'orchestration',
        entityId,
        recipeId,
      });
    });

    it('should verify generation needed before proceeding', () => {
      // Arrange
      const entityId = 'test-entity';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
          body: { root: 'existing-root' }, // Already has anatomy
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Act
      const result = anatomyOrchestrator.checkGenerationNeeded(entityId);

      // Assert
      expect(result).toEqual({
        needsGeneration: false,
        reason: 'Anatomy already generated',
      });
    });

    it('should identify entities that need generation', () => {
      // Arrange
      const entityId = 'test-entity';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'test-recipe',
          // No body property - needs generation
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // Act
      const result = anatomyOrchestrator.checkGenerationNeeded(entityId);

      // Assert
      expect(result).toEqual({
        needsGeneration: true,
        reason: 'Ready for generation',
      });
    });
  });
});
