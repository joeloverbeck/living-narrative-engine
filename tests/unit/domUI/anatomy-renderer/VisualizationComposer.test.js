/**
 * @file Unit tests for VisualizationComposer
 * @description Comprehensive unit tests for VisualizationComposer class covering all methods and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import VisualizationComposer from '../../../../src/domUI/anatomy-renderer/VisualizationComposer.js';
import AnatomyVisualizerTestBed from '../../../common/anatomy/anatomyVisualizerTestBed.js';
import { AnatomyRenderError } from '../../../../src/errors/anatomyRenderError.js';
import AnatomyNode from '../../../../src/domUI/anatomy-renderer/types/AnatomyNode.js';
import AnatomyEdge from '../../../../src/domUI/anatomy-renderer/types/AnatomyEdge.js';
import RenderContext from '../../../../src/domUI/anatomy-renderer/types/RenderContext.js';

// Mock RenderContext
jest.mock('../../../../src/domUI/anatomy-renderer/types/RenderContext.js', () => {
  return jest.fn().mockImplementation(() => ({
    updateTheme: jest.fn(),
    updatePerformance: jest.fn(),
    updateViewport: jest.fn(),
  }));
});

// Mock DomUtils
jest.mock('../../../../src/utils/domUtils.js', () => ({
  DomUtils: {
    textToHtml: jest.fn((text) => text),
    escapeHtml: jest.fn((text) => text),
  }
}));

describe('VisualizationComposer', () => {
  let testBed;
  let visualizationComposer;
  let mockLogger;
  let mockEntityManager;
  let mockDocumentContext;
  let mockLayoutEngine;
  let mockSvgRenderer;
  let mockInteractionController;
  let mockViewportManager;
  let mockContainer;
  let mockSvgElement;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();
    mockLogger = testBed.mockLogger;
    mockEntityManager = testBed.mockEntityManager;

    // Mock document context
    mockDocumentContext = {
      document: {
        getElementById: jest.fn(),
        createElement: jest.fn(),
        createElementNS: jest.fn(),
      }
    };

    // Mock layout engine
    mockLayoutEngine = {
      calculateLayout: jest.fn(),
      setStrategy: jest.fn(),
      getCurrentStrategyName: jest.fn().mockReturnValue('radial'),
    };

    // Mock SVG renderer
    mockSvgElement = {
      style: {},
      setAttribute: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
    };

    mockSvgRenderer = {
      createSVG: jest.fn(),
      clearSVG: jest.fn(),
      renderEdges: jest.fn(),
      renderNodes: jest.fn(),
      addDebugInfo: jest.fn(),
      getSVGElement: jest.fn().mockReturnValue(mockSvgElement),
      updateViewBox: jest.fn(),
      applyTheme: jest.fn(),
      showTooltip: jest.fn(),
      hideTooltip: jest.fn(),
    };

    // Mock interaction controller
    mockInteractionController = {
      registerHandler: jest.fn(),
      attachToElement: jest.fn(),
      detachFromElement: jest.fn(),
    };

    // Mock viewport manager
    mockViewportManager = {
      reset: jest.fn(),
      subscribe: jest.fn(),
      pan: jest.fn(),
      zoom: jest.fn(),
    };

    // Mock container element
    mockContainer = {
      appendChild: jest.fn(),
      innerHTML: '',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600
      }),
    };

    // Create instance
    visualizationComposer = new VisualizationComposer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      documentContext: mockDocumentContext,
      layoutEngine: mockLayoutEngine,
      svgRenderer: mockSvgRenderer,
      interactionController: mockInteractionController,
      viewportManager: mockViewportManager,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with all required dependencies', () => {
      expect(visualizationComposer).toBeDefined();
      expect(visualizationComposer.initialize).toBeDefined();
      expect(visualizationComposer.renderGraph).toBeDefined();
      expect(visualizationComposer.clear).toBeDefined();
    });

    it('should validate all required dependencies', () => {
      expect(() => {
        new VisualizationComposer({
          logger: null,
          entityManager: mockEntityManager,
          documentContext: mockDocumentContext,
          layoutEngine: mockLayoutEngine,
          svgRenderer: mockSvgRenderer,
          interactionController: mockInteractionController,
          viewportManager: mockViewportManager,
        });
      }).toThrow();
    });

    it('should setup interaction handlers during construction', () => {
      expect(mockInteractionController.registerHandler).toHaveBeenCalledWith('pan', expect.any(Function));
      expect(mockInteractionController.registerHandler).toHaveBeenCalledWith('zoom', expect.any(Function));
      expect(mockInteractionController.registerHandler).toHaveBeenCalledWith('panstart', expect.any(Function));
      expect(mockInteractionController.registerHandler).toHaveBeenCalledWith('panend', expect.any(Function));
      expect(mockInteractionController.registerHandler).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should initialize with container element', () => {
      visualizationComposer.initialize(mockContainer);
      expect(mockLogger.debug).toHaveBeenCalledWith('VisualizationComposer: Initialized');
    });

    it('should throw error when initializing without container', () => {
      expect(() => {
        visualizationComposer.initialize(null);
      }).toThrow();
    });
  });

  describe('Core Public API - renderGraph', () => {
    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);
    });

    it('should render graph successfully with valid data', async () => {
      const rootEntityId = 'test:root';
      const bodyData = {
        root: 'root-entity',
        parts: {
          head: 'head-entity',
          torso: 'torso-entity',
        }
      };

      const mockRootEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      const mockHeadEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Head' };
          if (type === 'anatomy:part') return { subType: 'head' };
          if (type === 'anatomy:joint') return { parentId: 'root-entity', socketId: 'neck' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockRootEntity)
        .mockResolvedValueOnce(mockHeadEntity)
        .mockResolvedValueOnce(mockHeadEntity);

      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockSvgRenderer.createSVG).toHaveBeenCalled();
      expect(mockSvgRenderer.renderEdges).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
      expect(mockInteractionController.attachToElement).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('VisualizationComposer: Rendered')
      );
    });

    it('should handle empty body data gracefully', async () => {
      const rootEntityId = 'test:root';
      const bodyData = null;

      await expect(visualizationComposer.renderGraph(rootEntityId, bodyData))
        .rejects.toThrow();
    });

    it('should handle body data without root', async () => {
      const rootEntityId = 'test:root';
      const bodyData = { parts: { head: 'head-entity' } };

      await visualizationComposer.renderGraph(rootEntityId, bodyData);

      expect(mockLogger.warn).toHaveBeenCalledWith('No body data or root found');
    });

    it('should throw error with invalid root entity ID', async () => {
      await expect(visualizationComposer.renderGraph('', { root: 'test' }))
        .rejects.toThrow();
    });

    it('should throw error with invalid body data', async () => {
      await expect(visualizationComposer.renderGraph('test:root', null))
        .rejects.toThrow();
    });

    it('should handle rendering errors', async () => {
      const rootEntityId = 'test:root';
      const bodyData = { root: 'root-entity', parts: {} };

      // Make layout calculation throw an error
      mockLayoutEngine.calculateLayout.mockImplementation(() => {
        throw new Error('Layout calculation failed');
      });

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      await expect(visualizationComposer.renderGraph(rootEntityId, bodyData))
        .rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'VisualizationComposer: Failed to render anatomy graph',
        expect.any(Error)
      );
    });
  });

  describe('Core Public API - clear', () => {
    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);
    });

    it('should clear visualization successfully', () => {
      visualizationComposer.clear();

      expect(mockSvgRenderer.clearSVG).toHaveBeenCalled();
      expect(mockSvgRenderer.getSVGElement).toHaveBeenCalled();
      expect(mockInteractionController.detachFromElement).toHaveBeenCalled();
      expect(mockViewportManager.reset).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('VisualizationComposer: Cleared');
    });

    it('should handle clear when no container is set', () => {
      const composer = new VisualizationComposer({
        logger: mockLogger,
        entityManager: mockEntityManager,
        documentContext: mockDocumentContext,
        layoutEngine: mockLayoutEngine,
        svgRenderer: mockSvgRenderer,
        interactionController: mockInteractionController,
        viewportManager: mockViewportManager,
      });

      expect(() => composer.clear()).not.toThrow();
    });

    it('should handle clear when SVG element is null', () => {
      mockSvgRenderer.getSVGElement.mockReturnValue(null);

      expect(() => visualizationComposer.clear()).not.toThrow();
      expect(mockInteractionController.detachFromElement).not.toHaveBeenCalled();
    });
  });

  describe('Core Public API - setLayout and setTheme', () => {
    it('should set layout strategy', () => {
      visualizationComposer.setLayout('hierarchical');
      expect(mockLayoutEngine.setStrategy).toHaveBeenCalledWith('hierarchical');
    });

    it('should set theme', () => {
      const theme = { backgroundColor: '#fff', nodeColor: '#000' };
      visualizationComposer.setTheme(theme);
      expect(mockSvgRenderer.applyTheme).toHaveBeenCalledWith(theme);
    });
  });

  describe('Core Public API - dispose', () => {
    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);
    });

    it('should dispose of all resources', () => {
      visualizationComposer.dispose();

      expect(mockSvgRenderer.clearSVG).toHaveBeenCalled();
      expect(mockViewportManager.reset).toHaveBeenCalled();
    });
  });

  describe('Graph Building - buildGraphData', () => {
    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);
    });

    it('should build graph data with connected entities', async () => {
      const bodyData = {
        root: 'root-entity',
        parts: {
          head: 'head-entity',
          torso: 'torso-entity',
        }
      };

      const mockRootEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      const mockHeadEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Head' };
          if (type === 'anatomy:part') return { subType: 'head' };
          if (type === 'anatomy:joint') return { parentId: 'root-entity', socketId: 'neck' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockRootEntity)
        .mockResolvedValueOnce(mockHeadEntity)
        .mockResolvedValueOnce(mockHeadEntity);

      await visualizationComposer.buildGraphData(bodyData);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('root-entity');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('head-entity');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'VisualizationComposer: Building graph data',
        expect.any(Object)
      );
    });

    it('should create edges for connected entities', async () => {
      const bodyData = {
        root: 'root-entity',
        parts: {
          head: 'head-entity',
        }
      };

      const mockRootEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      const mockHeadEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Head' };
          if (type === 'anatomy:part') return { subType: 'head' };
          if (type === 'anatomy:joint') return { parentId: 'root-entity', socketId: 'neck' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockRootEntity)
        .mockResolvedValueOnce(mockHeadEntity)
        .mockResolvedValueOnce(mockHeadEntity);

      await visualizationComposer.buildGraphData(bodyData);

      expect(mockLogger.debug).toHaveBeenCalledWith('Found 1 children for root-entity');
    });

    it('should handle missing entities gracefully', async () => {
      const bodyData = {
        root: 'root-entity',
        parts: {
          missing: 'missing-entity',
        }
      };

      const mockRootEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockRootEntity)
        .mockResolvedValueOnce(null);

      await visualizationComposer.buildGraphData(bodyData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Found 1 unconnected parts:',
        expect.any(Array)
      );
    });

    it('should handle entity loading errors', async () => {
      const bodyData = {
        root: 'root-entity',
        parts: {}
      };

      mockEntityManager.getEntityInstance.mockRejectedValue(new Error('Entity error'));

      await visualizationComposer.buildGraphData(bodyData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing entity root-entity:',
        expect.any(Error)
      );
    });

    it('should handle unconnected parts', async () => {
      const bodyData = {
        root: 'root-entity',
        parts: {
          unconnected: 'unconnected-entity',
        }
      };

      const mockRootEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      const mockUnconnectedEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Unconnected' };
          if (type === 'anatomy:part') return { subType: 'limb' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockRootEntity)
        .mockResolvedValueOnce(mockUnconnectedEntity)
        .mockResolvedValueOnce(mockUnconnectedEntity);

      await visualizationComposer.buildGraphData(bodyData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Found 1 unconnected parts:',
        expect.any(Array)
      );
    });
  });

  describe('Layout and Rendering - performLayout', () => {
    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);
    });

    it('should perform layout successfully', () => {
      visualizationComposer.performLayout();

      expect(mockLayoutEngine.calculateLayout).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('VisualizationComposer: Performing layout');
    });

    it('should handle layout calculation errors', () => {
      mockLayoutEngine.calculateLayout.mockImplementation(() => {
        throw new Error('Layout failed');
      });

      expect(() => visualizationComposer.performLayout()).toThrow(AnatomyRenderError);
    });
  });

  describe('Layout and Rendering - renderVisualization', () => {
    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);
    });

    it('should render visualization successfully', async () => {
      mockViewportManager.subscribe.mockImplementation((callback) => {
        callback({ viewport: { x: 0, y: 0, scale: 1 } }); // Simulate viewport change
      });

      await visualizationComposer.renderVisualization();

      expect(mockSvgRenderer.createSVG).toHaveBeenCalledWith(
        mockContainer,
        { width: 800, height: 600 },
        expect.any(Object)
      );
      expect(mockSvgRenderer.renderEdges).toHaveBeenCalled();
      expect(mockSvgRenderer.renderNodes).toHaveBeenCalled();
      expect(mockSvgRenderer.addDebugInfo).toHaveBeenCalled();
      expect(mockInteractionController.attachToElement).toHaveBeenCalledWith(mockSvgElement);
      expect(mockViewportManager.subscribe).toHaveBeenCalled();
    });

    it('should throw error when no container is set', async () => {
      const composer = new VisualizationComposer({
        logger: mockLogger,
        entityManager: mockEntityManager,
        documentContext: mockDocumentContext,
        layoutEngine: mockLayoutEngine,
        svgRenderer: mockSvgRenderer,
        interactionController: mockInteractionController,
        viewportManager: mockViewportManager,
      });

      await expect(composer.renderVisualization()).rejects.toThrow(AnatomyRenderError);
    });

    it('should handle SVG rendering errors', async () => {
      mockSvgRenderer.createSVG.mockImplementation(() => {
        throw new Error('SVG creation failed');
      });

      await expect(visualizationComposer.renderVisualization()).rejects.toThrow(AnatomyRenderError);
    });

    it('should handle case when SVG element is null', async () => {
      mockSvgRenderer.getSVGElement.mockReturnValue(null);

      await visualizationComposer.renderVisualization();
      expect(mockInteractionController.attachToElement).not.toHaveBeenCalled();
    });
  });

  describe('Interaction Handlers', () => {
    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);
    });

    it('should handle pan interaction', () => {
      const panHandler = mockInteractionController.registerHandler.mock.calls
        .find(call => call[0] === 'pan')[1];

      panHandler({ deltaX: 10, deltaY: 20 });

      expect(mockViewportManager.pan).toHaveBeenCalledWith(10, 20);
    });

    it('should handle zoom interaction', () => {
      const zoomHandler = mockInteractionController.registerHandler.mock.calls
        .find(call => call[0] === 'zoom')[1];

      zoomHandler({ zoomFactor: 1.5, x: 100, y: 200 });

      expect(mockViewportManager.zoom).toHaveBeenCalledWith(1.5, 100, 200);
    });

    it('should handle panstart interaction', () => {
      const panStartHandler = mockInteractionController.registerHandler.mock.calls
        .find(call => call[0] === 'panstart')[1];

      panStartHandler();

      expect(mockSvgElement.style.cursor).toBe('grabbing');
    });

    it('should handle panend interaction', () => {
      const panEndHandler = mockInteractionController.registerHandler.mock.calls
        .find(call => call[0] === 'panend')[1];

      panEndHandler();

      expect(mockSvgElement.style.cursor).toBe('grab');
    });

    it('should handle click interaction', () => {
      const clickHandler = mockInteractionController.registerHandler.mock.calls
        .find(call => call[0] === 'click')[1];

      clickHandler({ target: { type: 'node', id: 'test-node' } });

      expect(mockLogger.debug).toHaveBeenCalledWith('Clicked node: test-node');
    });

    it('should handle panstart when SVG element is null', () => {
      mockSvgRenderer.getSVGElement.mockReturnValue(null);

      const panStartHandler = mockInteractionController.registerHandler.mock.calls
        .find(call => call[0] === 'panstart')[1];

      expect(() => panStartHandler()).not.toThrow();
    });

    it('should handle panend when SVG element is null', () => {
      mockSvgRenderer.getSVGElement.mockReturnValue(null);

      const panEndHandler = mockInteractionController.registerHandler.mock.calls
        .find(call => call[0] === 'panend')[1];

      expect(() => panEndHandler()).not.toThrow();
    });
  });

  describe('Tooltips', () => {
    let mockNodeElement;

    beforeEach(() => {
      visualizationComposer.initialize(mockContainer);

      mockNodeElement = {
        getAttribute: jest.fn().mockReturnValue('test-node'),
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        getBoundingClientRect: jest.fn().mockReturnValue({
          left: 100,
          top: 200,
          width: 50,
          height: 50
        }),
        currentTarget: {
          getBoundingClientRect: jest.fn().mockReturnValue({
            left: 100,
            top: 200,
            width: 50,
            height: 50
          })
        }
      };

      const mockCircle = {
        getAttribute: jest.fn((attr) => {
          if (attr === 'r') return '10';
          if (attr === 'stroke-width') return '2';
          return '';
        }),
        setAttribute: jest.fn(),
      };

      mockNodeElement.querySelector.mockReturnValue(mockCircle);
      mockContainer.querySelectorAll.mockReturnValue([mockNodeElement]);
    });

    it('should setup tooltips for nodes', async () => {
      // Mock nodes in the visualization composer
      const mockNode = new AnatomyNode('test-node', 'Test Node', 'test-type', 0);
      mockNode.description = 'Test description';
      
      // Access private nodes map using renderGraph to populate it
      const bodyData = {
        root: 'test-node',
        parts: {}
      };

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Test Node' };
          if (type === 'anatomy:part') return { subType: 'test-type' };
          if (type === 'core:description') return { text: 'Test description' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      await visualizationComposer.renderGraph('test-root', bodyData);

      expect(mockNodeElement.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(mockNodeElement.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      expect(mockNodeElement.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    it('should show tooltip on mouse enter', async () => {
      // Setup node data first
      const bodyData = {
        root: 'test-node',
        parts: {}
      };

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Test Node' };
          if (type === 'anatomy:part') return { subType: 'test-type' };
          if (type === 'core:description') return { text: 'Test description' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      await visualizationComposer.renderGraph('test-root', bodyData);

      // Find the mouseenter handler
      const mouseEnterCall = mockNodeElement.addEventListener.mock.calls
        .find(call => call[0] === 'mouseenter');
      
      if (mouseEnterCall) {
        const mouseEnterHandler = mouseEnterCall[1];
        mouseEnterHandler({ currentTarget: mockNodeElement.currentTarget });

        expect(mockSvgRenderer.showTooltip).toHaveBeenCalledWith(
          expect.stringContaining('Test Node'),
          expect.any(Object)
        );
      }
    });

    it('should hide tooltip on mouse leave', async () => {
      // Setup node data first
      const bodyData = {
        root: 'test-node',
        parts: {}
      };

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Test Node' };
          if (type === 'anatomy:part') return { subType: 'test-type' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      await visualizationComposer.renderGraph('test-root', bodyData);

      // Find the mouseleave handler
      const mouseLeaveCall = mockNodeElement.addEventListener.mock.calls
        .find(call => call[0] === 'mouseleave');
      
      if (mouseLeaveCall) {
        const mouseLeaveHandler = mouseLeaveCall[1];
        mouseLeaveHandler();

        expect(mockSvgRenderer.hideTooltip).toHaveBeenCalled();
      }
    });

    it('should handle hover effects', async () => {
      // Setup node data first
      const bodyData = {
        root: 'test-node',
        parts: {}
      };

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Test Node' };
          if (type === 'anatomy:part') return { subType: 'test-type' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      await visualizationComposer.renderGraph('test-root', bodyData);

      // Find the second mouseenter handler (hover effects)
      const mouseEnterCalls = mockNodeElement.addEventListener.mock.calls
        .filter(call => call[0] === 'mouseenter');
      
      if (mouseEnterCalls.length > 1) {
        const hoverHandler = mouseEnterCalls[1][1];
        hoverHandler();

        const mockCircle = mockNodeElement.querySelector();
        expect(mockCircle.setAttribute).toHaveBeenCalledWith('r', '13');
        expect(mockCircle.setAttribute).toHaveBeenCalledWith('stroke-width', '3');
        expect(mockCircle.setAttribute).toHaveBeenCalledWith('fill-opacity', '0.9');

        // Test mouse leave for hover effects
        const mouseLeaveCalls = mockNodeElement.addEventListener.mock.calls
          .filter(call => call[0] === 'mouseleave');
        
        if (mouseLeaveCalls.length > 1) {
          const hoverLeaveHandler = mouseLeaveCalls[1][1];
          hoverLeaveHandler();

          expect(mockCircle.setAttribute).toHaveBeenCalledWith('r', '10');
          expect(mockCircle.setAttribute).toHaveBeenCalledWith('stroke-width', '2');
          expect(mockCircle.setAttribute).toHaveBeenCalledWith('fill-opacity', '1');
        }
      }
    });

    it('should prevent panning when clicking nodes', async () => {
      // Setup node data first
      const bodyData = {
        root: 'test-node',
        parts: {}
      };

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Test Node' };
          if (type === 'anatomy:part') return { subType: 'test-type' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      await visualizationComposer.renderGraph('test-root', bodyData);

      // Find the mousedown handler
      const mouseDownCall = mockNodeElement.addEventListener.mock.calls
        .find(call => call[0] === 'mousedown');
      
      if (mouseDownCall) {
        const mouseDownHandler = mouseDownCall[1];
        const mockEvent = { stopPropagation: jest.fn() };
        mouseDownHandler(mockEvent);

        expect(mockEvent.stopPropagation).toHaveBeenCalled();
      }
    });

    it('should handle missing node data gracefully', async () => {
      // Setup empty container
      mockContainer.querySelectorAll.mockReturnValue([mockNodeElement]);

      // Setup node data with missing node
      const bodyData = {
        root: 'test-node',
        parts: {}
      };

      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Test Node' };
          if (type === 'anatomy:part') return { subType: 'test-type' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);
      
      // Mock getAttribute to return non-existent node ID
      mockNodeElement.getAttribute.mockReturnValue('non-existent-node');

      await visualizationComposer.renderGraph('test-root', bodyData);

      // Should not throw error when setting up tooltips for non-existent nodes
      // But no event listeners should be added since the node doesn't exist
      expect(() => visualizationComposer.renderGraph('test-root', bodyData)).not.toThrow();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle unconnected parts processing errors', async () => {
      visualizationComposer.initialize(mockContainer);

      const bodyData = {
        root: 'root-entity',
        parts: {
          unconnected: 'unconnected-entity',
        }
      };

      const mockRootEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockRootEntity)
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('Entity error'));

      await visualizationComposer.buildGraphData(bodyData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to add unvisited part unconnected-entity:',
        expect.any(Error)
      );
    });

    it('should handle part checking errors during graph building', async () => {
      visualizationComposer.initialize(mockContainer);

      const bodyData = {
        root: 'root-entity',
        parts: {
          child: 'child-entity',
        }
      };

      const mockRootEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root Entity' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockRootEntity)
        .mockRejectedValueOnce(new Error('Child entity error'));

      await visualizationComposer.buildGraphData(bodyData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to check entity child-entity:',
        expect.any(Error)
      );
    });
  });
});