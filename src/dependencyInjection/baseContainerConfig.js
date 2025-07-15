// src/dependencyInjection/baseContainerConfig.js

// --- Import registration bundle functions ---
import { registerLoaders } from './registrations/loadersRegistrations.js';
import { registerInfrastructure } from './registrations/infrastructureRegistrations.js';
import { registerPersistence } from './registrations/persistenceRegistrations.js';
import { registerWorldAndEntity } from './registrations/worldAndEntityRegistrations.js';
import { registerCommandAndAction } from './registrations/commandAndActionRegistrations.js';
import { registerInterpreters } from './registrations/interpreterRegistrations.js';
import { registerEventBusAdapters } from './registrations/eventBusAdapterRegistrations.js';
import { registerInitializers } from './registrations/initializerRegistrations.js';
import { registerRuntime } from './registrations/runtimeRegistrations.js';
import { tokens } from './tokens.js';

// Game-specific registrations (conditionally imported)
import { registerAI } from './registrations/aiRegistrations.js';
import { registerTurnLifecycle } from './registrations/turnLifecycleRegistrations.js';
import { registerOrchestration } from './registrations/orchestrationRegistrations.js';
import { registerUI } from './registrations/uiRegistrations.js';

/**
 * @typedef {import('./appContainer.js').default} AppContainer
 */

/**
 * @description Configures the base container with core services and optional game-specific services
 * @param {AppContainer} container - The DI container to configure
 * @param {object} options - Configuration options
 * @param {boolean} [options.includeGameSystems] - Whether to include game-specific systems (AI, turn lifecycle, orchestration)
 * @param {boolean} [options.includeUI] - Whether to include UI registrations
 * @param {boolean} [options.includeAnatomySystems] - Whether to include anatomy initialization (for testing)
 * @param {object} [options.uiElements] - UI elements to register if includeUI is true
 * @param {ILogger} [options.logger] - Logger instance for debug logging
 */
export async function configureBaseContainer(container, options = {}) {
  const {
    includeGameSystems = false,
    includeUI = false,
    includeAnatomySystems = false,
    uiElements = null,
    logger = null,
  } = options;

  if (logger) {
    logger.debug(
      '[BaseContainerConfig] Starting base container configuration...'
    );
  }

  // --- Core Registration (always needed) ---
  // These services are required by both game and tools
  registerLoaders(container);
  registerInfrastructure(container);
  registerPersistence(container);
  registerWorldAndEntity(container);
  registerCommandAndAction(container);
  registerInterpreters(container);

  // --- Conditionally register game-specific services ---
  if (includeGameSystems) {
    if (logger) {
      logger.debug(
        '[BaseContainerConfig] Registering game-specific systems...'
      );
    }
    registerAI(container);
    registerTurnLifecycle(container);
  }

  // Continue with core registrations
  registerEventBusAdapters(container);

  // --- Conditionally register UI ---
  if (includeUI && uiElements) {
    if (logger) {
      logger.debug('[BaseContainerConfig] Registering UI components...');
    }
    registerUI(container, uiElements);
  }

  // Continue with final core registrations
  registerInitializers(container);
  registerRuntime(container);

  // --- Register orchestration if game systems are included ---
  if (includeGameSystems) {
    registerOrchestration(container);
  }

  // --- Initialize anatomy systems if requested (for testing) ---
  if (includeAnatomySystems) {
    if (logger) {
      logger.debug('[BaseContainerConfig] Initializing anatomy systems...');
    }
    // Initialize anatomy-related systems that were tagged with INITIALIZABLE
    try {
      const systemInitializer = container.resolve(tokens.SystemInitializer);
      // Initialize just the anatomy systems by resolving and initializing them
      const anatomyInitService = container.resolve(tokens.AnatomyInitializationService);
      if (anatomyInitService && typeof anatomyInitService.initialize === 'function') {
        anatomyInitService.initialize();
        if (logger) {
          logger.debug('[BaseContainerConfig] AnatomyInitializationService initialized');
        }
      }
    } catch (error) {
      if (logger) {
        logger.warn('[BaseContainerConfig] Failed to initialize anatomy systems:', error);
      }
    }
  }

  if (logger) {
    logger.debug(
      '[BaseContainerConfig] Base container configuration complete.'
    );
  }
}
