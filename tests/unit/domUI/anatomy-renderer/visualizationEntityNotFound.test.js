/**
 * @file Test suite for visualization with entity not found scenarios
 * @description Tests to ensure visualization handles missing entities gracefully
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import VisualizationComposer from '../../../../src/domUI/anatomy-renderer/VisualizationComposer.js';
import AnatomyNode from '../../../../src/domUI/anatomy-renderer/types/AnatomyNode.js';
import AnatomyEdge from '../../../../src/domUI/anatomy-renderer/types/AnatomyEdge.js';

// Mock the document context
global.document = {
  createTextNode: jest.fn(),
  createElement: jest.fn(),
};

describe('Visualization Entity Not Found Scenarios', () => {
  let mockLogger;
  let mockEntityManager;
  let mockDocumentContext;
  let mockLayoutEngine;
  let mockSvgRenderer;
  let mockInteractionController;
  let mockViewportManager;
  let visualizationComposer;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockDocumentContext = {
      document: global.document,
    };

    mockLayoutEngine = {
      calculateLayout: jest.fn(),
      setStrategy: jest.fn(),
      getCurrentStrategyName: jest.fn().mockReturnValue('radial'),
    };

    mockSvgRenderer = {
      createSVG: jest.fn(),
      renderEdges: jest.fn(),
      renderNodes: jest.fn(),
      addDebugInfo: jest.fn(),
      getSVGElement: jest.fn().mockReturnValue(null),
      clearSVG: jest.fn(),
      applyTheme: jest.fn(),
      updateViewBox: jest.fn(),
    };

    mockInteractionController = {
      attachToElement: jest.fn(),
      detachFromElement: jest.fn(),
      registerHandler: jest.fn(),
    };

    mockViewportManager = {
      reset: jest.fn(),
      subscribe: jest.fn(),
      pan: jest.fn(),
      zoom: jest.fn(),
    };

    visualizationComposer = new VisualizationComposer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      documentContext: mockDocumentContext,
      layoutEngine: mockLayoutEngine,
      svgRenderer: mockSvgRenderer,
      interactionController: mockInteractionController,
      viewportManager: mockViewportManager,
    });

    // Initialize with a mock container
    const mockContainer = {
      querySelectorAll: jest.fn().mockReturnValue([]),
    };
    visualizationComposer.initialize(mockContainer);
  });

  describe('Missing Root Entity', () => {
    it('should handle missing root entity gracefully', async () => {
      // Arrange
      const rootEntityId = 'missing-root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'entity-1',
          'part-2': 'entity-2',
        },
      };

      // Mock root entity not found
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) {
          return null; // Root entity not found
        }
        return {
          id,
          getComponentData: jest.fn().mockReturnValue({ text: `Entity ${id}` }),
        };
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Entity not found: ${rootEntityId}`)
      );
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
    });

    it('should continue processing other entities when root is missing', async () => {
      // Arrange
      const rootEntityId = 'missing-root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'entity-1',
          'part-2': 'entity-2',
        },
      };

      const mockEntity1 = {
        id: 'entity-1',
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Entity 1' };
          if (componentId === 'core:description') return { text: 'Description 1' };
          if (componentId === 'anatomy:part') return { subType: 'arm' };
          if (componentId === 'anatomy:joint') return { parentId: rootEntityId, socketId: 'socket-1' };
          return null;
        }),
      };

      const mockEntity2 = {
        id: 'entity-2',
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Entity 2' };
          if (componentId === 'core:description') return { text: 'Description 2' };
          if (componentId === 'anatomy:part') return { subType: 'leg' };
          if (componentId === 'anatomy:joint') return { parentId: rootEntityId, socketId: 'socket-2' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) return null; // Root entity not found
        if (id === 'entity-1') return mockEntity1;
        if (id === 'entity-2') return mockEntity2;
        return null;
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Entity not found: ${rootEntityId}`)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unconnected parts'),
        expect.arrayContaining([
          expect.objectContaining({ id: 'entity-1' }),
          expect.objectContaining({ id: 'entity-2' }),
        ])
      );
    });
  });

  describe('Missing Part Entities', () => {
    it('should handle missing part entities gracefully', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'entity-1',
          'part-2': 'missing-entity',
          'part-3': 'entity-3',
        },
      };

      const mockRootEntity = {
        id: rootEntityId,
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Root Entity' };
          if (componentId === 'core:description') return { text: 'Root Description' };
          if (componentId === 'anatomy:part') return { subType: 'torso' };
          if (componentId === 'anatomy:joint') return null;
          return null;
        }),
      };

      const mockEntity1 = {
        id: 'entity-1',
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Entity 1' };
          if (componentId === 'core:description') return { text: 'Description 1' };
          if (componentId === 'anatomy:part') return { subType: 'arm' };
          if (componentId === 'anatomy:joint') return { parentId: rootEntityId, socketId: 'socket-1' };
          return null;
        }),
      };

      const mockEntity3 = {
        id: 'entity-3',
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Entity 3' };
          if (componentId === 'core:description') return { text: 'Description 3' };
          if (componentId === 'anatomy:part') return { subType: 'leg' };
          if (componentId === 'anatomy:joint') return { parentId: rootEntityId, socketId: 'socket-3' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) return mockRootEntity;
        if (id === 'entity-1') return mockEntity1;
        if (id === 'missing-entity') return null; // Missing entity
        if (id === 'entity-3') return mockEntity3;
        return null;
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unconnected parts'),
        expect.arrayContaining([
          expect.objectContaining({ id: 'missing-entity', name: 'part-2' }),
        ])
      );
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
    });

    it('should handle all entities missing except root', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'missing-entity-1',
          'part-2': 'missing-entity-2',
        },
      };

      const mockRootEntity = {
        id: rootEntityId,
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Root Entity' };
          if (componentId === 'core:description') return { text: 'Root Description' };
          if (componentId === 'anatomy:part') return { subType: 'torso' };
          if (componentId === 'anatomy:joint') return null;
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) return mockRootEntity;
        return null; // All other entities are missing
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unconnected parts'),
        expect.arrayContaining([
          expect.objectContaining({ id: 'missing-entity-1', name: 'part-1' }),
          expect.objectContaining({ id: 'missing-entity-2', name: 'part-2' }),
        ])
      );
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
    });
  });

  describe('Entity Retrieval Errors', () => {
    it('should handle entity retrieval errors gracefully', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'entity-1',
          'part-2': 'entity-2',
        },
      };

      // Mock entity retrieval throwing an error
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) {
          throw new Error('Entity retrieval failed');
        }
        return {
          id,
          getComponentData: jest.fn().mockReturnValue({ text: `Entity ${id}` }),
        };
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error processing entity ${rootEntityId}`),
        expect.any(Error)
      );
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
    });

    it('should handle partial entity retrieval errors', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'entity-1',
          'part-2': 'entity-2',
        },
      };

      const mockRootEntity = {
        id: rootEntityId,
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Root Entity' };
          if (componentId === 'core:description') return { text: 'Root Description' };
          if (componentId === 'anatomy:part') return { subType: 'torso' };
          if (componentId === 'anatomy:joint') return null;
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) return mockRootEntity;
        if (id === 'entity-1') {
          throw new Error('Failed to retrieve entity-1');
        }
        return {
          id,
          getComponentData: jest.fn().mockReturnValue({ text: `Entity ${id}` }),
        };
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check entity entity-1'),
        expect.any(Error)
      );
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
    });
  });

  describe('Empty or Invalid Body Data', () => {
    it('should handle empty body data gracefully', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {}, // Empty parts
      };

      const mockRootEntity = {
        id: rootEntityId,
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Root Entity' };
          if (componentId === 'core:description') return { text: 'Root Description' };
          if (componentId === 'anatomy:part') return { subType: 'torso' };
          if (componentId === 'anatomy:joint') return null;
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) return mockRootEntity;
        return null;
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Rendered 1 nodes and 0 edges')
      );
    });

    it('should handle null body data gracefully', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = null;

      // Act & Assert
      await expect(visualizationComposer.renderGraph(rootEntityId, bodyData)).rejects.toThrow('Body data is required');
      
      // Should not get to layout or rendering
      expect(mockLayoutEngine.calculateLayout).not.toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).not.toHaveBeenCalled();
    });

    it('should handle body data without root', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = {
        parts: {
          'part-1': 'entity-1',
        },
        // No root property
      };

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith('No body data or root found');
      expect(mockLayoutEngine.calculateLayout).not.toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).not.toHaveBeenCalled();
    });
  });

  describe('Render Completion with Missing Entities', () => {
    it('should complete rendering even when many entities are missing', async () => {
      // Arrange
      const rootEntityId = 'root-entity';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'missing-1',
          'part-2': 'missing-2',
          'part-3': 'missing-3',
          'part-4': 'entity-4',
        },
      };

      const mockRootEntity = {
        id: rootEntityId,
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Root Entity' };
          if (componentId === 'core:description') return { text: 'Root Description' };
          if (componentId === 'anatomy:part') return { subType: 'torso' };
          if (componentId === 'anatomy:joint') return null;
          return null;
        }),
      };

      const mockEntity4 = {
        id: 'entity-4',
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'core:name') return { text: 'Entity 4' };
          if (componentId === 'core:description') return { text: 'Description 4' };
          if (componentId === 'anatomy:part') return { subType: 'leg' };
          if (componentId === 'anatomy:joint') return { parentId: rootEntityId, socketId: 'socket-4' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === rootEntityId) return mockRootEntity;
        if (id === 'entity-4') return mockEntity4;
        return null; // All other entities are missing
      });

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unconnected parts'),
        expect.arrayContaining([
          expect.objectContaining({ id: 'missing-1', name: 'part-1' }),
          expect.objectContaining({ id: 'missing-2', name: 'part-2' }),
          expect.objectContaining({ id: 'missing-3', name: 'part-3' }),
        ])
      );
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Rendered 2 nodes and 1 edges')
      );
    });

    it('should handle rendering with zero nodes when all entities are missing', async () => {
      // Arrange
      const rootEntityId = 'missing-root';
      const bodyData = {
        root: rootEntityId,
        parts: {
          'part-1': 'missing-1',
          'part-2': 'missing-2',
        },
      };

      // Mock all entities as missing
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      // Act
      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Entity not found: ${rootEntityId}`)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unconnected parts'),
        expect.arrayContaining([
          expect.objectContaining({ id: 'missing-1', name: 'part-1' }),
          expect.objectContaining({ id: 'missing-2', name: 'part-2' }),
        ])
      );
      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Rendered 0 nodes and 0 edges')
      );
    });
  });
});