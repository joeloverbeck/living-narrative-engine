/**
 * @file EntityLoadingService.test.js
 * @description Unit tests for EntityLoadingService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityLoadingService from '../../../../src/domUI/shared/EntityLoadingService.js';

describe('EntityLoadingService', () => {
  let mockEntityManager;
  let mockDataRegistry;
  let mockStateController;
  let mockLogger;
  let service;

  beforeEach(() => {
    // Mock entity manager
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
    };

    // Mock data registry
    mockDataRegistry = {
      getEntityDefinition: jest.fn(),
    };

    // Mock state controller
    mockStateController = {
      getCurrentState: jest.fn().mockReturnValue('IDLE'),
      reset: jest.fn(),
      selectEntity: jest.fn().mockResolvedValue(undefined),
      handleError: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new EntityLoadingService({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      stateController: mockStateController,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw when entityManager is missing required methods', () => {
      expect(() => {
        new EntityLoadingService({
          entityManager: {},
          dataRegistry: mockDataRegistry,
          stateController: mockStateController,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when dataRegistry is missing required methods', () => {
      expect(() => {
        new EntityLoadingService({
          entityManager: mockEntityManager,
          dataRegistry: {},
          stateController: mockStateController,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when stateController is missing required methods', () => {
      expect(() => {
        new EntityLoadingService({
          entityManager: mockEntityManager,
          dataRegistry: mockDataRegistry,
          stateController: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when logger is missing required methods', () => {
      expect(() => {
        new EntityLoadingService({
          entityManager: mockEntityManager,
          dataRegistry: mockDataRegistry,
          stateController: mockStateController,
          logger: {},
        });
      }).toThrow();
    });
  });

  describe('loadEntityWithAnatomy', () => {
    it('should clear tracked entity instances before loading new entity', async () => {
      // Arrange - load an entity first to create tracked state
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-1' });

      // Load first entity
      await service.loadEntityWithAnatomy('test:entity');

      // Reset mocks
      mockEntityManager.removeEntityInstance.mockClear();

      // Act - load second entity
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-2' });
      await service.loadEntityWithAnatomy('test:entity2');

      // Assert - previous entity should be removed
      expect(mockEntityManager.removeEntityInstance).toHaveBeenCalledWith('instance-1');
    });

    it('should reset state controller before loading if not in IDLE state', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-1' });
      mockStateController.getCurrentState.mockReturnValue('LOADED');

      // Act
      await service.loadEntityWithAnatomy('test:entity');

      // Assert
      expect(mockStateController.reset).toHaveBeenCalled();
    });

    it('should not reset state controller if already in IDLE state', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-1' });
      mockStateController.getCurrentState.mockReturnValue('IDLE');

      // Act
      await service.loadEntityWithAnatomy('test:entity');

      // Assert
      expect(mockStateController.reset).not.toHaveBeenCalled();
    });

    it('should throw error if definition not found', async () => {
      // Arrange
      mockDataRegistry.getEntityDefinition.mockReturnValue(null);

      // Act & Assert
      await expect(service.loadEntityWithAnatomy('test:missing')).rejects.toThrow(
        'Entity definition not found: test:missing'
      );
      expect(mockStateController.handleError).toHaveBeenCalled();
    });

    it('should throw error if definition lacks anatomy:body component', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:no-anatomy',
        components: { 'core:name': { text: 'No Body' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      // Act & Assert
      await expect(service.loadEntityWithAnatomy('test:no-anatomy')).rejects.toThrow(
        'Entity test:no-anatomy does not have anatomy:body component'
      );
      expect(mockStateController.handleError).toHaveBeenCalled();
    });

    it('should create entity instance from definition ID', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-1' });

      // Act
      await service.loadEntityWithAnatomy('test:entity');

      // Assert
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'test:entity',
        {}
      );
    });

    it('should wait for anatomy loading via state controller', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-1' });

      // Act
      await service.loadEntityWithAnatomy('test:entity');

      // Assert
      expect(mockStateController.selectEntity).toHaveBeenCalledWith('instance-1');
    });

    it('should return instance ID on successful load', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-xyz' });

      // Act
      const result = await service.loadEntityWithAnatomy('test:entity');

      // Assert
      expect(result).toBe('instance-xyz');
    });

    it('should handle loading errors gracefully', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      const error = new Error('Creation failed');
      mockEntityManager.createEntityInstance.mockRejectedValue(error);

      // Act & Assert
      await expect(service.loadEntityWithAnatomy('test:entity')).rejects.toThrow(
        'Creation failed'
      );
      expect(mockStateController.handleError).toHaveBeenCalledWith(error);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track created entity IDs for cleanup', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'instance-1' });

      // Act
      await service.loadEntityWithAnatomy('test:entity');

      // Assert
      expect(service.getCreatedEntities()).toContain('instance-1');
    });

    it('should validate definition exists in registry', async () => {
      // Arrange
      mockDataRegistry.getEntityDefinition.mockReturnValue(undefined);

      // Act & Assert
      await expect(service.loadEntityWithAnatomy('test:undefined')).rejects.toThrow(
        'Entity definition not found: test:undefined'
      );
    });

    it('should handle definition with null components', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:null-components',
        components: null,
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      // Act & Assert
      await expect(
        service.loadEntityWithAnatomy('test:null-components')
      ).rejects.toThrow('does not have anatomy:body component');
    });
  });

  describe('clearCurrentEntity', () => {
    it('should remove all tracked entities in reverse order', async () => {
      // Arrange - create multiple entities
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);

      // First entity
      mockEntityManager.createEntityInstance.mockResolvedValueOnce({ id: 'entity-1' });
      await service.loadEntityWithAnatomy('test:entity');

      // Clear and load second to test cleanup works
      mockEntityManager.removeEntityInstance.mockClear();
      mockEntityManager.createEntityInstance.mockResolvedValueOnce({ id: 'entity-2' });
      await service.loadEntityWithAnatomy('test:entity');

      // Clear again to test cleanup
      mockEntityManager.removeEntityInstance.mockClear();

      // Act
      await service.clearCurrentEntity();

      // Assert - entity-2 should be removed
      expect(mockEntityManager.removeEntityInstance).toHaveBeenCalledWith('entity-2');
    });

    it('should handle removal errors gracefully', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'entity-1' });
      await service.loadEntityWithAnatomy('test:entity');

      // Setup removal to fail
      const error = new Error('Removal failed');
      mockEntityManager.removeEntityInstance.mockRejectedValue(error);

      // Act - should not throw
      await service.clearCurrentEntity();

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'EntityLoadingService: Failed to destroy entity entity-1:',
        error
      );
    });

    it('should clear created entities array after cleanup', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'entity-1' });
      await service.loadEntityWithAnatomy('test:entity');

      // Act
      await service.clearCurrentEntity();

      // Assert
      expect(service.getCreatedEntities()).toEqual([]);
    });

    it('should reset current entity ID after cleanup', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'entity-1' });
      await service.loadEntityWithAnatomy('test:entity');

      // Act
      await service.clearCurrentEntity();

      // Assert
      expect(service.getCurrentEntityId()).toBeNull();
    });

    it('should do nothing if no entities are tracked', async () => {
      // Act - should not throw or call anything
      await service.clearCurrentEntity();

      // Assert
      expect(mockEntityManager.removeEntityInstance).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentEntityId', () => {
    it('should return null initially', () => {
      expect(service.getCurrentEntityId()).toBeNull();
    });

    it('should return current entity ID after loading', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'current-entity' });

      // Act
      await service.loadEntityWithAnatomy('test:entity');

      // Assert
      expect(service.getCurrentEntityId()).toBe('current-entity');
    });
  });

  describe('getCreatedEntities', () => {
    it('should return empty array initially', () => {
      expect(service.getCreatedEntities()).toEqual([]);
    });

    it('should return copy of created entities array', async () => {
      // Arrange
      const mockDefinition = {
        id: 'test:entity',
        components: { 'anatomy:body': { templateId: 'humanoid' } },
      };
      mockDataRegistry.getEntityDefinition.mockReturnValue(mockDefinition);
      mockEntityManager.createEntityInstance.mockResolvedValue({ id: 'entity-1' });
      await service.loadEntityWithAnatomy('test:entity');

      // Act
      const entities = service.getCreatedEntities();
      entities.push('modified'); // Try to modify

      // Assert - original should not be modified
      expect(service.getCreatedEntities()).toEqual(['entity-1']);
    });
  });
});
