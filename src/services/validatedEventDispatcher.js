/**
 * @fileoverview Defines the ValidatedEventDispatcher service.
 * This service validates event payloads against schemas (if available)
 * before dispatching them through the main EventBus.
 */

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../core/services/gameDataRepository.js').EventDefinition} EventDefinition */
/** @typedef {import('../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../core/interfaces/coreServices.js').ValidationResult} ValidationResult */

/**
 * A service responsible for validating event payloads against their definitions
 * (if available and loaded) and dispatching them via the EventBus.
 * Ensures that events are structurally correct before being sent, when possible.
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
     * @param {EventBus} dependencies.eventBus - The main event bus for dispatching.
     * @param {GameDataRepository} dependencies.gameDataRepository - Repository to access event definitions.
     * @param {ISchemaValidator} dependencies.schemaValidator - Service to validate payloads against JSON schemas.
     * @param {ILogger} dependencies.logger - Service for logging messages.
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
     * Validates the event payload against its definition schema (if available and loaded)
     * and dispatches the event via the EventBus if validation passes or is skipped.
     * Logs detailed information, including warnings if validation is skipped due to
     * missing definitions or schemas, unless suppressed by options.
     *
     * @param {string} eventName - The namespaced ID of the event to dispatch.
     * @param {object} payload - The data payload for the event.
     * @param {object} [options={}] - Optional settings.
     * @param {boolean} [options.allowSchemaNotFound=false] - If true, suppresses warnings when dispatching occurs specifically because an event definition or its associated payload schema was not found or not yet loaded. This is useful for early-stage events dispatched before schemas are fully loaded.
     * @returns {Promise<boolean>} A promise resolving to `true` if the event was successfully dispatched (either validated or validation skipped as allowed), and `false` otherwise (e.g., explicit validation failure, dispatch error, or error during validation process).
     */
    async dispatchValidated(eventName, payload, options = {}) {
        const {allowSchemaNotFound = false} = options; // Extract option with default
        let shouldDispatch = true;
        let validationAttempted = false;
        let validationPassed = true; // Assume valid unless proven otherwise or process fails

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
                        /** @type {ValidationResult} */
                        const validationResult = this.#schemaValidator.validate(schemaId, payload);

                        if (!validationResult.isValid) {
                            validationPassed = false;
                            const errorDetails = validationResult.errors?.map(e => `[${e.instancePath || 'root'}]: ${e.message}`).join('; ') || 'No details available';

                            // --- 5. Handle Failure: Log Error, Skip Dispatch ---
                            // This error should always be logged, regardless of allowSchemaNotFound
                            this.#logger.error(`ValidatedDispatcher: Payload validation FAILED for event '${eventName}'. Dispatch SKIPPED. Errors: ${errorDetails}`, {
                                payload,
                                errors: validationResult.errors
                            });
                            shouldDispatch = false; // Prevent dispatch
                        } else {
                            // Validation Succeeded
                            this.#logger.debug(`ValidatedDispatcher: Payload validation SUCCEEDED for event '${eventName}'.`);
                            // shouldDispatch remains true
                        }
                    } else {
                        // Schema Not Loaded: Log Warning ONLY IF NOT ALLOWED by options
                        if (!allowSchemaNotFound) { // <<< WRAPPED WARNING
                            this.#logger.warn(`ValidatedDispatcher: Payload schema '${schemaId}' not found/loaded for event '${eventName}'. Skipping validation and proceeding with dispatch.`);
                        } else {
                            // Optional: Log debug message when warning is suppressed
                            this.#logger.debug(`ValidatedDispatcher: Payload schema '${schemaId}' not found/loaded for event '${eventName}'. Skipping validation as allowed by options.`);
                        }
                        // shouldDispatch remains true (validation skipped, not failed)
                    }
                } else {
                    // No Schema Defined in Event Definition: Log Debug, Skip Validation, Proceed with Dispatch
                    // This is generally not an error condition.
                    this.#logger.debug(`ValidatedDispatcher: Event definition '${eventName}' found, but no 'payloadSchema' defined. Skipping validation and proceeding with dispatch.`);
                    // shouldDispatch remains true
                }
            } else {
                // Event Definition Not Found: Log Warning ONLY IF NOT ALLOWED by options
                if (!allowSchemaNotFound) { // <<< WRAPPED WARNING
                    this.#logger.warn(`ValidatedDispatcher: EventDefinition not found for '${eventName}'. Cannot validate payload. Proceeding with dispatch.`);
                } else {
                    // Optional: Log debug message when warning is suppressed
                    this.#logger.debug(`ValidatedDispatcher: EventDefinition not found for '${eventName}'. Skipping validation as allowed by options.`);
                }
                // shouldDispatch remains true (validation skipped, not failed)
            }
        } catch (validationProcessError) {
            // Catch errors in the validation *process* itself (e.g., bug in validator access)
            // This is distinct from a validation *failure*. We should log this as an error
            // and prevent dispatch because the state is uncertain.
            this.#logger.error(`ValidatedDispatcher: Unexpected error during payload validation process for event '${eventName}'. Dispatch will be skipped.`, validationProcessError);
            shouldDispatch = false; // Prevent dispatch due to the process error
            validationPassed = false; // Mark as failed state due to process error
        }

        // --- Final Dispatch Decision ---
        if (shouldDispatch) {
            try {
                this.#logger.debug(`ValidatedDispatcher: Dispatching event '${eventName}'...`, payload);
                await this.#eventBus.dispatch(eventName, payload);
                this.#logger.debug(`ValidatedDispatcher: Event '${eventName}' dispatch successful.`);
                return true; // Dispatch occurred successfully
            } catch (dispatchError) {
                this.#logger.error(`ValidatedDispatcher: Error occurred during EventBus.dispatch for event '${eventName}':`, dispatchError);
                return false; // Dispatch explicitly failed
            }
        } else {
            // Log why dispatch was skipped if it wasn't due to an explicit validation failure (already logged above)
            if (validationAttempted && !validationPassed) {
                // Already logged error for validation failure
                this.#logger.debug(`ValidatedDispatcher: Dispatch skipped for '${eventName}' due to validation failure (see error above).`);
            } else {
                // Log if skipped for other reasons (e.g., validation process error, or future logic)
                this.#logger.debug(`ValidatedDispatcher: Dispatch explicitly skipped for event '${eventName}'.`);
            }
            return false; // Dispatch did not occur
        }
    }
}

export default ValidatedEventDispatcher;