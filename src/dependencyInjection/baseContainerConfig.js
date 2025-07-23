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
import { registerCharacterBuilder } from './registrations/characterBuilderRegistrations.js';

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
 * @param {boolean} [options.includeCharacterBuilder] - Whether to include character builder services
 * @param {object} [options.uiElements] - UI elements to register if includeUI is true
 * @param {ILogger} [options.logger] - Logger instance for debug logging
 */
export async function configureBaseContainer(container, options = {}) {
  const {
    includeGameSystems = false,
    includeUI = false,
    includeAnatomySystems = false,
    includeCharacterBuilder = false,
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

  // --- Conditionally register character builder services ---
  if (includeCharacterBuilder) {
    if (logger) {
      logger.debug(
        '[BaseContainerConfig] Registering character builder services...'
      );
    }
    registerCharacterBuilder(container);
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
      logger.debug(
        '[BaseContainerConfig] Anatomy systems included, will be initialized by SystemInitializer'
      );
    }
    // AnatomyInitializationService is tagged with INITIALIZABLE and will be
    // automatically initialized by SystemInitializer during the standard initialization process
  }

  if (logger) {
    logger.debug(
      '[BaseContainerConfig] Base container configuration complete.'
    );
  }
}
