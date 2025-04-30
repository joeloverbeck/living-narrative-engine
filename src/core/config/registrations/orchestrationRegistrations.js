// src/core/config/registrations/orchestrationRegistrations.js

/**
 * @fileoverview Registers high-level orchestration services like InitializationService and ShutdownService.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../gameLoop.js').default} GameLoop */

// --- Service Imports ---
import InitializationService from '../../initializers/services/initializationService.js'; // Adjust path if necessary
import ShutdownService from '../../shutdown/services/shutdownService.js';             // Adjust path if necessary

// --- DI & Helper Imports ---
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';

/**
 * Registers the InitializationService and ShutdownService.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerOrchestration(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('Orchestration Registration: Starting...');

    // --- Initialization Service ---
    // Singleton lifecycle is appropriate as it manages a global process.
    registrar.singletonFactory(tokens.InitializationService, (c) => {
        logger.debug(`Orchestration Registration: Factory creating ${tokens.InitializationService}...`);
        return new InitializationService({
            container: c, // Pass the container itself
            logger: c.resolve(tokens.ILogger),
            validatedEventDispatcher: c.resolve(tokens.ValidatedEventDispatcher)
        });
    });
    logger.info(`Orchestration Registration: Registered ${tokens.InitializationService} (Singleton).`);

    // --- Shutdown Service ---
    // Singleton lifecycle is appropriate.
    registrar.singletonFactory(tokens.ShutdownService, (c) => {
        logger.debug(`Orchestration Registration: Factory creating ${tokens.ShutdownService}...`);
        // Note: GameLoop might not be fully ready or even resolved when the container is configured,
        // but the service constructor validates it upon injection.
        // The service's `runShutdownSequence` method should handle cases where the loop isn't running.
        return new ShutdownService({
            container: c, // Pass the container itself
            logger: c.resolve(tokens.ILogger),
            validatedEventDispatcher: c.resolve(tokens.ValidatedEventDispatcher),
            gameLoop: c.resolve(tokens.GameLoop) // GameLoop is resolved here
        });
    });
    logger.info(`Orchestration Registration: Registered ${tokens.ShutdownService} (Singleton).`);

    logger.info('Orchestration Registration: Complete.');
}