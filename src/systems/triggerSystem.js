// src/systems/triggerSystem.js

import {ConnectionsComponent} from "../components/connectionsComponent.js";

/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Corrected path if needed
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../eventBus.js').default} EventBus */              // Corrected path if needed
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */ // <<<--- ADDED Import
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */ // <<<--- ADDED Import


/**
 * Listens for game events, checks trigger conditions, executes actions,
 * and handles built-in reactions like auto-look on move and entity instantiation.
 */
class TriggerSystem {
    #eventBus;
    #dataManager;
    #entityManager;
    #gameStateManager; // May be needed for future triggers/actions
    #actionExecutor;

    /** @type {Map<string, Function>} */
    #triggerIdToHandlerMap = new Map(); // To store handlers for potential unsubscription

    /** @type {Set<string>} */
    #activeOneShotTriggerIds = new Set(); // Store IDs of one-shot triggers that haven't fired yet

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
        if (!actionExecutor) throw new Error("TriggerSystem requires options.actionExecutor."); // <<<--- ADDED Validation

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

        // --- Subscribe Combined Handler for Built-in Room Entered Logic ---
        this.#eventBus.subscribe('event:room_entered', this.#handleRoomEntered.bind(this));
        console.log("TriggerSystem: Subscribed #handleRoomEntered to 'event:room_entered' for entity instantiation and auto-look.");
    }

    /**
     * Handles the 'event:room_entered' event:
     * 1. Ensures entities in the new location are instantiated.
     * 2. Triggers an automatic 'look' action *if* this was a player move (not initial load).
     * @private
     * @param {{ newLocation: Entity, playerEntity: Entity, previousLocation?: Entity }} eventData
     */
    #handleRoomEntered(eventData) {
        console.log("TriggerSystem: Handling 'event:room_entered'.");
        const {newLocation, playerEntity, previousLocation} = eventData;

        // Validate essential data for both parts
        if (!newLocation || !playerEntity) {
            console.error("TriggerSystem #handleRoomEntered: Received 'event:room_entered' but newLocation or playerEntity was missing.", eventData);
            return;
        }

        // --- Part 1: Ensure Entities are Instantiated ---
        try {
            this.#entityManager.ensureLocationEntitiesInstantiated(newLocation);
            console.log(`TriggerSystem: Ensured entities are instantiated for ${newLocation.id}.`);
        } catch (error) {
            console.error(`TriggerSystem: Error during ensureLocationEntitiesInstantiated for ${newLocation.id}:`, error);
            this.#eventBus.dispatch('ui:message_display', {
                text: `Internal Error: Problem loading entities for location ${newLocation.id}.`,
                type: 'error'
            });
            // If entities fail to load, it might be confusing to show the room description. Stop here.
            return;
        }

        // --- Part 2: Trigger Automatic 'Look' if it was a player move ---
        if (previousLocation) { // Check if previousLocation exists (indicates a move, not initial game load)
            console.log(`TriggerSystem: Player moved from ${previousLocation.id} to ${newLocation.id}. Triggering automatic 'look'.`);

            /** @type {ActionContext} */
            const lookContext = {
                playerEntity: playerEntity,
                currentLocation: newLocation, // Use the *new* location for the look action
                targets: [], // 'look' action doesn't typically need targets when triggered this way
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                dispatch: this.#eventBus.dispatch.bind(this.#eventBus) // Pass the dispatcher for the action handler
            };

            try {
                // Execute the 'look' action via the injected executor.
                // The result isn't directly used here; the action handler dispatches UI messages.
                const lookResult = this.#actionExecutor.executeAction('core:action_look', lookContext);

                // Log potential issues from the look action itself for debugging.
                if (!lookResult.success) {
                    console.warn(`TriggerSystem: Automatic 'core:action_look' execution reported failure. Messages:`, lookResult.messages);
                    // Note: UI messages should have already been dispatched by the look handler or ActionExecutor via context.dispatch.
                } else {
                    console.log(`TriggerSystem: Automatic 'core:action_look' executed successfully.`);
                }
            } catch (error) {
                console.error("TriggerSystem: Uncaught error executing automatic 'core:action_look':", error);
                // Dispatch a generic error if the call to executeAction fails unexpectedly.
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Internal Error: Failed to perform automatic look after moving.",
                    type: 'error'
                });
            }

        } else {
            console.log("TriggerSystem: 'event:room_entered' received without previousLocation (likely initial game load). Skipping automatic 'look'.");
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

        // console.log(`TriggerSystem: Handling event "${eventName}" for trigger "${triggerDef.id}"`, eventData); // Verbose

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
        // ... (existing implementation remains the same) ...
        if (!listenCondition.filters) {
            return true; // No filters defined, always matches
        }

        // Example filter check (add more as needed for custom triggers)
        if (eventName === 'entity_died' && listenCondition.filters.source_id) {
            if (!eventData || typeof eventData.deceasedEntityId !== 'string') {
                console.warn(`TriggerSystem Filter Check (${listenCondition.event_type}): Filter requires 'deceasedEntityId' in eventData, but not found or invalid.`, eventData);
                return false;
            }
            if (eventData.deceasedEntityId !== listenCondition.filters.source_id) {
                return false;
            }
        }

        // If using event:room_entered for custom triggers, add filter checks here
        if (eventName === 'event:room_entered' && listenCondition.filters) {
            // Example: Filter by the ID of the room entered
            if (listenCondition.filters.location_id && (!eventData.newLocation || eventData.newLocation.id !== listenCondition.filters.location_id)) {
                return false;
            }
            // Example: Filter by the ID of the room exited
            if (listenCondition.filters.previous_location_id && (!eventData.previousLocation || eventData.previousLocation.id !== listenCondition.filters.previous_location_id)) {
                return false;
            }
            // Example: Filter only if it was a move (previousLocation exists)
            if (listenCondition.filters.is_move === true && !eventData.previousLocation) {
                return false;
            }
            // Example: Filter only if it was NOT a move (initial load)
            if (listenCondition.filters.is_move === false && eventData.previousLocation) {
                return false;
            }
        }

        return true; // All defined filters passed
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
        if (!target || !target.location_id || !target.connection_direction || !parameters || typeof parameters.state !== 'string') {
            messages.push({
                text: `Trigger Action Error: Invalid target or parameters for set_connection_state.`,
                type: 'error'
            });
            console.error("TriggerSystem _executeSetConnectionState: Invalid target/parameters.", target, parameters);
            return {success: false, messages};
        }
        const locationEntity = this.#entityManager.getEntityInstance(target.location_id);
        if (!locationEntity) {
            messages.push({
                text: `Trigger Action Error: Target location '${target.location_id}' not found.`,
                type: 'error'
            });
            console.error(`TriggerSystem _executeSetConnectionState: Target location '${target.location_id}' not found.`);
            return {success: false, messages};
        }
        const connectionsComp = locationEntity.getComponent(ConnectionsComponent);
        if (!connectionsComp || !Array.isArray(connectionsComp.connections)) {
            messages.push({
                text: `Trigger Action Error: Location '${target.location_id}' has no valid Connections component.`,
                type: 'error'
            });
            console.error(`TriggerSystem _executeSetConnectionState: Location '${target.location_id}' has no valid ConnectionsComponent.`);
            return {success: false, messages};
        }
        const connection = connectionsComp.connections.find(c => c.direction === target.connection_direction);
        if (!connection) {
            messages.push({
                text: `Trigger Action Error: Connection '${target.connection_direction}' not found in location '${target.location_id}'.`,
                type: 'error'
            });
            console.error(`TriggerSystem _executeSetConnectionState: Connection '${target.connection_direction}' not found in location '${target.location_id}'.`);
            return {success: false, messages};
        }
        const oldState = connection.state;
        if (oldState === parameters.state) {
            success = true;
        } else {
            connection.state = parameters.state;
            console.log(`Trigger Action (via TriggerSystem): Set connection '${target.connection_direction}' in '${target.location_id}' state from '${oldState || 'undefined'}' to '${parameters.state}'.`);
            if (parameters.state === 'unlocked' && oldState === 'locked') {
                messages.push({text: `You hear a click from the ${target.connection_direction}.`, type: 'sound'});
            }
            success = true;
        }
        return {success, messages};
    }
}

export default TriggerSystem;