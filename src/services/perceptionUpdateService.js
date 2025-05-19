// src/services/perceptionUpdateService.js

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
 * @property {string[]} [warnings] - Optional. An array of warning messages for non-critical issues.
 * @property {string} [error] - An error message if the operation failed.
 */

import {PERCEPTION_LOG_COMPONENT_ID} from "../constants/componentIds.js";

/**
 * @typedef {object} QueryDetailsForPerceptionUpdate
 * @property {string} action - The specific action to perform (e.g., "addEntryToLogsInLocation").
 * @property {NamespacedId} [locationId] - The ID of the location (for addEntryToLogsInLocation).
 * @property {LogEntry} [entry] - The log entry data (for addEntryToLogsInLocation).
 * @property {NamespacedId} [originatingActorId] - (for addEntryToLogsInLocation).
 * // Add other properties here if other actions are introduced
 */


const DEFAULT_MAX_LOG_ENTRIES = 50; // Default based on schema

// const POSITION_COMPONENT_ID = 'core:position'; // Not directly used here as getEntitiesInLocation handles it


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
            return Promise.resolve({success: false, error: errorMsg, logsUpdated: 0});
        }

        const {action, ...params} = queryDetails;

        switch (action) {
            case 'addEntryToLogsInLocation':
                return this.addEntryToLogsInLocation(params);
            default:
                const unknownActionMsg = `Unknown action: ${action}`;
                this.#logger.warn(`PerceptionUpdateService.handleQuery: ${unknownActionMsg}`, {queryDetails});
                return Promise.resolve({success: false, error: unknownActionMsg, logsUpdated: 0});
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
        const warnings = [];

        // <editor-fold desc="Parameter Validation">
        if (!params || typeof params !== 'object') {
            const errorMsg = "Invalid parameters: input must be an object.";
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Invalid params object.', {params});
            return {success: false, error: errorMsg, logsUpdated: 0};
        }

        const {locationId, entry, originatingActorId} = params; // originatingActorId currently unused but available

        if (typeof locationId !== 'string' || !locationId.trim()) {
            const errorMsg = "Invalid or missing locationId.";
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Invalid or missing locationId.', {locationId});
            return {success: false, error: errorMsg, logsUpdated: 0};
        }

        if (!entry || typeof entry !== 'object') {
            const errorMsg = "Invalid or missing entry object.";
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Invalid or missing entry object.', {entry});
            return {success: false, error: errorMsg, logsUpdated: 0};
        }

        const requiredEntryFields = ['descriptionText', 'timestamp', 'perceptionType', 'actorId'];
        for (const field of requiredEntryFields) {
            if (entry[field] === undefined || (typeof entry[field] === 'string' && !entry[field].trim() && field !== 'targetId')) { // Allow empty targetId
                const errorMsg = `Missing or invalid required field in entry: ${field}.`;
                this.#logger.error(`PerceptionUpdateService.addEntryToLogsInLocation: ${errorMsg}`, {entry});
                return {success: false, error: errorMsg, logsUpdated: 0};
            }
        }
        if (entry.involvedEntities && !Array.isArray(entry.involvedEntities)) {
            const errorMsg = "entry.involvedEntities must be an array if provided.";
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: entry.involvedEntities must be an array if provided.', {entry});
            return {success: false, error: errorMsg, logsUpdated: 0};
        }
        // </editor-fold>

        try {
            this.#logger.info(`PerceptionUpdateService: Processing event to add log entry in location '${locationId}'. Entry: ${entry.descriptionText}`);

            const entityIdsInLocation = this.#entityManager.getEntitiesInLocation(locationId);
            const perceiverEntityIds = [];
            if (entityIdsInLocation && entityIdsInLocation.size > 0) {
                for (const entityId of entityIdsInLocation) {
                    if (this.#entityManager.hasComponent(entityId, PERCEPTION_LOG_COMPONENT_ID)) {
                        perceiverEntityIds.push(entityId);
                    }
                }
            }
            this.#logger.debug(`PerceptionUpdateService: Found ${entityIdsInLocation ? entityIdsInLocation.size : 0} entities in location '${locationId}'. Filtered to ${perceiverEntityIds.length} entities with '${PERCEPTION_LOG_COMPONENT_ID}'.`);

            if (perceiverEntityIds.length === 0) {
                this.#logger.info(`PerceptionUpdateService: No entities with '${PERCEPTION_LOG_COMPONENT_ID}' found in location '${locationId}'. No logs will be updated.`);
                return {success: true, logsUpdated: 0, warnings};
            }

            let updatedCount = 0;
            for (const entityId of perceiverEntityIds) {
                let perceptionLogComponentData = this.#entityManager.getComponentData(entityId, PERCEPTION_LOG_COMPONENT_ID);
                let mutablePerceptionLog;

                if (!perceptionLogComponentData) {
                    const warningMsg = `Entity ${entityId} in location ${locationId} was expected to have ${PERCEPTION_LOG_COMPONENT_ID} but data not found. Initializing new log.`;
                    this.#logger.error(`PerceptionUpdateService: ${warningMsg}`); // Log as error due to unexpected state
                    warnings.push(warningMsg);
                    mutablePerceptionLog = {
                        maxEntries: DEFAULT_MAX_LOG_ENTRIES,
                        logEntries: []
                    };
                } else {
                    mutablePerceptionLog = JSON.parse(JSON.stringify(perceptionLogComponentData));

                    if (!Array.isArray(mutablePerceptionLog.logEntries)) {
                        const warningMsg = `Entity ${entityId}'s ${PERCEPTION_LOG_COMPONENT_ID}.logEntries was not an array (found ${typeof mutablePerceptionLog.logEntries}). Resetting to empty array.`;
                        this.#logger.warn(`PerceptionUpdateService: ${warningMsg}`);
                        warnings.push(warningMsg);
                        mutablePerceptionLog.logEntries = [];
                    }

                    if (typeof mutablePerceptionLog.maxEntries !== 'number' || mutablePerceptionLog.maxEntries < 1) {
                        const warningMsg = `Entity ${entityId}'s ${PERCEPTION_LOG_COMPONENT_ID}.maxEntries is invalid (${mutablePerceptionLog.maxEntries}). Using default ${DEFAULT_MAX_LOG_ENTRIES}.`;
                        this.#logger.warn(`PerceptionUpdateService: ${warningMsg}`);
                        warnings.push(warningMsg);
                        mutablePerceptionLog.maxEntries = DEFAULT_MAX_LOG_ENTRIES;
                    }
                }

                const newLogEntry = {...entry};
                if (!newLogEntry.eventId) {
                    newLogEntry.eventId = `ple_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                }

                mutablePerceptionLog.logEntries.push(newLogEntry);

                if (mutablePerceptionLog.logEntries.length > mutablePerceptionLog.maxEntries) {
                    mutablePerceptionLog.logEntries = mutablePerceptionLog.logEntries.slice(-mutablePerceptionLog.maxEntries);
                }

                try {
                    const updateSuccess = this.#entityManager.addComponent(entityId, PERCEPTION_LOG_COMPONENT_ID, mutablePerceptionLog);
                    if (updateSuccess) {
                        updatedCount++;
                        this.#logger.debug(`PerceptionUpdateService: Successfully updated perception log for entity ${entityId}.`);
                    } else {
                        const warningMsg = `Entity ${entityId}: EntityManager.addComponent returned false for perception log update. Log may not have been updated.`;
                        this.#logger.warn(`PerceptionUpdateService: ${warningMsg}`);
                        warnings.push(warningMsg);
                    }
                } catch (updateError) {
                    const errorForEntityMsg = `Entity ${entityId}: Error during EntityManager.addComponent for ${PERCEPTION_LOG_COMPONENT_ID}: ${updateError.message || String(updateError)}`;
                    this.#logger.error(`PerceptionUpdateService: ${errorForEntityMsg}`, {
                        error: updateError instanceof Error ? updateError.message : String(updateError),
                        stack: updateError instanceof Error ? updateError.stack : undefined,
                        entityId
                    });
                    warnings.push(errorForEntityMsg);
                }
            }

            this.#logger.info(`PerceptionUpdateService: Processed location ${locationId}. Logs updated for ${updatedCount} out of ${perceiverEntityIds.length} targeted entities. Warnings: ${warnings.length}`);
            return {success: true, logsUpdated: updatedCount, warnings};

        } catch (error) {
            const criticalErrorMsg = `Internal server error during perception update: ${error.message || String(error)}`;
            this.#logger.error('PerceptionUpdateService.addEntryToLogsInLocation: Unhandled error during perception update logic.', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                locationId,
                entryDescription: entry ? entry.descriptionText : 'N/A'
            });
            return {
                success: false,
                error: criticalErrorMsg,
                logsUpdated: 0, // Ensure logsUpdated is 0 on critical failure
                warnings // Include any warnings collected before the critical error
            };
        }
    }
}

export default PerceptionUpdateService;
// --- FILE END ---