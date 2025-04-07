// src/actions/actionResultProcessor.js

/** @typedef {import('./actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('./../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('./../entities/entity.js').default} Entity */

/**
 * @typedef {object} ProcessResult
 * @property {boolean} locationChanged - Indicates if the player's location was successfully changed.
 * @property {boolean} [processed] - Indicates if any part of the result was processed (optional, maybe useful later).
 */

/**
 * Processes the results of actions, primarily handling state changes indicated
 * in the ActionResult.newState property. Decouples result interpretation logic
 * from the GameLoop.
 */
class ActionResultProcessor {
    #gameStateManager;
    #entityManager;
    #eventBus;

    /**
     * @param {object} options
     * @param {GameStateManager} options.gameStateManager - Manages core game state.
     * @param {EntityManager} options.entityManager - Manages entity instances.
     * @param {EventBus} options.eventBus - For dispatching events.
     */
    constructor(options) {
        const { gameStateManager, entityManager, eventBus } = options || {};

        if (!gameStateManager) throw new Error("ActionResultProcessor requires options.gameStateManager.");
        if (!entityManager) throw new Error("ActionResultProcessor requires options.entityManager.");
        if (!eventBus) throw new Error("ActionResultProcessor requires options.eventBus.");

        this.#gameStateManager = gameStateManager;
        this.#entityManager = entityManager;
        this.#eventBus = eventBus;
        console.log("ActionResultProcessor: Initialized.");
    }

    /**
     * Processes an ActionResult, applying state changes and dispatching events.
     * Currently focuses on handling `newState.currentLocationId`.
     * @param {ActionResult} actionResult - The result object from ActionExecutor.
     * @returns {ProcessResult} An object indicating the outcome, e.g., { locationChanged: boolean }.
     */
    process(actionResult) {
        const defaultResult = { locationChanged: false, processed: false };

        if (!actionResult || !actionResult.newState) {
            // No state changes defined in the result
            return defaultResult;
        }

        let locationChanged = false;
        let processed = false; // Track if we actually handled something

        // --- Handle Location Change ---
        if (typeof actionResult.newState.currentLocationId === 'string') {
            processed = true; // We are attempting to process this part
            const newLocationId = actionResult.newState.currentLocationId;
            const previousLocation = this.#gameStateManager.getCurrentLocation();
            const playerEntity = this.#gameStateManager.getPlayer();

            // Basic validation of current state before proceeding
            if (!previousLocation || !playerEntity) {
                console.error("ActionResultProcessor: Cannot process location change, current state (player/location) is invalid in GameStateManager.");
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Internal Error: Cannot process movement due to inconsistent state.",
                    type: "error"
                });
                return defaultResult; // Return default, location didn't change
            }

            // Attempt to get the new location entity
            const newLocation = this.#entityManager.createEntityInstance(newLocationId);

            if (newLocation) {
                // Success! Update state and dispatch event
                this.#gameStateManager.setCurrentLocation(newLocation);
                console.log(`ActionResultProcessor: Player moved to ${newLocation.id}`);

                // Ensure the location's entities are loaded (might be redundant if called elsewhere, but safe)
                this.#entityManager.ensureLocationEntitiesInstantiated(newLocation);

                this.#eventBus.dispatch('event:room_entered', {
                    playerEntity: playerEntity, // Use the player we fetched earlier
                    newLocation: newLocation, // Use the instance we found/created
                    previousLocation: previousLocation
                });

                locationChanged = true; // Mark location as successfully changed

            } else {
                // Failure: Couldn't find/create the target location entity
                console.error(`ActionResultProcessor: Failed to get/create entity instance for target location ID: ${newLocationId}`);
                this.#eventBus.dispatch('ui:message_display', {
                    text: "There seems to be a problem with where you were trying to go. You remain here.",
                    type: "error"
                });
                // locationChanged remains false
            }
        }

        // --- Handle other potential newState flags in the future ---
        // if (typeof actionResult.newState.someOtherFlag === '...') {
        //     processed = true;
        //     // ... logic ...
        // }


        // Return the consolidated result
        return {
            locationChanged: locationChanged,
            processed: processed
        };
    }
}

export default ActionResultProcessor;