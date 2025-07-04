/**
 * @file AnatomyGraphRendererMethodNames.test.js
 * @description Focused tests to ensure AnatomyGraphRenderer uses correct entity method names
 */

import AnatomyGraphRenderer from '../../../src/domUI/AnatomyGraphRenderer.js';
import { jest } from '@jest/globals';

describe('AnatomyGraphRenderer - Method Name Validation', () => {
  let mockLogger;
  let mockEntityManager;
  let mockAnatomyDescriptionService;
  let renderer;
  let mockContainer;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    // Mock anatomy description service
    mockAnatomyDescriptionService = {
      generateDescriptionForPart: jest.fn(),
    };

    // Mock container
    mockContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      offsetWidth: 800,
      offsetHeight: 600,
    };

    // Mock SVG element
    const mockSvgElement = {
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      addEventListener: jest.fn(),
      getBoundingClientRect: jest.fn(() => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      })),
      style: {},
    };

    // Mock document
    const mockDocument = {
      getElementById: jest.fn(() => mockContainer),
      createElementNS: jest.fn(() => mockSvgElement),
      createElement: jest.fn(() => ({
        style: {},
        innerHTML: '',
        appendChild: jest.fn(),
      })),
      addEventListener: jest.fn(),
    };

    // Create renderer instance
    renderer = new AnatomyGraphRenderer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyDescriptionService: mockAnatomyDescriptionService,
      container: mockContainer,
      documentContext: { document: mockDocument },
    });
  });

  describe('Entity Method Names in Graph Building', () => {
    it('should use getEntityInstance() and getComponentData() when building graph', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const partEntityId = 'part-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          part1: partEntityId,
        },
      };

      // Mock root entity
      const mockRootEntity = {
        id: rootEntityId,
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Name' };
          if (type === 'core:description') return { text: 'Root Description' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          if (type === 'anatomy:joint') return null;
          return null;
        }),
      };

      // Mock part entity
      const mockPartEntity = {
        id: partEntityId,
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Part Name' };
          if (type === 'core:description') return { text: 'Part Description' };
          if (type === 'anatomy:part') return { subType: 'arm' };
          if (type === 'anatomy:joint') return { parentId: rootEntityId, socketId: 'socket1' };
          return null;
        }),
      };

      // Setup entity manager to return correct entities
      mockEntityManager.getEntityInstance.mockImplementation(async (id) => {
        if (id === rootEntityId) return mockRootEntity;
        if (id === partEntityId) return mockPartEntity;
        return null;
      });

      // Act
      await renderer.renderGraph(rootEntityId, bodyData);

      // Assert - verify getEntityInstance was called (not getEntity)
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(rootEntityId);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(partEntityId);
      // Algorithm: 1) process root, 2) check part as child of root, 3) process part
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(3);

      // Assert - verify getComponentData was called (not getComponent)
      expect(mockRootEntity.getComponentData).toHaveBeenCalledWith('core:name');
      expect(mockRootEntity.getComponentData).toHaveBeenCalledWith('core:description');
      expect(mockRootEntity.getComponentData).toHaveBeenCalledWith('anatomy:part');
      expect(mockRootEntity.getComponentData).toHaveBeenCalledWith('anatomy:joint');

      expect(mockPartEntity.getComponentData).toHaveBeenCalledWith('core:name');
      expect(mockPartEntity.getComponentData).toHaveBeenCalledWith('core:description');
      expect(mockPartEntity.getComponentData).toHaveBeenCalledWith('anatomy:part');
      expect(mockPartEntity.getComponentData).toHaveBeenCalledWith('anatomy:joint');
    });

    it('should handle entities without getComponent method gracefully', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = { root: rootEntityId, parts: {} };

      // Create entity that only has getComponentData (like real implementation)
      const mockEntity = {
        id: rootEntityId,
        getComponentData: jest.fn(() => null),
      };
      // Ensure getComponent doesn't exist
      Object.defineProperty(mockEntity, 'getComponent', {
        value: undefined,
        writable: false,
        configurable: false,
      });

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act & Assert - should not throw
      await expect(renderer.renderGraph(rootEntityId, bodyData)).resolves.not.toThrow();

      // Verify correct method was called
      expect(mockEntity.getComponentData).toHaveBeenCalled();
    });

    it('should not call getEntity() method on entityManager', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = { root: rootEntityId, parts: {} };

      const mockEntity = {
        id: rootEntityId,
        getComponentData: jest.fn(() => null),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      // Ensure getEntity doesn't exist
      mockEntityManager.getEntity = undefined;

      // Act
      await renderer.renderGraph(rootEntityId, bodyData);

      // Assert - only getEntityInstance should be called
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(rootEntityId);
      expect(mockEntityManager.getEntity).toBeUndefined();
    });
  });

  describe('Error Prevention', () => {
    it('should not throw TypeError when accessing entity components', async () => {
      // This test prevents errors like "entity.getComponent is not a function"
      const rootEntityId = 'root-entity';
      const partId1 = 'part1';
      const partId2 = 'part2';
      const bodyData = {
        root: rootEntityId,
        parts: {
          part1: partId1,
          part2: partId2,
        },
      };

      // Mock entities with only getComponentData
      const createMockEntity = (id, parentId = null) => ({
        id,
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: `Name ${id}` };
          if (type === 'core:description') return { text: `Desc ${id}` };
          if (type === 'anatomy:part') return { subType: 'part' };
          if (type === 'anatomy:joint' && parentId) {
            return { parentId, socketId: 'socket' };
          }
          return null;
        }),
      });

      const mockRootEntity = createMockEntity(rootEntityId);
      const mockPart1 = createMockEntity(partId1, rootEntityId);
      const mockPart2 = createMockEntity(partId2, rootEntityId);

      mockEntityManager.getEntityInstance.mockImplementation(async (id) => {
        if (id === rootEntityId) return mockRootEntity;
        if (id === partId1) return mockPart1;
        if (id === partId2) return mockPart2;
        return null;
      });

      // Act & Assert - should complete without throwing
      await expect(renderer.renderGraph(rootEntityId, bodyData)).resolves.not.toThrow();

      // Verify all component data was accessed correctly
      expect(mockRootEntity.getComponentData).toHaveBeenCalledTimes(4);
      // Each part: checked as child of root (1), processed from queue (4), checked by other part (1) = 5 for part1, 6 for part2
      expect(mockPart1.getComponentData).toHaveBeenCalledTimes(5);
      expect(mockPart2.getComponentData).toHaveBeenCalledTimes(6);
    });

    it('should handle null entities returned from getEntityInstance', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const partEntityId = 'missing-part';
      const bodyData = {
        root: partEntityId, // Start with the missing part as root
        parts: {
          [rootEntityId]: {},
        },
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(null); // Root entity not found

      // Act
      await renderer.renderGraph(partEntityId, bodyData);

      // Assert - should log warning when entity in queue is not found
      expect(mockLogger.warn).toHaveBeenCalledWith(`Entity not found: ${partEntityId}`);
    });
  });
});