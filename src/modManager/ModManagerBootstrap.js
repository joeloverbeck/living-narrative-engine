/**
 * @file Bootstrap class for Mod Manager application
 * @description Lightweight bootstrap for the Mod Manager utility page.
 *              Does NOT use full CharacterBuilderBootstrap pattern as this
 *              page doesn't need schema loading, event registration, or LLM services.
 */

import ConsoleLogger from '../logging/consoleLogger.js';
import ModDiscoveryService from './services/ModDiscoveryService.js';
import ModGraphService from './services/ModGraphService.js';
import WorldDiscoveryService from './services/WorldDiscoveryService.js';
import ConfigPersistenceService from './services/ConfigPersistenceService.js';
import ModManagerController from './controllers/ModManagerController.js';
import ModListView from './views/ModListView.js';
import SummaryPanelView from './views/SummaryPanelView.js';
import WorldListView from './views/WorldListView.js';
import ModCardComponent from './components/ModCardComponent.js';

/**
 * Bootstraps the Mod Manager application with lightweight dependency injection
 */
export class ModManagerBootstrap {
  #logger;
  #container;
  #controller;
  #modListView;
  #summaryPanelView;
  #worldListView;
  #modCardComponent;
  #backButtonHandler;
  #navigationHandler;

  /**
   * @param {{ navigationHandler?: (targetUrl: string) => void }} [options] - Optional configuration
   */
  constructor({ navigationHandler } = {}) {
    // ConsoleLogger takes log level, not namespace string
    this.#logger = new ConsoleLogger('INFO');
    this.#navigationHandler =
      navigationHandler ?? ((targetUrl) => window.location.assign(targetUrl));
  }

