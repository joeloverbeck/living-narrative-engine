// src/systems/blockerSystem.js

// --- Type Imports for JSDoc ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../core/appContainer.js').default} AppContainer */ // Optional, if needed elsewhere

// --- Utility Imports ---
import {getDisplayName} from '../utils/messages.js';
import {LOCKABLE_COMPONENT_ID, OPENABLE_COMPONENT_ID} from '../types/components.js'; // Adjust path if necessary

/**
 * @typedef {object} BlockerCheckResult
 * @property {boolean} blocked - True if movement/interaction is prevented by the specified blockerEntityId (due to state or not being found), false otherwise.
 * @property {'DIRECTION_LOCKED' | 'DIRECTION_BLOCKED' | 'BLOCKER_NOT_FOUND' | null} reasonCode - A code indicating the reason for the block, or null if not blocked.
 * @property {string | null} blockerDisplayName - The display name of the blocker entity if found, null otherwise.
 * @property {string | null} blockerEntityId - The ID of the blocker entity that was checked, null if no ID was provided in the payload.
 * @property {string | null} details - A user-friendly description of the block reason or confirmation of passage.
 */

/**
 * System responsible for checking if movement or interactions are blocked by specific entities.
 * Provides a synchronous service method for other systems (like MoveCoordinator) to use.
 */
class BlockerSystem {
  /** @type {EventBus} */
  #eventBus; // Kept as dependency, but not used for move_attempted subscription anymore
  /** @type {EntityManager} */
  #entityManager;

  /**
     * Constructs the BlockerSystem.
     * @param {object} dependencies - The dependencies injected by the container.
     * @param {EventBus} dependencies.eventBus - The game's event bus.
     * @param {EntityManager} dependencies.entityManager - Manages game entities.
     */
  constructor({eventBus, entityManager}) {
    if (!eventBus || !entityManager) {
      throw new Error('BlockerSystem requires EventBus and EntityManager dependencies.');
    }
    this.#eventBus = eventBus;
    this.#entityManager = entityManager;
    console.log('BlockerSystem: Instance created.');
  }

  /**
     * Initializes the system.
     * Previously subscribed to events, but now primarily serves as a setup point if needed.
     * Called by the GameEngine during startup.
     */
  initialize() {
    // The check logic is now exposed via the checkMovementBlock method.
    console.log('BlockerSystem: Initialized. Ready to provide blocking checks via checkMovementBlock().');
  }

  /**
     * Synchronously checks if a potential blocker entity prevents movement or interaction.
     * This method examines the state of Openable, Lockable, and Breakable components
     * on the specified blocker entity using ID-based component data access.
     * It does NOT dispatch any events; it returns the result directly to the caller.
     *
     * @returns {BlockerCheckResult} An object detailing whether the path is blocked and why.
     */
  checkMovementBlock(payload) {
    const {blockerEntityId, entityId, previousLocationId, direction} = payload;

    // --- Check for Blocker ID ---
    if (!blockerEntityId) {
      // If no specific blocker is identified for this direction/action,
      // this system has nothing to check. Return non-blocking.
      return {
        blocked: false,
        reasonCode: null,
        blockerDisplayName: null,
        blockerEntityId: null,
        details: 'No specific blocker entity identified for this action.'
      };
    }

    // --- Fetch Blocker Entity Instance (still needed for display name) ---
    const blockerEntity = this.#entityManager.getEntityInstance(blockerEntityId);

    // --- Handle Missing Blocker Entity ---
    if (!blockerEntity) {
      // A blocker ID was provided, but the entity doesn't exist. Treat as blocked.
      console.warn(`BlockerSystem: Blocker entity ID "${blockerEntityId}" specified for check by actor ${entityId}, but entity instance not found.`);
      return {
        blocked: true,
        reasonCode: 'BLOCKER_NOT_FOUND',
        blockerDisplayName: null,
        blockerEntityId: blockerEntityId, // Return the ID that was not found
        details: `Cannot find the specified blocker (ID: ${blockerEntityId}).`
      };
    }

    // --- Evaluate Blocker State using Component Data ---
    const blockerDisplayName = getDisplayName(blockerEntity); // Get name early for messages
    let isBlocked = false;
    let isLockedReason = false;
    let blockReasonDetail = ''; // Build up the specific reason detail

    // --- Check Openable Component Data ---
    // Replace const openable = blockerEntity.getComponent(OpenableComponent);
    const openableData = this.#entityManager.getComponentData(blockerEntityId, OPENABLE_COMPONENT_ID); // Use ID
    if (openableData && openableData.isOpen === false) {
      isBlocked = true;
      blockReasonDetail = `The ${blockerDisplayName} (${blockerEntityId}) is closed.`;
    }

    // --- Check Lockable Component Data (takes precedence for reason code if blocking) ---
    // Replace const lockable = blockerEntity.getComponent(LockableComponent);
    const lockableData = this.#entityManager.getComponentData(blockerEntityId, LOCKABLE_COMPONENT_ID); // Use ID
    if (lockableData && lockableData.isLocked === true) {
      isBlocked = true;
      isLockedReason = true; // Mark as locked
      blockReasonDetail = `The ${blockerDisplayName} (${blockerEntityId}) is locked.`; // Locked message overrides closed
    }

    // --- Return Result ---
    if (isBlocked) {
      const reasonCode = isLockedReason ? 'DIRECTION_LOCKED' : 'DIRECTION_BLOCKED';
      return {
        blocked: true,
        reasonCode: reasonCode,
        blockerDisplayName: blockerDisplayName,
        blockerEntityId: blockerEntity.id, // Use ID from the entity instance
        details: blockReasonDetail // Use the constructed detail message
      };
    } else {
      // The blocker entity was found, but its state allows passage.
      return {
        blocked: false,
        reasonCode: null,
        blockerDisplayName: blockerDisplayName,
        blockerEntityId: blockerEntity.id, // Use ID from the entity instance
        details: `The ${blockerDisplayName} (${blockerEntity.id}) allows passage.`
      };
    }
  }

  // Add other methods as needed for different blocking scenarios (e.g., interaction attempts in future tickets)
}

export default BlockerSystem;