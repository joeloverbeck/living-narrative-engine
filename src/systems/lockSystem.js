// src/systems/lockSystem.js

// Import component IDs
import {
  LOCKABLE_COMPONENT_ID,
  DEFINITION_REF_COMPONENT_ID
} from '../types/components.js';

// Import helper for display name
import {getDisplayName} from '../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
// Define a type for the incoming payload, allowing flexibility but noting expected properties
/** @typedef {{ userId: string, itemInstanceId?: string | null, targetEntityId?: string | null, validatedTargetId?: string | null, [key: string]: any }} ReceivedLockUnlockPayload */
/** @typedef {{targetEntityId: string, userId: string | null, keyItemId: string | null}} EntityLockedEventPayload */ // userId can be null
/** @typedef {{targetEntityId: string, userId: string | null, keyItemId: string | null, force?: boolean}} EntityUnlockedEventPayload */ // userId can be null
/** @typedef {{ text: string, type: 'info' | 'success' | 'warning' | 'error' }} UIMessageDisplayPayload */


/** @typedef {string} LockResultReasonCode */ // Placeholder


/**
 * ECS System responsible for handling the logic of locking and unlocking entities
 * (e.g., chests, doors represented as entities).
 * Listens for "event:unlock_entity_attempt" and "event:lock_entity_attempt".
 * Retrieves component *data* using the EntityManager.
 */
class LockSystem {
  #eventBus;
  #entityManager;

  // Store bound operationHandlers to ensure correct removal during shutdown
  _boundHandleUnlockAttempt;
  _boundHandleLockAttempt;
  _boundHandleForceUnlock;

  /**
     * @param {object} options
     * @param {EventBus} options.eventBus - The game's central event bus.
     * @param {EntityManager} options.entityManager - The game's entity manager.
     */
  constructor({eventBus, entityManager}) {
    // Dependency injection and validation
    if (!eventBus) {
      throw new Error('LockSystem requires options.eventBus.');
    }
    if (!entityManager) {
      throw new Error('LockSystem requires options.entityManager.');
    }

    this.#eventBus = eventBus;
    this.#entityManager = entityManager;

    // Bind event operationHandlers to this instance for correct context and removal
    this._boundHandleUnlockAttempt = this._handleUnlockAttempt.bind(this);
    this._boundHandleForceUnlock = this._handleForceUnlock.bind(this);
    this._boundHandleLockAttempt = this._handleLockAttempt.bind(this);

    console.log('LockSystem: Instance created.');
  }

  /**
     * Subscribes the system to relevant lock/unlock events.
     */
  initialize() {
    this.#eventBus.subscribe('event:unlock_entity_attempt', this._boundHandleUnlockAttempt);
    this.#eventBus.subscribe('event:lock_entity_attempt', this._boundHandleLockAttempt);
    this.#eventBus.subscribe('event:unlock_entity_force', this._boundHandleForceUnlock);
    console.log('LockSystem: Initialized and subscribed to "event:unlock_entity_attempt" and "event:lock_entity_attempt".');
  }

