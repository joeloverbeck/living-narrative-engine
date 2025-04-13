// src/systems/triggerSystem.js

import {ConnectionsComponent} from "../components/connectionsComponent.js";

/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Corrected path if needed
/** @typedef {import('../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../core/eventBus.js').default} EventBus */              // Corrected path if needed
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */


/**
 * Listens for game events, checks trigger conditions, executes actions,
 * and handles built-in reactions like auto-look and entity instantiation.
 */
class TriggerSystem {
    #eventBus;
    #dataManager;
    #entityManager;
    #gameStateManager;
    #actionExecutor;

    /** @type {Map<string, Function>} */
    #triggerIdToHandlerMap = new Map(); // To store handlers for potential unsubscription

    /** @type {Set<string>} */
    #activeOneShotTriggerIds = new Set(); // Store IDs of one-shot triggers that haven't fired yet

    /** @type {Set<string>} */
    #instantiatedLocationIds = new Set(); // Keep track of locations where entities have been instantiated

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {DataManager} options.dataManager
     * @param {EntityManager} options.entityManager
     * @param {GameStateManager} options.gameStateManager
     * @param {ActionExecutor} options.actionExecutor
     */
    constructor(options) {
        const {
            eventBus,
            dataManager,
            entityManager,
            gameStateManager,
            actionExecutor
        } = options || {};

        if (!eventBus) throw new Error("TriggerSystem requires options.eventBus.");
        if (!dataManager) throw new Error("TriggerSystem requires options.dataManager.");
        if (!entityManager) throw new Error("TriggerSystem requires options.entityManager.");
        if (!gameStateManager) throw new Error("TriggerSystem requires options.gameStateManager.");
        if (!actionExecutor) throw new Error("TriggerSystem requires options.actionExecutor.");

        this.#eventBus = eventBus;
        this.#dataManager = dataManager;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#actionExecutor = actionExecutor;

        console.log("TriggerSystem: Instance created.");
    }

    /**
     * Initializes the TriggerSystem by reading trigger definitions and subscribing to events.
     */
    initialize() {
        console.log("TriggerSystem: Initializing subscriptions...");
        const allTriggers = this.#dataManager.getAllTriggers();

        // --- Initialize Custom Triggers ---
        if (allTriggers && allTriggers.length > 0) {
            for (const triggerDef of allTriggers) {
                // ... (existing loop for custom triggers remains the same) ...
                if (!triggerDef || !triggerDef.id || !triggerDef.listen_to || !triggerDef.listen_to.event_type) {
                    console.warn("TriggerSystem: Skipping invalid trigger definition:", triggerDef);
                    continue;
                }
                if (triggerDef.one_shot !== false) {
                    this.#activeOneShotTriggerIds.add(triggerDef.id);
                }
                const eventName = triggerDef.listen_to.event_type;
                // Ensure handler is bound correctly if needed, or use arrow function
                const handler = (eventData) => this._handleTriggerEvent(triggerDef, eventName, eventData);
                this.#triggerIdToHandlerMap.set(triggerDef.id, handler);
                this.#eventBus.subscribe(eventName, handler);
            }
            console.log(`TriggerSystem: Finished initializing ${allTriggers.length} custom triggers. Active one-shots: ${this.#activeOneShotTriggerIds.size}`);
        } else {
            console.log("TriggerSystem: No custom trigger definitions found in DataManager.");
        }

        // --- Subscribe Handlers for Built-in Logic ---
        // Handler for the *initial* game start look
        this.#eventBus.subscribe('event:room_entered', this.#handleRoomEnteredInitialLook.bind(this));
        console.log("TriggerSystem: Subscribed #handleRoomEnteredInitialLook to 'event:room_entered' for initial auto-look.");

        // Handler for subsequent moves (instantiation + look)
        this.#eventBus.subscribe('event:entity_moved', this._handleEntityMoved.bind(this));
        console.log("TriggerSystem: Subscribed _handleEntityMoved to 'event:entity_moved' for subsequent instantiation and auto-look.");
    }

    /**
     * Handles the 'event:room_entered' event *only* for the initial game load scenario.
     * Triggers an automatic 'look' action because previousLocation is null.
     * Entity instantiation is now handled by _handleEntityMoved.
     * @private
     * @param {{ newLocation: Entity, playerEntity: Entity, previousLocation?: Entity | null }} eventData
     */
    #handleRoomEnteredInitialLook(eventData) {
        console.log("TriggerSystem: Handling 'event:room_entered'.");
        const {newLocation, playerEntity, previousLocation} = eventData;

