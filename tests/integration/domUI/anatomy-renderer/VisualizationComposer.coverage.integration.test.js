/**
 * @file Comprehensive integration tests for VisualizationComposer
 * @description Exercises collaboration with real DOM/UI modules to increase coverage.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import VisualizationComposer from '../../../../src/domUI/anatomy-renderer/VisualizationComposer.js';
import InteractionController from '../../../../src/domUI/anatomy-renderer/InteractionController.js';
import ViewportManager from '../../../../src/domUI/anatomy-renderer/ViewportManager.js';
import SVGRenderer from '../../../../src/domUI/anatomy-renderer/SVGRenderer.js';
import LayoutEngine from '../../../../src/domUI/anatomy-renderer/LayoutEngine.js';
import RadialLayoutStrategy from '../../../../src/domUI/anatomy-renderer/layouts/RadialLayoutStrategy.js';
import { AnatomyRenderError } from '../../../../src/errors/anatomyRenderError.js';
import {
  createEntityManagerAdapter,
} from '../../../common/entities/entityManagerTestFactory.js';

class FailingSVGRenderer extends SVGRenderer {
  /**
   * Force a rendering failure after the base SVG has been created.
   */
  renderNodes() {
    throw new Error('forced render failure');
  }
}

class ThrowingRadialStrategy extends RadialLayoutStrategy {
  calculate() {
    throw new Error('layout boom');
  }
}

