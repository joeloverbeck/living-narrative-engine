// src/systems/genericTriggerSystem.js

// Import necessary components used by action implementations
import {ConnectionsComponent} from "../components/connectionsComponent.js";
import {EVENT_ENTITY_DIED, EVENT_ENTITY_MOVED} from "../types/eventTypes.js";

/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../entities/entity.js').default} Entity */

// Note: ActionExecutor and GameStateManager are NOT dependencies here.

/**
 * Handles the generic processing of data-driven triggers.
 * Listens for specified game events based on trigger definitions,
 * checks trigger conditions (filters), executes defined actions,
 * and manages trigger lifecycles (e.g., one-shot triggers).
 */
class GenericTriggerSystem {
    #eventBus;
    #dataManager;
    #entityManager;

    /** @type {Map<string, Function>} */
    #triggerIdToHandlerMap = new Map(); // To store handlers for potential unsubscription

    /** @type {Set<string>} */
    #activeOneShotTriggerIds = new Set(); // Store IDs of one-shot triggers that haven't fired yet

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus The system's event bus.
     * @param {DataManager} options.dataManager The data manager to access trigger definitions.
     * @param {EntityManager} options.entityManager The entity manager to access/modify entities and components.
     */
    constructor(options) {
        const {
            eventBus,
            dataManager,
            entityManager
        } = options || {};

        // Validate mandatory dependencies
        if (!eventBus) throw new Error("GenericTriggerSystem requires options.eventBus.");
        if (!dataManager) throw new Error("GenericTriggerSystem requires options.dataManager.");
        if (!entityManager) throw new Error("GenericTriggerSystem requires options.entityManager.");

        this.#eventBus = eventBus;
        this.#dataManager = dataManager;
        this.#entityManager = entityManager;

        console.log("GenericTriggerSystem: Instance created.");
    }

    /**
     * Initializes the GenericTriggerSystem by reading trigger definitions
     * from the DataManager and subscribing to the events specified within them.
     */
    initialize() {
        console.log("GenericTriggerSystem: Initializing subscriptions based on trigger definitions...");
        const allTriggers = this.#dataManager.getAllTriggers();

        if (allTriggers && allTriggers.length > 0) {
            let initializedCount = 0;
            for (const triggerDef of allTriggers) {
                // Validate the core parts of the trigger definition needed for subscription
                if (!triggerDef || !triggerDef.id || !triggerDef.listen_to || !triggerDef.listen_to.event_type || !triggerDef.actions) {
                    console.warn("GenericTriggerSystem: Skipping invalid or incomplete trigger definition:", triggerDef);
                    continue;
                }

                // Track active one-shot triggers
                // Note: one_shot defaults to true if not specified or explicitly false
                if (triggerDef.one_shot !== false) {
                    this.#activeOneShotTriggerIds.add(triggerDef.id);
                }

                const eventName = triggerDef.listen_to.event_type;
                // Create a unique handler for this trigger instance, bound correctly
                const handler = (eventData) => this._handleTriggerEvent(triggerDef, eventName, eventData);

                // Store the handler in case we need to unsubscribe later (e.g., dynamic trigger removal)
                this.#triggerIdToHandlerMap.set(triggerDef.id, handler);

                // Subscribe to the specified event
                this.#eventBus.subscribe(eventName, handler);
                initializedCount++;
                // console.debug(`GenericTriggerSystem: Subscribed to "${eventName}" for trigger "${triggerDef.id}".`);
            }
            console.log(`GenericTriggerSystem: Finished initializing ${initializedCount} triggers. Active one-shots: ${this.#activeOneShotTriggerIds.size}`);
        } else {
            console.log("GenericTriggerSystem: No trigger definitions found in DataManager.");
        }
    }

