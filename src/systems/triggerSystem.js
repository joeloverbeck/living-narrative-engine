// src/systems/triggerSystem.js

/** @typedef {import('../dataManager.js').default} DataManager */
/** @typedef {import('./entities/entityManager.js').default} EntityManager */
/** @typedef {import('../gameStateManager.js').default} GameStateManager */
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('./actions/actionTypes.js').ActionMessage} ActionMessage */ // For return type hinting

import {ConnectionsComponent} from "../components/connectionsComponent.js";

/**
 * Listens for game events via the EventBus, checks trigger conditions defined
 * in data, and executes corresponding actions.
 */
class TriggerSystem {
    #eventBus;
    #dataManager;
    #entityManager;
    #gameStateManager; // May be needed for future triggers/actions

    /** @type {Map<string, Function>} */
    #triggerIdToHandlerMap = new Map(); // To store handlers for potential unsubscription

    /** @type {Set<string>} */
    #activeOneShotTriggerIds = new Set(); // Store IDs of one-shot triggers that haven't fired yet

    /**
     * @param {EventBus} eventBus
     * @param {DataManager} dataManager
     * @param {EntityManager} entityManager
     * @param {GameStateManager} gameStateManager
     */
    constructor(eventBus, dataManager, entityManager, gameStateManager) {
        if (!eventBus) throw new Error("TriggerSystem requires an EventBus instance.");
        if (!dataManager) throw new Error("TriggerSystem requires a DataManager instance.");
        if (!entityManager) throw new Error("TriggerSystem requires an EntityManager instance.");
        if (!gameStateManager) throw new Error("TriggerSystem requires a GameStateManager instance.");

        this.#eventBus = eventBus;
        this.#dataManager = dataManager;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;

        console.log("TriggerSystem: Instance created.");
    }

    /**
     * Initializes the TriggerSystem by reading trigger definitions and subscribing to events.
     * Should be called after DataManager has loaded all data.
     */
    initialize() {
        console.log("TriggerSystem: Initializing subscriptions...");
        const allTriggers = this.#dataManager.getAllTriggers();

        if (!allTriggers || allTriggers.length === 0) {
            console.log("TriggerSystem: No trigger definitions found in DataManager.");
            return;
        }

        for (const triggerDef of allTriggers) {
            if (!triggerDef || !triggerDef.id || !triggerDef.listen_to || !triggerDef.listen_to.event_type) {
                console.warn("TriggerSystem: Skipping invalid trigger definition:", triggerDef);
                continue;
            }

            // Track one-shot triggers that should start active
            // Note: JSON schema defaults one_shot to true if omitted. We respect that.
            if (triggerDef.one_shot !== false) { // Default to true
                this.#activeOneShotTriggerIds.add(triggerDef.id);
            }

            const eventName = triggerDef.listen_to.event_type;

            // Create a specific handler function bound to this trigger definition.
            // This function reference is needed if we want to unsubscribe later.
            const handler = (eventData) => this._handleTriggerEvent(triggerDef, eventName, eventData);

            // Store the handler reference associated with the trigger ID
            this.#triggerIdToHandlerMap.set(triggerDef.id, handler);

            // Subscribe the specific handler to the event bus
            this.#eventBus.subscribe(eventName, handler);
            // console.log(`TriggerSystem: Subscribed to "${eventName}" for trigger "${triggerDef.id}"`);
        }
        console.log(`TriggerSystem: Finished initializing ${allTriggers.length} triggers. Active one-shots: ${this.#activeOneShotTriggerIds.size}`);
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

                // Optional: Unsubscribe from the event bus to potentially save memory/processing.
                // Requires retrieving the exact handler function reference.
                // const handler = this.#triggerIdToHandlerMap.get(triggerDef.id);
                // if (handler) {
                //     this.#eventBus.unsubscribe(eventName, handler);
                //     this.#triggerIdToHandlerMap.delete(triggerDef.id); // Clean up map
                //     console.log(`TriggerSystem: Unsubscribed handler for one-shot trigger ${triggerDef.id}.`);
                // }
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
        if (!listenCondition.filters) {
            return true; // No filters defined, always matches
        }

        // --- Implement specific filter logic based on eventName and filter keys ---
        // Example: 'entity_died' event with 'source_id' filter
        if (eventName === 'entity_died' && listenCondition.filters.source_id) {
            if (!eventData || typeof eventData.deceasedEntityId !== 'string') {
                console.warn(`TriggerSystem Filter Check (${listenCondition.event_type}): Filter requires 'deceasedEntityId' in eventData, but not found or invalid.`, eventData);
                return false; // Expected data missing
            }
            if (eventData.deceasedEntityId !== listenCondition.filters.source_id) {
                // console.debug(`Filter mismatch: event deceasedEntityId (${eventData.deceasedEntityId}) !== filter source_id (${listenCondition.filters.source_id})`);
                return false; // ID does not match
            }
        }

        // Add checks for other event types and filter keys here...
        // Example placeholder:
        // if (eventName === 'item_used' && listenCondition.filters.item_id) {
        //     if (!eventData || eventData.itemId !== listenCondition.filters.item_id) return false;
        // }

        // If we haven't returned false yet, all defined filters matched
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
        /** @type {ActionMessage[]} */
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
            // console.debug(`Trigger Action: Connection '${target.connection_direction}' in '${target.location_id}' is already in state '${parameters.state}'. No change needed.`);
            success = true; // Considered success as the desired state is achieved
        } else {
            connection.state = parameters.state; // Direct modification of component data
            console.log(`Trigger Action (via TriggerSystem): Set connection '${target.connection_direction}' in '${target.location_id}' state from '${oldState || 'undefined'}' to '${parameters.state}'.`);

            // Generate feedback message only if state actually changed to unlocked from locked
            if (parameters.state === 'unlocked' && oldState === 'locked') {
                messages.push({text: `You hear a click from the ${target.connection_direction}.`, type: 'sound'});
            }
            // Add other feedback messages for different state changes if needed
            success = true;
        }

        // Optional: Check if the player is currently in the affected location
        // const currentLocation = this.#gameStateManager.getCurrentLocation();
        // if (currentLocation && currentLocation.id === target.location_id) {
        //    console.log("Player is in the affected location. State change might require UI update (e.g., next LOOK).");
        //    // Could potentially dispatch another event like 'location:updated' if needed
        // }

        return {success, messages};
    }
}

export default TriggerSystem;