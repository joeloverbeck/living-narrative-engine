// src/service/objectiveEventListenerService.js

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('./gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../types/questTypes.js').QuestDefinition} QuestDefinition */ // Assuming type definition exists
/** @typedef {import('../../types/questTypes.js').ObjectiveDefinition} ObjectiveDefinition */ // Assuming type definition exists
/** @typedef {import('../../types/questTypes.js').EventListenerCondition} EventListenerCondition */ // Assuming type definition exists

/**
 * Service dedicated to managing the lifecycle of event listeners
 * specifically for 'event_listener' type quest objectives.
 */
class ObjectiveEventListenerService {
    /** @type {EventBus} */
    #eventBus;
    /**
     * @type {GameDataRepository} // <-- UPDATED Type
     */
    #repository; // <-- UPDATED Property Name

    /**
     * Stores active event listeners.
     * @private
     * @type {Map<string, Map<string, Array<{ eventName: string, handler: Function }>>>}
     */
    #activeEventListeners = new Map();

    /**
     * // *** [REFACTOR-014-SUB-11] Updated Constructor Signature ***
     * @param {object} dependencies - The dependencies required by the service.
     * @param {EventBus} dependencies.eventBus - For subscribing/unsubscribing to game events.
     * @param {GameDataRepository} dependencies.gameDataRepository - For fetching objective definitions.
     */
    constructor({eventBus, gameDataRepository}) { // <-- UPDATED Parameter key
        if (!eventBus) throw new Error("ObjectiveEventListenerService requires EventBus.");
        // Updated error message to reflect new dependency
        if (!gameDataRepository) throw new Error("ObjectiveEventListenerService requires GameDataRepository.");

        this.#eventBus = eventBus;
        this.#repository = gameDataRepository; // <-- UPDATED Assignment

        console.log("ObjectiveEventListenerService: Instantiated.");
    }

    /**
     * Registers event listeners for all relevant objectives within a given quest.
     * Called when a quest starts.
     *
     * @param {string} questId - The ID of the quest being started.
     * @param {QuestDefinition} questDefinition - The definition object for the quest.
     * @param {QuestLogComponent} questLogComponent - The player's quest log component to check completion status.
     * @param {Function} onObjectiveConditionMet - Callback function `(questId, objectiveId) => void` to execute when an event matches an objective's condition.
     */
    registerListenersForQuest(questId, questDefinition, questLogComponent, onObjectiveConditionMet) {
        if (!questDefinition || !questLogComponent || typeof onObjectiveConditionMet !== 'function') {
            console.error(`ObjectiveEventListenerService.registerListenersForQuest: Invalid arguments for quest "${questId}". Aborting registration.`);
            return;
        }

        if (!questDefinition.objectiveIds || !Array.isArray(questDefinition.objectiveIds)) {
            console.warn(`ObjectiveEventListenerService: Quest "${questId}" has no objectiveIds array or it's empty. No listeners to register.`);
            return;
        }

        for (const objectiveId of questDefinition.objectiveIds) {
            if (!objectiveId || typeof objectiveId !== 'string') {
                console.warn(`ObjectiveEventListenerService: Invalid objectiveId found in quest "${questId}":`, objectiveId);
                continue;
            }

            // Check if Objective is Already Complete *before* fetching definition
            if (questLogComponent.isObjectiveComplete(questId, objectiveId)) {
                // console.log(`ObjectiveEventListenerService: Objective "${objectiveId}" for quest "${questId}" is already complete. Skipping listener registration.`);
                continue;
            }

            // Retrieve Objective Definition
            const objectiveDefinition = this.#repository.getObjectiveDefinition(objectiveId);
            if (!objectiveDefinition) {
                console.error(`ObjectiveEventListenerService: Objective definition not found for ID: ${objectiveId} (referenced by quest ${questId}). Skipping.`);
                continue;
            }

            // Parse Completion Conditions (allOf array)
            if (!objectiveDefinition.completionConditions?.allOf || !Array.isArray(objectiveDefinition.completionConditions.allOf)) {
                // console.warn(`ObjectiveEventListenerService: Objective "${objectiveId}" is missing or has invalid completionConditions.allOf array. Skipping.`);
                continue;
            }

            for (const condition of objectiveDefinition.completionConditions.allOf) {
                if (!condition || typeof condition !== 'object') {
                    // console.warn(`ObjectiveEventListenerService: Invalid condition found in objective "${objectiveId}":`, condition);
                    continue;
                }

                // Handle 'event_listener' Condition Type
                if (condition.type === 'event_listener') {
                    this._createAndRegisterHandler(questId, objectiveId, condition, onObjectiveConditionMet);
                }
            } // End loop through conditions
        } // End loop through objectiveIds
    }

