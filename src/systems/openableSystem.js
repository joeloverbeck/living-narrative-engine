// src/systems/openableSystem.js

// --- Component Imports ---
import OpenableComponent from '../components/openableComponent.js';
import LockableComponent from '../components/lockableComponent.js';

// --- Utility Imports ---
import {getDisplayName} from '../utils/messages.js'; // Adjust path if necessary

// --- Type Imports for JSDoc ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

// --- Expected Event Payload Types (Defined in OPEN-4) ---
/**
 * @typedef {object} EntityOpenedEventPayload
 * @property {string} actorId - ID of the entity initiating the open action
 * @property {string} targetEntityId - ID of the entity that was opened
 * @property {string} targetDisplayName - Display name of the entity that was opened
 */

/**
 * @typedef {object} OpenFailedEventPayload
 * @property {string} actorId - ID of the entity initiating the open action
 * @property {string} targetEntityId - ID of the entity that failed to open
 * @property {'ALREADY_OPEN' | 'LOCKED'} reasonCode - Specific reason for failure handled by this system
 */

/**
 * System responsible for handling the state change logic for entities
 * possessing an OpenableComponent. It validates the open attempt,
 * checks for blocking states (like being locked), modifies the
 * OpenableComponent state, and dispatches events indicating success or failure.
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
        // AC 2: Constructor accepts dependencies and throws if missing
        if (!eventBus) {
            throw new Error("OpenableSystem requires options.eventBus.");
        }
        if (!entityManager) {
            throw new Error("OpenableSystem requires options.entityManager.");
        }

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;

        // AC 8: Basic logging for instantiation
        console.log("OpenableSystem: Instance created.");
    }

    /**
     * Initializes the system. Currently does nothing but provides a
     * consistent structure for potential future event subscriptions.
     */
    initialize() {
        // AC 3: Initialize method exists (can be empty)
        console.log("OpenableSystem: Initialized.");
        // No event subscriptions needed for this system's core logic based on the ticket.
        // It acts based on direct calls to openEntity.
    }

    /**
     * Attempts to open the specified target entity, initiated by the actor.
     * Performs validation, state checks, modifies state, and dispatches events.
     *
     * @param {string} targetEntityId - The unique ID of the entity to open.
     * @param {string} actorId - The unique ID of the entity initiating the action.
     * @returns {boolean} True if the entity was successfully opened, false otherwise.
     */
    openEntity(targetEntityId, actorId) {
        // AC 4: Method signature
        // AC 8: Logging attempt
        console.log(`OpenableSystem: Actor [${actorId}] attempting to open target [${targetEntityId}].`);

        // AC 5: Target Validation - Retrieve entities
        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);
        const actorEntity = this.#entityManager.getEntityInstance(actorId); // Retrieved as per AC, though not used further in this logic

        // AC 5: Target Validation - Check target existence
        if (!targetEntity) {
            console.error(`OpenableSystem: Failed to open. Target entity [${targetEntityId}] not found. Attempt by actor [${actorId}].`);
            // Note: No specific event for "target not found" defined in the ticket's scope for this system.
            // Consider adding a reason code to OpenFailedEventPayload if needed elsewhere.
            return false;
        }

        // AC 5: Target Validation - Check for OpenableComponent
        const openableComponent = targetEntity.getComponent(OpenableComponent);
        if (!openableComponent) {
            console.error(`OpenableSystem: Failed to open. Target entity [${targetEntityId}] lacks OpenableComponent. Attempt by actor [${actorId}].`);
            // Note: No specific event for "component missing" defined in the ticket's scope for this system.
            // Consider adding a reason code to OpenFailedEventPayload if needed elsewhere.
            return false;
        }

        // AC 6: State Checks & Failure - Already Open
        if (openableComponent.isOpen === true) {
            // AC 8: Logging failure reason
            console.log(`OpenableSystem: Open failed for target [${targetEntityId}] by actor [${actorId}]. Reason: Already open.`);
            /** @type {OpenFailedEventPayload} */
            const payload = {
                actorId: actorId,
                targetEntityId: targetEntityId,
                reasonCode: 'ALREADY_OPEN'
            };
            this.#eventBus.dispatch('event:open_failed', payload);
            return false;
        }

        // AC 6: State Checks & Failure - Locked Check
        const lockableComponent = targetEntity.getComponent(LockableComponent);
        if (lockableComponent && lockableComponent.isLocked === true) {
            // AC 8: Logging failure reason
            console.log(`OpenableSystem: Open failed for target [${targetEntityId}] by actor [${actorId}]. Reason: Locked.`);
            /** @type {OpenFailedEventPayload} */
            const payload = {
                actorId: actorId,
                targetEntityId: targetEntityId,
                reasonCode: 'LOCKED'
            };
            this.#eventBus.dispatch('event:open_failed', payload);
            return false;
        }

        // AC 7: Success Path - Set State
        openableComponent.setState(true);

        // AC 7: Success Path - Get Display Name
        const targetDisplayName = getDisplayName(targetEntity);

        // AC 7: Success Path - Dispatch Success Event
        /** @type {EntityOpenedEventPayload} */
        const successPayload = {
            actorId: actorId,
            targetEntityId: targetEntityId,
            targetDisplayName: targetDisplayName
        };
        this.#eventBus.dispatch('event:entity_opened', successPayload);

        // AC 8: Logging success
        console.log(`OpenableSystem: Successfully opened target [${targetDisplayName} (${targetEntityId})] by actor [${actorId}]. Event 'event:entity_opened' dispatched.`);

        // AC 7: Success Path - Return true
        return true;
    }

} // End of OpenableSystem class

// AC 1: File defines and exports class
export default OpenableSystem;