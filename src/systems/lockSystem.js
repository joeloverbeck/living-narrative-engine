// src/systems/lockSystem.js

import LockableComponent from '../components/lockableComponent.js';
// Import helper for display name
import { getDisplayName } from '../utils/messages.js'; // Assuming getDisplayName is exported from messages.js or similar

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../types/eventTypes.js').UnlockEntityAttemptEventPayload} UnlockEntityAttemptEventPayload */
/** @typedef {import('../types/eventTypes.js').LockEntityAttemptEventPayload} LockEntityAttemptEventPayload */
/** @typedef {import('../types/eventTypes.js').EntityUnlockedEventPayload} EntityUnlockedEventPayload */
/** @typedef {import('../types/eventTypes.js').EntityLockedEventPayload} EntityLockedEventPayload */
/** @typedef {import('../types/eventTypes.js').UIMessageDisplayPayload} UIMessageDisplayPayload */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/lockableComponent.js').LockAttemptResult} LockAttemptResult */
/** @typedef {import('../components/lockableComponent.js').LockResultReasonCode} LockResultReasonCode */


/**
 * ECS System responsible for handling the logic of locking and unlocking entities
 * (e.g., chests, doors represented as entities).
 * Listens for 'event:unlock_entity_attempt' and 'event:lock_entity_attempt'.
 * Delegates the core state change and validation logic to LockableComponent.
 */
class LockSystem {
    #eventBus;
    #entityManager;

    // Store bound handlers to ensure correct removal during shutdown
    _boundHandleUnlockAttempt;
    _boundHandleLockAttempt;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus - The game's central event bus.
     * @param {EntityManager} options.entityManager - The game's entity manager.
     */
    constructor({ eventBus, entityManager }) {
        // Dependency injection and validation
        if (!eventBus) {
            throw new Error("LockSystem requires options.eventBus.");
        }
        if (!entityManager) {
            throw new Error("LockSystem requires options.entityManager.");
        }

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;

        // Bind event handlers to this instance for correct context and removal
        this._boundHandleUnlockAttempt = this._handleUnlockAttempt.bind(this);
        this._boundHandleLockAttempt = this._handleLockAttempt.bind(this);

        console.log("LockSystem: Instance created.");
    }

    /**
     * Subscribes the system to relevant lock/unlock events.
     */
    initialize() {
        this.#eventBus.subscribe('event:unlock_entity_attempt', this._boundHandleUnlockAttempt);
        this.#eventBus.subscribe('event:lock_entity_attempt', this._boundHandleLockAttempt);
        console.log("LockSystem: Initialized and subscribed to event:unlock_entity_attempt and event:lock_entity_attempt.");
    }

    /**
     * Handles entity unlock attempts by delegating to LockableComponent.unlock().
     * Dispatches events and UI messages based on the component's result.
     *
     * @private
     * @param {UnlockEntityAttemptEventPayload} payload - The event data associated with the unlock attempt.
     */
    _handleUnlockAttempt(payload) {
        console.debug("LockSystem: _handleUnlockAttempt received:", payload);

        const { userId, targetEntityId, keyItemId } = payload; // Keep: Extract payload data
        console.debug(`LockSystem: Extracted - userId: ${userId}, targetId: ${targetEntityId}, keyId: ${keyItemId}`);

        /** @type {Entity | undefined} */
        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId); // Keep: Find entity

        if (!targetEntity) { // Keep: Check if entity exists
            console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process unlock attempt.`);
            this.#dispatchUIMessage("You can't find anything like that to unlock.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found target entity: ${targetEntity.id}`);

        /** @type {LockableComponent | undefined} */
        const lockableComponent = targetEntity.getComponent(LockableComponent); // Keep: Get component

