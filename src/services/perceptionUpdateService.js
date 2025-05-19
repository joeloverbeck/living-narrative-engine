// src/services/PerceptionUpdateService.js
// ****** MODIFIED FILE ******

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../types/common.js').NamespacedId} NamespacedId */

/**
 * @typedef {object} LogEntry
 * @property {string} descriptionText - The human-readable summary of the event.
 * @property {string} timestamp - ISO 8601 date-time string when the event occurred.
 * @property {string} perceptionType - The category of the perceived event.
 * @property {NamespacedId} actorId - The ID of the entity that caused the event.
 * @property {NamespacedId} [targetId] - Optional. The ID of the primary target of the event.
 * @property {NamespacedId[]} [involvedEntities=[]] - Optional. Other entities involved.
 * @property {NamespacedId} [eventId] - Optional. A unique ID for this specific log entry.
 */

/**
 * @typedef {object} AddEntryParams
 * @property {NamespacedId} locationId - The ID of the location where the event occurred.
 * @property {LogEntry} entry - The log entry data to be added.
 * @property {NamespacedId} [originatingActorId] - Optional. The ID of the actor who initiated the original core:perceptible_event.
 */

/**
 * @typedef {object} PerceptionUpdateResult
 * @property {boolean} success - True if the operation was successful.
 * @property {number} [logsUpdated] - The number of perception logs updated.
 * @property {string} [error] - An error message if the operation failed.
 */

/**
 * @typedef {object} QueryDetailsForPerceptionUpdate
 * @property {string} action - The specific action to perform (e.g., "addEntryToLogsInLocation").
 * @property {NamespacedId} [locationId] - The ID of the location (for addEntryToLogsInLocation).
 * @property {LogEntry} [entry] - The log entry data (for addEntryToLogsInLocation).
 * @property {NamespacedId} [originatingActorId] - (for addEntryToLogsInLocation).
 * // Add other properties here if other actions are introduced
 */


/**
 * @constant {string} PERCEPTION_LOG_COMPONENT_ID - The ID for the perception log component.
 * @default
 */
const PERCEPTION_LOG_COMPONENT_ID = 'core:perception_log';


/**
 * Service responsible for updating character perception logs within a given location.
 * Implements a handleQuery method to be compatible with SystemDataRegistry.
 * @class PerceptionUpdateService
 */
class PerceptionUpdateService {
    #logger;
    #entityManager;

    /**
     * Creates an instance of PerceptionUpdateService.
     * @param {object} dependencies - The dependencies for the service.
     * @param {ILogger} dependencies.logger - The logger service.
     * @param {IEntityManager} dependencies.entityManager - The entity manager service.
     */
    constructor({logger, entityManager}) {
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('PerceptionUpdateService: Valid ILogger instance is required.');
        }
        if (!entityManager ||
            typeof entityManager.getEntitiesInLocation !== 'function' ||
            typeof entityManager.hasComponent !== 'function' ||
            typeof entityManager.getComponentData !== 'function' ||
            typeof entityManager.addComponent !== 'function') {
            throw new Error('PerceptionUpdateService: Valid IEntityManager instance with required methods (getEntitiesInLocation, hasComponent, getComponentData, addComponent) is required.');
        }