  /**
     * Handles entity unlock attempts using component data. Validates against the lockable data,
     * checks keys if necessary, updates the component data via EntityManager, and dispatches events/messages.
     * (Implemented in T-4.3.4)
     * @private
     * @param {ReceivedLockUnlockPayload} payload - The event data associated with the unlock attempt.
     */
  _handleUnlockAttempt(payload) {
    console.debug('LockSystem: _handleUnlockAttempt received:', payload);

    const {userId, itemInstanceId} = payload;
    const targetEntityId = payload.validatedTargetId ?? payload.targetEntityId ?? null;
    const keyInstanceIdUsed = itemInstanceId || null;

    console.debug(`LockSystem: Extracted - userId: ${userId}, targetEntityId: ${targetEntityId}, keyInstanceIdUsed: ${keyInstanceIdUsed}`);

    const lockableComponentData = this.#entityManager.getComponentData(targetEntityId, LOCKABLE_COMPONENT_ID);
    const targetEntity = this.#entityManager.getEntityInstance(targetEntityId); // Get instance for display name

    if (!targetEntity) {
      console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process unlock attempt.`);
      this.#dispatchUIMessage("You can't find anything like that to unlock.", 'warning');
      return;
    }
    const entityName = getDisplayName(targetEntity); // Get name early for failure messages

    if (!lockableComponentData) {
      console.error(`LockSystem: Entity ${targetEntityId} lacks LockableComponent data. Cannot process unlock attempt.`);
      this.#dispatchUIMessage(`You can't unlock the ${entityName}.`, 'warning');
      return;
    }
    console.debug(`LockSystem: Found LockableComponent data on ${targetEntityId}. Data:`, lockableComponentData);


    // --- TICKET 4.3.4: Reimplement Unlock Logic ---

    // 1. Check if already unlocked
    if (!lockableComponentData.isLocked) {
      console.debug(`LockSystem: Entity ${targetEntityId} is already unlocked.`);
      this.#handleUnlockFailure('ALREADY_UNLOCKED', entityName);
      return;
    }

    // 2. Resolve Key Definition ID (if key was used)
    let keyDefinitionIdToCompare = null;
    if (keyInstanceIdUsed) {
      const defRefData = this.#entityManager.getComponentData(keyInstanceIdUsed, DEFINITION_REF_COMPONENT_ID);
      keyDefinitionIdToCompare = defRefData?.id ?? null;
      if (keyDefinitionIdToCompare) {
        console.debug(`LockSystem (Unlock Attempt): Resolved Key Instance ${keyInstanceIdUsed} to Definition ID: ${keyDefinitionIdToCompare} (via DefinitionRefComponent Data)`);
      } else {
        const keyEntity = this.#entityManager.getEntityInstance(keyInstanceIdUsed);
        if (keyEntity) {
          console.warn(`LockSystem (Unlock Attempt): Key instance ${keyInstanceIdUsed} found but lacks DefinitionRefComponent data or valid id property.`);
        } else {
          console.warn(`LockSystem (Unlock Attempt): Key instance ${keyInstanceIdUsed} not found in EntityManager.`);
        }
      }
    }

    // 3. Check if a key is required and if the correct key was used
    const requiredKeyId = lockableComponentData.keyId;
    if (requiredKeyId) {
      console.debug(`LockSystem: Unlock requires key definition ID: ${requiredKeyId}`);
      if (!keyDefinitionIdToCompare) {
        console.debug('LockSystem: Unlock requires a key, but none was provided/resolved.');
        this.#handleUnlockFailure('KEY_REQUIRED', entityName);
        return;
      }
      if (keyDefinitionIdToCompare !== requiredKeyId) {
        console.debug(`LockSystem: Wrong key used. Required: ${requiredKeyId}, Provided: ${keyDefinitionIdToCompare}`);
        this.#handleUnlockFailure('WRONG_KEY', entityName);
        return;
      }
      console.debug(`LockSystem: Correct key (${keyDefinitionIdToCompare}) provided.`);
    } else {
      console.debug('LockSystem: Unlock does not require a specific key.');
    }

    // 4. All checks passed - Proceed to unlock
    console.debug(`LockSystem: Unlock attempt successful for ${targetEntityId}. Updating component data...`);

    // Modify the data object
    lockableComponentData.isLocked = false;

    // Persist the change using EntityManager.addComponent (which overwrites)
    try {
      this.#entityManager.addComponent(targetEntityId, LOCKABLE_COMPONENT_ID, lockableComponentData);
      console.debug(`LockSystem: Component data for ${targetEntityId} updated successfully.`);
    } catch (error) {
      console.error(`LockSystem: CRITICAL - Failed to update LockableComponent data for ${targetEntityId} via EntityManager. Unlock state might be inconsistent.`, error);
      this.#dispatchUIMessage(`An error occurred while trying to unlock the ${entityName}.`, 'error');
      return; // Stop further processing
    }

    // 5. Dispatch success event and message
    /** @type {EntityUnlockedEventPayload} */
    const entityUnlockedPayload = {
      userId: userId,
      targetEntityId: targetEntityId,
      keyItemId: keyInstanceIdUsed // Report instance ID used
    };
    console.debug(`LockSystem: Dispatching ${'event:entity_unlocked'}`, entityUnlockedPayload);
    this.#eventBus.dispatch('event:entity_unlocked', entityUnlockedPayload);
    this.#dispatchUIMessage(`You unlock the ${entityName}.`, 'success');

    // --- End TICKET 4.3.4 Implementation ---
  }

