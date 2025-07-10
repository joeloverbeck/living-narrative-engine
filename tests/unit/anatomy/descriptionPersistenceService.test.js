/**
 * @file Test suite for DescriptionPersistenceService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DescriptionPersistenceService } from '../../../src/anatomy/DescriptionPersistenceService.js';
import { DESCRIPTION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('DescriptionPersistenceService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntity;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Setup mock entity
    mockEntity = {
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
    };

    service = new DescriptionPersistenceService({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(() => {
        new DescriptionPersistenceService({
          entityManager: mockEntityManager,
        });
      }).toThrow('logger is required');
    });

    it('should throw error when entityManager is not provided', () => {
      expect(() => {
        new DescriptionPersistenceService({
          logger: mockLogger,
        });
      }).toThrow('entityManager is required');
    });

    it('should create instance with valid dependencies', () => {
      const instance = new DescriptionPersistenceService({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('updateDescription', () => {
    it('should successfully update description for existing entity', () => {
      const entityId = 'test-entity';
      const description = 'Test description';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = service.updateDescription(entityId, description);

      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(entityId);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        DESCRIPTION_COMPONENT_ID,
        { text: description }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Updated description for entity '${entityId}'`
      );
    });

    it('should return false when entity not found', () => {
      const entityId = 'non-existent';
      const description = 'Test description';

      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = service.updateDescription(entityId, description);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Entity '${entityId}' not found`
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should handle errors and return false', () => {
      const entityId = 'test-entity';
      const description = 'Test description';
      const error = new Error('Update failed');

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntityManager.addComponent.mockImplementation(() => {
        throw error;
      });

      const result = service.updateDescription(entityId, description);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Failed to update description for entity '${entityId}'`,
        error
      );
    });
  });

  describe('updateMultipleDescriptions', () => {
    it('should update all descriptions successfully', () => {
      const descriptionsMap = new Map([
        ['entity1', 'Description 1'],
        ['entity2', 'Description 2'],
        ['entity3', 'Description 3'],
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = service.updateMultipleDescriptions(descriptionsMap);

      expect(result.successful).toBe(3);
      expect(result.failed).toEqual([]);
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DescriptionPersistenceService: Updated 3 descriptions, 0 failed'
      );
    });

    it('should handle partial failures', () => {
      const descriptionsMap = new Map([
        ['entity1', 'Description 1'],
        ['entity2', 'Description 2'],
        ['entity3', 'Description 3'],
      ]);

      // Mock entity2 as not found
      mockEntityManager.getEntityInstance
        .mockReturnValueOnce(mockEntity) // entity1
        .mockReturnValueOnce(null) // entity2
        .mockReturnValueOnce(mockEntity); // entity3

      const result = service.updateMultipleDescriptions(descriptionsMap);

      expect(result.successful).toBe(2);
      expect(result.failed).toEqual(['entity2']);
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DescriptionPersistenceService: Updated 2 descriptions, 1 failed'
      );
    });

    it('should handle empty map', () => {
      const descriptionsMap = new Map();

      const result = service.updateMultipleDescriptions(descriptionsMap);

      expect(result.successful).toBe(0);
      expect(result.failed).toEqual([]);
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('removeDescription', () => {
    it('should successfully remove description from entity', () => {
      const entityId = 'test-entity';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);

      const result = service.removeDescription(entityId);

      expect(result).toBe(true);
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        entityId,
        DESCRIPTION_COMPONENT_ID
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Removed description from entity '${entityId}'`
      );
    });

    it('should return false when entity not found', () => {
      const entityId = 'non-existent';

      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = service.removeDescription(entityId);

      expect(result).toBe(false);
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    });

    it('should return false when entity has no description component', () => {
      const entityId = 'test-entity';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(false);

      const result = service.removeDescription(entityId);

      expect(result).toBe(false);
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    });

    it('should handle errors and return false', () => {
      const entityId = 'test-entity';
      const error = new Error('Remove failed');

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);
      mockEntityManager.removeComponent.mockImplementation(() => {
        throw error;
      });

      const result = service.removeDescription(entityId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Failed to remove description from entity '${entityId}'`,
        error
      );
    });
  });

  describe('getDescription', () => {
    it('should return description data for entity with description', () => {
      const entityId = 'test-entity';
      const descriptionData = { text: 'Test description' };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.getComponentData.mockReturnValue(descriptionData);

      const result = service.getDescription(entityId);

      expect(result).toEqual(descriptionData);
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        DESCRIPTION_COMPONENT_ID
      );
    });

    it('should return null when entity not found', () => {
      const entityId = 'non-existent';

      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = service.getDescription(entityId);

      expect(result).toBeNull();
      expect(mockEntity.getComponentData).not.toHaveBeenCalled();
    });

    it('should handle errors and return null', () => {
      const entityId = 'test-entity';
      const error = new Error('Get failed');

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.getComponentData.mockImplementation(() => {
        throw error;
      });

      const result = service.getDescription(entityId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Failed to get description for entity '${entityId}'`,
        error
      );
    });
  });

  describe('hasDescription', () => {
    it('should return true when entity has description component', () => {
      const entityId = 'test-entity';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);

      const result = service.hasDescription(entityId);

      expect(result).toBe(true);
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(
        DESCRIPTION_COMPONENT_ID
      );
    });

    it('should return false when entity not found', () => {
      const entityId = 'non-existent';

      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = service.hasDescription(entityId);

      expect(result).toBe(false);
    });

    it('should return false when entity has no description component', () => {
      const entityId = 'test-entity';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(false);

      const result = service.hasDescription(entityId);

      expect(result).toBe(false);
    });

    it('should handle errors and return false', () => {
      const entityId = 'test-entity';

      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Check failed');
      });

      const result = service.hasDescription(entityId);

      expect(result).toBe(false);
      // Note: hasDescription doesn't log errors, it just returns false
    });
  });

  describe('integration scenarios', () => {
    it('should handle update then remove workflow', () => {
      const entityId = 'test-entity';
      const description = 'Initial description';

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntity.hasComponent.mockReturnValue(true);

      // Update description
      const updateResult = service.updateDescription(entityId, description);
      expect(updateResult).toBe(true);

      // Remove description
      const removeResult = service.removeDescription(entityId);
      expect(removeResult).toBe(true);
    });

    it('should handle batch update with various entity states', () => {
      const descriptionsMap = new Map([
        ['existing1', 'Description 1'],
        ['non-existent', 'Description 2'],
        ['existing2', 'Description 3'],
      ]);

      // Mock different states
      mockEntityManager.getEntityInstance
        .mockReturnValueOnce(mockEntity) // existing1
        .mockReturnValueOnce(null) // non-existent
        .mockReturnValueOnce(mockEntity); // existing2

      const result = service.updateMultipleDescriptions(descriptionsMap);

      expect(result.successful).toBe(2);
      expect(result.failed).toEqual(['non-existent']);
    });
  });
});