  /**
   * Initialize the Mod Manager application
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this.#logger.info('[ModManagerBootstrap] Initializing Mod Manager...');

    try {
      // Step 1: Create lightweight DI container
      this.#container = this.#createContainer();

      // Step 2: Register services
      await this.#registerServices();

      // Step 3: Create and initialize controller
      await this.#initializeController();

      // Step 4: Initialize view components
      this.#initializeViews();

      // Step 5: Wire navigation controls
      this.#initializeNavigation();

      // Step 6: Load initial data and render
      await this.#loadInitialData();

      this.#logger.info(
        '[ModManagerBootstrap] Mod Manager initialized successfully'
      );
    } catch (error) {
      this.#logger.error('[ModManagerBootstrap] Initialization failed', error);
      throw error;
    }
  }

  /**
   * Create lightweight DI container for Mod Manager
   *
   * @returns {Map} Simple container instance
   */
  #createContainer() {
    // Using a simple Map-based container for this standalone page
    // Full AppContainer is overkill for this use case
    return new Map();
  }

  /**
   * Register all services in the container
   *
   * @returns {Promise<void>}
   */
  async #registerServices() {
    this.#logger.debug('[ModManagerBootstrap] Registering services...');

    // Register logger first
    this.#container.set('logger', this.#logger);

    // Create services with dependencies
    const modDiscoveryService = new ModDiscoveryService({
      logger: this.#logger,
    });
    const modGraphService = new ModGraphService({
      logger: this.#logger,
    });
    const worldDiscoveryService = new WorldDiscoveryService({
      logger: this.#logger,
      modDiscoveryService,
    });
    const configPersistenceService = new ConfigPersistenceService({
      logger: this.#logger,
    });

    // Register in container
    this.#container.set('modDiscoveryService', modDiscoveryService);
    this.#container.set('modGraphService', modGraphService);
    this.#container.set('worldDiscoveryService', worldDiscoveryService);
    this.#container.set('configPersistenceService', configPersistenceService);
  }

  /**
   * Create and initialize the main controller
   *
   * @returns {Promise<void>}
   */
  async #initializeController() {
    this.#logger.debug('[ModManagerBootstrap] Initializing controller...');

    // Create controller with all required dependencies
    this.#controller = new ModManagerController({
      logger: this.#container.get('logger'),
      modDiscoveryService: this.#container.get('modDiscoveryService'),
      modGraphService: this.#container.get('modGraphService'),
      worldDiscoveryService: this.#container.get('worldDiscoveryService'),
      configPersistenceService: this.#container.get('configPersistenceService'),
    });
  }

  /**
   * Initialize all view components
   */
  #initializeViews() {
    this.#logger.debug('[ModManagerBootstrap] Initializing views...');

    // Create shared mod card component
    this.#modCardComponent = new ModCardComponent({
      logger: this.#logger,
    });

    // Get container elements from DOM
    const modListContainer = document.getElementById('mod-list');
    const summaryPanelContainer =
      /** @type {HTMLElement|null} */ (document.querySelector('.summary-panel'));
    const worldListContainer = document.getElementById('world-list');

    // Create ModListView
    if (modListContainer) {
      this.#modListView = new ModListView({
        container: modListContainer,
        logger: this.#logger,
        onModToggle: (modId) => this.#controller.toggleMod(modId),
        modCardComponent: this.#modCardComponent,
      });
    }

    // Create SummaryPanelView
    if (summaryPanelContainer) {
      this.#summaryPanelView = new SummaryPanelView({
        container: summaryPanelContainer,
        logger: this.#logger,
        onSave: () => this.#controller.saveConfiguration(),
      });
    }

    // Create WorldListView
    if (worldListContainer) {
      this.#worldListView = new WorldListView({
        container: worldListContainer,
        logger: this.#logger,
        onWorldSelect: (worldId) => this.#controller.selectWorld(worldId),
      });
    }
  }

  /**
   * Wire up navigation controls
   */
  #initializeNavigation() {
    const backButton = document.getElementById('back-button');
    if (!backButton) {
      this.#logger.warn(
        '[ModManagerBootstrap] Back button not found; skipping navigation binding'
      );
      return;
    }

    this.#backButtonHandler = () => {
      try {
        this.#navigationHandler('index.html');
      } catch (error) {
        this.#logger.warn(
          '[ModManagerBootstrap] Failed to navigate back to menu',
          error
        );
      }
    };

    backButton.addEventListener('click', this.#backButtonHandler);
  }

  /**
   * Load initial data (current config, available mods)
   *
   * @returns {Promise<void>}
   */
  async #loadInitialData() {
    this.#logger.debug('[ModManagerBootstrap] Loading initial data...');

    try {
      // Controller.initialize() fetches mods, config, builds graph, discovers worlds
      await this.#controller.initialize();

      // Subscribe to state changes to update UI
      this.#controller.subscribe((state) => {
        this.#renderUI(state);
      });
    } catch (error) {
      this.#logger.error(
        '[ModManagerBootstrap] Failed to load initial data',
        error
      );
      // Update loading indicators with error state
      const loadingIndicators = document.querySelectorAll('.loading-indicator');
      loadingIndicators.forEach((indicator) => {
        indicator.textContent = 'Failed to load data.';
      });
      throw error;
    }
  }

  /**
   * Render all UI views with current state
   *
   * @param {import('./controllers/ModManagerController.js').ModManagerState} state - Current controller state
   */
  #renderUI(state) {
    // Update loading indicators (backwards compatibility)
    this.#updateLoadingIndicators(state);

    // Render mod list
    if (this.#modListView) {
      this.#modListView.render({
        mods: state.availableMods || [],
        getModDisplayInfo: (modId) => this.#controller.getModDisplayInfo(modId),
        getModName: (modId) => this.#controller.getModName(modId),
        isLoading: state.isLoading,
      });
    }

    // Render summary panel
    if (this.#summaryPanelView) {
      this.#summaryPanelView.render({
        loadOrder: state.resolvedMods || [],
        activeCount: (state.resolvedMods || []).length,
        hasUnsavedChanges: state.hasUnsavedChanges,
        isSaving: state.isSaving,
        isLoading: state.isLoading,
      });
    }

    // Render world list
    if (this.#worldListView) {
      this.#worldListView.render({
        worlds: state.availableWorlds || [],
        selectedWorld: state.selectedWorld,
        isLoading: state.isLoading,
      });
    }
  }

  /**
   * Update loading indicator text
   *
   * @param {import('./controllers/ModManagerController.js').ModManagerState} state - Current controller state
   */
  #updateLoadingIndicators(state) {
    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach((indicator) => {
      if (state.isLoading) {
        indicator.textContent = 'Loading mods...';
      } else if (state.error) {
        indicator.textContent = state.error;
      } else {
        const modCount = state.availableMods?.length || 0;
        indicator.textContent = `Loaded ${modCount} mods`;
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.#logger.info('[ModManagerBootstrap] Destroying Mod Manager...');

    // Destroy views
    if (this.#modListView?.destroy) {
      this.#modListView.destroy();
    }
    if (this.#summaryPanelView?.destroy) {
      this.#summaryPanelView.destroy();
    }
    if (this.#worldListView?.destroy) {
      this.#worldListView.destroy();
    }

    // Remove navigation handlers
    const backButton = document.getElementById('back-button');
    if (backButton && this.#backButtonHandler) {
      backButton.removeEventListener('click', this.#backButtonHandler);
    }
    this.#backButtonHandler = null;

    // Destroy controller
    if (this.#controller?.destroy) {
      this.#controller.destroy();
    }

    // Clear container
    if (this.#container) {
      this.#container.clear();
    }
  }
}

export default ModManagerBootstrap;
