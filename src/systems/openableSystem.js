// src/systems/openableSystem.js

// --- Component Imports ---
// Note: While the test uses Component Classes, the system logic here
// relies on component *data* retrieved via IDs. Ensure your EntityManager
// and getComponentData implementation align with this.
// import OpenableComponent from '../components/openableComponent.js'; // Keep if needed elsewhere, but not directly used by getComponentData(ID)
// import LockableComponent from '../components/lockableComponent.js'; // Keep if needed elsewhere
import {getDisplayName} from '../utils/messages.js';
import {LOCKABLE_COMPONENT_ID, OPENABLE_COMPONENT_ID} from '../types/components.js'; // Assuming you have these constants defined

// --- Utility Imports ---
// (Add any other utility imports if necessary)

// --- Type Imports for JSDoc ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @typedef {object} OpenAttemptedEventPayload
 * @property {string} actorId - The ID of the entity attempting the action.
 * @property {string} targetEntityId - The ID of the entity being targeted.
 */

/**
 * @typedef {object} OpenFailedEventPayload
 * @property {string} actorId
 * @property {string} targetEntityId
 * @property {string} targetDisplayName
 * @property {'ALREADY_OPEN' | 'LOCKED' | 'TARGET_NOT_OPENABLE' | 'OTHER'} reasonCode
 */

/**
 * @typedef {object} EntityOpenedEventPayload
 * @property {string} actorId
 * @property {string} targetEntityId
 * @property {string} targetDisplayName
 */


/**
 * System responsible for handling the state change logic for entities
 * possessing openable component data. It listens for 'event:open_attempted',
 * validates the attempt, checks for blocking states (like being locked),
 * modifies the component data, and dispatches events indicating
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
    // --- Dependency Validation ---
    if (!eventBus) {
      throw new Error('OpenableSystem requires options.eventBus.');
    }
    if (!entityManager) {
      throw new Error('OpenableSystem requires options.entityManager.');
    }

    // --- Assign Dependencies ---
    this.#eventBus = eventBus;
    this.#entityManager = entityManager;

    // --- Binding Not Needed ---
    // Private methods (#) are automatically bound to 'this'.
    // The line below caused the 'TypeError: Private method is not writable'.
    // this.#handleOpenAttempted = this.#handleOpenAttempted.bind(this); // REMOVED

    console.log('OpenableSystem: Instance created.');
  }

  /**
     * Initializes the system by subscribing to the 'event:open_attempted' event.
     */
  initialize() {
    // Subscribe to the relevant event using the private method directly.
    // 'this' context will be correctly maintained.
    this.#eventBus.subscribe('event:open_attempted', this.#handleOpenAttempted);
    console.log("OpenableSystem: Initialized and subscribed to 'event:open_attempted'.");
  }

  /**
     * Handles the 'event:open_attempted' event.
     * Attempts to open the specified target entity, initiated by the actor.
     * Performs validation, state checks, modifies state, and dispatches events.
     *
     * @private
     * @param {OpenAttemptedEventPayload} payload - The event data.
     */
  #handleOpenAttempted(payload) {
    const {actorId, targetEntityId} = payload;

    // Optional: Add payload validation if needed

    console.log(`OpenableSystem: Received 'event:open_attempted'. Actor [${actorId}] Target [${targetEntityId}].`);

    const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);

    // --- Target Entity Existence Check ---
    if (!targetEntity) {
      console.error(`OpenableSystem: Failed to process open attempt. Target entity [${targetEntityId}] not found. Attempt by actor [${actorId}].`);
      /** @type {OpenFailedEventPayload} */
      const failPayload = {
        actorId: actorId,
        targetEntityId: targetEntityId,
        targetDisplayName: targetEntityId, // Best guess if entity is gone
        reasonCode: 'OTHER'
      };
      this.#eventBus.dispatch('event:open_failed', failPayload);
      return;
    }

    // --- Get Display Name ---
    // Ensure getDisplayName handles potential missing NameComponent gracefully.
    const targetDisplayName = getDisplayName(targetEntity);

    // --- Target Validation - Check for Openable Component Data ---
    // Assumes entity.getComponentData(COMPONENT_ID) returns the data object or null/undefined
    const openableData = targetEntity.getComponentData(OPENABLE_COMPONENT_ID);
    if (!openableData) {
      console.warn(`OpenableSystem: Target entity [${targetDisplayName} (${targetEntityId})] lacks component data for '${OPENABLE_COMPONENT_ID}'. Cannot process open attempt by actor [${actorId}].`);
      /** @type {OpenFailedEventPayload} */
      const failPayload = {
        actorId: actorId,
        targetEntityId: targetEntityId,
        targetDisplayName: targetDisplayName,
        reasonCode: 'TARGET_NOT_OPENABLE'
      };
      this.#eventBus.dispatch('event:open_failed', failPayload);
      return;
    }

    // --- State Checks & Failure - Already Open ---
    if (openableData.isOpen === true) {
      console.log(`OpenableSystem: Open failed for target [${targetDisplayName} (${targetEntityId})] by actor [${actorId}]. Reason: Already open.`);
      /** @type {OpenFailedEventPayload} */
      const failPayload = {
        actorId: actorId,
        targetEntityId: targetEntityId,
        targetDisplayName: targetDisplayName,
        reasonCode: 'ALREADY_OPEN'
      };
      this.#eventBus.dispatch('event:open_failed', failPayload);
      return;
    }

    // --- State Checks & Failure - Locked Check ---
    const lockableData = targetEntity.getComponentData(LOCKABLE_COMPONENT_ID);
    if (lockableData && lockableData.isLocked === true) {
      console.log(`OpenableSystem: Open failed for target [${targetDisplayName} (${targetEntityId})] by actor [${actorId}]. Reason: Locked.`);
      /** @type {OpenFailedEventPayload} */
      const failPayload = {
        actorId: actorId,
        targetEntityId: targetEntityId,
        targetDisplayName: targetDisplayName,
        reasonCode: 'LOCKED'
      };
      this.#eventBus.dispatch('event:open_failed', failPayload);
      return;
    }

    // --- Success Path ---
    // Modify the component data directly.
    // Ensure your ECS design allows for direct mutation of component data,
    // or replace this with the appropriate method (e.g., targetEntity.updateComponentData).
    openableData.isOpen = true;
    console.log(`OpenableSystem: State data updated for [${targetDisplayName} (${targetEntityId})]. isOpen: ${openableData.isOpen}`);

    // --- Dispatch Success Event ---
    /** @type {EntityOpenedEventPayload} */
    const successPayload = {
      actorId: actorId,
      targetEntityId: targetEntityId,
      targetDisplayName: targetDisplayName
    };

    console.log(`OpenableSystem: Attempting to dispatch '${'event:entity_opened'}' with payload:`, JSON.stringify(successPayload));
    this.#eventBus.dispatch('event:entity_opened', successPayload);

    console.log(`OpenableSystem: Successfully opened target [${targetDisplayName} (${targetEntityId})] by actor [${actorId}]. Event '${'event:entity_opened'}' dispatched.`);
  }

  /**
     * Cleans up by unsubscribing the event listener.
     */
  shutdown() {
    // Unsubscribe the same private method instance used in subscribe.
    this.#eventBus.unsubscribe('event:open_attempted', this.#handleOpenAttempted);
    console.log("OpenableSystem: Unsubscribed from 'event:open_attempted'. System shutdown.");
  }

} // End of OpenableSystem class

export default OpenableSystem;