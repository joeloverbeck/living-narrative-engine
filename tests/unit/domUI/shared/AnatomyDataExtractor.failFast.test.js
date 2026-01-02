/**
 * @file AnatomyDataExtractor.failFast.test.js
 * @description Unit tests for fail-fast behavior in AnatomyDataExtractor.
 * These tests verify that invalid data causes errors to be thrown rather than
 * silently returning null, ensuring callers handle errors appropriately.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyDataExtractor from '../../../../src/domUI/shared/AnatomyDataExtractor.js';

describe('AnatomyDataExtractor - Fail Fast Behavior', () => {
  let mockEntityManager;
  let mockLogger;
  let extractor;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    extractor = new AnatomyDataExtractor({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('extractHierarchy - fail fast on invalid bodyData', () => {
    it('should throw when bodyData.root is missing', async () => {
      // Act & Assert
      await expect(extractor.extractHierarchy({ parts: {} })).rejects.toThrow(
        'AnatomyDataExtractor: bodyData.root is required for hierarchy extraction'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnatomyDataExtractor: Invalid bodyData - missing root property',
        expect.objectContaining({ bodyData: { parts: {} } })
      );
    });

    it('should throw when bodyData is null', async () => {
      // Act & Assert
      await expect(extractor.extractHierarchy(null)).rejects.toThrow(
        'AnatomyDataExtractor: bodyData.root is required for hierarchy extraction'
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw when bodyData is undefined', async () => {
      // Act & Assert
      await expect(extractor.extractHierarchy(undefined)).rejects.toThrow(
        'AnatomyDataExtractor: bodyData.root is required for hierarchy extraction'
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw when bodyData.root is empty string', async () => {
      // Act & Assert
      await expect(
        extractor.extractHierarchy({ root: '', parts: {} })
      ).rejects.toThrow(
        'AnatomyDataExtractor: bodyData.root is required for hierarchy extraction'
      );
    });

    it('should throw when bodyData is an empty object', async () => {
      // Act & Assert
      await expect(extractor.extractHierarchy({})).rejects.toThrow(
        'AnatomyDataExtractor: bodyData.root is required for hierarchy extraction'
      );
    });
  });

  describe('extractFromEntity - error propagation', () => {
    it('should propagate error when extractHierarchy throws', async () => {
      // Arrange
      const entityInstanceId = 'test-entity-1';
      const mockEntity = {
        getComponentData: jest.fn().mockImplementation((compId) => {
          if (compId === 'anatomy:body') {
            // Return bodyData without root - this will cause extractHierarchy to throw
            return { body: { parts: {} } };
          }
          return null;
        }),
      };
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act & Assert
      await expect(
        extractor.extractFromEntity(entityInstanceId)
      ).rejects.toThrow(
        'AnatomyDataExtractor: bodyData.root is required for hierarchy extraction'
      );

      // Should have two error logs: one from extractHierarchy, one from extractFromEntity
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnatomyDataExtractor: Invalid bodyData - missing root property',
        expect.objectContaining({ bodyData: { parts: {} } })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyDataExtractor: Failed to extract from entity ${entityInstanceId}:`,
        expect.any(Error)
      );
    });

    it('should propagate error when entity manager throws', async () => {
      // Arrange
      const entityInstanceId = 'test-entity-2';
      const error = new Error('Entity manager failure');
      mockEntityManager.getEntityInstance.mockRejectedValue(error);

      // Act & Assert
      await expect(
        extractor.extractFromEntity(entityInstanceId)
      ).rejects.toThrow('Entity manager failure');

      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyDataExtractor: Failed to extract from entity ${entityInstanceId}:`,
        error
      );
    });

    it('should still return null for missing entityInstanceId (validation case)', async () => {
      // This case is a validation failure, not a runtime error
      // It should still return null with a warning

      const result = await extractor.extractFromEntity(null);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyDataExtractor: entityInstanceId is required for extractFromEntity'
      );
    });

    it('should still return null when entity is not found (graceful case)', async () => {
      // When the entity doesn't exist, it's a valid "no data" scenario
      // not a programming error, so null is appropriate

      mockEntityManager.getEntityInstance.mockResolvedValue(null);

      const result = await extractor.extractFromEntity('nonexistent-entity');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyDataExtractor: Entity not found: nonexistent-entity'
      );
    });

    it('should still return null when entity has no anatomy:body (graceful case)', async () => {
      // Entity exists but has no anatomy:body component - this is valid
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue(null),
      };
      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await extractor.extractFromEntity('entity-without-body');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyDataExtractor: Entity entity-without-body has no anatomy:body component'
      );
    });
  });

  describe('error message clarity', () => {
    it('should include bodyData context in error log for debugging', async () => {
      const invalidBodyData = { parts: { leftArm: 'arm-1' } };

      await expect(
        extractor.extractHierarchy(invalidBodyData)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnatomyDataExtractor: Invalid bodyData - missing root property',
        { bodyData: invalidBodyData }
      );
    });
  });
});