        if (!lockableComponent) { // Keep: Check if component exists
            console.error(`LockSystem: Entity ${targetEntityId} lacks a LockableComponent. Cannot process unlock attempt.`);
            this.#dispatchUIMessage("You can't unlock that.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found LockableComponent on ${targetEntityId}.`); // Note: Removed internal state logging here

        // Call the component's unlock method
        const currentKeyItemId = keyItemId || null; // Ensure null is passed if keyItemId is undefined/falsy
        console.debug(`LockSystem: Calling lockableComponent.unlock(${currentKeyItemId})`);
        /** @type {LockAttemptResult} */
        const unlockResult = lockableComponent.unlock(currentKeyItemId); // Capture result
        console.debug(`LockSystem: lockableComponent.unlock result:`, unlockResult);

        // Retrieve display name using the helper - needed for both success/failure messages
        const entityName = getDisplayName(targetEntity);

        // Based on the return value, dispatch events/messages
        if (unlockResult.success) {
            // Dispatch the core game event ONLY if successful
            /** @type {EntityUnlockedEventPayload} */
            const entityUnlockedPayload = {
                userId: userId,
                targetEntityId: targetEntityId,
                keyItemId: currentKeyItemId // Pass the key used, which might be null
            };
            console.debug(`LockSystem: Dispatching event:entity_unlocked`, entityUnlockedPayload);
            this.#eventBus.dispatch('event:entity_unlocked', entityUnlockedPayload);

            // Dispatch success UI message ONLY if successful
            this.#dispatchUIMessage(`You unlock the ${entityName}.`, 'success');

        } else {
            // Dispatch failure UI message based on the reason code
            this.#handleUnlockFailure(unlockResult.reasonCode, entityName);
        }
    }

    /**
     * Handles entity lock attempts by delegating to LockableComponent.lock().
     * Dispatches events and UI messages based on the component's result.
     *
     * @private
     * @param {LockEntityAttemptEventPayload} payload - The event data associated with the lock attempt.
     */
    _handleLockAttempt(payload) {
        console.debug("LockSystem: _handleLockAttempt received:", payload);

        const { userId, targetEntityId, keyItemId } = payload; // Keep: Extract payload data
        console.debug(`LockSystem: Extracted - userId: ${userId}, targetId: ${targetEntityId}, keyId: ${keyItemId}`);

        /** @type {Entity | undefined} */
        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId); // Keep: Find entity

        if (!targetEntity) { // Keep: Check if entity exists
            console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process lock attempt.`);
            this.#dispatchUIMessage("You can't find anything like that to lock.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found target entity: ${targetEntity.id}`);

        /** @type {LockableComponent | undefined} */
        const lockableComponent = targetEntity.getComponent(LockableComponent); // Keep: Get component

        if (!lockableComponent) { // Keep: Check if component exists
            console.error(`LockSystem: Entity ${targetEntityId} lacks a LockableComponent. Cannot process lock attempt.`);
            this.#dispatchUIMessage("You can't lock that.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found LockableComponent on ${targetEntityId}.`); // Note: Removed internal state logging here

        // Call the component's lock method
        const currentKeyItemId = keyItemId || null; // Ensure null is passed if keyItemId is undefined/falsy
        console.debug(`LockSystem: Calling lockableComponent.lock(${currentKeyItemId})`);
        /** @type {LockAttemptResult} */
        const lockResult = lockableComponent.lock(currentKeyItemId); // Capture result
        console.debug(`LockSystem: lockableComponent.lock result:`, lockResult);

        // Retrieve display name using the helper
        const entityName = getDisplayName(targetEntity);

        // Based on the return value, dispatch events/messages
        if (lockResult.success) {
            // Dispatch core game event ONLY if successful
            /** @type {EntityLockedEventPayload} */
            const entityLockedPayload = {
                userId: userId,
                targetEntityId: targetEntityId,
                keyItemId: currentKeyItemId // Pass the key used in the attempt, which might be null
            };
            console.debug(`LockSystem: Dispatching event:entity_locked`, entityLockedPayload);
            this.#eventBus.dispatch('event:entity_locked', entityLockedPayload);

            // Dispatch success UI message ONLY if successful
            this.#dispatchUIMessage(`You lock the ${entityName}.`, 'success');

        } else {
            // Dispatch failure UI message based on the reason code
            this.#handleLockFailure(lockResult.reasonCode, entityName);
        }
    }

