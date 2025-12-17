// src/dependencyInjection/baseContainerConfig.js

// --- Import registration bundle functions ---
import { registerLoaders } from './registrations/loadersRegistrations.js';
import { registerInfrastructure } from './registrations/infrastructureRegistrations.js';
import { registerActionTracing } from './registrations/actionTracingRegistrations.js';
import { registerWorldAndEntity } from './registrations/worldAndEntityRegistrations.js';
import { registerCommandAndAction } from './registrations/commandAndActionRegistrations.js';
import { registerInterpreters } from './registrations/interpreterRegistrations.js';
import { registerActionCategorization } from './registrations/actionCategorizationRegistrations.js';
import { registerEventBusAdapters } from './registrations/eventBusAdapterRegistrations.js';
import { registerInitializers } from './registrations/initializerRegistrations.js';
import { registerRuntime } from './registrations/runtimeRegistrations.js';
import { registerPipelineServices } from './registrations/pipelineServiceRegistrations.js';
import { registerGoapServices } from './registrations/goapRegistrations.js';
import { registerCombatServices } from './registrations/combatRegistrations.js';

// Game-specific registrations (conditionally imported)
import {
  registerAI,
  registerMinimalAIForCharacterBuilder,
} from './registrations/aiRegistrations.js';
import { registerTurnLifecycle } from './registrations/turnLifecycleRegistrations.js';
import { registerOrchestration } from './registrations/orchestrationRegistrations.js';
// UI registrations will be dynamically imported only when needed
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

  try {
    // --- Core Registration (always needed) ---
    // These services are required by both game and tools
    if (logger) logger.debug('[BaseContainerConfig] Registering loaders...');
    try {
      await registerLoaders(container);
    } catch (error) {
      const errorMessage = `Failed to register loaders: ${error.message}`;
      if (logger) {
        logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      }
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering infrastructure...');
    try {
      registerInfrastructure(container);
    } catch (error) {
      const errorMessage = `Failed to register infrastructure: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering action tracing...');
    try {
      registerActionTracing(container);
    } catch (error) {
      const errorMessage = `Failed to register action tracing: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering world and entity...');
    try {
      registerWorldAndEntity(container);
    } catch (error) {
      const errorMessage = `Failed to register world and entity: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering pipeline services...');
    try {
      registerPipelineServices(container);
    } catch (error) {
      const errorMessage = `Failed to register pipeline services: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering command and action...');
    try {
      registerCommandAndAction(container);
    } catch (error) {
      const errorMessage = `Failed to register command and action: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering interpreters...');
    try {
      registerInterpreters(container);
    } catch (error) {
      const errorMessage = `Failed to register interpreters: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering GOAP services...');
    try {
      registerGoapServices(container);
    } catch (error) {
      const errorMessage = `Failed to register GOAP services: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

    if (logger)
      logger.debug('[BaseContainerConfig] Registering combat services...');
    try {
      registerCombatServices(container);
    } catch (error) {
      const errorMessage = `Failed to register combat services: ${error.message}`;
      if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      throw new Error(errorMessage);
    }

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
      // Character builder needs minimal AI services (LlmJsonService, LLMAdapter, etc.)
      // If game systems aren't included, register only the minimal AI services needed
      if (!includeGameSystems) {
        if (logger) {
          logger.debug(
            '[BaseContainerConfig] Registering minimal AI services for character builder...'
          );
        }
        registerMinimalAIForCharacterBuilder(container, logger);
      }
      registerCharacterBuilder(container);
    }

    // Continue with core registrations
    registerEventBusAdapters(container);

    // Register action categorization services
    if (logger)
      logger.debug(
        '[BaseContainerConfig] Registering action categorization services...'
      );
    try {
      registerActionCategorization(container);
    } catch (error) {
      const errorMessage = `Failed to register action categorization services: ${error.message}`;
      if (logger) {
        logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
      }
      throw new Error(errorMessage);
    }

    // --- Conditionally register UI ---
    if (includeUI && uiElements) {
      if (logger) {
        logger.debug('[BaseContainerConfig] Registering UI components...');
      }
      // Dynamically import UI registrations only when needed
      const { registerUI } = await import('./registrations/uiRegistrations.js');
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

    // Execute any registered callbacks after all services are registered
    if (container.executeCallbacks) {
      if (logger) {
        logger.debug('[BaseContainerConfig] Executing registered callbacks...');
      }
      container.executeCallbacks();
    }

    if (logger) {
      logger.debug(
        '[BaseContainerConfig] Base container configuration complete.'
      );
    }
  } catch (error) {
    if (logger) {
      logger.error('[BaseContainerConfig] Configuration failed:', error);
    } else {
      // eslint-disable-next-line no-console
      console.error('[BaseContainerConfig] Configuration failed:', error);
    }
    throw error;
  }
}
