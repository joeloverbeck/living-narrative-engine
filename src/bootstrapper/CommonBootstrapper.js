// src/bootstrapper/CommonBootstrapper.js

import AppContainer from '../dependencyInjection/appContainer.js';
import { tokens } from '../dependencyInjection/tokens.js';
import { configureContainer } from '../dependencyInjection/containerConfig.js';
import { configureMinimalContainer } from '../dependencyInjection/minimalContainerConfig.js';
import { loadModsFromGameConfig } from '../utils/initialization/modLoadingUtils.js';
import { initializeCoreServices, initializeAnatomyServices, initializeAuxiliaryServices } from '../utils/initialization/commonInitialization.js';
import { stageSuccess, stageFailure } from '../utils/bootstrapperHelpers.js';
import { initializeAnatomyFormattingStage } from './stages/anatomyFormattingStage.js';

/**
 * @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} BootstrapOptions
 * @property {'minimal' | 'full'} [containerConfigType='minimal'] - Type of container configuration to use
 * @property {string} [worldName='default'] - World name for mod loading
 * @property {object} [uiElements=null] - UI elements for full configuration
 * @property {Function} [postInitHook=null] - Custom post-initialization hook
 * @property {boolean} [includeAnatomyFormatting=false] - Whether to initialize anatomy formatting
 * @property {boolean} [skipModLoading=false] - Whether to skip mod loading (for testing)
 */

/**
 * @typedef {object} BootstrapResult
 * @property {AppContainer} container - The configured DI container
 * @property {object} services - Resolved core services
 * @property {object} [loadReport] - Mod loading report (if mods were loaded)
 */

/**
 * Common bootstrapper for initializing the application with shared logic
 * between the game and anatomy visualizer.
 */
export class CommonBootstrapper {
  /**
   * Bootstrap the application with the specified options
   *
   * @param {BootstrapOptions} options - Bootstrap configuration options
   * @returns {Promise<BootstrapResult>} The bootstrap result with container and services
   * @throws {Error} If initialization fails at any stage
   */
  async bootstrap(options = {}) {
    const {
      containerConfigType = 'minimal',
      worldName = 'default',
      uiElements = null,
      postInitHook = null,
      includeAnatomyFormatting = false,
      skipModLoading = false
    } = options;

    let container;
    let logger;
    let services;
    let loadReport;

    try {
      // Step 1: Create and configure container
      container = new AppContainer();
      
      if (containerConfigType === 'full') {
        if (!uiElements) {
          throw new Error('UI elements are required for full container configuration');
        }
        configureContainer(container, uiElements);
      } else {
        configureMinimalContainer(container);
      }

      // Step 2: Resolve core services
      services = await initializeCoreServices(container, tokens);
      logger = services.logger;
      
      logger.info(`CommonBootstrapper: Starting bootstrap process with ${containerConfigType} configuration`);

      // Step 3: Load mods (unless skipped)
      if (!skipModLoading) {
        logger.info('CommonBootstrapper: Loading mods...');
        loadReport = await loadModsFromGameConfig(
          services.modsLoader, 
          logger, 
          worldName
        );
        logger.info(`CommonBootstrapper: Mod loading complete. Loaded ${loadReport.finalModOrder.length} mods`);
      } else {
        logger.info('CommonBootstrapper: Skipping mod loading as requested');
      }

      // Step 4: Initialize anatomy formatting if needed
      if (includeAnatomyFormatting) {
        const formatResult = await initializeAnatomyFormattingStage(container, logger, tokens);
        if (!formatResult.success) {
          throw new Error(`Anatomy formatting initialization failed: ${formatResult.error.message}`);
        }
      }

      // Step 5: Initialize auxiliary services
      logger.info('CommonBootstrapper: Initializing auxiliary services...');
      await initializeAuxiliaryServices(container, logger, tokens);

      // Step 6: Custom post-initialization hook
      if (postInitHook) {
        logger.info('CommonBootstrapper: Running post-initialization hook...');
        await postInitHook(services, container);
      }

      logger.info('CommonBootstrapper: Bootstrap process completed successfully');
      
      return { 
        container, 
        services, 
        ...(loadReport && { loadReport })
      };

    } catch (error) {
      const errorMsg = `CommonBootstrapper: Fatal error during initialization: ${error.message}`;
      
      if (logger) {
        logger.error(errorMsg, error);
      } else {
        console.error(errorMsg, error);
      }
      
      throw error;
    }
  }

  /**
   * Display a fatal startup error to the user
   *
   * @param {string} message - The error message to display
   * @param {Error} [error] - The error object if available
   */
  displayFatalStartupError(message, error = null) {
    // Try to display in the error div if available
    const errorDiv = document.getElementById('error-output');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
    
    // Always log to console
    console.error(message, error);
    
    // Show alert as fallback
    alert(message);
  }
}