    /**
     * Dispatches a UI message based on the unlock failure reason.
     * @private
     * @param {LockResultReasonCode | undefined} reasonCode - The reason code from the failed unlock attempt.
     * @param {string} entityName - The display name of the target entity.
     */
    #handleUnlockFailure(reasonCode, entityName) {
        let message = `You cannot unlock the ${entityName}.`; // Default fallback
        let type = 'warning';

        switch (reasonCode) {
            case 'ALREADY_UNLOCKED':
                message = `The ${entityName} is already unlocked.`;
                type = 'info';
                break;
            case 'KEY_REQUIRED':
                message = `You need a key to unlock the ${entityName}.`;
                type = 'warning';
                break;
            case 'WRONG_KEY':
                message = "The key doesn't seem to fit the lock."; // Consistent with ticket example
                type = 'warning';
                break;
            // case 'NO_KEY_NEEDED': // Should not happen for a failure, handled by success path
            // case 'KEY_MATCH': // Should not happen for a failure, handled by success path
            default:
                console.warn(`LockSystem: Unhandled unlock failure reasonCode: ${reasonCode}`);
                // Keep default message & type
                break;
        }
        this.#dispatchUIMessage(message, type);
    }

    /**
     * Dispatches a UI message based on the lock failure reason.
     * @private
     * @param {LockResultReasonCode | undefined} reasonCode - The reason code from the failed lock attempt.
     * @param {string} entityName - The display name of the target entity.
     */
    #handleLockFailure(reasonCode, entityName) {
        let message = `You cannot lock the ${entityName}.`; // Default fallback
        let type = 'warning';

        switch (reasonCode) {
            case 'ALREADY_LOCKED':
                message = `The ${entityName} is already locked.`;
                type = 'info';
                break;
            case 'KEY_REQUIRED':
                // This implies the lock mechanism *itself* needs a key to operate (to lock)
                message = `You need the right key to lock the ${entityName}.`; // Consistent with ticket example
                type = 'warning';
                break;
            case 'WRONG_KEY':
                // This implies the lock mechanism *itself* needs a key to operate, and the wrong one was used
                message = `That key doesn't seem to work for locking the ${entityName}.`; // Or reuse "doesn't seem to fit" as per unlock
                // Let's use the ticket example for locking failure:
                // message = "You need the right key..."; // Ambiguous, let's refine based on context
                // Using the WRONG_KEY message seems more specific if a key was provided but didn't match
                // Using KEY_REQUIRED if no key was provided but one was needed seems better handled by that case.
                // Let's stick to a specific message for WRONG_KEY when locking:
                message = `That key doesn't seem to work for locking the ${entityName}.`;
                type = 'warning';
                break;
            // case 'NO_KEY_NEEDED': // Should not happen for a failure, handled by success path
            // case 'KEY_MATCH': // Should not happen for a failure, handled by success path
            default:
                console.warn(`LockSystem: Unhandled lock failure reasonCode: ${reasonCode}`);
                // Keep default message & type
                break;
        }
        this.#dispatchUIMessage(message, type);
    }

    /**
     * Helper method to dispatch UI messages.
     * @private
     * @param {string} text - The message text.
     * @param {'info' | 'success' | 'warning' | 'error'} type - The message type.
     */
    #dispatchUIMessage(text, type) {
        /** @type {UIMessageDisplayPayload} */
        const uiMessagePayload = { text, type };
        console.debug(`LockSystem: Dispatching UI message: "${text}" (Type: ${type})`);
        this.#eventBus.dispatch('ui:message_display', uiMessagePayload);
    }

    /**
     * Unsubscribes the system from events during shutdown.
     */
    shutdown() {
        // Use the stored bound handlers for correct unsubscription
        this.#eventBus.unsubscribe('event:unlock_entity_attempt', this._boundHandleUnlockAttempt);
        this.#eventBus.unsubscribe('event:lock_entity_attempt', this._boundHandleLockAttempt);
        console.log("LockSystem: Shutdown complete, unsubscribed from events.");
    }
}

export default LockSystem;