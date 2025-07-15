/**
 * @file Unit tests for BodyGraphService.getAnatomyData method
 * @see src/anatomy/bodyGraphService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService.getAnatomyData', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockQueryCache;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    service = new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      queryCache: mockQueryCache,
    });
  });

  describe('input validation', () => {
    it('should throw InvalidArgumentError for null entityId', async () => {
      await expect(service.getAnatomyData(null)).rejects.toThrow(
        InvalidArgumentError
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should throw InvalidArgumentError for undefined entityId', async () => {
      await expect(service.getAnatomyData(undefined)).rejects.toThrow(
        InvalidArgumentError
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should throw InvalidArgumentError for empty string entityId', async () => {
      await expect(service.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should throw InvalidArgumentError for non-string entityId', async () => {
      await expect(service.getAnatomyData(123)).rejects.toThrow(
        InvalidArgumentError
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('anatomy:body component handling', () => {
    it('should return null when entity has no anatomy:body component', async () => {
      const entityId = 'test-entity-123';
      mockEntityManager.getComponentData.mockResolvedValue(null);

      const result = await service.getAnatomyData(entityId);

      expect(result).toBeNull();
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        entityId,
        'anatomy:body'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `BodyGraphService.getAnatomyData: Getting anatomy data for entity '${entityId}'`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `BodyGraphService.getAnatomyData: Entity '${entityId}' has no anatomy:body component`
      );
    });

    it('should return anatomy data when component exists with recipeId', async () => {
      const entityId = 'test-entity-123';
      const mockBodyComponent = {
        recipeId: 'human_base',
        body: {
          root: 'root-entity-456',
        },
      };
      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);

      const result = await service.getAnatomyData(entityId);

      expect(result).toEqual({
        recipeId: 'human_base',
        rootEntityId: entityId,
      });
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        entityId,
        'anatomy:body'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `BodyGraphService.getAnatomyData: Getting anatomy data for entity '${entityId}'`
      );
    });

    it('should return anatomy data with null recipeId when not specified', async () => {
      const entityId = 'test-entity-123';
      const mockBodyComponent = {
        body: {
          root: 'root-entity-456',
        },
      };
      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);

      const result = await service.getAnatomyData(entityId);

      expect(result).toEqual({
        recipeId: null,
        rootEntityId: entityId,
      });
    });

    it('should return anatomy data with null recipeId when recipeId is explicitly null', async () => {
      const entityId = 'test-entity-123';
      const mockBodyComponent = {
        recipeId: null,
        body: {
          root: 'root-entity-456',
        },
      };
      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);

      const result = await service.getAnatomyData(entityId);

      expect(result).toEqual({
        recipeId: null,
        rootEntityId: entityId,
      });
    });

    it('should return anatomy data with null recipeId when recipeId is empty string', async () => {
      const entityId = 'test-entity-123';
      const mockBodyComponent = {
        recipeId: '',
        body: {
          root: 'root-entity-456',
        },
      };
      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);

      const result = await service.getAnatomyData(entityId);

      expect(result).toEqual({
        recipeId: null,
        rootEntityId: entityId,
      });
    });
  });

  describe('integration with ClothingInstantiationService expectations', () => {
    it('should return data structure compatible with ClothingInstantiationService', async () => {
      const entityId = 'actor-123';
      const mockBodyComponent = {
        recipeId: 'human_base',
        body: {
          root: 'torso-456',
        },
      };
      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);

      const result = await service.getAnatomyData(entityId);

      // Verify the structure matches what ClothingInstantiationService expects
      expect(result).toHaveProperty('recipeId');
      expect(result).toHaveProperty('rootEntityId');
      expect(typeof result.recipeId).toBe('string');
      expect(typeof result.rootEntityId).toBe('string');
      expect(result.recipeId).toBe('human_base');
      expect(result.rootEntityId).toBe(entityId);
    });

    it('should handle the case where ClothingInstantiationService checks for null anatomy data', async () => {
      const entityId = 'actor-without-anatomy';
      mockEntityManager.getComponentData.mockResolvedValue(null);

      const result = await service.getAnatomyData(entityId);

      expect(result).toBeNull();
      // Verify that the code in ClothingInstantiationService line 416 can handle this
      expect(result?.recipeId).toBeUndefined();
    });
  });

  describe('logging behavior', () => {
    it('should log debug messages for successful retrieval', async () => {
      const entityId = 'test-entity-123';
      const mockBodyComponent = {
        recipeId: 'human_base',
      };
      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);

      await service.getAnatomyData(entityId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `BodyGraphService.getAnatomyData: Getting anatomy data for entity '${entityId}'`
      );
    });

    it('should log debug messages when no component found', async () => {
      const entityId = 'test-entity-123';
      mockEntityManager.getComponentData.mockResolvedValue(null);

      await service.getAnatomyData(entityId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `BodyGraphService.getAnatomyData: Entity '${entityId}' has no anatomy:body component`
      );
    });
  });
});