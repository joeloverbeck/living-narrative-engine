// src/core/registryInitializer.js

// --- Import Configurations ---
// These were previously imported in containerConfig.js factories
import {componentRegistryConfig} from '../config/componentRegistry.config.js';
// Removed import for actionHandlerRegistryConfig as it's no longer used
// import { actionHandlerRegistryConfig } from '../config/actionHandlerRegistry.config.js';

// --- Import Types for JSDoc ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */

/**
 * Responsible for centralizing the registration of components
 * with the EntityManager after it has been instantiated.
 * Action handler registration is no longer performed here.
 */
class RegistryInitializer {
    /**
     * Populates the component registry of the provided EntityManager
     * using the imported configuration map.
     *
     * @param {EntityManager} entityManager - The EntityManager instance.
     * @param {ActionExecutor} actionExecutor - The ActionExecutor instance (passed but no longer used for registration here).
     */
    initializeRegistries(entityManager, actionExecutor) {
        // --- Validate EntityManager ---
        if (!entityManager || typeof entityManager.registerComponent !== 'function') {
            throw new Error("RegistryInitializer: A valid EntityManager instance is required.");
        }
        // --- Validate ActionExecutor (presence only, not registerHandler method) ---
        if (!actionExecutor) {
            // Optional: Keep the check to ensure it's provided, even if not used for registration here.
            // Or remove this check if ActionExecutor is no longer strictly needed by this initializer.
            console.warn("RegistryInitializer: ActionExecutor instance provided but no longer used for handler registration in this initializer.");
            // throw new Error("RegistryInitializer: A valid ActionExecutor instance is required."); // Uncomment if needed
        }


        console.log("RegistryInitializer: Initializing component registry...");

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

        // --- Removed Action Handler Registration ---
        // The block for registering action handlers with ActionExecutor has been removed
        // as the registerHandler method is deprecated and removed.
        console.log("RegistryInitializer: Action handler registration is skipped (using definition-based execution).");


        console.log("RegistryInitializer: Registry initialization finished.");
    }
}

export default RegistryInitializer;