  /**
     * Handles entity lock attempts using component data. Validates against the lockable data,
     * checks keys if necessary, updates the component data via EntityManager, and dispatches events/messages.
     * (Implemented in T-4.3.3)
     * @private
     * @param {ReceivedLockUnlockPayload} payload - The event data associated with the lock attempt.
     */
  _handleLockAttempt(payload) {
    console.debug('LockSystem: _handleLockAttempt received:', payload);

    const {userId, itemInstanceId} = payload;
    const targetEntityId = payload.validatedTargetId ?? payload.targetEntityId ?? null;
    const keyInstanceIdUsed = itemInstanceId || null;

    console.debug(`LockSystem: Extracted - userId: ${userId}, targetEntityId: ${targetEntityId}, keyInstanceIdUsed: ${keyInstanceIdUsed}`);

    const lockableComponentData = this.#entityManager.getComponentData(targetEntityId, LOCKABLE_COMPONENT_ID);
    const targetEntity = this.#entityManager.getEntityInstance(targetEntityId); // Get instance for display name

    if (!targetEntity) {
      console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process lock attempt.`);
      this.#dispatchUIMessage("You can't find anything like that to lock.", 'warning');
      return;
    }
    const entityName = getDisplayName(targetEntity); // Get name early for failure messages

    if (!lockableComponentData) {
      console.error(`LockSystem: Entity ${targetEntityId} lacks LockableComponent data. Cannot process lock attempt.`);
      this.#dispatchUIMessage(`You can't lock the ${entityName}.`, 'warning');
      return;
    }
    console.debug(`LockSystem: Found LockableComponent data on ${targetEntityId}. Data:`, lockableComponentData);


    // --- TICKET 4.3.3: Reimplement Lock Logic ---

    // 1. Check if already locked
    if (lockableComponentData.isLocked) {
      console.debug(`LockSystem: Entity ${targetEntityId} is already locked.`);
      this.#handleLockFailure('ALREADY_LOCKED', entityName);
      return;
    }

    // 2. Resolve Key Definition ID (if key was used)
    let keyDefinitionIdToCompare = null;
    if (keyInstanceIdUsed) {
      const defRefData = this.#entityManager.getComponentData(keyInstanceIdUsed, DEFINITION_REF_COMPONENT_ID);
      keyDefinitionIdToCompare = defRefData?.id ?? null;
      if (keyDefinitionIdToCompare) {
        console.debug(`LockSystem (Lock Attempt): Resolved Key Instance ${keyInstanceIdUsed} to Definition ID: ${keyDefinitionIdToCompare} (via DefinitionRefComponent Data)`);
      } else {
        const keyEntity = this.#entityManager.getEntityInstance(keyInstanceIdUsed);
        if (keyEntity) {
          console.warn(`LockSystem (Lock Attempt): Key instance ${keyInstanceIdUsed} found but lacks DefinitionRefComponent data or valid id property.`);
        } else {
          console.warn(`LockSystem (Lock Attempt): Key instance ${keyInstanceIdUsed} not found in EntityManager.`);
        }
      }
    }

    // 3. Check if a key is required and if the correct key was used
    const requiredKeyId = lockableComponentData.keyId;
    if (requiredKeyId) {
      console.debug(`LockSystem: Lock requires key definition ID: ${requiredKeyId}`);
      if (!keyDefinitionIdToCompare) {
        console.debug('LockSystem: Lock requires a key, but none was provided/resolved.');
        this.#handleLockFailure('KEY_REQUIRED', entityName);
        return;
      }
      if (keyDefinitionIdToCompare !== requiredKeyId) {
        console.debug(`LockSystem: Wrong key used. Required: ${requiredKeyId}, Provided: ${keyDefinitionIdToCompare}`);
        this.#handleLockFailure('WRONG_KEY', entityName);
        return;
      }
      console.debug(`LockSystem: Correct key (${keyDefinitionIdToCompare}) provided.`);
    } else {
      console.debug('LockSystem: Lock does not require a specific key.');
    }

    // 4. All checks passed - Proceed to lock
    console.debug(`LockSystem: Lock attempt successful for ${targetEntityId}. Updating component data...`);

    // Modify the data object
    lockableComponentData.isLocked = true;

    // Persist the change using EntityManager.addComponent (which overwrites)
    try {
      this.#entityManager.addComponent(targetEntityId, LOCKABLE_COMPONENT_ID, lockableComponentData);
      console.debug(`LockSystem: Component data for ${targetEntityId} updated successfully.`);
    } catch (error) {
      console.error(`LockSystem: CRITICAL - Failed to update LockableComponent data for ${targetEntityId} via EntityManager. Lock state might be inconsistent.`, error);
      this.#dispatchUIMessage(`An error occurred while trying to lock the ${entityName}.`, 'error');
      return; // Stop further processing
    }


    // 5. Dispatch success event and message
    /** @type {EntityLockedEventPayload} */
    const entityLockedPayload = {
      userId: userId,
      targetEntityId: targetEntityId,
      keyItemId: keyInstanceIdUsed // Report instance ID used, even if null
    };
    console.debug(`LockSystem: Dispatching ${'event:entity_locked'}`, entityLockedPayload);
    this.#eventBus.dispatch('event:entity_locked', entityLockedPayload);
    this.#dispatchUIMessage(`You lock the ${entityName}.`, 'success');

    // --- End TICKET 4.3.3 Implementation ---
  }

