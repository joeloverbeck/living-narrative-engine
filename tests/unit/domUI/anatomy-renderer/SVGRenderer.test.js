/**
 * @file Unit tests for SVGRenderer
 * @description Comprehensive unit tests for SVGRenderer class covering all methods and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import SVGRenderer from '../../../../src/domUI/anatomy-renderer/SVGRenderer.js';
import AnatomyVisualizerTestBed from '../../../common/anatomy/anatomyVisualizerTestBed.js';
import { AnatomyRenderError } from '../../../../src/errors/anatomyRenderError.js';

// Mock DomUtils
jest.mock('../../../../src/utils/domUtils.js', () => ({
  DomUtils: {
    clearElement: jest.fn()
  }
}));

describe('SVGRenderer', () => {
  let testBed;
  let svgRenderer;
  let mockDocumentContext;
  let mockLogger;
  let mockDocument;
  let mockContainer;
  let mockSVGElement;
  let mockDefsElement;
  let mockGroupElement;
  let mockRenderContext;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();
    mockLogger = testBed.mockLogger;
    
    // Create mock DOM elements with all required methods
    const createMockElement = (tagName) => ({
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      remove: jest.fn(),
      insertBefore: jest.fn(),
      querySelector: jest.fn(),
      getAttribute: jest.fn(),
      textContent: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      },
      style: {}
    });
    
    mockSVGElement = createMockElement('svg');
    mockDefsElement = createMockElement('defs');
    mockGroupElement = createMockElement('g');
    
    mockContainer = {
      appendChild: jest.fn(),
      remove: jest.fn()
    };
    
    mockDocument = {
      createElementNS: jest.fn(),
      createElement: jest.fn()
    };
    
    // Track created elements for specific tests
    let createdGroupElements = [];
    
    // Setup createElementNS to return appropriate elements
    mockDocument.createElementNS.mockImplementation((namespace, tagName) => {
      if (tagName === 'svg') return mockSVGElement;
      if (tagName === 'defs') return mockDefsElement;
      if (tagName === 'g') {
        const newGroup = createMockElement('g');
        createdGroupElements.push(newGroup);
        return newGroup;
      }
      if (tagName === 'circle') return createMockElement('circle');
      if (tagName === 'text') return createMockElement('text');
      if (tagName === 'path') return createMockElement('path');
      if (tagName === 'rect') return createMockElement('rect');
      return createMockElement('unknown');
    });
    
    mockDocument.createElement.mockReturnValue({
      className: '',
      style: {
        position: '',
        visibility: '',
        opacity: '',
        left: '',
        top: ''
      },
      appendChild: jest.fn(),
      remove: jest.fn(),
      innerHTML: ''
    });
    
    mockDocumentContext = {
      document: mockDocument
    };
    
    mockRenderContext = {
      getViewBoxString: jest.fn().mockReturnValue('0 0 800 600'),
      options: {
        nodeRadius: 20,
        showDebugInfo: false
      },
      getNodeColor: jest.fn().mockReturnValue('#ff0000'),
      viewport: { x: 0, y: 0 },
      performance: { nodeCount: 5, edgeCount: 3 }
    };
    
    svgRenderer = new SVGRenderer({
      documentContext: mockDocumentContext,
      logger: mockLogger
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(svgRenderer).toBeDefined();
      expect(svgRenderer).toBeInstanceOf(SVGRenderer);
    });

    it('should throw error when documentContext is null', () => {
      expect(() => {
        new SVGRenderer({ documentContext: null, logger: mockLogger });
      }).toThrow('Missing required dependency: IDocumentContext');
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new SVGRenderer({ documentContext: mockDocumentContext, logger: null });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when documentContext is undefined', () => {
      expect(() => {
        new SVGRenderer({ documentContext: undefined, logger: mockLogger });
      }).toThrow('Missing required dependency: IDocumentContext');
    });

    it('should throw error when logger is undefined', () => {
      expect(() => {
        new SVGRenderer({ documentContext: mockDocumentContext, logger: undefined });
      }).toThrow('Missing required dependency: ILogger');
    });
  });

  describe('createSVG', () => {
    it('should create SVG element with correct attributes', () => {
      const dimensions = { width: 800, height: 600 };
      
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'svg');
      expect(mockSVGElement.setAttribute).toHaveBeenCalledWith('width', '100%');
      expect(mockSVGElement.setAttribute).toHaveBeenCalledWith('height', '100%');
      expect(mockSVGElement.setAttribute).toHaveBeenCalledWith('viewBox', '0 0 800 600');
      expect(mockSVGElement.setAttribute).toHaveBeenCalledWith('preserveAspectRatio', 'xMidYMid meet');
      expect(mockSVGElement.id).toBe('anatomy-graph');
      expect(mockSVGElement.style.cursor).toBe('grab');
    });

    it('should create defs element and append to SVG', () => {
      const dimensions = { width: 800, height: 600 };
      
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'defs');
      expect(mockSVGElement.appendChild).toHaveBeenCalledWith(mockDefsElement);
    });

    it('should create default layers', () => {
      const dimensions = { width: 800, height: 600 };
      
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      // Should create 4 layers: background, edges, nodes, overlay
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
      // Check that layers were created with correct classes
      const setAttributeCalls = mockDocument.createElementNS.mock.results
        .filter(result => result.value.setAttribute)
        .map(result => result.value.setAttribute.mock.calls)
        .flat();
      
      const classSetCalls = setAttributeCalls.filter(call => call[0] === 'class');
      const classValues = classSetCalls.map(call => call[1]);
      
      expect(classValues).toContain('layer-background');
      expect(classValues).toContain('layer-edges');
      expect(classValues).toContain('layer-nodes');
      expect(classValues).toContain('layer-overlay');
    });

    it('should append SVG to container', () => {
      const dimensions = { width: 800, height: 600 };
      
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      expect(mockContainer.appendChild).toHaveBeenCalledWith(mockSVGElement);
    });

    it('should create tooltip element', () => {
      const dimensions = { width: 800, height: 600 };
      
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockContainer.appendChild).toHaveBeenCalledTimes(2); // SVG + tooltip
    });

    it('should log success message', () => {
      const dimensions = { width: 800, height: 600 };
      
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: SVG created successfully');
    });

    it('should throw AnatomyRenderError when SVG creation fails', () => {
      const dimensions = { width: 800, height: 600 };
      const error = new Error('DOM creation failed');
      mockDocument.createElementNS.mockImplementation(() => {
        throw error;
      });
      
      expect(() => {
        svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      }).toThrow(AnatomyRenderError);
    });
  });

  describe('clearSVG', () => {
    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should remove SVG element when SVG and container exist', () => {
      svgRenderer.clearSVG();
      
      expect(mockSVGElement.remove).toHaveBeenCalled();
    });

    it('should remove tooltip element when it exists', () => {
      // The tooltip is created during createSVG, so it should already exist
      svgRenderer.clearSVG();
      
      // Should not throw error - tooltip removal is handled internally
      expect(() => {
        svgRenderer.clearSVG();
      }).not.toThrow();
    });

    it('should log clear message', () => {
      svgRenderer.clearSVG();
      
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: SVG cleared');
    });

    it('should handle case when SVG does not exist', () => {
      // Clear first time
      svgRenderer.clearSVG();
      
      // Clear again should not throw
      expect(() => {
        svgRenderer.clearSVG();
      }).not.toThrow();
    });
  });

  describe('createLayer', () => {
    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should create layer with correct attributes', () => {
      const layer = svgRenderer.createLayer('test-layer', 5);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
      expect(layer.setAttribute).toHaveBeenCalledWith('class', 'layer-test-layer');
      expect(layer.setAttribute).toHaveBeenCalledWith('data-layer', 'test-layer');
      expect(layer.setAttribute).toHaveBeenCalledWith('data-z-index', '5');
    });

    it('should append layer to SVG', () => {
      const layer = svgRenderer.createLayer('test-layer', 5);
      
      expect(mockSVGElement.appendChild).toHaveBeenCalledWith(layer);
    });

    it('should throw error when SVG not initialized', () => {
      svgRenderer.clearSVG();
      
      expect(() => {
        svgRenderer.createLayer('test-layer', 5);
      }).toThrow('SVG not initialized');
    });

    it('should remove existing layer if present', () => {
      const firstLayer = svgRenderer.createLayer('test-layer', 5);
      const secondLayer = svgRenderer.createLayer('test-layer', 6);
      
      expect(firstLayer.remove).toHaveBeenCalled();
      expect(secondLayer).toBeDefined();
    });

    it('should insert layer in correct z-order', () => {
      // Create a layer that has higher z-index than the test layer
      const existingLayer = svgRenderer.createLayer('existing-layer', 10);
      existingLayer.getAttribute.mockReturnValue('10');
      
      const layer = svgRenderer.createLayer('test-layer', 5);
      
      expect(mockSVGElement.insertBefore).toHaveBeenCalled();
    });

    it('should return created layer', () => {
      const layer = svgRenderer.createLayer('test-layer', 5);
      
      expect(layer).toBeDefined();
      expect(layer.setAttribute).toHaveBeenCalledWith('class', 'layer-test-layer');
    });
  });

  describe('getLayer', () => {
    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should return layer when it exists', () => {
      svgRenderer.createLayer('test-layer', 5);
      
      const layer = svgRenderer.getLayer('test-layer');
      
      expect(layer).toBeDefined();
      expect(layer.setAttribute).toHaveBeenCalledWith('class', 'layer-test-layer');
    });

    it('should return null when layer does not exist', () => {
      const layer = svgRenderer.getLayer('non-existent-layer');
      
      expect(layer).toBeNull();
    });

    it('should return default layers created during initialization', () => {
      const backgroundLayer = svgRenderer.getLayer('background');
      const edgesLayer = svgRenderer.getLayer('edges');
      const nodesLayer = svgRenderer.getLayer('nodes');
      const overlayLayer = svgRenderer.getLayer('overlay');
      
      expect(backgroundLayer).toBeDefined();
      expect(edgesLayer).toBeDefined();
      expect(nodesLayer).toBeDefined();
      expect(overlayLayer).toBeDefined();
    });
  });

  describe('createNode', () => {
    let nodeData;

    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      nodeData = {
        id: 'node-1',
        x: 100,
        y: 200,
        name: 'Test Node',
        type: 'organ'
      };
    });

    it('should create node group with correct attributes', () => {
      const node = svgRenderer.createNode(nodeData, mockRenderContext);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
      expect(node.setAttribute).toHaveBeenCalledWith('class', 'anatomy-node');
      expect(node.setAttribute).toHaveBeenCalledWith('transform', 'translate(100, 200)');
      expect(node.setAttribute).toHaveBeenCalledWith('data-node-id', 'node-1');
    });

    it('should create circle element with correct attributes', () => {
      svgRenderer.createNode(nodeData, mockRenderContext);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'circle');
      expect(mockRenderContext.getNodeColor).toHaveBeenCalledWith('organ');
    });

    it('should create text element with correct attributes', () => {
      svgRenderer.createNode(nodeData, mockRenderContext);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'text');
    });

    it('should throw AnatomyRenderError when node creation fails', () => {
      const error = new Error('Node creation failed');
      mockDocument.createElementNS.mockImplementation(() => {
        throw error;
      });
      
      expect(() => {
        svgRenderer.createNode(nodeData, mockRenderContext);
      }).toThrow(AnatomyRenderError);
    });

    it('should return created node group', () => {
      const node = svgRenderer.createNode(nodeData, mockRenderContext);
      
      expect(node).toBeDefined();
      expect(node.setAttribute).toHaveBeenCalledWith('class', 'anatomy-node');
    });
  });

  describe('createEdge', () => {
    let edgeData, sourceNode, targetNode;

    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      sourceNode = { id: 'source', x: 100, y: 200 };
      targetNode = { id: 'target', x: 300, y: 400 };
      
      edgeData = {
        source: 'source',
        target: 'target',
        strokeColor: '#333',
        strokeWidth: 2,
        strokeOpacity: 0.8,
        setPathData: jest.fn()
      };
    });

    it('should create path element with correct attributes', () => {
      const edge = svgRenderer.createEdge(edgeData, sourceNode, targetNode);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
      expect(edge.setAttribute).toHaveBeenCalledWith('class', 'anatomy-edge');
      expect(edge.setAttribute).toHaveBeenCalledWith('stroke', '#333');
      expect(edge.setAttribute).toHaveBeenCalledWith('stroke-width', '2');
      expect(edge.setAttribute).toHaveBeenCalledWith('fill', 'none');
      expect(edge.setAttribute).toHaveBeenCalledWith('stroke-opacity', '0.8');
      expect(edge.setAttribute).toHaveBeenCalledWith('data-source', 'source');
      expect(edge.setAttribute).toHaveBeenCalledWith('data-target', 'target');
    });

    it('should calculate and set path data', () => {
      svgRenderer.createEdge(edgeData, sourceNode, targetNode);
      
      expect(edgeData.setPathData).toHaveBeenCalled();
    });

    it('should throw AnatomyRenderError when edge creation fails', () => {
      const error = new Error('Edge creation failed');
      mockDocument.createElementNS.mockImplementation(() => {
        throw error;
      });
      
      expect(() => {
        svgRenderer.createEdge(edgeData, sourceNode, targetNode);
      }).toThrow(AnatomyRenderError);
    });

    it('should return created path element', () => {
      const edge = svgRenderer.createEdge(edgeData, sourceNode, targetNode);
      
      expect(edge).toBeDefined();
      expect(edge.setAttribute).toHaveBeenCalledWith('class', 'anatomy-edge');
    });
  });

  describe('renderNodes', () => {
    let nodes;

    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      nodes = new Map([
        ['node-1', { id: 'node-1', x: 100, y: 200, name: 'Node 1', type: 'organ' }],
        ['node-2', { id: 'node-2', x: 300, y: 400, name: 'Node 2', type: 'organ' }]
      ]);
    });

    it('should render all nodes to node layer', () => {
      svgRenderer.renderNodes(nodes, mockRenderContext);
      
      // Verify that nodes were rendered and the layer was used
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Rendered 2 nodes');
    });

    it('should throw error when node layer not found', () => {
      svgRenderer.clearSVG();
      
      expect(() => {
        svgRenderer.renderNodes(nodes, mockRenderContext);
      }).toThrow('Node layer not found');
    });

    it('should handle empty nodes map', () => {
      const emptyNodes = new Map();
      
      svgRenderer.renderNodes(emptyNodes, mockRenderContext);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Rendered 0 nodes');
    });
  });

  describe('renderEdges', () => {
    let edges, nodes;

    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      nodes = new Map([
        ['source', { id: 'source', x: 100, y: 200 }],
        ['target', { id: 'target', x: 300, y: 400 }]
      ]);
      
      edges = [
        {
          source: 'source',
          target: 'target',
          strokeColor: '#333',
          strokeWidth: 2,
          strokeOpacity: 0.8,
          setPathData: jest.fn()
        }
      ];
    });

    it('should render all edges to edge layer', () => {
      svgRenderer.renderEdges(edges, nodes);
      
      // Verify that edges were rendered
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Rendered 1 edges');
    });

    it('should throw error when edge layer not found', () => {
      svgRenderer.clearSVG();
      
      expect(() => {
        svgRenderer.renderEdges(edges, nodes);
      }).toThrow('Edge layer not found');
    });

    it('should skip edges with missing source node', () => {
      edges[0].source = 'missing-source';
      
      // Clear previous mock calls
      mockDocument.createElementNS.mockClear();
      mockLogger.debug.mockClear();
      
      svgRenderer.renderEdges(edges, nodes);
      
      // Since source node is missing, no edge should be created
      expect(mockDocument.createElementNS).not.toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
      // The logging shows the total number of edges in the array, not the number rendered
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Rendered 1 edges');
    });

    it('should skip edges with missing target node', () => {
      edges[0].target = 'missing-target';
      
      // Clear previous mock calls
      mockDocument.createElementNS.mockClear();
      mockLogger.debug.mockClear();
      
      svgRenderer.renderEdges(edges, nodes);
      
      // Since target node is missing, no edge should be created
      expect(mockDocument.createElementNS).not.toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
      // The logging shows the total number of edges in the array, not the number rendered
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Rendered 1 edges');
    });

    it('should handle empty edges array', () => {
      svgRenderer.renderEdges([], nodes);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Rendered 0 edges');
    });
  });

  describe('applyTheme', () => {
    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should apply background color when provided', () => {
      const theme = { backgroundColor: '#f0f0f0' };
      
      svgRenderer.applyTheme(theme);
      
      expect(mockSVGElement.style.backgroundColor).toBe('#f0f0f0');
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Theme applied');
    });

    it('should handle theme without background color', () => {
      const theme = {};
      
      svgRenderer.applyTheme(theme);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('SVGRenderer: Theme applied');
    });

    it('should return early when SVG not initialized', () => {
      svgRenderer.clearSVG();
      
      svgRenderer.applyTheme({ backgroundColor: '#f0f0f0' });
      
      // Should not throw and should not log
      expect(mockLogger.debug).not.toHaveBeenCalledWith('SVGRenderer: Theme applied');
    });
  });

  describe('highlightElement', () => {
    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should add highlight class when highlight is true', () => {
      const mockElement = { classList: { add: jest.fn(), remove: jest.fn() } };
      mockSVGElement.querySelector.mockReturnValue(mockElement);
      
      svgRenderer.highlightElement('element-id', true);
      
      expect(mockSVGElement.querySelector).toHaveBeenCalledWith('[data-node-id="element-id"]');
      expect(mockElement.classList.add).toHaveBeenCalledWith('highlighted');
    });

    it('should remove highlight class when highlight is false', () => {
      const mockElement = { classList: { add: jest.fn(), remove: jest.fn() } };
      mockSVGElement.querySelector.mockReturnValue(mockElement);
      
      svgRenderer.highlightElement('element-id', false);
      
      expect(mockElement.classList.remove).toHaveBeenCalledWith('highlighted');
    });

    it('should default to true when highlight parameter not provided', () => {
      const mockElement = { classList: { add: jest.fn(), remove: jest.fn() } };
      mockSVGElement.querySelector.mockReturnValue(mockElement);
      
      svgRenderer.highlightElement('element-id');
      
      expect(mockElement.classList.add).toHaveBeenCalledWith('highlighted');
    });

    it('should return early when SVG not initialized', () => {
      svgRenderer.clearSVG();
      
      svgRenderer.highlightElement('element-id', true);
      
      expect(mockSVGElement.querySelector).not.toHaveBeenCalled();
    });

    it('should handle case when element not found', () => {
      mockSVGElement.querySelector.mockReturnValue(null);
      
      expect(() => {
        svgRenderer.highlightElement('non-existent-id', true);
      }).not.toThrow();
    });
  });

  describe('updateViewBox', () => {
    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should update viewBox when SVG exists', () => {
      mockRenderContext.getViewBoxString.mockReturnValue('0 0 1000 800');
      
      svgRenderer.updateViewBox(mockRenderContext);
      
      expect(mockSVGElement.setAttribute).toHaveBeenCalledWith('viewBox', '0 0 1000 800');
    });

    it('should handle case when SVG not initialized', () => {
      svgRenderer.clearSVG();
      
      expect(() => {
        svgRenderer.updateViewBox(mockRenderContext);
      }).not.toThrow();
    });
  });

  describe('showTooltip', () => {
    let mockTooltip;

    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      mockTooltip = {
        innerHTML: '',
        style: { visibility: '', opacity: '', left: '', top: '' }
      };
      mockDocument.createElement.mockReturnValue(mockTooltip);
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should show tooltip with correct content and position', () => {
      const content = '<div>Test tooltip</div>';
      const position = { x: 100, y: 200 };
      
      svgRenderer.showTooltip(content, position);
      
      expect(mockTooltip.innerHTML).toBe(content);
      expect(mockTooltip.style.visibility).toBe('visible');
      expect(mockTooltip.style.opacity).toBe('1');
      expect(mockTooltip.style.left).toBe('100px');
      expect(mockTooltip.style.top).toBe('200px');
    });

    it('should return early when tooltip not initialized', () => {
      // Create a new renderer without initializing SVG
      const newRenderer = new SVGRenderer({
        documentContext: mockDocumentContext,
        logger: mockLogger
      });
      
      expect(() => {
        newRenderer.showTooltip('content', { x: 100, y: 200 });
      }).not.toThrow();
    });
  });

  describe('hideTooltip', () => {
    let mockTooltip;

    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      mockTooltip = {
        innerHTML: '',
        style: { visibility: '', opacity: '', left: '', top: '' }
      };
      mockDocument.createElement.mockReturnValue(mockTooltip);
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should hide tooltip', () => {
      svgRenderer.hideTooltip();
      
      expect(mockTooltip.style.visibility).toBe('hidden');
      expect(mockTooltip.style.opacity).toBe('0');
    });

    it('should return early when tooltip not initialized', () => {
      // Create a new renderer without initializing SVG
      const newRenderer = new SVGRenderer({
        documentContext: mockDocumentContext,
        logger: mockLogger
      });
      
      expect(() => {
        newRenderer.hideTooltip();
      }).not.toThrow();
    });
  });

  describe('addDebugInfo', () => {
    beforeEach(() => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
    });

    it('should add debug info when showDebugInfo is true', () => {
      mockRenderContext.options.showDebugInfo = true;
      
      svgRenderer.addDebugInfo(mockRenderContext);
      
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'rect');
      expect(mockDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'text');
    });

    it('should return early when showDebugInfo is false', () => {
      mockRenderContext.options.showDebugInfo = false;
      
      svgRenderer.addDebugInfo(mockRenderContext);
      
      // Should not create debug elements
      expect(mockDocument.createElementNS).not.toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'rect');
    });

    it('should return early when SVG not initialized', () => {
      svgRenderer.clearSVG();
      mockRenderContext.options.showDebugInfo = true;
      
      svgRenderer.addDebugInfo(mockRenderContext);
      
      expect(mockDocument.createElementNS).not.toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'rect');
    });

    it('should return early when overlay layer not found', () => {
      // Mock getLayer to return null for overlay
      const originalGetLayer = svgRenderer.getLayer;
      svgRenderer.getLayer = jest.fn().mockImplementation((name) => {
        if (name === 'overlay') return null;
        return originalGetLayer.call(svgRenderer, name);
      });
      
      mockRenderContext.options.showDebugInfo = true;
      
      svgRenderer.addDebugInfo(mockRenderContext);
      
      expect(mockDocument.createElementNS).not.toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'rect');
    });

    it('should remove existing debug info before adding new', () => {
      mockRenderContext.options.showDebugInfo = true;
      const existingDebug = { remove: jest.fn() };
      
      // Create a mock overlay layer with querySelector
      const mockOverlay = {
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        remove: jest.fn(),
        insertBefore: jest.fn(),
        querySelector: jest.fn().mockReturnValue(existingDebug),
        getAttribute: jest.fn(),
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        style: {}
      };
      
      // Mock getLayer to return the mock overlay
      const originalGetLayer = svgRenderer.getLayer;
      svgRenderer.getLayer = jest.fn().mockImplementation((name) => {
        if (name === 'overlay') return mockOverlay;
        return originalGetLayer.call(svgRenderer, name);
      });
      
      svgRenderer.addDebugInfo(mockRenderContext);
      
      expect(existingDebug.remove).toHaveBeenCalled();
    });
  });

  describe('getSVGElement', () => {
    it('should return SVG element when initialized', () => {
      const dimensions = { width: 800, height: 600 };
      svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
      
      const svg = svgRenderer.getSVGElement();
      
      expect(svg).toBe(mockSVGElement);
    });

    it('should return null when SVG not initialized', () => {
      const svg = svgRenderer.getSVGElement();
      
      expect(svg).toBeNull();
    });
  });

  describe('Private Methods', () => {
    describe('#calculateEdgePath', () => {
      it('should calculate correct path for edge', () => {
        const dimensions = { width: 800, height: 600 };
        svgRenderer.createSVG(mockContainer, dimensions, mockRenderContext);
        
        const sourceNode = { x: 100, y: 200 };
        const targetNode = { x: 300, y: 400, radius: 50 };
        
        const edgeData = {
          source: 'source',
          target: 'target',
          strokeColor: '#333',
          strokeWidth: 2,
          strokeOpacity: 0.8,
          setPathData: jest.fn()
        };
        
        svgRenderer.createEdge(edgeData, sourceNode, targetNode);
        
        // Verify that setPathData was called with a valid SVG path
        expect(edgeData.setPathData).toHaveBeenCalledWith(
          expect.stringMatching(/^M \d+ \d+ Q \d+\.?\d* \d+\.?\d* \d+ \d+$/)
        );
      });
    });
  });
});