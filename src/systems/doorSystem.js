// src/systems/doorSystem.js

// Component Imports
import {ConnectionsComponent} from '../components/connectionsComponent.js';

// Utility Imports
import {getDisplayName} from "../utils/messages.js"; // Assuming you might want richer logging

// Type Imports for JSDoc
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

/** @typedef {import('../types/eventTypes.js').ConnectionUnlockAttemptEventPayload} ConnectionUnlockAttemptEventPayload */

/** @typedef {import('../types/eventTypes.js').DoorUnlockedEventPayload} DoorUnlockedEventPayload */

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

        if (!payload) { // Handles null, undefined
            console.warn(`DoorSystem: Invalid null or undefined payload received for event:connection_unlock_attempt. Payload:`, payload);
            return; // Stop processing immediately
        }

        // 1. Extract required data from payload
        const {connectionId, locationId, userId, keyId, /* sourceItemId */} = payload; // keyId/sourceItemId might be useful for future rules/logging

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
            const updated = connectionsComponent.setConnectionState(connectionId, 'unlocked');

            if (updated) {
                // Log success message
                const locationName = getDisplayName(locationEntity);
                const connectionData = connectionsComponent.getConnectionById(connectionId); // Get connection data again for name
                const connectionDisplayName = connectionData?.name || connectionId; // Use name if available

                console.log(`DoorSystem: Connection '${connectionDisplayName}' (${connectionId}) in location '${locationId}' (${locationName}) unlocked by user '${userId}'.`);

                /** @type {DoorUnlockedEventPayload} */
                const unlockEventPayload = {
                    userId: userId,
                    locationId: locationId,
                    connectionId: connectionId,
                    keyId: keyId || null, // Pass the keyId if available
                    previousState: 'locked', // We know it was locked
                    newState: 'unlocked' // We just set it to unlocked
                };
                this.#eventBus.dispatch('event:door_unlocked', unlockEventPayload);
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