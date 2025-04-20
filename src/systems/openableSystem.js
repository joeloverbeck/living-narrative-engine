// src/systems/openableSystem.js

// --- Component Imports ---
import OpenableComponent from '../components/openableComponent.js';
import LockableComponent from '../components/lockableComponent.js';
import {getDisplayName} from "../utils/messages.js";

// --- Utility Imports ---
// --- Type Imports for JSDoc ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
// --- Import Event Payload Types ---
/** @typedef {import('../types/eventTypes.js').OpenAttemptedEventPayload} OpenAttemptedEventPayload */
/** @typedef {import('../types/eventTypes.js').EntityOpenedEventPayload} EntityOpenedEventPayload */

/** @typedef {import('../types/eventTypes.js').OpenFailedEventPayload} OpenFailedEventPayload */


/**
 * System responsible for handling the state change logic for entities
 * possessing an OpenableComponent. It listens for 'event:open_attempted',
 * validates the attempt, checks for blocking states (like being locked),
 * modifies the OpenableComponent state, and dispatches events indicating
 * success ("event:entity_opened") or failure ('event:open_failed').
 */
class OpenableSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {EntityManager} */
    #entityManager;

    /**
     * Constructs the OpenableSystem.
     * @param {object} options - The dependencies for the system.
     * @param {EventBus} options.eventBus - The game's central event bus.
     * @param {EntityManager} options.entityManager - The game's entity manager.
     * @throws {Error} If eventBus or entityManager is missing.
     */
    constructor({eventBus, entityManager}) {
        // Constructor remains the same
        if (!eventBus) {
            throw new Error("OpenableSystem requires options.eventBus.");
        }
        if (!entityManager) {
            throw new Error("OpenableSystem requires options.entityManager.");
        }

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;

        // Basic logging for instantiation
        console.log("OpenableSystem: Instance created.");
    }

    /**
     * Initializes the system by subscribing to the 'event:open_attempted' event.
     */
    initialize() {
        // Subscribe to the relevant event
        this.#eventBus.subscribe('event:open_attempted', this.#handleOpenAttempted.bind(this));
        console.log("OpenableSystem: Initialized and subscribed to 'event:open_attempted'.");
    }

    /**
     * Handles the 'event:open_attempted' event.
     * Attempts to open the specified target entity, initiated by the actor.
     * Performs validation, state checks, modifies state, and dispatches events.
     *
     * @private
     * @param {OpenAttemptedEventPayload} payload - The event data containing actorId and targetEntityId.
     */
    #handleOpenAttempted(payload) {
        const {actorId, targetEntityId} = payload;

        // <<< ADD LOG 1 HERE >>>
        console.log(`OpenableSystem: Received 'event:open_attempted'. Actor [${actorId}] Target [${targetEntityId}].`);

        // Target Validation - Retrieve entities
        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);
        // Actor entity retrieval is not strictly needed for the core logic below, but might be useful for future enhancements (e.g., checking actor capabilities)
        // const actorEntity = this.#entityManager.getEntityInstance(actorId);

        // Target Validation - Check target existence
        if (!targetEntity) {
            console.error(`OpenableSystem: Failed to process open attempt. Target entity [${targetEntityId}] not found. Attempt by actor [${actorId}].`);
            // No specific 'target not found' event is dispatched here, as the action handler already deals with target resolution.
            // If the event fires, we assume the target *should* exist. Failure here indicates a deeper issue.
            // We could potentially dispatch a generic 'open_failed' with an 'OTHER' reason?
            /** @type {OpenFailedEventPayload} */
            const failPayload = {
                actorId: actorId,
                targetEntityId: targetEntityId,
                targetDisplayName: targetEntityId, // Best guess if entity is gone
                reasonCode: 'OTHER' // Or a new code like 'TARGET_VANISHED'
            };
            this.#eventBus.dispatch('event:open_failed', failPayload);
            return; // Stop processing this event
        }

        const targetDisplayName = getDisplayName(targetEntity); // Get name early for consistent logging/events

        // Target Validation - Check for OpenableComponent
        const openableComponent = targetEntity.getComponent(OpenableComponent);
        if (!openableComponent) {
            console.warn(`OpenableSystem: Target entity [${targetDisplayName} (${targetEntityId})] lacks OpenableComponent. Cannot process open attempt by actor [${actorId}].`);
            // Dispatch failure event - this is a valid failure case the system should report
            /** @type {OpenFailedEventPayload} */
            const failPayload = {
                actorId: actorId,
                targetEntityId: targetEntityId,
                targetDisplayName: targetDisplayName,
                reasonCode: 'TARGET_NOT_OPENABLE'
            };
            this.#eventBus.dispatch('event:open_failed', failPayload);
            return; // Stop processing this event
        }

        // State Checks & Failure - Already Open
        if (openableComponent.isOpen === true) {
            // Logging failure reason
            console.log(`OpenableSystem: Open failed for target [${targetDisplayName} (${targetEntityId})] by actor [${actorId}]. Reason: Already open.`);
            /** @type {OpenFailedEventPayload} */
            const failPayload = {
                actorId: actorId,
                targetEntityId: targetEntityId,
                targetDisplayName: targetDisplayName,
                reasonCode: 'ALREADY_OPEN'
            };
            this.#eventBus.dispatch('event:open_failed', failPayload);
            return; // Stop processing this event
        }

        // State Checks & Failure - Locked Check
        const lockableComponent = targetEntity.getComponent(LockableComponent);
        if (lockableComponent && lockableComponent.isLocked === true) {
            // Logging failure reason
            console.log(`OpenableSystem: Open failed for target [${targetDisplayName} (${targetEntityId})] by actor [${actorId}]. Reason: Locked.`);
            /** @type {OpenFailedEventPayload} */
            const failPayload = {
                actorId: actorId,
                targetEntityId: targetEntityId,
                targetDisplayName: targetDisplayName,
                reasonCode: 'LOCKED'
            };
            this.#eventBus.dispatch('event:open_failed', failPayload);
            return; // Stop processing this event
        }

        // --- Success Path ---
        // Set State
        openableComponent.setState(true);
        console.log(`OpenableSystem: State set for [${targetEntityId}]. isOpen: ${openableComponent.isOpen}`); // Optional: Verify state change


        // Dispatch Success Event
        /** @type {EntityOpenedEventPayload} */
        const successPayload = {
            actorId: actorId,
            targetEntityId: targetEntityId,
            targetDisplayName: targetDisplayName // Use name retrieved earlier
        };

        // <<< ADD LOG 2 HERE >>>
        console.log(`OpenableSystem: Attempting to dispatch '${"event:entity_opened"}' with payload:`, JSON.stringify(successPayload));
        this.#eventBus.dispatch("event:entity_opened", successPayload);

        // Logging success
        console.log(`OpenableSystem: Successfully opened target [${targetDisplayName} (${targetEntityId})] by actor [${actorId}]. Event '${"event:entity_opened"}' dispatched.`);

        // No return value needed for event handlers
    }

    // The public `openEntity` method is removed as it's no longer the entry point.

    // Optional: Add a shutdown method to unsubscribe if needed
    shutdown() {
        this.#eventBus.unsubscribe('event:open_attempted', this.#handleOpenAttempted);
        console.log("OpenableSystem: Unsubscribed from 'event:open_attempted'.");
    }

} // End of OpenableSystem class

export default OpenableSystem;