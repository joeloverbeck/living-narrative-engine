// src/core/config/registrations/adapterRegistrations.js
// ****** NEW FILE ******

/**
 * @fileoverview Registers port adapter implementations with the DI container.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../ports/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */

// --- Adapter Imports ---
import { EventBusCommandInputGateway } from '../../adapters/eventBusCommandInputGateway.js';
import { EventBusPromptAdapter } from '../../adapters/eventBusPromptAdapter.js';
import { EventBusTurnEndAdapter } from '../../adapters/EventBusTurnEndAdapter.js'; // Corrected filename case

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { SHUTDOWNABLE } from "../tags.js"; // Import SHUTDOWNABLE if needed (e.g., for destroy methods)

/**
 * Registers the default port adapters.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerAdapters(container) {
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('Adapter Registrations: Starting...');

    // --- Register EventBusCommandInputGateway ---
    // Implements ICommandInputPort, depends on IValidatedEventDispatcher.
    // Has a destroy() method, so tag as SHUTDOWNABLE.
    registrar.tagged(SHUTDOWNABLE).singletonFactory(tokens.ICommandInputPort, (c) => {
        const ved = /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher));
        if (!ved) {
            logger.error(`Adapter Registration: Failed to resolve ${tokens.IValidatedEventDispatcher} for ${tokens.ICommandInputPort}.`);
            throw new Error(`Missing dependency ${tokens.IValidatedEventDispatcher} for EventBusCommandInputGateway`);
        }
        return new EventBusCommandInputGateway({ validatedEventDispatcher: ved });
    });
    logger.debug(`Adapter Registration: Registered EventBusCommandInputGateway as ${tokens.ICommandInputPort} tagged with ${SHUTDOWNABLE.join(', ')}.`);


    // --- Register EventBusPromptAdapter ---
    // Implements IPromptOutputPort, depends on ISafeEventDispatcher (preferred) and IValidatedEventDispatcher.
    // No destroy() method currently, so no SHUTDOWNABLE tag.
    registrar.singletonFactory(tokens.IPromptOutputPort, (c) => {
        // Resolve both potential dependencies
        const safeDispatcher = /** @type {ISafeEventDispatcher | null} */ (c.resolve(tokens.ISafeEventDispatcher));
        const validatedDispatcher = /** @type {IValidatedEventDispatcher | null} */ (c.resolve(tokens.IValidatedEventDispatcher));

        if (!safeDispatcher && !validatedDispatcher) {
            logger.error(`Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.IPromptOutputPort}.`);
            throw new Error(`Missing dispatcher dependency for EventBusPromptAdapter`);
        }
        // Pass both to the constructor; it will decide which to use.
        return new EventBusPromptAdapter({
            safeEventDispatcher: safeDispatcher,
            validatedEventDispatcher: validatedDispatcher
        });
    });
    logger.debug(`Adapter Registration: Registered EventBusPromptAdapter as ${tokens.IPromptOutputPort}.`);


    // --- Register EventBusTurnEndAdapter ---
    // Implements ITurnEndPort, depends on ISafeEventDispatcher (preferred) and IValidatedEventDispatcher.
    // No destroy() method currently, so no SHUTDOWNABLE tag.
    registrar.singletonFactory(tokens.ITurnEndPort, (c) => {
        // Resolve both potential dependencies
        const safeDispatcher = /** @type {ISafeEventDispatcher | null} */ (c.resolve(tokens.ISafeEventDispatcher));
        const validatedDispatcher = /** @type {IValidatedEventDispatcher | null} */ (c.resolve(tokens.IValidatedEventDispatcher));

        if (!safeDispatcher && !validatedDispatcher) {
            logger.error(`Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.ITurnEndPort}.`);
            throw new Error(`Missing dispatcher dependency for EventBusTurnEndAdapter`);
        }
        // Pass both to the constructor.
        return new EventBusTurnEndAdapter({
            safeEventDispatcher: safeDispatcher,
            validatedEventDispatcher: validatedDispatcher
        });
    });
    logger.debug(`Adapter Registration: Registered EventBusTurnEndAdapter as ${tokens.ITurnEndPort}.`);


    logger.info('Adapter Registrations: Complete.');
}