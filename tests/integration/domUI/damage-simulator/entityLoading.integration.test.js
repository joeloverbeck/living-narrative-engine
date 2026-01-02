/**
 * @file entityLoading.integration.test.js
 * @description Integration tests for damage simulator entity loading.
 * Tests that AnatomyDataExtractor correctly handles the nested anatomy:body structure.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AnatomyDataExtractor from '../../../../src/domUI/shared/AnatomyDataExtractor.js';

describe('AnatomyDataExtractor - Entity Loading Integration', () => {
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  describe('extractFromEntity with real component structure', () => {
    it('should successfully load entity when anatomy:body.body is populated', async () => {
      // Arrange - mock component with actual nested structure
      const rootEntityId = 'root-part-123';
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            // Actual structure from anatomy mod
            return {
              recipeId: 'anatomy:human',
              body: {
                root: rootEntityId,
                parts: {
                  torso: rootEntityId,
                },
              },
            };
          }
          if (componentId === 'core:name') {
            return { text: 'Torso' };
          }
          if (componentId === 'anatomy:part_health') {
            return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
          }
          if (componentId === 'anatomy:joint') {
            return null; // Root has no parent
          }
          return null;
        }),
        getAllComponents: jest.fn(() => ({
          'core:name': { text: 'Torso' },
          'anatomy:part_health': {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
          },
        })),
      };

      mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue(mockEntity),
      };

      const extractor = new AnatomyDataExtractor({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // Act
      const result = await extractor.extractFromEntity('test-entity-id');

      // Assert
      expect(result).not.toBeNull();
      expect(result.id).toBe(rootEntityId);
      expect(result.name).toBe('Torso');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle entity with anatomy:body but null body property', async () => {
      // Arrange - anatomy:body exists but body is null (not yet generated)
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              recipeId: 'anatomy:human',
              body: null, // Not yet generated
            };
          }
          return null;
        }),
      };

      mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue(mockEntity),
      };

      const extractor = new AnatomyDataExtractor({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // Act
      const result = await extractor.extractFromEntity('test-entity-id');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('anatomy:body.body is null')
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle entity with anatomy:body but missing body property', async () => {
      // Arrange - anatomy:body exists but body property is undefined
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              recipeId: 'anatomy:human',
              // body property missing entirely
            };
          }
          return null;
        }),
      };

      mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue(mockEntity),
      };

      const extractor = new AnatomyDataExtractor({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // Act
      const result = await extractor.extractFromEntity('test-entity-id');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('anatomy:body.body is null')
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return null when entity has no anatomy:body component', async () => {
      // Arrange
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue(null),
      };

      mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue(mockEntity),
      };

      const extractor = new AnatomyDataExtractor({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // Act
      const result = await extractor.extractFromEntity('test-entity-id');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no anatomy:body component')
      );
    });

    it('should return null when entity is not found', async () => {
      // Arrange
      mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue(null),
      };

      const extractor = new AnatomyDataExtractor({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // Act
      const result = await extractor.extractFromEntity('non-existent-entity');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Entity not found')
      );
    });
  });

  describe('extractHierarchy direct calls', () => {
    it('should throw when called with component wrapper instead of body', async () => {
      // Arrange - simulating the OLD bug where entire component was passed
      mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue(null),
      };

      const extractor = new AnatomyDataExtractor({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // This is what the bug was passing - the entire component
      const wrongData = {
        recipeId: 'anatomy:human',
        body: {
          root: 'torso-1',
          parts: {},
        },
      };

      // Act & Assert - this should throw because wrongData.root is undefined
      await expect(extractor.extractHierarchy(wrongData)).rejects.toThrow(
        'bodyData.root is required'
      );
    });

    it('should succeed when called with correct body structure', async () => {
      // Arrange
      const rootEntityId = 'root-part-123';
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Torso' };
          }
          if (componentId === 'anatomy:part_health') {
            return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
          }
          if (componentId === 'anatomy:joint') {
            return null;
          }
          return null;
        }),
        getAllComponents: jest.fn(() => ({
          'core:name': { text: 'Torso' },
        })),
      };

      mockEntityManager = {
        getEntityInstance: jest.fn().mockResolvedValue(mockEntity),
      };

      const extractor = new AnatomyDataExtractor({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // This is what should be passed - the body object directly
      const correctData = {
        root: rootEntityId,
        parts: { torso: rootEntityId },
      };

      // Act
      const result = await extractor.extractHierarchy(correctData);

      // Assert
      expect(result).not.toBeNull();
      expect(result.id).toBe(rootEntityId);
    });
  });
});
