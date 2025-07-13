/**
 * @file Registers visualizer-specific services for the anatomy visualizer
 * @see VisualizerStateController.js, VisualizerState.js, AnatomyLoadingDetector.js
 */

import { tokens } from '../tokens.js';
import { Registrar, registerWithLog } from '../../utils/registrarHelpers.js';
import { VisualizerState } from '../../domUI/visualizer/VisualizerState.js';
import { AnatomyLoadingDetector } from '../../domUI/visualizer/AnatomyLoadingDetector.js';
import { VisualizerStateController } from '../../domUI/visualizer/VisualizerStateController.js';

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
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singletonFactory' },
    logger
  );

  logger.debug('Visualizer Registrations: Complete.');
}
