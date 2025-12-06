import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerVisualizerComponents } from '../../../src/dependencyInjection/registrations/visualizerRegistrations.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import {
  VisualizerState,
  VISUALIZER_STATES,
} from '../../../src/domUI/visualizer/VisualizerState.js';
import { AnatomyLoadingDetector } from '../../../src/domUI/visualizer/AnatomyLoadingDetector.js';
import { VisualizerStateController } from '../../../src/domUI/visualizer/VisualizerStateController.js';
import RadialLayoutStrategy from '../../../src/domUI/anatomy-renderer/layouts/RadialLayoutStrategy.js';
import LayoutEngine from '../../../src/domUI/anatomy-renderer/LayoutEngine.js';
import SVGRenderer from '../../../src/domUI/anatomy-renderer/SVGRenderer.js';
import InteractionController from '../../../src/domUI/anatomy-renderer/InteractionController.js';
import ViewportManager from '../../../src/domUI/anatomy-renderer/ViewportManager.js';
import VisualizationComposer from '../../../src/domUI/anatomy-renderer/VisualizationComposer.js';

describe('registerVisualizerComponents integration', () => {
  let container;
  let logger;
  let eventDispatcher;
  let entityManager;

  beforeEach(() => {
    container = new AppContainer();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => jest.fn()),
    };

    entityManager = {
      getEntityInstance: jest.fn(async () => null),
    };

    container.register(tokens.ILogger, () => logger, {
      lifecycle: 'singletonFactory',
    });
    container.register(
      tokens.IValidatedEventDispatcher,
      () => eventDispatcher,
      {
        lifecycle: 'singletonFactory',
      }
    );
    container.register(tokens.IEntityManager, () => entityManager, {
      lifecycle: 'singletonFactory',
    });

    registerVisualizerComponents(container);
  });

  it('registers visualizer components that resolve to functioning instances', () => {
    expect(logger.debug).toHaveBeenCalledWith(
      'Visualizer Registrations: Starting...'
    );

    const documentContext = container.resolve(tokens.IDocumentContext);
    expect(documentContext).toBeInstanceOf(DocumentContext);
    expect(documentContext.document).toBe(document);

    const visualizerState = container.resolve(tokens.VisualizerState);
    expect(visualizerState).toBeInstanceOf(VisualizerState);
    expect(visualizerState.getCurrentState()).toBe(VISUALIZER_STATES.IDLE);

    const loadingDetector = container.resolve(tokens.AnatomyLoadingDetector);
    expect(loadingDetector).toBeInstanceOf(AnatomyLoadingDetector);

    const controller = container.resolve(tokens.VisualizerStateController);
    expect(controller).toBeInstanceOf(VisualizerStateController);

    const layoutEngine = container.resolve(tokens.LayoutEngine);
    expect(layoutEngine).toBeInstanceOf(LayoutEngine);
    expect(layoutEngine.getAvailableStrategies()).toContain('radial');
    expect(layoutEngine.getCurrentStrategyName()).toBe('radial');

    const svgRenderer = container.resolve(tokens.SVGRenderer);
    expect(svgRenderer).toBeInstanceOf(SVGRenderer);

    const interactionController = container.resolve(
      tokens.InteractionController
    );
    expect(interactionController).toBeInstanceOf(InteractionController);

    const viewportManager = container.resolve(tokens.ViewportManager);
    expect(viewportManager).toBeInstanceOf(ViewportManager);

    const composer = container.resolve(tokens.VisualizationComposer);
    expect(composer).toBeInstanceOf(VisualizationComposer);

    expect(logger.debug).toHaveBeenCalledWith(
      'Visualizer Registrations: Complete.'
    );
  });

  it('applies the expected lifecycles to each registration', () => {
    const docContextA = container.resolve(tokens.IDocumentContext);
    const docContextB = container.resolve(tokens.IDocumentContext);
    expect(docContextA).toBe(docContextB);

    const stateA = container.resolve(tokens.VisualizerState);
    const stateB = container.resolve(tokens.VisualizerState);
    expect(stateA).toBe(stateB);

    const engineA = container.resolve(tokens.LayoutEngine);
    const engineB = container.resolve(tokens.LayoutEngine);
    expect(engineA).toBe(engineB);

    const strategyA = container.resolve(tokens.RadialLayoutStrategy);
    const strategyB = container.resolve(tokens.RadialLayoutStrategy);
    expect(strategyA).not.toBe(strategyB);

    const controllerA = container.resolve(tokens.InteractionController);
    const controllerB = container.resolve(tokens.InteractionController);
    expect(controllerA).not.toBe(controllerB);

    const viewportA = container.resolve(tokens.ViewportManager);
    const viewportB = container.resolve(tokens.ViewportManager);
    expect(viewportA).not.toBe(viewportB);

    const composerA = container.resolve(tokens.VisualizationComposer);
    const composerB = container.resolve(tokens.VisualizationComposer);
    expect(composerA).not.toBe(composerB);
  });
});