        this.#logger = logger;
        this.#entityManager = entityManager;
        this.#logger.info('PerceptionUpdateService: Instance created.');
    }

    /**
     * Handles queries routed from the SystemDataRegistry.
     * This method acts as a dispatcher based on the 'action' property in queryDetails.
     *
     * @param {QueryDetailsForPerceptionUpdate} queryDetails - An object containing the action to perform and its parameters.
     * @returns {Promise<PerceptionUpdateResult | any>} A promise resolving to the result of the dispatched action.
     */
    async handleQuery(queryDetails) {
        this.#logger.debug('PerceptionUpdateService.handleQuery: Received query', {queryDetails});
        if (!queryDetails || typeof queryDetails !== 'object' || typeof queryDetails.action !== 'string' || !queryDetails.action.trim()) {
            const errorMsg = "Invalid queryDetails: must be an object with a non-empty 'action' string property.";
            this.#logger.error(`PerceptionUpdateService.handleQuery: ${errorMsg}`, {queryDetails});
            return Promise.resolve({success: false, error: errorMsg});
        }

        const {action, ...params} = queryDetails; // Destructure action and pass the rest as params

        switch (action) {
            case 'addEntryToLogsInLocation':
                // The addEntryToLogsInLocation method expects an object structured like 'params'
                return this.addEntryToLogsInLocation(params);
            // Example for future extension:
            // case 'clearLogsInLocation':
            //     return this.clearLogsInLocation(params);
            default:
                const unknownActionMsg = `Unknown action: ${action}`;
                this.#logger.warn(`PerceptionUpdateService.handleQuery: ${unknownActionMsg}`, {queryDetails});
                return Promise.resolve({success: false, error: unknownActionMsg});
        }
    }


    /**
     * Adds a new log entry to the perception logs of all relevant entities in a specified location.
     * Relevant entities are those present in the location and possessing a 'core:perception_log' component.
     *
     * @param {AddEntryParams} params - The parameters for adding the log entry.
     * @returns {Promise<PerceptionUpdateResult>} A Promise resolving to an object indicating the outcome.
     */
    async addEntryToLogsInLocation(params) {
        this.#logger.debug('PerceptionUpdateService.addEntryToLogsInLocation: Received request', params);

        if (!params || typeof params !== 'object') {
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Invalid params object.', {params});
            return {success: false, error: "Invalid parameters: input must be an object."};
        }

        const {locationId, entry, originatingActorId} = params;

        if (typeof locationId !== 'string' || !locationId.trim()) {
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Invalid or missing locationId.', {locationId});
            return {success: false, error: "Invalid or missing locationId."};
        }

        if (!entry || typeof entry !== 'object') {
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Invalid or missing entry object.', {entry});
            return {success: false, error: "Invalid or missing entry object."};
        }

        const requiredEntryFields = ['descriptionText', 'timestamp', 'perceptionType', 'actorId'];
        for (const field of requiredEntryFields) {
            if (entry[field] === undefined || (typeof entry[field] === 'string' && !entry[field].trim() && field !== 'targetId')) {
                this.#logger.error(`PerceptionUpdateService.addEntryToLogsInLocation: Missing or invalid required field in entry: ${field}.`, {entry});
                return {success: false, error: `Missing or invalid required field in entry: ${field}.`};
            }
        }
        if (entry.involvedEntities && !Array.isArray(entry.involvedEntities)) {
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: entry.involvedEntities must be an array if provided.', {entry});
            return {success: false, error: "entry.involvedEntities must be an array if provided."};
        }

        try {
            this.#logger.info(`PerceptionUpdateService: Adding entry to logs in location '${locationId}'. Entry: ${JSON.stringify(entry)}`);

            const entityIdsInLocation = this.#entityManager.getEntitiesInLocation(locationId);
            let updatedCount = 0;

            for (const entityId of entityIdsInLocation) {
                if (!this.#entityManager.hasComponent(entityId, PERCEPTION_LOG_COMPONENT_ID)) {
                    continue;
                }

                const perceptionLogComponentData = this.#entityManager.getComponentData(entityId, PERCEPTION_LOG_COMPONENT_ID);
                if (!perceptionLogComponentData) {
                    this.#logger.warn(`PerceptionUpdateService: Entity ${entityId} in location ${locationId} was expected to have ${PERCEPTION_LOG_COMPONENT_ID} but data not found during update. Skipping.`);
                    continue;
                }

                const mutablePerceptionLog = JSON.parse(JSON.stringify(perceptionLogComponentData));

                if (!mutablePerceptionLog.logEntries) {
                    mutablePerceptionLog.logEntries = [];
                }
                if (!Array.isArray(mutablePerceptionLog.logEntries)) {
                    this.#logger.error(`PerceptionUpdateService: Entity ${entityId} has invalid logEntries (not an array) in ${PERCEPTION_LOG_COMPONENT_ID}. Skipping.`);
                    continue;
                }

                const newEntry = {...entry};
                if (!newEntry.eventId) {
                    newEntry.eventId = `evt_${new Date().toISOString()}_${Math.random().toString(36).substr(2, 9)}`;
                }

                mutablePerceptionLog.logEntries.push(newEntry);

                const maxEntries = mutablePerceptionLog.maxEntries || 50;
                if (mutablePerceptionLog.logEntries.length > maxEntries) {
                    mutablePerceptionLog.logEntries = mutablePerceptionLog.logEntries.slice(
                        mutablePerceptionLog.logEntries.length - maxEntries
                    );
                }

                try {
                    const updateSuccess = this.#entityManager.addComponent(entityId, PERCEPTION_LOG_COMPONENT_ID, mutablePerceptionLog);
                    if (updateSuccess) {
                        updatedCount++;
                        this.#logger.debug(`PerceptionUpdateService: Successfully updated perception log for entity ${entityId}.`);
                    } else {
                        this.#logger.warn(`PerceptionUpdateService: EntityManager.addComponent returned false for perception log update on entity ${entityId}.`);
                    }
                } catch (updateError) {
                    this.#logger.error(`PerceptionUpdateService: Error calling EntityManager.addComponent for entity ${entityId}.`, {
                        error: updateError instanceof Error ? updateError.message : String(updateError),
                        stack: updateError instanceof Error ? updateError.stack : undefined,
                    });
                }
            }

            this.#logger.info(`PerceptionUpdateService: Processed location ${locationId}. Logs updated for ${updatedCount} entities.`);
            return {success: true, logsUpdated: updatedCount};

        } catch (error) {
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Error during core logic execution.', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                locationId,
                entry
            });
            return {success: false, error: `Internal server error: ${error.message}`};
        }
    }
}

export default PerceptionUpdateService;
// --- FILE END ---