    /**
     * Creates the event handler, subscribes it, and stores the reference.
     * @param {string} questId
     * @param {string} objectiveId
     * @param {EventListenerCondition} condition
     * @param {Function} onObjectiveConditionMet - The callback to QuestSystem.
     * @private
     */
    _createAndRegisterHandler(questId, objectiveId, condition, onObjectiveConditionMet) {
        if (!condition.eventName || typeof condition.eventName !== 'string') {
            console.error(`ObjectiveEventListenerService: Objective "${objectiveId}" (Quest: ${questId}) has event_listener condition with missing or invalid eventName:`, condition);
            return; // Skip this specific condition
        }

        // Create Dedicated Handler Function (includes filter logic and calls back)
        const handler = this._createFilteringEventHandler(questId, objectiveId, condition, onObjectiveConditionMet);

        // Register Handler with EventBus
        this.eventBus.subscribe(condition.eventName, handler);
        console.log(`ObjectiveEventListenerService: Subscribed to "${condition.eventName}" for objective "${objectiveId}" (Quest: "${questId}")`);

        // Store Listener Reference for later cleanup
        this._storeListenerReference(questId, objectiveId, condition.eventName, handler);
    }


    /**
     * Creates a specific event handler function for an objective's event listener condition.
     * This function closes over the questId, objectiveId, condition filters, and the callback.
     * It evaluates filters against incoming eventData and calls the callback if they match.
     * @param {string} questId - The ID of the quest.
     * @param {string} objectiveId - The ID of the objective.
     * @param {EventListenerCondition} condition - The event_listener condition object.
     * @param {Function} onObjectiveConditionMet - Callback function `(questId, objectiveId) => void`
     * @returns {Function} The event handler function to be subscribed to the EventBus.
     * @private
     */
    _createFilteringEventHandler(questId, objectiveId, condition, onObjectiveConditionMet) {
        // This is the actual handler function that will be subscribed
        return (eventData) => {
            const filters = condition.filters;
            const hasFilters = filters && typeof filters === 'object' && Object.keys(filters).length > 0;

            if (hasFilters) {
                // Evaluate filters
                for (const filterKey in filters) {
                    if (Object.hasOwnProperty.call(filters, filterKey)) {
                        const requiredValue = filters[filterKey];
                        if (!eventData || !Object.hasOwnProperty.call(eventData, filterKey) || eventData[filterKey] !== requiredValue) {
                            // Filter failed (missing key or value mismatch)
                            // console.debug(`[OELS Filter Fail] Event: ${condition.eventName}, Quest: ${questId}, Obj: ${objectiveId}, Key: ${filterKey}, Required: ${requiredValue}, Data:`, eventData);
                            return; // Exit early
                        }
                        // console.debug(`    [OELS Filter Pass] Key "${filterKey}": Matched value ${requiredValue}.`);
                    }
                }
                // console.debug(`  [OELS Filters Passed] All filters matched for obj "${objectiveId}".`);
            }
            // --- END Filter Logic ---

            // If execution reaches here, filters passed (or none existed)
            // console.log(`ObjectiveEventListenerService: Event "${condition.eventName}" matched for objective "${objectiveId}" (Quest: "${questId}"). Triggering callback.`);

            // Execute the callback to notify the QuestSystem
            try {
                onObjectiveConditionMet(questId, objectiveId);
            } catch (error) {
                console.error(`ObjectiveEventListenerService: Error executing onObjectiveConditionMet callback for quest "${questId}", objective "${objectiveId}".`, error);
            }
        };
    }

