// src/systems/doorSystem.js

// Component Imports
import {ConnectionsComponent} from '../components/connectionsComponent.js';

// Utility Imports
import {getDisplayName} from "../utils/messages.js"; // Assuming you might want richer logging

// Type Imports for JSDoc
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

/** @typedef {import('../events/eventTypes.js').ConnectionUnlockAttemptEventPayload} ConnectionUnlockAttemptEventPayload */

/**
 * Handles the logic for unlocking connections (like doors) in response
 * to the 'event:connection_unlock_attempt'.
 */
class DoorSystem {
    #eventBus;
    #entityManager;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus - The game's event bus.
     * @param {EntityManager} options.entityManager - The game's entity manager.
     */
    constructor({eventBus, entityManager}) {
        if (!eventBus) {
            console.error("DoorSystem: EventBus dependency is missing.");
            throw new Error("DoorSystem requires an EventBus instance.");
        }
        if (!entityManager) {
            console.error("DoorSystem: EntityManager dependency is missing.");
            throw new Error("DoorSystem requires an EntityManager instance.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        console.log("DoorSystem: Instance created.");
    }

    /**
     * Subscribes the system to the connection unlock attempt event.
     */
    initialize() {
        this.#eventBus.subscribe(
            'event:connection_unlock_attempt',
            this._handleConnectionUnlockAttempt.bind(this)
        );
        console.log("DoorSystem: Initialized and subscribed to 'event:connection_unlock_attempt'.");
    }

    /**
     * Handles the 'event:connection_unlock_attempt' event.
     * Retrieves the location and its ConnectionsComponent, checks the state
     * of the targeted connection, and unlocks it if it's currently locked.
     *
     * @private
     * @param {ConnectionUnlockAttemptEventPayload} payload - Data from the event.
     */
    _handleConnectionUnlockAttempt(payload) {
        console.debug("DoorSystem: Received event:connection_unlock_attempt", payload);

        // 1. Extract required data from payload
        const {connectionId, locationId, userId /*, keyId, sourceItemId */} = payload; // keyId/sourceItemId might be useful for future rules/logging

        if (!connectionId || !locationId || !userId) {
            console.warn(`DoorSystem: Invalid payload received for event:connection_unlock_attempt. Missing required fields (connectionId, locationId, userId). Payload:`, payload);
            return; // Stop processing if core data is missing
        }

        // 2. Retrieve Location Entity
        const locationEntity = this.#entityManager.getEntityInstance(locationId);
        if (!locationEntity) {
            console.warn(`DoorSystem: Could not find location entity instance with ID: ${locationId}. Cannot process unlock attempt for connection ${connectionId}.`);
            return; // Stop processing
        }
        console.debug(`DoorSystem: Found location entity: ${getDisplayName(locationEntity)} (${locationId})`);

        // 3. Retrieve ConnectionsComponent from Location
        const connectionsComponent = locationEntity.getComponent(ConnectionsComponent);
        if (!connectionsComponent) {
            console.warn(`DoorSystem: Location entity ${locationId} (${getDisplayName(locationEntity)}) does not have a ConnectionsComponent. Cannot process unlock attempt for connection ${connectionId}.`);
            return; // Stop processing
        }
        console.debug(`DoorSystem: Found ConnectionsComponent on location ${locationId}.`);

        // 4. Get Current Connection State
        const currentState = connectionsComponent.getConnectionState(connectionId);
        console.debug(`DoorSystem: Current state of connection '${connectionId}' in location '${locationId}' is: ${currentState}`);

        // 5. Conditional Update
        if (currentState === 'locked') {
            // Call setConnectionState to update the runtime state
            const updated = connectionsComponent.setConnectionState(connectionId, 'unlocked');

            if (updated) {
                // Log success message
                const locationName = getDisplayName(locationEntity);
                // Future: could get user display name too: const userName = getDisplayName(this.#entityManager.getEntityInstance(userId));
                console.log(`DoorSystem: Connection '${connectionId}' in location '${locationId}' (${locationName}) unlocked by user '${userId}'.`);
                // Optional: Dispatch a success UI message? Depends on if the triggering item already gave feedback.
                // this.#eventBus.dispatch('ui:message_display', { text: `You unlock the ${connectionId}.`, type: 'success' });
            } else {
                // This case should theoretically not happen if getConnectionState returned 'locked',
                // but included for robustness.
                console.error(`DoorSystem: Failed to update state for connection '${connectionId}' in location '${locationId}' even though its state was reported as 'locked'.`);
            }
        } else {
            // Log informative message when no action is needed
            if (currentState === undefined) {
                console.log(`DoorSystem: Connection '${connectionId}' not found in location '${locationId}'. No action taken.`);
            } else {
                console.log(`DoorSystem: Connection '${connectionId}' in location '${locationId}' is not in a 'locked' state (current: '${currentState}'). No action taken.`);
            }
        }
    }

    /**
     * Unsubscribes the system from events if needed during shutdown.
     */
    shutdown() {
        this.#eventBus.unsubscribe('event:connection_unlock_attempt', this._handleConnectionUnlockAttempt);
        console.log("DoorSystem: Unsubscribed from 'event:connection_unlock_attempt'.");
    }
}

export default DoorSystem;