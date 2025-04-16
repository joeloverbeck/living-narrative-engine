// src/systems/deathSystem.js

import {PositionComponent} from '../components/positionComponent.js';
import {EVENT_ENTITY_DIED, EVENT_ENTITY_LOOT_SPAWN_REQUESTED} from "../types/eventTypes.js"; // Import PositionComponent
// Other necessary imports remain the same

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Listens for entity death events and handles related tasks like
 * determining location for potential follow-up events (e.g., loot spawning).
 */
class DeathSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {EntityManager} */
    #entityManager;

    /**
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus
     * @param {EntityManager} dependencies.entityManager
     */
    constructor({eventBus, entityManager}) {
        if (!eventBus || !entityManager) {
            throw new Error("DeathSystem requires EventBus and EntityManager.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        console.log("DeathSystem: Instance created.");
    }

    /**
     * Subscribes to the EVENT_ENTITY_DIED event. Call this after instantiation.
     */
    initialize() {
        // Bind the handler to ensure 'this' context is correct when called by EventBus
        this.#eventBus.subscribe(EVENT_ENTITY_DIED, this._handleEntityDied.bind(this));
        console.log("DeathSystem: Initialized and subscribed to '" + EVENT_ENTITY_DIED + "'.");
    }

    /**
     * Handles the EVENT_ENTITY_DIED event.
     * Determines the location of the deceased entity using its PositionComponent.
     * This location ID can be used for subsequent events (e.g., loot spawning).
     * @param {object} eventData
     * @param {string} eventData.deceasedEntityId - The ID of the entity that died.
     * @param {string} [eventData.killerEntityId] - The ID of the entity that caused the death (optional).
     * @private
     */
    _handleEntityDied(eventData) {
        const {deceasedEntityId} = eventData;

        if (!deceasedEntityId) {
            console.error(`DeathSystem: Received '${EVENT_ENTITY_DIED}' without a deceasedEntityId.`, eventData);
            return;
        }

        console.log(`DeathSystem: Handling death of entity '${deceasedEntityId}'.`);

        // --- 1. Retrieve Deceased Entity ---
        const deceasedEntity = this.#entityManager.getEntityInstance(deceasedEntityId);
        if (!deceasedEntity) {
            // This could happen if the entity was already removed by another system or the event fired late.
            console.warn(`DeathSystem: Deceased entity '${deceasedEntityId}' not found in EntityManager. Cannot determine location.`);
            return;
        }

        // --- 2. Determine Location ID via PositionComponent ---
        let locationId = null;
        const posComp = deceasedEntity.getComponent(PositionComponent);

        if (posComp && typeof posComp.locationId === 'string' && posComp.locationId.length > 0) {
            locationId = posComp.locationId;
        } else {
            // Log an error if PositionComponent or locationId is missing.
            // An entity that can die in a location *should* have a valid PositionComponent.
            console.error(`DeathSystem: Cannot determine location for deceased entity '${deceasedEntityId}'. PositionComponent is missing or does not contain a valid locationId.`);
            // Depending on requirements, you might still proceed with other cleanup,
            // but location-specific actions like loot spawning would fail.
            // For now, we stop processing if location is unknown.
            return;
        }

        console.log(`DeathSystem: Determined entity '${deceasedEntityId}' died at location '${locationId}'. System will now proceed with other death-related tasks (if any).`);

        // --- Future Enhancements / Follow-up Events ---
        // The determined locationId is now available for use in subsequent events.
        // Example: Firing an event to request loot spawning at the determined location.
        if (locationId) {
            // Example: Emit an event for loot generation system
            this.#eventBus.dispatch(EVENT_ENTITY_LOOT_SPAWN_REQUESTED, {
                deceasedEntityId: deceasedEntityId,
                locationId: locationId,
                killerEntityId: eventData.killerEntityId // Pass along killer if available
                // Add any other relevant data, e.g., entity type for loot tables
            });
        }

        // console.log(`DeathSystem: TODO: Schedule full entity instance removal for ${deceasedEntityId} from EntityManager.`);
        // this.#entityManager.removeEntityInstance(deceasedEntityId); // Or schedule this in a separate cleanup phase/system
    }
}

export default DeathSystem;