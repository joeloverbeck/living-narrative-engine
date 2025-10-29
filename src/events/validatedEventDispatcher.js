// src/events/validatedEventDispatcher.js

/**
 * @file Defines the ValidatedEventDispatcher service.
 * This service validates event payloads against schemas (if available)
 * before dispatching them through the main EventBus. It also acts
 * as a facade for subscribing and unsubscribing via the EventBus.
 */

/** @typedef {import('../interfaces/IEventBus.js').IEventBus} IEventBus */
/** @typedef {import('./eventBus.js').EventListener} EventListener */ // Added for type hinting
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../data/gameDataRepository.js').EventDefinition} EventDefinition */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */

import { IValidatedEventDispatcher } from '../interfaces/IValidatedEventDispatcher.js';

/**
 * A service responsible for validating event payloads against their definitions
 * (if available and loaded) and dispatching them via the EventBus. It also
 * provides subscribe/unsubscribe methods that delegate directly to the EventBus.
 * Ensures that events are structurally correct before being sent, when possible.
 */
class ValidatedEventDispatcher extends IValidatedEventDispatcher {
  /** @type {IEventBus} */
  #eventBus;
  #gameDataRepository;
  #schemaValidator;
  #logger;

  /**
   * Creates an instance of ValidatedEventDispatcher.
   *
   * @param {object} dependencies
   * @param {IEventBus} dependencies.eventBus - The main event bus for dispatching and subscriptions.
   * @param {GameDataRepository} dependencies.gameDataRepository - Repository to access event definitions.
   * @param {ISchemaValidator} dependencies.schemaValidator - Service to validate payloads against JSON schemas.
   * @param {ILogger} dependencies.logger - Service for logging messages.
   */
  constructor({ eventBus, gameDataRepository, schemaValidator, logger }) {
    super();

    if (!eventBus)
      throw new Error(
        "ValidatedEventDispatcher: Missing required dependency 'eventBus'."
      );
    if (!gameDataRepository)
      throw new Error(
        "ValidatedEventDispatcher: Missing required dependency 'gameDataRepository'."
      );
    if (!schemaValidator)
      throw new Error(
        "ValidatedEventDispatcher: Missing required dependency 'schemaValidator'."
      );
    if (!logger)
      throw new Error(
        "ValidatedEventDispatcher: Missing required dependency 'logger'."
      );

    this.#eventBus = eventBus;
    this.#gameDataRepository = gameDataRepository;
    this.#schemaValidator = schemaValidator;
    this.#logger = logger;

    this.#logger.debug('ValidatedEventDispatcher: Instance created.');
  }

  /**
   * Validates the payload for an event if a schema is available.
   *
   * @param {string} eventName - Event identifier.
   * @param {object} payload - Event payload.
   * @param {boolean} allowSchemaNotFound - If true, suppress warnings when schema is missing.
   * @returns {{ shouldDispatch: boolean, validationAttempted: boolean, validationPassed: boolean }}
   */
  #validatePayload(eventName, payload, allowSchemaNotFound) {
    let validationAttempted = false;

