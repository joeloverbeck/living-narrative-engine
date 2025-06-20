// src/dependencyInjection/registrations/eventBusAdapterRegistrations.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../turns/ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { SHUTDOWNABLE as _SHUTDOWNABLE } from '../tags.js';

// --- Adapter Imports ---
import { EventBusPromptAdapter } from '../../turns/adapters/eventBusPromptAdapter.js';
import EventBusTurnEndAdapter from '../../turns/adapters/eventBusTurnEndAdapter.js';

/**
 * Registers the default event bus-based port adapters.
 *
 * @param {AppContainer} container - The application's DI container.
 */
export function registerEventBusAdapters(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Event Bus Adapter Registrations: Starting...');

  // --- Register EventBusPromptAdapter ---
  registrar.singletonFactory(tokens.IPromptOutputPort, (c) => {
    // --- FIX: Check for registration before resolving optional dependencies. ---
    // This prevents c.resolve() from throwing an error if a dependency isn't registered.
    const safeDispatcher = c.isRegistered(tokens.ISafeEventDispatcher)
      ? /** @type {ISafeEventDispatcher | null} */ (
          c.resolve(tokens.ISafeEventDispatcher)
        )
      : null;
    const validatedDispatcher = c.isRegistered(tokens.IValidatedEventDispatcher)
      ? /** @type {IValidatedEventDispatcher | null} */ (
          c.resolve(tokens.IValidatedEventDispatcher)
        )
      : null;

    if (!safeDispatcher && !validatedDispatcher) {
      logger.error(
        `Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.IPromptOutputPort}.`
      );
      throw new Error(
        `Missing dispatcher dependency for EventBusPromptAdapter`
      );
    }
    return new EventBusPromptAdapter({
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: validatedDispatcher,
    });
  });
  logger.debug(
    `Adapter Registration: Registered EventBusPromptAdapter as ${tokens.IPromptOutputPort}.`
  );

  // --- Register EventBusTurnEndAdapter ---
  registrar.singletonFactory(tokens.ITurnEndPort, (c) => {
    const safeDispatcher = c.isRegistered(tokens.ISafeEventDispatcher)
      ? /** @type {ISafeEventDispatcher} */ (
          c.resolve(tokens.ISafeEventDispatcher)
        )
      : null;

    if (!safeDispatcher) {
      logger.error(
        `Adapter Registration: Failed to resolve ${tokens.ISafeEventDispatcher} for ${tokens.ITurnEndPort}.`
      );
      throw new Error(
        `Missing dispatcher dependency for EventBusTurnEndAdapter`
      );
    }
    return new EventBusTurnEndAdapter({
      safeEventDispatcher: safeDispatcher,
      logger,
    });
  });
  logger.debug(
    `Adapter Registration: Registered EventBusTurnEndAdapter as ${tokens.ITurnEndPort}.`
  );

  logger.debug('Event Bus Adapter Registrations: All registrations complete.');
}