  /**
     * Handles "event:unlock_entity_force". Uses LockableComponent data.
     * Ignores key checks, sets isLocked to false if currently locked, and dispatches events/messages.
     * @private
     * @param {{targetEntityId:string, userId?:string|null, [key:string]:any}} payload
     */
  _handleForceUnlock(payload) {
    const {targetEntityId, userId = null} = payload;
    console.debug(`LockSystem: _handleForceUnlock received for ${targetEntityId}`);

    const lockableComponentData = this.#entityManager.getComponentData(targetEntityId, LOCKABLE_COMPONENT_ID);

    let entityName = 'something'; // Default name
    const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);
    if (targetEntity) {
      entityName = getDisplayName(targetEntity);
    } else {
      // Entity doesn't exist - different from not being lockable
      console.warn(`LockSystem: FORCE unlock – target entity ${targetEntityId} not found.`);
      if (userId) this.#dispatchUIMessage("You can't find that to force unlock.", 'warning');
      return;
    }

    // --- TICKET 4.3.5: Reimplement Force Unlock Logic ---

    let stateChanged = false;
    // 1. Check if lockable and locked
    if (lockableComponentData && lockableComponentData.isLocked) {
      console.debug(`LockSystem: Force unlocking entity ${targetEntityId}. Updating component data...`);
      // 2. Modify data
      lockableComponentData.isLocked = false;
      stateChanged = true;

      // 3. Persist change
      try {
        this.#entityManager.addComponent(targetEntityId, LOCKABLE_COMPONENT_ID, lockableComponentData);
        console.debug(`LockSystem: Component data for ${targetEntityId} updated successfully (force unlock).`);
      } catch (error) {
        console.error(`LockSystem: CRITICAL - Failed to update LockableComponent data for ${targetEntityId} via EntityManager during force unlock. State might be inconsistent.`, error);
        // Still dispatch event, but maybe log a more severe error or dispatch specific error message?
        if (userId) this.#dispatchUIMessage(`An error occurred while trying to force unlock the ${entityName}.`, 'error');
        // Allow event dispatch to proceed anyway for consistency? Or return? For now, proceed.
      }

    } else if (!lockableComponentData) {
      // Not lockable - completes silently
      console.debug(`LockSystem: FORCE unlock – target ${targetEntityId} is not lockable (no data). Silently succeeding.`);
    } else {
      // Lockable but already unlocked - completes silently
      console.debug(`LockSystem: FORCE unlock – target ${targetEntityId} found but is already unlocked. Silently succeeding.`);
    }

    // 4. Dispatch event (always)
    console.debug(`LockSystem: Dispatching forced ${'event:entity_unlocked'} for ${targetEntityId}`);
    /** @type {EntityUnlockedEventPayload} */
    const entityUnlockedPayload = {
      userId: userId, // Can be null if triggered by system
      targetEntityId: targetEntityId,
      keyItemId: null,
      force: true // Indicate it was a forced unlock
    };
    this.#eventBus.dispatch('event:entity_unlocked', entityUnlockedPayload);

