/**
 * @file Registers visualizer-specific services for the anatomy visualizer
 * @see VisualizerStateController.js, VisualizerState.js, AnatomyLoadingDetector.js
 */

import { tokens } from '../tokens.js';
import { Registrar, registerWithLog } from '../../utils/registrarHelpers.js';
import { VisualizerState } from '../../domUI/visualizer/VisualizerState.js';
import { AnatomyLoadingDetector } from '../../domUI/visualizer/AnatomyLoadingDetector.js';
import { VisualizerStateController } from '../../domUI/visualizer/VisualizerStateController.js';
import DocumentContext from '../../domUI/documentContext.js';
// Anatomy Renderer Components
import LayoutEngine from '../../domUI/anatomy-renderer/LayoutEngine.js';
import RadialLayoutStrategy from '../../domUI/anatomy-renderer/layouts/RadialLayoutStrategy.js';
import SVGRenderer from '../../domUI/anatomy-renderer/SVGRenderer.js';
import InteractionController from '../../domUI/anatomy-renderer/InteractionController.js';
import ViewportManager from '../../domUI/anatomy-renderer/ViewportManager.js';
import VisualizationComposer from '../../domUI/anatomy-renderer/VisualizationComposer.js';

/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Registers visualizer-specific components needed for the anatomy visualizer.
 * This is a subset of UI registrations that doesn't require game-specific DOM elements.
 *
 * @param {AppContainer} container - The application's DI container
 */
export function registerVisualizerComponents(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);

  logger.debug('Visualizer Registrations: Starting...');

  // Register IDocumentContext - required by SVGRenderer and other components
  registerWithLog(
    registrar,
    tokens.IDocumentContext,
    (c) =>
      new DocumentContext(
        (typeof globalThis !== 'undefined' && globalThis.document) ||
          (typeof window !== 'undefined' && window.document) ||
          null,
        c.resolve(tokens.ILogger)
      ),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register VisualizerState
  registerWithLog(
    registrar,
    tokens.VisualizerState,
    (c) =>
      new VisualizerState({
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register AnatomyLoadingDetector
  registerWithLog(
    registrar,
    tokens.AnatomyLoadingDetector,
    (c) =>
      new AnatomyLoadingDetector({
        entityManager: c.resolve(tokens.IEntityManager),
        eventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register VisualizerStateController
  registerWithLog(
    registrar,
    tokens.VisualizerStateController,
    (c) =>
      new VisualizerStateController({
        visualizerState: c.resolve(tokens.VisualizerState),
        anatomyLoadingDetector: c.resolve(tokens.AnatomyLoadingDetector),
        eventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        entityManager: c.resolve(tokens.IEntityManager),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register RadialLayoutStrategy
  registerWithLog(
    registrar,
    tokens.RadialLayoutStrategy,
    (c) =>
      new RadialLayoutStrategy({
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'transient' },
    logger
  );

  // Register LayoutEngine
  registerWithLog(
    registrar,
    tokens.LayoutEngine,
    (c) => {
      const layoutEngine = new LayoutEngine({
        logger: c.resolve(tokens.ILogger),
      });
      // Register default radial layout strategy
      const radialStrategy = c.resolve(tokens.RadialLayoutStrategy);
      layoutEngine.registerStrategy('radial', radialStrategy);
      layoutEngine.setStrategy('radial');
      return layoutEngine;
    },
    { lifecycle: 'singletonFactory' },
    logger
  );

  // Register SVGRenderer
  registerWithLog(
    registrar,
    tokens.SVGRenderer,
    (c) =>
      new SVGRenderer({
        documentContext: c.resolve(tokens.IDocumentContext),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'transient' },
    logger
  );

  // Register InteractionController
  registerWithLog(
    registrar,
    tokens.InteractionController,
    (c) =>
      new InteractionController({
        logger: c.resolve(tokens.ILogger),
        eventBus: c.resolve(tokens.IValidatedEventDispatcher),
      }),
    { lifecycle: 'transient' },
    logger
  );

  // Register ViewportManager
  registerWithLog(
    registrar,
    tokens.ViewportManager,
    (c) =>
      new ViewportManager({
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'transient' },
    logger
  );

  // Register VisualizationComposer
  registerWithLog(
    registrar,
    tokens.VisualizationComposer,
    (c) =>
      new VisualizationComposer({
        logger: c.resolve(tokens.ILogger),
        entityManager: c.resolve(tokens.IEntityManager),
        documentContext: c.resolve(tokens.IDocumentContext),
        layoutEngine: c.resolve(tokens.LayoutEngine),
        svgRenderer: c.resolve(tokens.SVGRenderer),
        interactionController: c.resolve(tokens.InteractionController),
        viewportManager: c.resolve(tokens.ViewportManager),
      }),
    { lifecycle: 'transient' },
    logger
  );

  logger.debug('Visualizer Registrations: Complete.');
}