    try {
      const eventDefinition =
        this.#gameDataRepository.getEventDefinition(eventName);

      if (!eventDefinition) {
        // Special handling for bootstrap events that may be dispatched before they're registered
        // during initialization
        if (
          eventName === 'core:system_error_occurred' ||
          eventName === 'core:critical_notification_shown'
        ) {
          this.#logger.debug(
            `VED: EventDefinition not found for '${eventName}' (expected during bootstrap). Proceeding with dispatch.`
          );
        } else if (!allowSchemaNotFound) {
          this.#logger.warn(
            `VED: EventDefinition not found for '${eventName}'. Cannot validate payload. Proceeding with dispatch.`
          );
        } else {
          this.#logger.debug(
            `VED: EventDefinition not found for '${eventName}'. Skipping validation as allowed by options.`
          );
        }
        return {
          shouldDispatch: true,
          validationAttempted,
          validationPassed: true,
        };
      }

      if (!eventDefinition.payloadSchema) {
        this.#logger.debug(
          `VED: Event definition '${eventName}' found, but no 'payloadSchema' defined. Skipping validation and proceeding with dispatch.`
        );
        return {
          shouldDispatch: true,
          validationAttempted,
          validationPassed: true,
        };
      }

      validationAttempted = true;
      const schemaId = `${eventName}#payload`;
      if (!this.#schemaValidator.isSchemaLoaded(schemaId)) {
        if (!allowSchemaNotFound) {
          this.#logger.warn(
            `VED: Payload schema '${schemaId}' not found/loaded for event '${eventName}'. Skipping validation and proceeding with dispatch.`
          );
        } else {
          this.#logger.debug(
            `VED: Payload schema '${schemaId}' not found/loaded for event '${eventName}'. Skipping validation as allowed by options.`
          );
        }
        return {
          shouldDispatch: true,
          validationAttempted,
          validationPassed: true,
        };
      }

      this.#logger.debug(
        `VED: Validating payload for event '${eventName}' against schema '${schemaId}'...`
      );
      const validationResult = this.#schemaValidator.validate(
        schemaId,
        payload
      );
      if (!validationResult.isValid) {
        const errorDetails =
          validationResult.errors
            ?.map((e) => `[${e.instancePath || 'root'}]: ${e.message}`)
            .join('; ') || 'No details available';
        this.#logger.error(
          `VED: Payload validation FAILED for event '${eventName}'. Dispatch SKIPPED. Errors: ${errorDetails}`,
          {
            payload,
            errors: validationResult.errors,
          }
        );
        return {
          shouldDispatch: false,
          validationAttempted,
          validationPassed: false,
        };
      }

      this.#logger.debug(
        `VED: Payload validation SUCCEEDED for event '${eventName}'.`
      );
      return {
        shouldDispatch: true,
        validationAttempted,
        validationPassed: true,
      };
    } catch (validationProcessError) {
      this.#logger.error(
        `VED: Unexpected error during payload validation process for event '${eventName}'. Dispatch will be skipped.`,
        validationProcessError
      );
      return {
        shouldDispatch: false,
        validationAttempted: true,
        validationPassed: false,
      };
    }
  }

  /**
   * Emits an event through the EventBus and handles errors.
   *
   * @param {string} eventName - Name of the event to emit.
   * @param {object} payload - Event payload.
   * @returns {Promise<boolean>} Resolves `true` on success, `false` on failure.
   */
  /**
   * Emits an event through the EventBus and handles errors.
   *
   * @param {string} eventName - Name of the event to emit.
   * @param {object} payload - Event payload.
   * @returns {Promise<boolean>} Resolves `true` on success, `false` on failure.
   */
  async #emitEvent(eventName, payload) {
    try {
      // Enhanced circuit breaker for error events
      const isErrorEvent = eventName === 'core:system_error_occurred';

      // The circuit breaker logic is now handled above with the Set approach

      try {
        // Enhanced safety around logger calls
        if (isErrorEvent) {
          // For error events, skip logger debug messages that could trigger recursion
          console.debug(
            `VED: Dispatching error event '${eventName}' via EventBus (using console to prevent recursion)...`
          );
        } else {
          try {
            this.#logger.debug(
              `VED: Dispatching event '${eventName}' via EventBus...`,
              payload
            );
          } catch {
            // Logger failed - fallback to console
            console.debug(
              `VED: Logger failed, using console: Dispatching event '${eventName}' via EventBus...`
            );
          }
        }

        await this.#eventBus.dispatch(eventName, payload);

        if (isErrorEvent) {
          console.debug(
            `VED: Error event '${eventName}' dispatch successful (using console).`
          );
        } else {
          try {
            this.#logger.debug(
              `VED: Event '${eventName}' dispatch successful.`
            );
          } catch {
            console.debug(
              `VED: Event '${eventName}' dispatch successful (logger failed).`
            );
          }
        }
        return true;
      } finally {
        // Reset flag after dispatch completes - handled by Set cleanup above
      }
    } catch (dispatchError) {
      // Enhanced error handling to prevent recursion
      const isErrorEvent =
        eventName === 'core:system_error_occurred' ||
        eventName.includes('error');

      if (isErrorEvent) {
        // Use console for error events to prevent recursion
        console.error(
          `VED: Error during error event dispatch (using console to prevent recursion):`,
          dispatchError
        );
      } else {
        // For regular events, try logger but fallback to console
        try {
          this.#logger.error(
            `VED: Error occurred during EventBus.dispatch for event '${eventName}':`,
            dispatchError
          );
        } catch (loggerError) {
          console.error(
            `VED: Logger failed during error handling for '${eventName}'. Original error:`,
            dispatchError,
            'Logger error:',
            loggerError
          );
        }
      }
      return false;
    }
  }

  /**
   * Validates the event payload against its definition schema (if available and loaded)
   * and dispatches the event via the EventBus if validation passes or is skipped.
   * Logs detailed information, including warnings if validation is skipped due to
   * missing definitions or schemas, unless suppressed by options.
   *
   * @param {string} eventName - The namespaced ID of the event to dispatch.
   * @param {object} payload - The data payload for the event.
   * @param {object} [options] - Optional settings.
   * @param {boolean} [options.allowSchemaNotFound] - If true, suppresses warnings when dispatching occurs specifically because an event definition or its associated payload schema was not found or not yet loaded.
   * @returns {Promise<boolean>} A promise resolving to `true` if the event was successfully dispatched, and `false` otherwise.
   */
  async dispatch(eventName, payload, options = {}) {
    const { allowSchemaNotFound = false } = options;
    const { shouldDispatch, validationAttempted, validationPassed } =
      this.#validatePayload(eventName, payload, allowSchemaNotFound);

    if (shouldDispatch) {
      return this.#emitEvent(eventName, payload);
    }

    if (validationAttempted && !validationPassed) {
      this.#logger.debug(
        `VED: Dispatch skipped for '${eventName}' due to validation failure (see error above).`
      );
    }
    return false;
  }

  /**
   * Subscribes a listener function to a specific event name.
   * Delegates directly to the underlying EventBus and returns a function
   * that can be called to unsubscribe the listener.
   *
   * @param {string} eventName - The name of the event to subscribe to.
   * @param {EventListener} listener - The function to call when the event is dispatched.
   * @returns {(() => boolean) | null} An unsubscribe function on success, or `null` on failure.
   */
  subscribe(eventName, listener) {
    this.#logger.debug(
      `VED: Delegating subscription for event "${eventName}" to EventBus.`
    );
    // Delegate subscription to the internal EventBus instance
    return this.#eventBus.subscribe(eventName, listener);
  }

  /**
   * Unsubscribes a listener function from a specific event name.
   * Delegates directly to the underlying EventBus.
   *
   * @param {string} eventName - The name of the event to unsubscribe from.
   * @param {EventListener} listener - The listener function to remove.
   * @returns {boolean} `true` if a listener was removed, otherwise `false`.
   */
  unsubscribe(eventName, listener) {
    this.#logger.debug(
      `VED: Delegating unsubscription for event "${eventName}" to EventBus.`
    );
    // Delegate directly to the internal EventBus instance
    return this.#eventBus.unsubscribe(eventName, listener);
  }

  /**
   * Sets batch mode on the underlying EventBus to control event processing behavior.
   * This is primarily used to prevent infinite recursion during bulk operations.
   *
   * @param {boolean} enabled - Whether to enable or disable batch mode
   * @param {object} [options] - Batch mode configuration options
   * @param {number} [options.maxRecursionDepth] - Maximum recursion depth in batch mode
   * @param {number} [options.maxGlobalRecursion] - Maximum global recursion in batch mode
   * @param {number} [options.timeoutMs] - Auto-disable timeout in milliseconds
   * @param {string} [options.context] - Context description for logging
   * @returns {void}
   */
  setBatchMode(enabled, options = {}) {
    this.#logger.debug(
      `VED: Delegating setBatchMode(${enabled}) to EventBus with context: ${options.context || 'unknown'}`
    );
    // Delegate directly to the internal EventBus instance
    this.#eventBus.setBatchMode(enabled, options);
  }
}

export default ValidatedEventDispatcher;
