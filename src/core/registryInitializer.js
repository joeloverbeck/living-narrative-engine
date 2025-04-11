// src/core/registryInitializer.js

// --- Import Configurations ---
// These were previously imported in containerConfig.js factories
import { componentRegistryConfig } from '../config/componentRegistry.config.js';
import { actionHandlerRegistryConfig } from '../config/actionHandlerRegistry.config.js';

// --- Import Types for JSDoc ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */

/**
 * Responsible for centralizing the registration of components and action handlers
 * with their respective managers after the managers have been instantiated.
 */
class RegistryInitializer {
    /**
     * Populates the registries of the provided EntityManager and ActionExecutor
     * using the imported configuration maps.
     *
     * @param {EntityManager} entityManager - The EntityManager instance.
     * @param {ActionExecutor} actionExecutor - The ActionExecutor instance.
     */
    initializeRegistries(entityManager, actionExecutor) {
        if (!entityManager || typeof entityManager.registerComponent !== 'function') {
            throw new Error("RegistryInitializer: A valid EntityManager instance is required.");
        }
        if (!actionExecutor || typeof actionExecutor.registerHandler !== 'function') {
            throw new Error("RegistryInitializer: A valid ActionExecutor instance is required.");
        }

        console.log("RegistryInitializer: Initializing component and action handler registries...");

        // --- Register Components with EntityManager ---
        if (!componentRegistryConfig || !(componentRegistryConfig instanceof Map) || componentRegistryConfig.size === 0) {
            // Use console.warn for non-fatal configuration issues
            console.warn("RegistryInitializer: Component registry configuration is invalid, empty, or failed to load. No components registered.");
        } else {
            try {
                for (const [jsonKey, componentClass] of componentRegistryConfig.entries()) {
                    // EntityManager's registerComponent already has logging and error handling
                    entityManager.registerComponent(jsonKey, componentClass);
                }
                // Log summary based on internal state of EntityManager registry for accuracy
                console.log(`RegistryInitializer: Component registration process completed. EntityManager reports ${entityManager.componentRegistry.size} components registered.`);
            } catch (error) {
                // Catch potential errors during the loop itself, though registerComponent should handle its own errors.
                // This is more of a safeguard.
                console.error(`RegistryInitializer: Error during component registration loop: ${error.message}`, error);
                // Optionally re-throw to make registration failure fatal (halts initialization)
                // throw error;
            }
        }

        // --- Register Action Handlers with ActionExecutor ---
        if (!actionHandlerRegistryConfig || !(actionHandlerRegistryConfig instanceof Map) || actionHandlerRegistryConfig.size === 0) {
            console.warn("RegistryInitializer: Action handler registry configuration is invalid, empty, or failed to load. No handlers registered.");
        } else {
            try {
                for (const [actionId, handlerFunction] of actionHandlerRegistryConfig.entries()) {
                    // ActionExecutor's registerHandler already has logging and error handling
                    actionExecutor.registerHandler(actionId, handlerFunction);
                }
                // Log summary based on internal state of ActionExecutor registry
                console.log(`RegistryInitializer: Action handler registration process completed. ActionExecutor reports ${actionExecutor.handlers.size} handlers registered.`);
            } catch (error) {
                console.error(`RegistryInitializer: Error during action handler registration loop: ${error.message}`, error);
                // Optionally re-throw to make registration failure fatal
                // throw error;
            }
        }

        console.log("RegistryInitializer: Registry initialization finished.");
    }
}

export default RegistryInitializer;