    /**
     * Handles an incoming event dispatch relevant to a specific trigger definition.
     * Checks filters, executes actions, and handles one-shot logic.
     * This is the core callback for event subscriptions set up in `initialize`.
     * @private
     * @param {object} triggerDef - The full trigger definition object from DataManager.
     * @param {string} eventName - The name of the event that occurred.
     * @param {object} eventData - The data payload of the event.
     */
    _handleTriggerEvent(triggerDef, eventName, eventData) {
        // 1. Check if it's a one-shot trigger that is no longer active
        if (triggerDef.one_shot !== false && !this.#activeOneShotTriggerIds.has(triggerDef.id)) {
            // console.debug(`GenericTriggerSystem: Skipping already fired/deactivated one-shot trigger "${triggerDef.id}"`);
            return;
        }

        // console.log(`[DEBUG] GenericTriggerSystem: Handling event "${eventName}" for trigger "${triggerDef.id}"`, eventData);

        // 2. Check Filters
        // Inject the trigger ID into the listen_to object temporarily for better logging in _checkFilters
        // This avoids needing to pass triggerId down separately.
        const listenConditionWithContext = {...triggerDef.listen_to, parentTriggerId: triggerDef.id};
        if (!this._checkFilters(listenConditionWithContext, eventName, eventData)) {
            // console.debug(`GenericTriggerSystem: Filters did not match for trigger "${triggerDef.id}" on event "${eventName}"`);
            return; // Filters didn't match, do nothing further for this trigger
        }

        console.log(`GenericTriggerSystem: Trigger MATCHED: ${triggerDef.id} for event ${eventName}`);

        // 3. Execute Actions
        let allActionsSucceeded = true;
        if (!triggerDef.actions || triggerDef.actions.length === 0) {
            console.warn(`GenericTriggerSystem: Trigger "${triggerDef.id}" matched but has no actions defined.`);
            // If it's a one-shot with no actions, should it be deactivated? Let's assume yes for now.
            // If filters pass but no actions, it effectively "fired".
        } else {
            for (const action of triggerDef.actions) {
                // console.log(`GenericTriggerSystem: Executing trigger action:`, action); // Verbose
                let result = {success: false, messages: []}; // Default result

                try {
                    // Add the trigger ID to the action context for potential use within action logic/logging
                    const targetWithContext = action.target ? {
                        ...action.target,
                        parentTriggerId: triggerDef.id
                    } : {parentTriggerId: triggerDef.id};
                    const paramsWithContext = action.parameters ? {
                        ...action.parameters,
                        parentTriggerId: triggerDef.id
                    } : {parentTriggerId: triggerDef.id};

                    switch (action.type) {
                        case 'set_connection_state':
                            result = this._executeSetConnectionState(targetWithContext, paramsWithContext);
                            break;
                        case 'update_entity_component':
                            result = this._executeUpdateEntityComponent(targetWithContext, paramsWithContext);
                            break;
                        // --- Add cases for other generic trigger action types here ---
                        // case 'display_message':
                        //    result = this._executeDisplayMessage(paramsWithContext); // Example
                        //    break;
                        default:
                            console.warn(`GenericTriggerSystem: Unknown trigger action type '${action.type}' in trigger ${triggerDef.id}`);
                            result.messages.push({
                                text: `Internal warning: Unknown trigger action type '${action.type}'.`,
                                type: 'warning'
                            });
                            result.success = false; // Consider unknown actions as failures.
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
                        console.error(`GenericTriggerSystem: Action type '${action.type}' failed for trigger ${triggerDef.id}.`);
                        // Optional: Decide whether to stop processing further actions for this trigger if one fails.
                        // break; // Uncomment to stop on first failure
                    }

                } catch (error) {
                    console.error(`GenericTriggerSystem: Uncaught error executing action type '${action.type}' for trigger ${triggerDef.id}:`, error);
                    allActionsSucceeded = false;
                    // Dispatch an error message to the UI
                    this.#eventBus.dispatch('ui:message_display', {
                        text: `Internal error processing action for trigger '${triggerDef.id}'. Check console.`,
                        type: 'error'
                    });
                    // Optional: break; // Stop processing actions on uncaught error
                }
            }
        } // End of action execution block

        // 4. Handle One-Shot Logic
        // Deactivate the trigger if it's one-shot AND all its actions executed successfully
        // (or if it had no actions but the filters passed).
        if (triggerDef.one_shot !== false && allActionsSucceeded) {
            if (this.#activeOneShotTriggerIds.has(triggerDef.id)) {
                console.log(`GenericTriggerSystem: Deactivating successful one-shot trigger ${triggerDef.id}.`);
                this.#activeOneShotTriggerIds.delete(triggerDef.id);
                // Optional: Also unsubscribe handler to save memory?
                // const handlerToRemove = this.#triggerIdToHandlerMap.get(triggerDef.id);
                // if (handlerToRemove) {
                //    this.#eventBus.unsubscribe(eventName, handlerToRemove);
                //    this.#triggerIdToHandlerMap.delete(triggerDef.id);
                //    console.log(`GenericTriggerSystem: Unsubscribed handler for deactivated one-shot trigger ${triggerDef.id}.`);
                // }
            }
        } else if (triggerDef.one_shot !== false && !allActionsSucceeded) {
            console.warn(`GenericTriggerSystem: One-shot trigger ${triggerDef.id} matched but action(s) failed. Trigger remains active.`);
        }
    }

    /**
     * Checks if the provided event data matches the filters defined in the trigger's listen_to block.
     * @private
     * @param {object} listenCondition - The `listen_to` object from the trigger definition (potentially with parentTriggerId added).
     * @param {string} eventName - The name of the event being processed.
     * @param {object} eventData - The data payload of the event.
     * @returns {boolean} True if all filters match or no filters are defined, false otherwise.
     */
    _checkFilters(listenCondition, eventName, eventData) {
        const triggerId = listenCondition.parentTriggerId ?? 'unknown'; // Use context if available

        // No filters defined? Always matches.
        if (!listenCondition.filters || Object.keys(listenCondition.filters).length === 0) {
            // console.debug(`GenericTriggerSystem Filter Check (${triggerId}): No filters defined. PASSED.`);
            return true;
        }

        // console.debug(`GenericTriggerSystem Filter Check (${triggerId}): Checking filters for event "${eventName}". Filters:`, listenCondition.filters, "Event Data:", eventData);

        // Iterate through each filter defined in the trigger
        for (const filterKey in listenCondition.filters) {
            const filterValue = listenCondition.filters[filterKey];
            let filterPassed = false; // Assume filter fails unless explicitly passed

            // --- Check specific filter types based on eventName and filterKey ---
            // Use optional chaining (?.) extensively to avoid errors if eventData structure varies
            if (eventName === EVENT_ENTITY_DIED) {
                if (filterKey === 'source_id') { // Assuming source_id refers to the deceased entity
                    if (eventData?.deceasedEntityId === filterValue) filterPassed = true;
                }
                // Add other EVENT_ENTITY_DIED specific filters here if needed
            } else if (eventName === 'event:room_entered') { // Player or NPC entered a room
                if (filterKey === 'location_id') { // The room being entered
                    if (eventData?.newLocation?.id === filterValue) filterPassed = true;
                } else if (filterKey === 'entity_id') { // The entity that entered
                    if (eventData?.playerEntity?.id === filterValue) filterPassed = true; // Assuming playerEntity for now
                    // TODO: Make this check more robust if non-player entities can trigger 'room_entered'
                } else if (filterKey === 'previous_location_id') { // The room they came from
                    // Handles null/undefined previousLocation correctly for matching `null` or a specific ID
                    if (eventData?.previousLocation?.id === filterValue || (filterValue === null && !eventData?.previousLocation)) {
                        filterPassed = true;
                    }
                } else if (filterKey === 'is_move') { // Check if it was result of a move vs initial load
                    // true check: requires previousLocation to exist. false check: requires previousLocation NOT to exist.
                    if (filterValue === true && eventData?.previousLocation) filterPassed = true;
                    if (filterValue === false && !eventData?.previousLocation) filterPassed = true;
                }
                // Add other 'event:room_entered' specific filters here
            } else if (eventName === EVENT_ENTITY_MOVED) { // Entity changed location reference
                if (filterKey === 'entity_id') {
                    if (eventData?.entityId === filterValue) filterPassed = true;
                } else if (filterKey === 'new_location_id') { // Destination ID
                    if (eventData?.newLocationId === filterValue) filterPassed = true;
                } else if (filterKey === 'old_location_id') { // Source ID
                    if (eventData?.oldLocationId === filterValue) filterPassed = true;
                }
            }
                // --- Add checks for other event types and filter keys as needed ---
                // Example: event:item_used
                // else if (eventName === EVENT_ITEM_USE_ATTEMPTED) {
                //     if (filterKey === 'item_id') {
                //         if (eventData?.item?.id === filterValue) filterPassed = true;
                //     } else if (filterKey === 'target_id') {
                //         if (eventData?.target?.id === filterValue) filterPassed = true;
                //     } else if (filterKey === 'actor_id') {
                //         if (eventData?.actor?.id === filterValue) filterPassed = true;
                //     }
            // }
            else {
                // Generic fallback: check if a property with filterKey exists directly on eventData
                // This is less robust but provides some flexibility for simple custom events.
                if (eventData && eventData.hasOwnProperty(filterKey) && eventData[filterKey] === filterValue) {
                    console.warn(`GenericTriggerSystem Filter Check (${triggerId}): Using generic fallback check for filter key '${filterKey}' on event '${eventName}'. Match found.`);
                    filterPassed = true;
                } else {
                    // If the eventName doesn't match any known type with specific filters,
                    // and the generic check failed, assume the filter is unhandled/failed.
                    console.warn(`GenericTriggerSystem Filter Check (${triggerId}): Unhandled filter key '${filterKey}' for event type '${eventName}' or property not found/matched in eventData. Assuming filter FAILED.`);
                    return false; // Fail unknown/unmatched filters for safety.
                }
            }

            // --- If any filter explicitly fails, stop checking and return false ---
            if (!filterPassed) {
                // console.debug(`GenericTriggerSystem Filter Check (${triggerId}): Filter '${filterKey}' check FAILED. Overall check FAILED.`);
                return false;
            } else {
                // console.debug(`GenericTriggerSystem Filter Check (${triggerId}): Filter '${filterKey}' check PASSED.`);
            }
        }

        // If the loop completes without returning false, all defined filters passed.
        // console.debug(`GenericTriggerSystem Filter Check (${triggerId}): All defined filters PASSED.`);
        return true;
    }

    /**
     * Executes the 'set_connection_state' trigger action.
     * Modifies the state of a connection on a location entity's ConnectionsComponent.
     * @private
     * @param {{location_id: string, connection_direction: string, parentTriggerId?: string}} target
     * @param {{state: string}} parameters
     * @returns {{ success: boolean, messages: ActionMessage[] }} Result object.
     */
    _executeSetConnectionState(target, parameters) {
        const messages = [];
        let success = false;
        const triggerId = target.parentTriggerId ?? 'unknown'; // Get context for logging

        // --- Basic validation ---
        if (!target || !target.location_id || !target.connection_direction || !parameters || typeof parameters.state !== 'string') {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Invalid target or parameters for set_connection_state.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeSetConnectionState (Trigger: ${triggerId}): Invalid target/parameters.`, target, parameters);
            return {success: false, messages};
        }

        // --- Get Location Entity and Component ---
        const locationEntity = this.#entityManager.getEntityInstance(target.location_id);
        if (!locationEntity) {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Target location '${target.location_id}' not found for set_connection_state.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeSetConnectionState (Trigger: ${triggerId}): Target location '${target.location_id}' not found.`);
            return {success: false, messages};
        }
        // Ensure the component exists and has the expected method
        const connectionsComp = locationEntity.getComponent(ConnectionsComponent);
        if (!connectionsComp || typeof connectionsComp.setConnectionState !== 'function') {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Location '${target.location_id}' has no valid Connections component with setConnectionState method.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeSetConnectionState (Trigger: ${triggerId}): Location '${target.location_id}' has no valid ConnectionsComponent or missing method.`);
            return {success: false, messages};
        }

        // --- Find Connection by Direction ---
        // We need the connection's runtime ID to modify it safely.
        const connection = connectionsComp.getConnectionByDirection(target.connection_direction);
        if (!connection) {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Connection '${target.connection_direction}' not found in location '${target.location_id}'.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeSetConnectionState (Trigger: ${triggerId}): Connection '${target.connection_direction}' not found in location '${target.location_id}'.`);
            return {success: false, messages};
        }

        // --- Check if Connection ID exists ---
        if (!connection.connectionId) {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Found connection '${target.connection_direction}' in '${target.location_id}', but it lacks a 'connectionId' needed for state update.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeSetConnectionState (Trigger: ${triggerId}): Connection '${target.connection_direction}' in '${target.location_id}' found but missing connectionId.`);
            return {success: false, messages};
        }

        // --- Check Current State and Update ---
        const oldState = connection.state; // Use the current runtime state from the found connection object
        if (oldState === parameters.state) {
            // console.debug(`[DEBUG] Trigger Action (Trigger: ${triggerId}): Connection '${connection.connectionId}' state is already '${parameters.state}'. No change needed.`);
            success = true; // Already in desired state, consider it success
        } else {
            // Use the component's method with the connection ID to ensure consistency
            const updated = connectionsComp.setConnectionState(connection.connectionId, parameters.state);

            if (updated) {
                console.log(`[DEBUG] Trigger Action (Trigger: ${triggerId}): Set connection '${connection.connectionId}' (direction: ${target.connection_direction}) in '${target.location_id}' state from '${oldState ?? 'undefined'}' to '${parameters.state}'.`);
                // Generate UI messages based on state change (example)
                if (parameters.state === 'unlocked' && oldState === 'locked') {
                    messages.push({text: `You hear a click from the ${target.connection_direction}.`, type: 'sound'}); // Example message
                } else if (parameters.state === 'locked' && (oldState === 'unlocked' || oldState === undefined || oldState === null)) {
                    messages.push({
                        text: `You hear a click as the ${target.connection_direction} locks.`,
                        type: 'sound'
                    }); // Example message
                }
                // Add more messages for other state changes if desired
                success = true;
            } else {
                // This might happen if setConnectionState fails internally for some reason (e.g., invalid state value)
                console.error(`[DEBUG] GenericTriggerSystem _executeSetConnectionState (Trigger: ${triggerId}): Failed to update connection state for ID '${connection.connectionId}' via ConnectionsComponent method.`);
                success = false;
                messages.push({
                    text: `Trigger Action Error (Trigger: ${triggerId}): Failed internally to update connection state for '${target.connection_direction}' in '${target.location_id}'.`,
                    type: 'error'
                });
            }
        }
        return {success, messages};
    }

    /**
     * Executes the 'update_entity_component' trigger action.
     * Modifies data within a specified component on a target entity instance.
     * @private
     * @param {{entity_id: string, parentTriggerId?: string}} target
     * @param {{component_name: string, component_data: object, merge_strategy?: string}} parameters
     * @returns {{ success: boolean, messages: ActionMessage[] }} Result object.
     */
    _executeUpdateEntityComponent(target, parameters) {
        const messages = [];
        let success = false;
        const triggerId = target.parentTriggerId ?? 'unknown'; // Get context for logging
        const {entity_id} = target || {};
        const {component_name, component_data, merge_strategy = 'merge_shallow'} = parameters || {}; // Default merge strategy

        // --- Basic validation ---
        if (!entity_id || !component_name || typeof component_data !== 'object' || component_data === null) {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Invalid target or parameters for update_entity_component. Requires entity_id, component_name, and non-null component_data object.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): Invalid target/parameters.`, target, parameters);
            return {success: false, messages};
        }

        // --- Get Entity Instance ---
        const targetEntity = this.#entityManager.getEntityInstance(entity_id);
        if (!targetEntity) {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Target entity '${entity_id}' not found for update_entity_component.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): Target entity '${entity_id}' not found.`);
            return {success: false, messages};
        }

        // --- Get the Component Class from the Registry ---
        // Assumes componentRegistry maps names (string) to actual classes (constructor functions)
        const ComponentClass = this.#entityManager.componentRegistry.get(component_name);
        if (!ComponentClass) {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Component type '${component_name}' not registered or found in ComponentRegistry.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): Component type '${component_name}' not registered.`);
            return {success: false, messages};
        }

        // --- Get the Component Instance from the Entity ---
        const componentInstance = targetEntity.getComponent(ComponentClass);
        if (!componentInstance) {
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Entity '${entity_id}' does not have component '${component_name}'. Cannot update.`,
                type: 'error'
            });
            console.error(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): Entity '${entity_id}' lacks component '${component_name}'.`);
            return {success: false, messages};
        }

        // --- Update Component Data ---
        try {
            // TODO: Implement different merge strategies ('replace', 'merge_deep') if needed.
            // For now, only implementing 'merge_shallow' (default).
            if (merge_strategy === 'replace') {
                // Potentially dangerous: Replace the entire component's data structure?
                // This likely requires a specific method on the component like `setState` or `replaceAllData`.
                // For now, log a warning and proceed with merge_shallow as a fallback.
                console.warn(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): Merge strategy 'replace' not fully implemented. Falling back to 'merge_shallow' for component '${component_name}' on entity '${entity_id}'.`);
                // Fall through to merge_shallow
            }

            // 'merge_shallow' or fallback from 'replace'
            let updatePerformed = false;
            let actionSuccess = true; // Assume success unless a specific action fails

            // Check for specific component methods first (e.g., LockableComponent's lock/unlock)
            if (component_name === 'Lockable' && component_data.hasOwnProperty('isLocked')) {
                const targetLockedState = component_data.isLocked;
                let lockResult = null; // To store the result from lock/unlock

                // --- Updated Lock/Unlock Handling ---
                if (typeof targetLockedState !== 'boolean') {
                    console.warn(`[DEBUG] Trigger Action (Trigger: ${triggerId}): Invalid non-boolean value '${targetLockedState}' provided for 'isLocked' on Lockable component for entity '${entity_id}'. Skipping lock/unlock.`);
                    // Decide if this should be considered a failure
                    actionSuccess = false; // Treat invalid data as failure
                    messages.push({ text: `Trigger Action Warning (Trigger: ${triggerId}): Invalid data for Lockable 'isLocked' state.`, type: 'warning'});

                } else if (targetLockedState === false && typeof componentInstance.unlock === 'function') {
                    // Attempt to unlock, passing null as the keyItemId since trigger data doesn't specify one
                    lockResult = componentInstance.unlock(null);
                    console.log(`[DEBUG] Trigger Action (Trigger: ${triggerId}): Called unlock(null) on ${component_name} for entity '${entity_id}'. Result:`, lockResult);

                } else if (targetLockedState === true && typeof componentInstance.lock === 'function') {
                    // Attempt to lock, passing null as the keyItemId
                    lockResult = componentInstance.lock(null);
                    console.log(`[DEBUG] Trigger Action (Trigger: ${triggerId}): Called lock(null) on ${component_name} for entity '${entity_id}'. Result:`, lockResult);
                }

                // Check the result of the lock/unlock attempt
                if (lockResult !== null) {
                    updatePerformed = lockResult.success; // Update was performed ONLY if the lock/unlock succeeded
                    actionSuccess = lockResult.success;   // The overall action succeeded ONLY if lock/unlock succeeded
                    if (!lockResult.success) {
                        console.warn(`[DEBUG] Trigger Action (Trigger: ${triggerId}): Lockable operation failed for entity '${entity_id}'. Reason: ${lockResult.reasonCode}`);
                        // Optionally add a generic failure message if specific lock/unlock messages aren't desired from triggers
                        // messages.push({ text: `Trigger Action Notice (Trigger: ${triggerId}): Could not change lock state for entity '${entity_id}' (${lockResult.reasonCode}).`, type: 'info' });
                    }
                }
                // --- End Updated Lock/Unlock Handling ---

            } // End Lockable component check

            // If no specific method handled it (or if it wasn't Lockable), or for other components/properties, perform shallow merge
            // IMPORTANT: Only proceed with generic merge if a specific handler (like lock/unlock) didn't run or if it's a different component.
            // We set updatePerformed = true inside the loop ONLY if a property is actually merged.
            // actionSuccess remains true unless the merge itself fails (which is unlikely with the current hasOwnProperty check).
            if (component_name !== 'Lockable' || !component_data.hasOwnProperty('isLocked')) {
                let mergePerformed = false; // Track if any merge happened
                for (const key in component_data) {
                    if (componentInstance.hasOwnProperty(key)) {
                        componentInstance[key] = component_data[key];
                        mergePerformed = true;
                    } else {
                        console.warn(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): Property '${key}' defined in trigger data does not exist on component '${component_name}' for entity '${entity_id}'. Skipping update for this key.`);
                    }
                }
                if (mergePerformed) {
                    console.log(`[DEBUG] Trigger Action (Trigger: ${triggerId}): Updated properties via shallow merge on ${component_name} for entity '${entity_id}' with data:`, component_data);
                    updatePerformed = true; // An update happened via merge
                    // actionSuccess remains true (assuming merge itself doesn't throw error)
                } else {
                    // Only warn if NO update happened at all (neither specific nor merge)
                    if (!updatePerformed) {
                        console.warn(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): No properties updated for component '${component_name}' on entity '${entity_id}'. Data provided:`, component_data);
                    }
                }
            }

            // If any update was potentially made (either via method or merge), consider it a success for event dispatch purposes.
            // The actual functional success is tracked by actionSuccess.
            if (updatePerformed) {
                this.#eventBus.dispatch('system:entity_component_updated', {
                    entityId: entity_id,
                    componentName: component_name,
                    updatedData: component_data, // The data used for the update attempt
                    triggerId: triggerId,
                    success: actionSuccess // Include the actual success state in the event
                });
            }

            // The overall success of the execution step depends on actionSuccess
            success = actionSuccess;
        } catch (updateError) {
            console.error(`[DEBUG] GenericTriggerSystem _executeUpdateEntityComponent (Trigger: ${triggerId}): Error updating component '${component_name}' for entity '${entity_id}':`, updateError);
            messages.push({
                text: `Trigger Action Error (Trigger: ${triggerId}): Failed internally to update component '${component_name}' for '${entity_id}'.`,
                type: 'error'
            });
            success = false;
        }

        return {success, messages};
    }

    // Add other _execute... methods for different action types here as needed
    // e.g., _executeDisplayMessage, _executeSpawnEntity, etc.

}

export default GenericTriggerSystem;