    /**
     * Stores a reference to an active event listener for later unsubscribing.
     * @param {string} questId - The ID of the quest.
     * @param {string} objectiveId - The ID of the objective.
     * @param {string} eventName - The name of the event being listened to.
     * @param {Function} handler - The specific handler function that was subscribed.
     * @private
     */
    _storeListenerReference(questId, objectiveId, eventName, handler) {
        if (!this.#activeEventListeners.has(questId)) {
            this.#activeEventListeners.set(questId, new Map());
        }
        const questListeners = this.#activeEventListeners.get(questId);

        if (!questListeners.has(objectiveId)) {
            questListeners.set(objectiveId, []);
        }
        const objectiveListeners = questListeners.get(objectiveId);

        // Prevent adding the exact same handler multiple times (safety check)
        if (!objectiveListeners.some(l => l.eventName === eventName && l.handler === handler)) {
            objectiveListeners.push({eventName, handler});
        }
    }

    /**
     * Unsubscribes all event listeners associated with a specific objective of a quest.
     * Removes the references from the internal tracking map.
     * Called by QuestSystem after an objective is completed.
     * @param {string} questId - The ID of the quest.
     * @param {string} objectiveId - The ID of the objective whose listeners should be removed.
     */
    unregisterListenersForObjective(questId, objectiveId) {
        const questListeners = this.#activeEventListeners.get(questId);
        if (!questListeners) {
            // console.debug(`ObjectiveEventListenerService.unregisterListenersForObjective: No listeners tracked for quest "${questId}".`);
            return;
        }

        const objectiveListeners = questListeners.get(objectiveId);
        if (!objectiveListeners || objectiveListeners.length === 0) {
            // console.debug(`ObjectiveEventListenerService.unregisterListenersForObjective: No listeners tracked for objective "${objectiveId}" in quest "${questId}".`);
            return;
        }

        console.log(`ObjectiveEventListenerService: Unsubscribing ${objectiveListeners.length} listeners for completed objective "${objectiveId}" (Quest: "${questId}")...`);

        const listenersToRemove = [...objectiveListeners];
        objectiveListeners.length = 0; // Clear original array immediately

        for (const listenerInfo of listenersToRemove) {
            this.eventBus.unsubscribe(listenerInfo.eventName, listenerInfo.handler);
            // console.log(`  - Unsubscribed from "${listenerInfo.eventName}" for objective "${objectiveId}"`);
        }

        // Remove the entry for this objective from the tracking map
        questListeners.delete(objectiveId);
        // console.log(`ObjectiveEventListenerService: Removed listener tracking for objective "${objectiveId}"`);

        // Clean up the quest entry if no objectives remain for this quest
        if (questListeners.size === 0) {
            this.#activeEventListeners.delete(questId);
            // console.log(`ObjectiveEventListenerService: Removed listener tracking for quest "${questId}" as no objectives have active listeners.`);
        }
    }

    /**
     * Unsubscribes ALL event listeners associated with ANY objective of a specific quest.
     * Used as a cleanup mechanism when a quest ends (completed or failed).
     * Called by QuestSystem when a quest completion or failure event is handled.
     * @param {string} questId - The ID of the quest.
     */
    unregisterAllListenersForQuest(questId) {
        const questListeners = this.#activeEventListeners.get(questId);
        if (!questListeners) {
            // console.debug(`ObjectiveEventListenerService.unregisterAllListenersForQuest: No listeners found for quest "${questId}". Already cleaned or none existed.`);
            return; // No listeners tracked for this quest
        }

        console.log(`ObjectiveEventListenerService: Performing full listener cleanup for ended quest "${questId}"...`);

        const objectiveIdsToClean = Array.from(questListeners.keys());

        for (const objectiveId of objectiveIdsToClean) {
            // Reuse the objective-specific cleanup logic
            this.unregisterListenersForObjective(questId, objectiveId);
        }

        // Final check to remove the main quest entry if somehow missed
        if (this.#activeEventListeners.has(questId)) {
            this.#activeEventListeners.delete(questId);
            // console.log(`ObjectiveEventListenerService: Confirmed removal of tracking entry for quest "${questId}".`);
        }
        console.log(`ObjectiveEventListenerService: Listener cleanup complete for quest "${questId}".`);
    }
}

export {ObjectiveEventListenerService}; // Export the service class