    // 5. Dispatch UI message (if user initiated and state actually changed)
    if (userId && stateChanged) {
      // Use name retrieved earlier
      this.#dispatchUIMessage(`The ${entityName} unlocks with a loud *click*.`, 'info');
    } else if (userId && !stateChanged) {
      // Optional: provide feedback even if no state change occurred?
      // Example: this.#dispatchUIMessage(`The ${entityName} was already unlocked.`, 'info');
    }

    console.debug(`LockSystem: FORCE unlock processing finished for ${targetEntityId}. State changed: ${stateChanged}`);
    // --- End TICKET 4.3.5 Implementation ---
  }

  /**
     * Dispatches a UI message based on the unlock failure reason.
     * Uses specific reason codes implemented in T-4.3.4.
     * @private
     * @param {LockResultReasonCode | undefined} reasonCode - The reason code from the failed unlock attempt.
     * @param {string} entityName - The display name of the target entity.
     */
  #handleUnlockFailure(reasonCode, entityName) {
    let message = `You cannot unlock the ${entityName}.`; // Default fallback
    let type = 'warning';

    switch (reasonCode) {
      case 'ALREADY_UNLOCKED': // Implemented in T-4.3.4
        message = `The ${entityName} is already unlocked.`;
        type = 'info';
        break;
      case 'KEY_REQUIRED': // Implemented in T-4.3.4
        message = `You need a key to unlock the ${entityName}.`;
        type = 'warning';
        break;
      case 'WRONG_KEY': // Implemented in T-4.3.4
        message = "The key doesn't seem to fit the lock.";
        type = 'warning';
        break;
      case 'NOT_LOCKABLE': // Placeholder
        message = `You can't unlock the ${entityName}.`;
        type = 'warning';
        break;
      default:
        console.warn(`LockSystem: Unhandled unlock failure reasonCode: ${reasonCode}`);
        break;
    }
    this.#dispatchUIMessage(message, type);
  }

  /**
     * Dispatches a UI message based on the lock failure reason.
     * Uses specific reason codes implemented in T-4.3.3.
     * @private
     * @param {LockResultReasonCode | undefined} reasonCode - The reason code from the failed lock attempt.
     * @param {string} entityName - The display name of the target entity.
     */
  #handleLockFailure(reasonCode, entityName) {
    let message = `You cannot lock the ${entityName}.`; // Default fallback
    let type = 'warning';

    switch (reasonCode) {
      case 'ALREADY_LOCKED': // Implemented in T-4.3.3
        message = `The ${entityName} is already locked.`;
        type = 'info';
        break;
      case 'KEY_REQUIRED': // Implemented in T-4.3.3
        message = `You need the specific key associated with the ${entityName} to lock it.`;
        type = 'warning';
        break;
      case 'WRONG_KEY': // Implemented in T-4.3.3
        message = `That key doesn't seem to be the correct one for locking the ${entityName}.`;
        type = 'warning';
        break;
      case 'NOT_LOCKABLE': // Placeholder - might be redundant if check happens earlier
        message = `You can't lock the ${entityName}.`;
        type = 'warning';
        break;
      default:
        console.warn(`LockSystem: Unhandled lock failure reasonCode: ${reasonCode}`);
        break;
    }
    this.#dispatchUIMessage(message, type);
  }

  /**
     * Helper method to dispatch UI messages via the EventBus.
     * @private
     * @param {string} text - The message text.
     * @param {'info' | 'success' | 'warning' | 'error'} type - The message type.
     */
  #dispatchUIMessage(text, type) {
    /** @type {UIMessageDisplayPayload} */
    const uiMessagePayload = {text, type};
    console.debug(`LockSystem: Dispatching UI message: "${text}" (Type: ${type})`);
    this.#eventBus.dispatch('textUI:display_message', uiMessagePayload);
  }

  /**
     * Unsubscribes the system from events during shutdown.
     */
  shutdown() {
    // Use the stored bound operationHandlers for correct unsubscription
    this.#eventBus.unsubscribe('event:unlock_entity_attempt', this._boundHandleUnlockAttempt);
    this.#eventBus.unsubscribe('event:lock_entity_attempt', this._boundHandleLockAttempt);
    this.#eventBus.unsubscribe('event:unlock_entity_force', this._boundHandleForceUnlock);
    console.log('LockSystem: Shutdown complete, unsubscribed from events.');
  }
}

export default LockSystem;