        // Validate essential data
        if (!newLocation || !playerEntity) {
            console.error("TriggerSystem #handleRoomEnteredInitialLook: Received 'event:room_entered' but newLocation or playerEntity was missing.", eventData);
            return;
        }

        // --- Trigger Initial 'Look' ONLY if it's the initial game load ---
        if (previousLocation === null || previousLocation === undefined) {
            console.log("TriggerSystem: Initial game load detected (no previousLocation). Triggering initial 'look'.");

            /** @type {ActionContext} */
            const lookContext = {
                playerEntity: playerEntity,
                currentLocation: newLocation,
                parsedCommand: {
                    actionId: 'core:look',
                    directObjectPhrase: null, // No specific target for automatic look
                    preposition: null,
                    indirectObjectPhrase: null,
                    originalInput: '[AUTO_LOOK_INITIAL]', // Indicate it's not from player
                    error: null
                },
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
                eventBus: this.#eventBus // Add eventBus if needed by handlers/resolvers called by look
            };

            try {
                const lookResult = this.#actionExecutor.executeAction('core:look', lookContext);
                if (!lookResult.success) {
                    console.warn(`TriggerSystem: Initial 'core:look' execution reported failure. Messages:`, lookResult.messages);
                } else {
                    console.log(`TriggerSystem: Initial 'core:look' executed successfully.`);
                }
            } catch (error) {
                console.error("TriggerSystem: Uncaught error executing initial 'core:look':", error);
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Internal Error: Failed to perform initial look.",
                    type: 'error'
                });
            }
        } else {
            // This event is now ignored if previousLocation exists, as _handleEntityMoved handles it.
            // console.log("TriggerSystem: 'event:room_entered' received with previousLocation. Ignoring for look (handled by entity_moved).");
        }
    }

    _handleEntityMoved(eventData) {
        const {entityId, newLocationId} = eventData;
        const player = this.#gameStateManager.getPlayer();

        if (!player || entityId !== player.id) {
            return;
        }

        console.log(`TriggerSystem: Player moved to ${newLocationId}. Handling instantiation and auto-look.`);

        // Attempt to create/get the instance. If it already exists, getEntityInstance
        // inside createEntityInstance (if forceNew=false) will return it.
        // If it doesn't exist, it will be created now.
        const newLocationEntity = this.#entityManager.createEntityInstance(newLocationId);

        // Now, check if it was successfully created/retrieved
        if (!newLocationEntity) {
            console.error(`TriggerSystem: Failed to create or find instance for location ${newLocationId}! Cannot proceed with post-move logic.`);
            // Dispatch error? Should not happen if definition exists and creation logic is sound.
            this.#eventBus.dispatch('ui:message_display', {
                text: `Critical Error: Cannot process arrival at ${newLocationId}. Location data might be corrupted.`,
                type: 'error'
            });
            return;
        }

        this.#gameStateManager.setCurrentLocation(newLocationEntity);
        console.log(`TriggerSystem: Updated GameStateManager's current location to ${newLocationId}.`);
        // ******************************************************

        // Trigger Automatic 'Look' (using the now guaranteed valid newLocationEntity)
        console.log(`TriggerSystem: Triggering automatic 'look' for player in ${newLocationId}.`);
        /** @type {ActionContext} */
        const lookContext = {
            playerEntity: player,
            currentLocation: newLocationEntity,
            parsedCommand: {
                actionId: 'core:look',
                directObjectPhrase: null, // No specific target for automatic look
                preposition: null,
                indirectObjectPhrase: null,
                originalInput: '[AUTO_LOOK_MOVE]', // Indicate it's not from player
                error: null
            },
            dataManager: this.#dataManager,
            entityManager: this.#entityManager,
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
            eventBus: this.#eventBus // Add eventBus if needed by handlers/resolvers called by look
        };

        try {
            const lookResult = this.#actionExecutor.executeAction('core:look', lookContext);
            if (!lookResult.success) {
                console.warn(`TriggerSystem: Automatic 'core:look' after move reported failure. Messages:`, lookResult.messages);
            } else {
                console.log(`TriggerSystem: Automatic 'core:look' after move executed successfully.`);
            }
        } catch (error) {
            console.error("TriggerSystem: Uncaught error executing automatic 'core:look' after move:", error);
            this.#eventBus.dispatch('ui:message_display', {
                text: "Internal Error: Failed to perform automatic look after moving.",
                type: 'error'
            });
        }
    }

    /**
     * Handles an incoming event dispatch relevant to a specific trigger definition.
     * Checks filters, executes actions, and handles one-shot logic.
     * @private
     * @param {object} triggerDef - The full trigger definition object from DataManager.
     * @param {string} eventName - The name of the event that occurred.
     * @param {object} eventData - The data payload of the event.
     */
    _handleTriggerEvent(triggerDef, eventName, eventData) {
        // 1. Check if it's a one-shot trigger that is no longer active
        if (triggerDef.one_shot !== false && !this.#activeOneShotTriggerIds.has(triggerDef.id)) {
            // console.debug(`TriggerSystem: Skipping already fired/deactivated one-shot trigger "${triggerDef.id}"`);
            return;
        }

        // console.log(`[DEBUG] TriggerSystem: Handling event "${eventName}" for trigger "${triggerDef.id}"`, eventData);

        // 2. Check Filters
        if (!this._checkFilters(triggerDef.listen_to, eventName, eventData)) {
            // console.debug(`TriggerSystem: Filters did not match for trigger "${triggerDef.id}" on event "${eventName}"`);
            return; // Filters didn't match, do nothing further for this trigger
        }

        console.log(`TriggerSystem: Trigger MATCHED: ${triggerDef.id} for event ${eventName}`);

        // 3. Execute Actions
        let allActionsSucceeded = true;
        for (const action of triggerDef.actions) {
            // console.log(`TriggerSystem: Executing trigger action:`, action); // Verbose
            let result = {success: false, messages: []}; // Default result

            try {
                switch (action.type) {
                    case 'set_connection_state':
                        result = this._executeSetConnectionState(action.target, action.parameters);
                        break;
                    // Add cases for other trigger action types here...
                    default:
                        console.warn(`TriggerSystem: Unknown trigger action type '${action.type}' in trigger ${triggerDef.id}`);
                        result.messages.push({
                            text: `Internal warning: Unknown trigger action type '${action.type}'.`,
                            type: 'warning'
                        });
                        result.success = false; // Consider unknown actions as failures? Or just warn? Let's mark as failure.
                }

                // Dispatch any messages generated by the action via the EventBus
                if (result.messages && result.messages.length > 0) {
                    result.messages.forEach(msg => {
                        // Use a specific event for UI messages to decouple from Renderer
                        this.#eventBus.dispatch('ui:message_display', msg);
                    });
                }

                if (!result.success) {
                    allActionsSucceeded = false;
                    console.error(`TriggerSystem: Action type '${action.type}' failed for trigger ${triggerDef.id}.`);
                    // Optional: Decide whether to stop processing further actions for this trigger if one fails.
                    // break; // Uncomment to stop on first failure
                }

            } catch (error) {
                console.error(`TriggerSystem: Uncaught error executing action type '${action.type}' for trigger ${triggerDef.id}:`, error);
                allActionsSucceeded = false;
                // Dispatch an error message to the UI
                this.#eventBus.dispatch('ui:message_display', {
                    text: `Internal error processing action for trigger '${triggerDef.id}'. Check console.`,
                    type: 'error'
                });
                // Optional: break; // Stop processing actions on uncaught error
            }
        }

        // 4. Handle One-Shot Logic
        // Deactivate the trigger if it's one-shot AND all its actions executed successfully.
        if (triggerDef.one_shot !== false && allActionsSucceeded) {
            if (this.#activeOneShotTriggerIds.has(triggerDef.id)) {
                console.log(`TriggerSystem: Deactivating successful one-shot trigger ${triggerDef.id}.`);
                this.#activeOneShotTriggerIds.delete(triggerDef.id);
            }
        } else if (triggerDef.one_shot !== false && !allActionsSucceeded) {
            console.warn(`TriggerSystem: One-shot trigger ${triggerDef.id} matched but action(s) failed. Trigger remains active.`);
        }
    }

    /**
     * Checks if the provided event data matches the filters defined in the trigger's listen_to block.
     * @private
     * @param {object} listenCondition - The `listen_to` object from the trigger definition.
     * @param {string} eventName - The name of the event being processed.
     * @param {object} eventData - The data payload of the event.
     * @returns {boolean} True if all filters match or no filters are defined, false otherwise.
     */
    _checkFilters(listenCondition, eventName, eventData) {
        const triggerId = listenCondition.parent?.id ?? 'unknown'; // Helper for logging

        // No filters defined? Always matches.
        if (!listenCondition.filters || Object.keys(listenCondition.filters).length === 0) {
            // console.log(`[DEBUG] TriggerSystem Filter Check (${triggerId}): No filters defined. PASSED.`);
            return true;
        }

        // console.log(`[DEBUG] TriggerSystem Filter Check (${triggerId}): Checking filters for event "${eventName}". Filters:`, listenCondition.filters, "Event Data:", eventData);

        // Iterate through each filter defined in the trigger
        for (const filterKey in listenCondition.filters) {
            const filterValue = listenCondition.filters[filterKey];
            let filterPassed = false; // Assume filter fails unless explicitly passed

            // --- Check specific filter types based on eventName and filterKey ---

            if (eventName === 'event:entity_died') {
                if (filterKey === 'source_id') {
                    if (!eventData || typeof eventData.deceasedEntityId !== 'string') {
                        // console.warn(`[DEBUG] Filter Check (${triggerId}): Filter 'source_id' requires 'deceasedEntityId' string in eventData. Not found/invalid. FAILED.`);
                        return false; // Cannot evaluate filter
                    }
                    if (eventData.deceasedEntityId === filterValue) {
                        filterPassed = true;
                    } else {
                        // console.log(`[DEBUG] Filter Check (${triggerId}): Filter 'source_id' FAILED. Event value (${eventData.deceasedEntityId}) !== Filter value (${filterValue}).`);
                    }
                }
                // Add other 'event:entity_died' specific filters here if needed
            } else if (eventName === 'event:room_entered') {
                if (filterKey === 'location_id') {
                    if (eventData?.newLocation?.id === filterValue) filterPassed = true;
                } else if (filterKey === 'previous_location_id') {
                    // Handles null/undefined previousLocation correctly
                    if (eventData?.previousLocation?.id === filterValue) filterPassed = true;
                } else if (filterKey === 'is_move') {
                    // true check: requires previousLocation to exist. false check: requires previousLocation NOT to exist.
                    if (filterValue === true && eventData?.previousLocation) filterPassed = true;
                    if (filterValue === false && !eventData?.previousLocation) filterPassed = true;
                }
                // Add other 'event:room_entered' specific filters here
            } else if (eventName === 'event:entity_moved') {
                if (filterKey === 'entity_id') {
                    if (eventData?.entityId === filterValue) filterPassed = true;
                } else if (filterKey === 'new_location_id') {
                    if (eventData?.newLocationId === filterValue) filterPassed = true;
                } else if (filterKey === 'old_location_id') {
                    if (eventData?.oldLocationId === filterValue) filterPassed = true;
                }
                // Add other 'event:entity_moved' specific filters here
            }
            // --- Add checks for other event types and filter keys as needed ---
            else {
                // If the eventName doesn't match any known type with specific filters,
                // we might assume the filter doesn't apply or log a warning.
                // For now, let's assume an unknown filter key for a known event means it passes
                // unless specific logic is added. Or perhaps fail? Let's fail unknown filters for safety.
                console.warn(`[DEBUG] Filter Check (${triggerId}): Unhandled filter key '${filterKey}' for event type '${eventName}'. Assuming filter FAILED.`);
                // filterPassed = true; // Option: Assume pass if unhandled
                return false; // Option: Assume fail if unhandled
            }

            // --- If any filter explicitly fails, stop checking and return false ---
            if (!filterPassed) {
                // console.log(`[DEBUG] TriggerSystem Filter Check (${triggerId}): Filter '${filterKey}' check FAILED. Overall check FAILED.`);
                return false;
            } else {
                // console.log(`[DEBUG] TriggerSystem Filter Check (${triggerId}): Filter '${filterKey}' check PASSED.`);
            }
        }

        // If the loop completes without returning false, all defined filters passed.
        // console.log(`[DEBUG] TriggerSystem Filter Check (${triggerId}): All defined filters PASSED.`);
        return true;
    }

    /**
     * Executes the 'set_connection_state' trigger action.
     * Modifies the state of a connection on a location entity.
     * @private
     * @param {{location_id: string, connection_direction: string}} target
     * @param {{state: string}} parameters
     * @returns {{ success: boolean, messages: ActionMessage[] }} Result object.
     */
    _executeSetConnectionState(target, parameters) {
        const messages = [];
        let success = false;

        // --- Basic validation ---
        if (!target || !target.location_id || !target.connection_direction || !parameters || typeof parameters.state !== 'string') {
            messages.push({
                text: `Trigger Action Error: Invalid target or parameters for set_connection_state.`,
                type: 'error'
            });
            console.error("[DEBUG] TriggerSystem _executeSetConnectionState: Invalid target/parameters.", target, parameters);
            return {success: false, messages};
        }

        // --- Get Location and Component ---
        const locationEntity = this.#entityManager.getEntityInstance(target.location_id);
        if (!locationEntity) {
            messages.push({
                text: `Trigger Action Error: Target location '${target.location_id}' not found.`,
                type: 'error'
            });
            console.error(`[DEBUG] TriggerSystem _executeSetConnectionState: Target location '${target.location_id}' not found.`);
            return {success: false, messages};
        }
        const connectionsComp = locationEntity.getComponent(ConnectionsComponent);
        if (!connectionsComp || typeof connectionsComp.setConnectionState !== 'function') { // Check for the method existence too
            messages.push({
                text: `Trigger Action Error: Location '${target.location_id}' has no valid Connections component.`,
                type: 'error'
            });
            console.error(`[DEBUG] TriggerSystem _executeSetConnectionState: Location '${target.location_id}' has no valid ConnectionsComponent.`);
            return {success: false, messages};
        }

        // --- Find Connection by Direction (as specified in trigger) ---
        const connection = connectionsComp.getConnectionByDirection(target.connection_direction); // Use the component's method for consistency
        if (!connection) {
            messages.push({
                text: `Trigger Action Error: Connection '${target.connection_direction}' not found in location '${target.location_id}'.`,
                type: 'error'
            });
            console.error(`[DEBUG] TriggerSystem _executeSetConnectionState: Connection '${target.connection_direction}' not found in location '${target.location_id}'.`);
            return {success: false, messages};
        }

        // --- Check if Connection ID exists (crucial for setting state) ---
        if (!connection.connectionId) {
            messages.push({
                text: `Trigger Action Error: Found connection '${target.connection_direction}' in '${target.location_id}', but it lacks a 'connectionId' needed for state update.`,
                type: 'error'
            });
            console.error(`[DEBUG] TriggerSystem _executeSetConnectionState: Connection '${target.connection_direction}' in '${target.location_id}' found but missing connectionId.`);
            return {success: false, messages};
        }

        // --- Check Current State and Update ---
        const oldState = connection.state; // Use the current runtime state
        if (oldState === parameters.state) {
            // console.log(`[DEBUG] Trigger Action (via TriggerSystem): Connection '${connection.connectionId}' state is already '${parameters.state}'. No change needed.`);
            success = true; // Already in desired state, consider it success
        } else {
            // *** FIX: Use connection.connectionId to update state ***
            const updated = connectionsComp.setConnectionState(connection.connectionId, parameters.state);

            if (updated) {
                console.log(`[DEBUG] Trigger Action (via TriggerSystem): Set connection '${connection.connectionId}' (direction: ${target.connection_direction}) in '${target.location_id}' state from '${oldState}' to '${parameters.state}'.`);
                // Generate UI messages based on state change
                if (parameters.state === 'unlocked' && oldState === 'locked') {
                    messages.push({text: `You hear a click from the ${target.connection_direction}.`, type: 'sound'});
                } else if (parameters.state === 'locked' && (oldState === 'unlocked' || oldState === undefined || oldState === null)) { // Handle initial undefined/null too
                    messages.push({
                        text: `You hear a click as the ${target.connection_direction} locks.`,
                        type: 'sound'
                    });
                }
                // Add more messages for other state changes if needed
                success = true;
            } else {
                // This should ideally not happen now if connectionId was found
                console.error(`[DEBUG] TriggerSystem _executeSetConnectionState: Failed to update connection state for ID '${connection.connectionId}' via ConnectionsComponent method.`);
                success = false;
                messages.push({
                    text: `Trigger Action Error: Failed internally to update connection state for '${target.connection_direction}' in '${target.location_id}'.`,
                    type: 'error'
                });
            }
        }
        return {success, messages};
    }
}

export default TriggerSystem;