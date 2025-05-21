// src/core/config/registrations/orchestrationRegistrations.js

/**
 * @fileoverview Registers high-level orchestration services like InitializationService and ShutdownService.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../appContainer.js').default} AppContainer */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */ // Adjusted path assuming interfaces is sibling to core
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Adjusted path assuming services is sibling to core

// --- Service Imports ---
import InitializationService from '../../initializers/services/initializationService.js'; // Adjusted path
import ShutdownService from '../../shutdown/services/shutdownService.js';             // Adjusted path

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js'; // Adjusted path

/**
 * Registers the InitializationService and ShutdownService.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerOrchestration(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger); // Assumes ILogger is already registered
    logger.info('Orchestration Registration: Starting...');

    // --- Initialization Service ---
    // Singleton lifecycle is appropriate as it manages a global process.
    registrar.singletonFactory(tokens.IInitializationService, (c) => {
        logger.debug(`Orchestration Registration: Factory creating ${tokens.IInitializationService}...`);
        // Ensure all dependencies are resolved using the CORRECT tokens
        const initLogger = c.resolve(tokens.ILogger);
        const initDispatcher = c.resolve(tokens.IValidatedEventDispatcher); // <<< CORRECTED TOKEN HERE

        // Validate resolved dependencies before passing to constructor (optional but good practice)
        if (!initLogger) throw new Error(`InitializationService Factory: Failed to resolve dependency: ${tokens.ILogger}`);
        if (!initDispatcher) throw new Error(`InitializationService Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`);

        return new InitializationService({
            container: c, // Pass the container itself
            logger: initLogger,
            validatedEventDispatcher: initDispatcher
        });
    });
    logger.info(`Orchestration Registration: Registered ${tokens.IInitializationService} (Singleton).`);

    // --- Shutdown Service ---
    // Singleton lifecycle is appropriate.
    registrar.singletonFactory(tokens.ShutdownService, (c) => {
        logger.debug(`Orchestration Registration: Factory creating ${tokens.ShutdownService}...`);
        // Ensure all dependencies are resolved using the CORRECT tokens
        const shutdownLogger = c.resolve(tokens.ILogger);
        const shutdownDispatcher = c.resolve(tokens.IValidatedEventDispatcher); // <<< CHECK THIS ONE TOO! It should also use 'I'
        const shutdownGameLoop = c.resolve(tokens.GameLoop);

        // Validate resolved dependencies
        if (!shutdownLogger) throw new Error(`ShutdownService Factory: Failed to resolve dependency: ${tokens.ILogger}`);
        if (!shutdownDispatcher) throw new Error(`ShutdownService Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`);
        if (!shutdownGameLoop) throw new Error(`ShutdownService Factory: Failed to resolve dependency: ${tokens.GameLoop}`);

        // Note: GameLoop might not be fully ready or even resolved when the container is configured,
        // but the service constructor validates it upon injection.
        // The service's `runShutdownSequence` method should handle cases where the loop isn't running.
        return new ShutdownService({
            container: c, // Pass the container itself
            logger: shutdownLogger,
            validatedEventDispatcher: shutdownDispatcher,
            gameLoop: shutdownGameLoop // GameLoop is resolved here
        });
    });
    logger.info(`Orchestration Registration: Registered ${tokens.ShutdownService} (Singleton).`);

    logger.info('Orchestration Registration: Complete.');
}
