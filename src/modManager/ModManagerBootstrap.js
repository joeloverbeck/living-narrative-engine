/**
 * @file Bootstrap class for Mod Manager application
 * @description Lightweight bootstrap for the Mod Manager utility page.
 *              Does NOT use full CharacterBuilderBootstrap pattern as this
 *              page doesn't need schema loading, event registration, or LLM services.
 */

import ConsoleLogger from '../logging/consoleLogger.js';

/**
 * Bootstraps the Mod Manager application with lightweight dependency injection
 */
export class ModManagerBootstrap {
  #logger;
  #container;
  #controller;

  constructor() {
    // ConsoleLogger takes log level, not namespace string
    this.#logger = new ConsoleLogger('INFO');
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

      // Step 4: Load initial data
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

    // Services will be registered here by MODMANIMP-008 to 011
    // Placeholder registrations:
    this.#container.set('logger', this.#logger);

    // TODO: Register ModDiscoveryService (MODMANIMP-008)
    // TODO: Register ModGraphService (MODMANIMP-009)
    // TODO: Register WorldDiscoveryService (MODMANIMP-010)
    // TODO: Register ConfigPersistenceService (MODMANIMP-011)
  }

  /**
   * Create and initialize the main controller
   *
   * @returns {Promise<void>}
   */
  async #initializeController() {
    this.#logger.debug('[ModManagerBootstrap] Initializing controller...');

    // Controller will be created here by MODMANIMP-012
    // TODO: Create ModManagerController with dependencies

    // Placeholder: Store reference for later use
    this.#controller = null;
  }

  /**
   * Load initial data (current config, available mods)
   *
   * @returns {Promise<void>}
   */
  async #loadInitialData() {
    this.#logger.debug('[ModManagerBootstrap] Loading initial data...');

    // Initial data loading will be implemented by controller
    // TODO: Load current game.json configuration
    // TODO: Fetch available mods from API
    // TODO: Build dependency graph
    // TODO: Render initial UI state

    // For now, update loading indicators
    this.#updateLoadingState('ready');
  }

  /**
   * Update UI loading state
   *
   * @param {string} state - Current state: 'loading' | 'ready' | 'error'
   */
  #updateLoadingState(state) {
    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach((indicator) => {
      if (state === 'ready') {
        indicator.textContent = 'No data loaded yet. Services not connected.';
      } else if (state === 'error') {
        indicator.textContent = 'Failed to load data.';
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.#logger.info('[ModManagerBootstrap] Destroying Mod Manager...');
    if (this.#controller?.destroy) {
      this.#controller.destroy();
    }
    if (this.#container) {
      this.#container.clear();
    }
  }
}

export default ModManagerBootstrap;