describe('VisualizationComposer integration coverage', () => {
  let dom;
  let document;
  let container;
  let logger;

  beforeEach(() => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="container"></div></body></html>',
      { pretendToBeVisual: true }
    );
    global.window = dom.window;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.SVGElement = dom.window.SVGElement;

    document = dom.window.document;
    container = document.getElementById('container');

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (dom?.window) {
      dom.window.close();
    }
    delete global.window;
    delete global.document;
    delete global.Element;
    delete global.SVGElement;
  });

  /**
   * Build the production collaborators used by the composer for a test run.
   *
   * @param {object} options - Dependency overrides
   * @param {Array<object>} options.initialEntities - Entities seeded into the entity manager
   * @param {typeof SVGRenderer} [options.svgClass] - Optional SVG renderer override
   * @param {() => LayoutEngine} [options.layoutFactory] - Optional layout engine factory
   * @returns {{
   *   composer: VisualizationComposer,
   *   entityManager: import('../../../../src/interfaces/IEntityManager.js').IEntityManager,
   *   viewportManager: ViewportManager,
   *   interactionController: InteractionController,
   *   svgRenderer: SVGRenderer,
   *   layoutEngine: LayoutEngine
   * }}
   */
  function createComposer({
    initialEntities,
    svgClass = SVGRenderer,
    layoutFactory,
  }) {
    const eventBus = { dispatch: jest.fn() };
    const viewportManager = new ViewportManager({ logger });
    const interactionController = new InteractionController({
      logger,
      eventBus,
    });
    const svgRenderer = new svgClass({
      documentContext: { document },
      logger,
    });
    const layoutEngine = layoutFactory
      ? layoutFactory()
      : new LayoutEngine({ logger });

    if (layoutEngine.getAvailableStrategies().length === 0) {
      const radial = new RadialLayoutStrategy({ logger });
      layoutEngine.registerStrategy('radial', radial);
    }

    const entityManager = createEntityManagerAdapter({
      logger,
      initialEntities,
    });

    const composer = new VisualizationComposer({
      logger,
      entityManager,
      documentContext: { document },
      layoutEngine,
      svgRenderer,
      interactionController,
      viewportManager,
    });

    return {
      composer,
      entityManager,
      viewportManager,
      interactionController,
      svgRenderer,
      layoutEngine,
    };
  }

  it('should orchestrate real collaborators and surface tooltip & interaction behaviour', async () => {
    const initialEntities = [
      {
        id: 'root-entity',
        components: {
          'core:name': { text: 'Root Torso' },
          'core:description': { text: 'Root description with details' },
          'anatomy:part': { subType: 'torso' },
          'anatomy:joint': { parentId: null, socketId: 'root-socket' },
          'descriptors:size': { value: 'broad' },
        },
      },
      {
        id: 'child-entity',
        components: {
          'core:name': { text: 'Left Arm' },
          'core:description': { text: 'Left arm description' },
          'anatomy:part': { subType: 'arm' },
          'anatomy:joint': { parentId: 'root-entity', socketId: 'arm-socket' },
        },
      },
      {
        id: 'stray-entity',
        components: {
          'core:name': { text: 'Stray Leg' },
          'core:description': { text: 'Detached leg component' },
          'anatomy:part': { subType: 'leg' },
          'anatomy:joint': { parentId: 'other-root', socketId: 'leg-socket' },
        },
      },
    ];

    const {
      composer,
      entityManager,
      viewportManager,
      interactionController,
      svgRenderer,
      layoutEngine,
    } = createComposer({ initialEntities });

    composer.initialize(container);

    const originalGet = entityManager.getEntityInstance.bind(entityManager);
    const callCounts = new Map();
    entityManager.getEntityInstance = jest.fn(async (id) => {
      if (id === 'error-child') {
        throw new Error('lookup failure');
      }
      if (id === 'broken-entity') {
        const count = callCounts.get(id) || 0;
        callCounts.set(id, count + 1);
        if (count === 0) {
          return {
            getComponentData: (componentId) => {
              if (componentId === 'anatomy:joint') {
                return { parentId: 'root-entity', socketId: 'broken-socket' };
              }
              return null;
            },
            getAllComponents: () => ({
              'anatomy:joint': { parentId: 'root-entity', socketId: 'broken-socket' },
            }),
          };
        }
        return undefined;
      }
      return originalGet(id);
    });

    const bodyData = {
      root: 'root-entity',
      parts: {
        arm: 'child-entity',
        stray: 'stray-entity',
        missing: 'ghost-entity',
        broken: 'broken-entity',
        problematic: 'error-child',
      },
    };

    container.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    });

    await composer.renderGraph('root-entity', bodyData);

    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeTruthy();
    svgElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    });

    const alternateStrategy = new RadialLayoutStrategy({ logger });
    layoutEngine.registerStrategy('radial-alt', alternateStrategy);
    composer.setLayout('radial-alt');
    expect(layoutEngine.getCurrentStrategyName()).toBe('radial-alt');

    composer.setTheme({
      backgroundColor: '#123456',
      nodeColors: { torso: '#abcdef' },
    });
    expect(svgElement.style.backgroundColor).not.toBe('');

    const initialViewBox = svgElement.getAttribute('viewBox');
    viewportManager.pan(50, 25);
    const updatedViewBox = svgElement.getAttribute('viewBox');
    expect(updatedViewBox).not.toBe(initialViewBox);

    const panSpy = jest.spyOn(viewportManager, 'pan');
    const zoomSpy = jest.spyOn(viewportManager, 'zoom');

    interactionController.startPan({ clientX: 10, clientY: 10 });
    expect(svgElement.style.cursor).toBe('grabbing');

    interactionController.updatePan({ clientX: 30, clientY: 20 });
    expect(panSpy).toHaveBeenCalledWith(20, 10);

    interactionController.endPan();
    expect(svgElement.style.cursor).toBe('grab');

    interactionController.handleZoom({
      deltaY: -120,
      clientX: 40,
      clientY: 60,
      preventDefault: () => {},
    });
    expect(zoomSpy).toHaveBeenCalledWith(expect.any(Number), 40, 60);

    const nodeElements = container.querySelectorAll('.anatomy-node');
    expect(nodeElements).toHaveLength(3);

    const strayNode = container.querySelector('[data-node-id="stray-entity"]');
    expect(strayNode).toBeTruthy();

    const rootNode = container.querySelector('[data-node-id="root-entity"]');
    rootNode.getBoundingClientRect = () => ({
      left: 100,
      top: 120,
      width: 60,
      height: 60,
      right: 160,
      bottom: 180,
    });

    const tooltipBefore = container.querySelector('.anatomy-tooltip');
    expect(tooltipBefore).toBeTruthy();

    rootNode.dispatchEvent(
      new dom.window.MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
      })
    );

    const tooltip = container.querySelector('.anatomy-tooltip');
    expect(tooltip.style.visibility).toBe('visible');
    expect(tooltip.innerHTML).toContain('Descriptors: size');

    const circle = rootNode.querySelector('.node-circle');
    expect(circle.getAttribute('r')).toBe('33');

    rootNode.dispatchEvent(
      new dom.window.MouseEvent('mouseleave', {
        bubbles: true,
        cancelable: true,
      })
    );
    expect(tooltip.style.visibility).toBe('hidden');
    expect(circle.getAttribute('r')).toBe('30');

    const containerMouseSpy = jest.fn();
    container.addEventListener('mousedown', containerMouseSpy);
    rootNode.dispatchEvent(
      new dom.window.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      })
    );
    expect(containerMouseSpy).not.toHaveBeenCalled();

    rootNode.dispatchEvent(
      new dom.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Clicked node: root-entity')
      )
    ).toBe(true);

    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('Entity not found: broken-entity')
      )
    ).toBe(true);
    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('unconnected parts')
      )
    ).toBe(true);
    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('Failed to index entity error-child')
      )
    ).toBe(true);

    panSpy.mockRestore();
    zoomSpy.mockRestore();

    const viewportAfterPan = viewportManager.getViewport();
    expect(viewportAfterPan.x).not.toBe(0);

    composer.dispose();
    const viewportAfterDispose = viewportManager.getViewport();
    expect(viewportAfterDispose).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('should validate error paths for layout and rendering failures', async () => {
    const initialEntities = [
      {
        id: 'root',
        components: {
          'core:name': { text: 'Root' },
          'core:description': { text: 'Description' },
          'anatomy:part': { subType: 'torso' },
        },
      },
    ];

    const eventBus = { dispatch: jest.fn() };
    const viewportManager = new ViewportManager({ logger });
    const interactionController = new InteractionController({
      logger,
      eventBus,
    });
    const throwingLayoutEngine = new LayoutEngine({ logger });
    throwingLayoutEngine.registerStrategy(
      'throwing',
      new ThrowingRadialStrategy({ logger })
    );
    const svgRenderer = new SVGRenderer({
      documentContext: { document },
      logger,
    });
    const entityManager = createEntityManagerAdapter({
      logger,
      initialEntities,
    });

    const failingComposer = new VisualizationComposer({
      logger,
      entityManager,
      documentContext: { document },
      layoutEngine: throwingLayoutEngine,
      svgRenderer,
      interactionController,
      viewportManager,
    });
    failingComposer.initialize(container);
    await failingComposer.buildGraphData({ root: 'root', parts: {} });
    failingComposer.setLayout('throwing');
    expect(() => failingComposer.performLayout()).toThrow(AnatomyRenderError);

    const eventBus2 = { dispatch: jest.fn() };
    const viewportManager2 = new ViewportManager({ logger });
    const interactionController2 = new InteractionController({
      logger,
      eventBus: eventBus2,
    });
    const layoutEngine2 = new LayoutEngine({ logger });
    layoutEngine2.registerStrategy('radial', new RadialLayoutStrategy({ logger }));
    const entityManager2 = createEntityManagerAdapter({
      logger,
      initialEntities,
    });
    const renderFailureComposer = new VisualizationComposer({
      logger,
      entityManager: entityManager2,
      documentContext: { document },
      layoutEngine: layoutEngine2,
      svgRenderer: new FailingSVGRenderer({
        documentContext: { document },
        logger,
      }),
      interactionController: interactionController2,
      viewportManager: viewportManager2,
    });
    renderFailureComposer.initialize(container);
    await expect(
      renderFailureComposer.renderGraph('root', { root: 'root', parts: {} })
    ).rejects.toThrow(AnatomyRenderError);
  });

  it('should throw if renderVisualization runs without initialization', async () => {
    const {
      composer,
    } = createComposer({ initialEntities: [] });

    await expect(composer.renderVisualization()).rejects.toThrow(
      AnatomyRenderError
    );
  });
});
