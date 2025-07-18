/**
 * @file Unit test for VisualizationComposer panning functionality
 * @description Tests that the viewport observer correctly updates the RenderContext and SVG viewBox
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import VisualizationComposer from '../../../../src/domUI/anatomy-renderer/VisualizationComposer.js';
import InteractionController from '../../../../src/domUI/anatomy-renderer/InteractionController.js';
import ViewportManager from '../../../../src/domUI/anatomy-renderer/ViewportManager.js';
import SVGRenderer from '../../../../src/domUI/anatomy-renderer/SVGRenderer.js';
import LayoutEngine from '../../../../src/domUI/anatomy-renderer/LayoutEngine.js';
import RadialLayoutStrategy from '../../../../src/domUI/anatomy-renderer/layouts/RadialLayoutStrategy.js';

describe('VisualizationComposer - Panning Integration', () => {
  let dom;
  let container;
  let visualizationComposer;
  let viewportManager;
  let interactionController;
  let svgRenderer;
  let layoutEngine;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    // Create DOM environment
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="container"></div></body></html>'
    );
    global.document = dom.window.document;
    global.window = dom.window;

    container = document.getElementById('container');

    // Ensure container exists
    if (!container) {
      container = document.createElement('div');
      container.id = 'container';
      document.body.appendChild(container);
    }

    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    // Create real components
    viewportManager = new ViewportManager({ logger: mockLogger });
    interactionController = new InteractionController({
      logger: mockLogger,
      eventBus: { dispatch: jest.fn() },
    });
    svgRenderer = new SVGRenderer({
      documentContext: { document },
      logger: mockLogger,
    });
    layoutEngine = new LayoutEngine({ logger: mockLogger });

    // Register layout strategy
    const radialStrategy = new RadialLayoutStrategy({ logger: mockLogger });
    layoutEngine.registerStrategy('radial', radialStrategy);

    // Create visualization composer
    visualizationComposer = new VisualizationComposer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      documentContext: { document },
      layoutEngine,
      svgRenderer,
      interactionController,
      viewportManager,
    });

    // Initialize composer
    visualizationComposer.initialize(container);
  });

  afterEach(() => {
    if (visualizationComposer) {
      visualizationComposer.dispose();
    }
  });

  it('should update SVG viewBox when ViewportManager viewport changes', async () => {
    // Mock entity manager to return minimal entity data
    mockEntityManager.getEntityInstance.mockResolvedValue({
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'core:name') return { text: 'Test Root' };
        if (componentId === 'core:description')
          return { text: 'Test description' };
        if (componentId === 'anatomy:part') return { subType: 'torso' };
        return null;
      }),
    });

    // Create minimal anatomy data
    const anatomyData = {
      root: 'test-root',
      parts: {},
    };

    // Render the graph to create the SVG
    await visualizationComposer.renderGraph('test-root', anatomyData);

    // Get the SVG element
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeTruthy();

    // Get initial viewBox
    const initialViewBox = svgElement.getAttribute('viewBox');
    expect(initialViewBox).toBeDefined();

    // Parse initial viewBox values
    const initialValues = initialViewBox.split(' ').map(Number);
    const [initialX, initialY] = initialValues;

    // Simulate viewport change through ViewportManager
    const panDeltaX = 100;
    const panDeltaY = 50;
    viewportManager.pan(panDeltaX, panDeltaY);

    // Get updated viewBox
    const updatedViewBox = svgElement.getAttribute('viewBox');
    expect(updatedViewBox).toBeDefined();

    // Parse updated viewBox values
    const updatedValues = updatedViewBox.split(' ').map(Number);
    const [updatedX, updatedY] = updatedValues;

    // ViewBox should have changed according to the pan delta
    expect(updatedX).not.toBe(initialX);
    expect(updatedY).not.toBe(initialY);

    // Verify the pan worked correctly (viewport coordinates should be updated)
    expect(updatedViewBox).not.toBe(initialViewBox);
  });

  it('should sync RenderContext with ViewportManager state', async () => {
    // Mock entity manager
    mockEntityManager.getEntityInstance.mockResolvedValue({
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'core:name') return { text: 'Test Root' };
        if (componentId === 'core:description')
          return { text: 'Test description' };
        if (componentId === 'anatomy:part') return { subType: 'torso' };
        return null;
      }),
    });

    // Create minimal anatomy data
    const anatomyData = {
      root: 'test-root',
      parts: {},
    };

    // Render the graph
    await visualizationComposer.renderGraph('test-root', anatomyData);

    // Get initial viewport state
    const initialViewport = viewportManager.getViewport();

    // Simulate viewport change
    viewportManager.pan(75, 25);

    // Get updated viewport state
    const updatedViewport = viewportManager.getViewport();

    // Verify viewport changed
    expect(updatedViewport.x).not.toBe(initialViewport.x);
    expect(updatedViewport.y).not.toBe(initialViewport.y);

    // Verify SVG viewBox reflects the viewport change
    const svgElement = container.querySelector('svg');
    const viewBox = svgElement.getAttribute('viewBox');
    const viewBoxParts = viewBox.split(' ').map(Number);

    // ViewBox should match the updated viewport
    expect(viewBoxParts[0]).toBe(updatedViewport.x);
    expect(viewBoxParts[1]).toBe(updatedViewport.y);
  });

  it('should handle multiple sequential pan operations', async () => {
    // Mock entity manager
    mockEntityManager.getEntityInstance.mockResolvedValue({
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === 'core:name') return { text: 'Test Root' };
        if (componentId === 'core:description')
          return { text: 'Test description' };
        if (componentId === 'anatomy:part') return { subType: 'torso' };
        return null;
      }),
    });

    // Create minimal anatomy data
    const anatomyData = {
      root: 'test-root',
      parts: {},
    };

    // Render the graph
    await visualizationComposer.renderGraph('test-root', anatomyData);

    const svgElement = container.querySelector('svg');

    // Get initial viewBox
    const initialViewBox = svgElement.getAttribute('viewBox');

    // Apply multiple pan operations
    viewportManager.pan(50, 30);
    const firstPanViewBox = svgElement.getAttribute('viewBox');

    viewportManager.pan(25, 15);
    const secondPanViewBox = svgElement.getAttribute('viewBox');

    viewportManager.pan(-75, -45);
    const thirdPanViewBox = svgElement.getAttribute('viewBox');

    // Each pan should result in a different viewBox
    expect(firstPanViewBox).not.toBe(initialViewBox);
    expect(secondPanViewBox).not.toBe(firstPanViewBox);
    expect(thirdPanViewBox).not.toBe(secondPanViewBox);

    // Final viewBox should be close to initial after the reverse pan
    // (accounting for accumulated floating point precision)
    const initialValues = initialViewBox.split(' ').map(Number);
    const finalValues = thirdPanViewBox.split(' ').map(Number);

    expect(Math.abs(finalValues[0] - initialValues[0])).toBeLessThan(0.01);
    expect(Math.abs(finalValues[1] - initialValues[1])).toBeLessThan(0.01);
  });
});
