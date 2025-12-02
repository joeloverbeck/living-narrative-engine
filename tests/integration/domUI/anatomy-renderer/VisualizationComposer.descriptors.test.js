/**
 * @file Integration tests for VisualizationComposer descriptor tooltips
 * @description Tests the complete flow from entity descriptor components to tooltip display
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import VisualizationComposer from '../../../../src/domUI/anatomy-renderer/VisualizationComposer.js';
import { JSDOM } from 'jsdom';
import { DomUtils } from '../../../../src/utils/domUtils.js';

describe('VisualizationComposer - Descriptor Tooltips Integration', () => {
  let dom;
  let document;
  let container;
  let visualizationComposer;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="test-container"></div></body></html>'
    );
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.Element = dom.window.Element;
    global.SVGElement = dom.window.SVGElement;

    container = document.getElementById('test-container');

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager with proper entities
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    // Mock dependencies with real implementations where needed
    const mockDocumentContext = { document };
    const mockLayoutEngine = {
      calculateLayout: jest.fn(),
      setStrategy: jest.fn(),
      getCurrentStrategyName: jest.fn().mockReturnValue('radial'),
    };
    const mockSvgRenderer = {
      createSVG: jest.fn((container, dimensions) => {
        const svg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        );
        svg.setAttribute('id', 'anatomy-graph');
        svg.setAttribute('width', dimensions.width);
        svg.setAttribute('height', dimensions.height);
        container.appendChild(svg);
      }),
      clearSVG: jest.fn(),
      renderNodes: jest.fn((nodes) => {
        const svg = container.querySelector('svg');
        nodes.forEach((node) => {
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.classList.add('anatomy-node');
          g.setAttribute('data-node-id', node.id);

          const circle = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
          );
          circle.classList.add('node-circle');
          circle.setAttribute('r', '20');
          circle.setAttribute('stroke-width', '2');
          g.appendChild(circle);

          svg.appendChild(g);
        });
      }),
      renderEdges: jest.fn(),
      addDebugInfo: jest.fn(),
      getSVGElement: jest.fn(() => container.querySelector('svg')),
      updateViewBox: jest.fn(),
      applyTheme: jest.fn(),
      showTooltip: jest.fn((content, position) => {
        // Create real tooltip in DOM for testing
        let tooltip = container.querySelector('.anatomy-tooltip');
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.classList.add('anatomy-tooltip');
          container.appendChild(tooltip);
        }
        tooltip.innerHTML = content;
        tooltip.style.left = position.x + 'px';
        tooltip.style.top = position.y + 'px';
        tooltip.style.display = 'block';
      }),
      hideTooltip: jest.fn(() => {
        const tooltip = container.querySelector('.anatomy-tooltip');
        if (tooltip) {
          tooltip.style.display = 'none';
        }
      }),
    };
    const mockInteractionController = {
      attachToElement: jest.fn(),
      registerHandler: jest.fn(),
      dispose: jest.fn(),
    };
    const mockViewportManager = {
      subscribe: jest.fn(),
      reset: jest.fn(),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    dom.window.close();
  });

  it('should display descriptor components in tooltip when entity has descriptors', async () => {
    // Setup entity with descriptor components
    const mockEntity = {
      getComponentData: jest.fn((type) => {
        if (type === 'core:name') return { text: 'Left Breast' };
        if (type === 'core:description')
          return { text: 'A soft, large breast' };
        if (type === 'anatomy:part') return { subType: 'breast' };
        return null;
      }),
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { text: 'Left Breast' },
        'core:description': { text: 'A soft, large breast' },
        'anatomy:part': { subType: 'breast' },
        'descriptors:size_specific': { value: 'G-cup' },
        'descriptors:weight_feel': { value: 'meaty' },
        'descriptors:firmness': { value: 'soft' },
        'descriptors:projection': { value: 'prominent' },
      }),
    };

    mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

    // Initialize and build graph
    visualizationComposer.initialize(container);
    await visualizationComposer.buildGraphData({
      root: 'breast-entity',
      parts: {},
    });
    visualizationComposer.performLayout();
    await visualizationComposer.renderVisualization();

    // Find the anatomy node element
    const nodeElement = container.querySelector(
      '[data-node-id="breast-entity"]'
    );
    expect(nodeElement).toBeTruthy();

    // Simulate mouse enter to trigger tooltip
    const mouseEnterEvent = new dom.window.MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
      currentTarget: nodeElement,
    });
    nodeElement.dispatchEvent(mouseEnterEvent);

    // Check tooltip content
    const tooltip = container.querySelector('.anatomy-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip.innerHTML).toContain('Left Breast');
    expect(tooltip.innerHTML).toContain('Type: breast');
    expect(tooltip.innerHTML).toContain('A soft, large breast');
    expect(tooltip.innerHTML).toContain(
      'Descriptors: size_specific, weight_feel, firmness, projection'
    );
  });

  it('should display "none" when entity has no descriptor components', async () => {
    // Setup entity without descriptor components
    const mockEntity = {
      getComponentData: jest.fn((type) => {
        if (type === 'core:name') return { text: 'Torso' };
        if (type === 'core:description') return { text: 'The main body' };
        if (type === 'anatomy:part') return { subType: 'torso' };
        return null;
      }),
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { text: 'Torso' },
        'core:description': { text: 'The main body' },
        'anatomy:part': { subType: 'torso' },
        // No descriptor components
      }),
    };

    mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

    // Initialize and build graph
    visualizationComposer.initialize(container);
    await visualizationComposer.buildGraphData({
      root: 'torso-entity',
      parts: {},
    });
    visualizationComposer.performLayout();
    await visualizationComposer.renderVisualization();

    // Find the anatomy node element
    const nodeElement = container.querySelector(
      '[data-node-id="torso-entity"]'
    );
    expect(nodeElement).toBeTruthy();

    // Simulate mouse enter to trigger tooltip
    const mouseEnterEvent = new dom.window.MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
      currentTarget: nodeElement,
    });
    nodeElement.dispatchEvent(mouseEnterEvent);

    // Check tooltip content
    const tooltip = container.querySelector('.anatomy-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip.innerHTML).toContain('Torso');
    expect(tooltip.innerHTML).toContain('Type: torso');
    expect(tooltip.innerHTML).toContain('The main body');
    expect(tooltip.innerHTML).toContain('Descriptors: none');
  });

  it('should handle multiple entities with different descriptor configurations', async () => {
    // Setup multiple entities
    const mockRootEntity = {
      getComponentData: jest.fn((type) => {
        if (type === 'core:name') return { text: 'Root' };
        if (type === 'anatomy:part') return { subType: 'torso' };
        return null;
      }),
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { text: 'Root' },
        'anatomy:part': { subType: 'torso' },
        'descriptors:build': { value: 'athletic' },
      }),
    };

    const mockChildEntity = {
      getComponentData: jest.fn((type) => {
        if (type === 'core:name') return { text: 'Child Part' };
        if (type === 'anatomy:part') return { subType: 'limb' };
        if (type === 'anatomy:joint')
          return { parentId: 'root-entity', socketId: 'socket' };
        return null;
      }),
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { text: 'Child Part' },
        'anatomy:part': { subType: 'limb' },
        'anatomy:joint': { parentId: 'root-entity', socketId: 'socket' },
        'descriptors:size_category': { value: 'medium' },
        'descriptors:texture': { value: 'smooth' },
      }),
    };

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'root-entity') return Promise.resolve(mockRootEntity);
      if (id === 'child-entity') return Promise.resolve(mockChildEntity);
      return Promise.resolve(null);
    });

    // Initialize and build graph
    visualizationComposer.initialize(container);
    await visualizationComposer.buildGraphData({
      root: 'root-entity',
      parts: { child: 'child-entity' },
    });
    visualizationComposer.performLayout();
    await visualizationComposer.renderVisualization();

    // Test root entity tooltip
    const rootNode = container.querySelector('[data-node-id="root-entity"]');
    rootNode.dispatchEvent(
      new dom.window.MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        currentTarget: rootNode,
      })
    );

    let tooltip = container.querySelector('.anatomy-tooltip');
    expect(tooltip.innerHTML).toContain('Descriptors: build');

    // Test child entity tooltip
    const childNode = container.querySelector('[data-node-id="child-entity"]');
    childNode.dispatchEvent(
      new dom.window.MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        currentTarget: childNode,
      })
    );

    tooltip = container.querySelector('.anatomy-tooltip');
    expect(tooltip.innerHTML).toContain('Descriptors: size_category, texture');
  });

  it('should properly escape descriptor component names in tooltip', async () => {
    // Setup entity with special characters in descriptor names
    const mockEntity = {
      getComponentData: jest.fn((type) => {
        if (type === 'core:name') return { text: 'Test Part' };
        if (type === 'anatomy:part') return { subType: 'test' };
        return null;
      }),
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { text: 'Test Part' },
        'anatomy:part': { subType: 'test' },
        'descriptors:<script>alert("xss")</script>': { value: 'test' },
        'descriptors:color_&_size': { value: 'test' },
      }),
    };

    mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

    // Initialize and build graph
    visualizationComposer.initialize(container);
    await visualizationComposer.buildGraphData({
      root: 'test-entity',
      parts: {},
    });
    visualizationComposer.performLayout();
    await visualizationComposer.renderVisualization();

    // Find the anatomy node element
    const nodeElement = container.querySelector('[data-node-id="test-entity"]');
    nodeElement.dispatchEvent(
      new dom.window.MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        currentTarget: nodeElement,
      })
    );

    // Check that HTML is properly escaped
    const tooltip = container.querySelector('.anatomy-tooltip');
    // Note: DomUtils.escapeHtml may escape quotes differently (using " instead of &quot;)
    expect(tooltip.innerHTML).toContain('&lt;script&gt;alert(');
    expect(tooltip.innerHTML).toContain(')&lt;/script&gt;');
    expect(tooltip.innerHTML).toContain('color_&amp;_size');
  });
});
