// src/services/validatedEventDispatcher.js

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../core/services/gameDataRepository.js').EventDefinition} EventDefinition */
/** @typedef {import('../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */

/**
 * A service responsible for validating event payloads against their definitions
 * (if available) and dispatching them via the EventBus.
 * Ensures that events are structurally correct before being sent.
 */
class ValidatedEventDispatcher {
    /** @private @type {EventBus} */
    #eventBus;
    /** @private @type {GameDataRepository} */
    #gameDataRepository;
    /** @private @type {ISchemaValidator} */
    #schemaValidator;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of ValidatedEventDispatcher.
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {ISchemaValidator} dependencies.schemaValidator
     * @param {ILogger} dependencies.logger
     */
    constructor({eventBus, gameDataRepository, schemaValidator, logger}) {
        if (!eventBus) throw new Error("ValidatedEventDispatcher: Missing required dependency 'eventBus'.");
        if (!gameDataRepository) throw new Error("ValidatedEventDispatcher: Missing required dependency 'gameDataRepository'.");
        if (!schemaValidator) throw new Error("ValidatedEventDispatcher: Missing required dependency 'schemaValidator'.");
        if (!logger) throw new Error("ValidatedEventDispatcher: Missing required dependency 'logger'.");

        this.#eventBus = eventBus;
        this.#gameDataRepository = gameDataRepository;
        this.#schemaValidator = schemaValidator;
        this.#logger = logger;

        this.#logger.info("ValidatedEventDispatcher: Instance created.");
    }

    /**
     * Validates the event payload against its definition schema (if available)
     * and dispatches the event via the EventBus if validation passes or is not required.
     * Logs detailed information about the validation and dispatch process.
     *
     * @param {string} eventName - The namespaced ID of the event to dispatch.
     * @param {object} payload - The data payload for the event.
     * @returns {Promise<boolean>} A promise resolving to `true` if the event was successfully dispatched,
     * and `false` otherwise (e.g., validation failure, dispatch error).
     */
    async dispatchValidated(eventName, payload) {
        let shouldDispatch = true;
        let validationAttempted = false;
        let validationPassed = true; // Assume valid unless proven otherwise

        try {
            // --- 1. Get Event Definition ---
            const eventDefinition = this.#gameDataRepository.getEventDefinition(eventName);

            if (eventDefinition) {
                // --- 2. Check for Payload Schema ---
                if (eventDefinition.payloadSchema) {
                    validationAttempted = true;
                    const schemaId = `${eventName}#payload`;

                    // --- 3. Check if Schema is Loaded ---
                    if (this.#schemaValidator.isSchemaLoaded(schemaId)) {
                        this.#logger.debug(`ValidatedDispatcher: Validating payload for event '${eventName}' against schema '${schemaId}'...`);

                        // --- 4. Validate Payload ---
                        const validationResult = this.#schemaValidator.validate(schemaId, payload);

                        if (!validationResult.valid) {
                            validationPassed = false;
                            const errorDetails = validationResult.errors?.map(e => `[${e.instancePath || 'root'}]: ${e.message}`).join('; ') || 'No details available';

                            // --- 5. Handle Failure: Log Error, Skip Dispatch (Consistent approach) ---
                            this.#logger.error(`ValidatedDispatcher: Payload validation FAILED for event '${eventName}'. Dispatch SKIPPED. Errors: ${errorDetails}`, {
                                payload,
                                errors: validationResult.errors
                            });
                            shouldDispatch = false; // Prevent dispatch
                        } else {
                            // Validation Succeeded
                            this.#logger.debug(`ValidatedDispatcher: Payload validation SUCCEEDED for event '${eventName}'.`);
                        }
                    } else {
                        // Schema Not Loaded: Log Warning, Skip Validation, Proceed with Dispatch
                        this.#logger.warn(`ValidatedDispatcher: Payload schema '${schemaId}' not found/loaded for event '${eventName}'. Skipping validation and proceeding with dispatch.`);
                        // shouldDispatch remains true
                    }
                } else {
                    // No Schema Defined: Log Debug, Skip Validation, Proceed with Dispatch
                    this.#logger.debug(`ValidatedDispatcher: Event definition '${eventName}' found, but no 'payloadSchema' defined. Skipping validation and proceeding with dispatch.`);
                    // shouldDispatch remains true
                }
            } else {
                // Event Definition Not Found: Log Warning, Skip Validation, Proceed with Dispatch
                this.#logger.warn(`ValidatedDispatcher: EventDefinition not found for '${eventName}'. Cannot validate payload. Proceeding with dispatch.`);
                // shouldDispatch remains true
            }
        } catch (validationProcessError) {
            // Catch errors in the validation *process* itself
            this.#logger.error(`ValidatedDispatcher: Unexpected error during payload validation process for event '${eventName}'. Dispatch might be skipped depending on outcome.`, validationProcessError);
            // If validation explicitly failed before this error, respect that. Otherwise, skip dispatch due to the process error.
            if (validationPassed && shouldDispatch) {
                shouldDispatch = false; // Skip dispatch because the validation process itself failed
                this.#logger.error(`ValidatedDispatcher: Dispatch explicitly skipped for '${eventName}' due to error *during* validation process.`);
            } else if (!validationPassed) {
                // Already decided not to dispatch due to failed validation, the process error is secondary.
                this.#logger.debug(`ValidatedDispatcher: Dispatch already skipped for '${eventName}' due to validation failure; process error occurred subsequently.`);
                // --- FIX: Ensure shouldDispatch is false in this case ---
                shouldDispatch = false;
                // ----------------------------------------------------------
            }
            // If neither condition is met (e.g., error occurred before validation check),
            // the initial 'shouldDispatch = true' might still stand, but the error log indicates a problem.
            // However, for safety in unexpected scenarios, you might even consider adding an else block
            // to set shouldDispatch = false here too, unless there's a specific reason not to.
            // Example safety addition (optional):
            // else {
            //    this.#logger.warn(`ValidatedDispatcher: Unhandled state in validation process catch block for event '${eventName}'. Defaulting to skip dispatch.`);
            //    shouldDispatch = false;
            // }
        }

        // --- Final Dispatch Decision ---
        if (shouldDispatch) {
            try {
                this.#logger.debug(`ValidatedDispatcher: Dispatching event '${eventName}'...`, payload);
                await this.#eventBus.dispatch(eventName, payload);
                this.#logger.debug(`ValidatedDispatcher: Event '${eventName}' dispatch successful.`);
                return true; // Dispatch occurred
            } catch (dispatchError) {
                this.#logger.error(`ValidatedDispatcher: Error occurred during EventBus.dispatch for event '${eventName}':`, dispatchError);
                return false; // Dispatch failed
            }
        } else {
            this.#logger.debug(`ValidatedDispatcher: Dispatch explicitly skipped for event '${eventName}'.`);
            return false; // Dispatch did not occur
        }
    }
}

export default ValidatedEventDispatcher;