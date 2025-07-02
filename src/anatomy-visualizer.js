// anatomy-visualizer.js

import { configureMinimalContainer } from './dependencyInjection/minimalContainerConfig.js';
import { tokens } from './dependencyInjection/tokens.js';
import AppContainer from './dependencyInjection/appContainer.js';
import AnatomyVisualizerUI from './domUI/AnatomyVisualizerUI.js';

let container;
let logger;
let modsLoader;
let registry;
let entityManager;
let anatomyDescriptionService;
let systemInitializer;
let eventDispatcher;
let visualizerUI;

/**
 *
 */
async function initialize() {
  try {
    // Create and configure the DI container
    container = new AppContainer();

    // Use minimal configuration that doesn't require game UI elements
    configureMinimalContainer(container);

    // Resolve essential services
    logger = container.resolve(tokens.ILogger);
    modsLoader = container.resolve(tokens.ModsLoader);
    registry = container.resolve(tokens.IDataRegistry);
    entityManager = container.resolve(tokens.IEntityManager);
    anatomyDescriptionService = container.resolve(
      tokens.AnatomyDescriptionService
    );
    systemInitializer = container.resolve(tokens.SystemInitializer);
    eventDispatcher = container.resolve(tokens.ISafeEventDispatcher);

    logger.info('Anatomy Visualizer: Starting initialization...');

    // Load mods
    logger.info('Anatomy Visualizer: Loading mods...');
    await loadMods();

    // Initialize all tagged services (including AnatomyInitializationService)
    logger.info('Anatomy Visualizer: Initializing system services...');
    await systemInitializer.initializeAll();

    // Initialize UI
    logger.info('Anatomy Visualizer: Initializing UI...');
    visualizerUI = new AnatomyVisualizerUI({
      logger,
      registry,
      entityManager,
      anatomyDescriptionService,
      eventDispatcher,
      documentContext: { document },
    });

    await visualizerUI.initialize();

    // Setup back button
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    logger.info('Anatomy Visualizer: Initialization complete');
  } catch (error) {
    console.error('Failed to initialize anatomy visualizer:', error);
    alert(`Failed to initialize anatomy visualizer: ${error.message}`);
  }
}

/**
 *
 */
async function loadMods() {
  try {
    // Load game configuration
    const gameConfigResponse = await fetch('./data/game.json');
    if (!gameConfigResponse.ok) {
      throw new Error('Failed to load game configuration');
    }

    const gameConfig = await gameConfigResponse.json();
    const requestedMods = gameConfig.mods || [];

    logger.info(
      `Anatomy Visualizer: Loading mods: ${requestedMods.join(', ')}`
    );

    // Load all mods and their dependencies
    const loadReport = await modsLoader.loadMods('default', requestedMods);

    logger.info(
      `Anatomy Visualizer: Loaded ${loadReport.finalModOrder.length} mods`
    );
    logger.debug('Load report:', loadReport);
  } catch (error) {
    logger.error('Failed to load mods:', error);
    throw error;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
