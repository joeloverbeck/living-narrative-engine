// src/systems/lockSystem.js

import LockableComponent from '../components/lockableComponent.js';

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../types/eventTypes.js').UnlockEntityAttemptEventPayload} UnlockEntityAttemptEventPayload */
/** @typedef {import('../types/eventTypes.js').LockEntityAttemptEventPayload} LockEntityAttemptEventPayload */ // <<< Relevant Type
/** @typedef {import('../types/eventTypes.js').EntityUnlockedEventPayload} EntityUnlockedEventPayload */
/** @typedef {import('../types/eventTypes.js').EntityLockedEventPayload} EntityLockedEventPayload */     // <<< Relevant Type
/** @typedef {import('../types/eventTypes.js').UIMessageDisplayPayload} UIMessageDisplayPayload */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/lockableComponent.js').default} LockableComponent */
// Import helper for display name
import {getDisplayName} from '../utils/messages.js'; // Assuming getDisplayName is exported from messages.js or similar

/**
 * ECS System responsible for handling the logic of locking and unlocking entities
 * (e.g., chests, doors represented as entities).
 * Listens for 'event:unlock_entity_attempt' and 'event:lock_entity_attempt'.
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
    constructor({eventBus, entityManager}) {
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
        this._boundHandleLockAttempt = this._handleLockAttempt.bind(this); // <<< Bind the new handler

        console.log("LockSystem: Instance created.");
    }

    /**
     * Subscribes the system to relevant lock/unlock events.
     */
    initialize() {
        this.#eventBus.subscribe('event:unlock_entity_attempt', this._boundHandleUnlockAttempt);
        this.#eventBus.subscribe('event:lock_entity_attempt', this._boundHandleLockAttempt); // <<< Subscribe to the new event
        console.log("LockSystem: Initialized and subscribed to event:unlock_entity_attempt and event:lock_entity_attempt.");
    }

    /**
     * Handles entity unlock attempts.
     * Extracts identifiers, retrieves the target entity, and performs initial validation.
     * Validates the presence of a LockableComponent on the target.
     * Checks if the target is already unlocked.
     * Checks if the correct key (if required) is provided.
     * If all checks pass, updates the LockableComponent state.
     * Dispatches the event:entity_unlocked event and a success UI message.
     *
     * @private
     * @param {UnlockEntityAttemptEventPayload} payload - The event data associated with the unlock attempt.
     */
    _handleUnlockAttempt(payload) {
        console.debug("LockSystem: _handleUnlockAttempt received:", payload);

        const {userId, targetEntityId, keyItemId} = payload;
        console.debug(`LockSystem: Extracted - userId: ${userId}, targetId: ${targetEntityId}, keyId: ${keyItemId}`);

        /** @type {Entity | undefined} */
        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);

        if (!targetEntity) {
            console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process unlock attempt.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: "You can't find anything like that to unlock.",
                type: 'warning'
            });
            return;
        }
        console.debug(`LockSystem: Found target entity: ${targetEntity.id}`);

        /** @type {LockableComponent | undefined} */
        const lockableComponent = targetEntity.getComponent(LockableComponent);

        if (!lockableComponent) {
            console.error(`LockSystem: Entity ${targetEntityId} lacks a LockableComponent. Cannot process unlock attempt.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: "You can't unlock that.",
                type: 'warning'
            });
            return;
        }
        console.debug(`LockSystem: Found LockableComponent on ${targetEntityId}. State: isLocked=${lockableComponent.isLocked}, keyId=${lockableComponent.keyId}`);

        if (!lockableComponent.isLocked) {
            console.debug(`LockSystem: Entity ${targetEntityId} is already unlocked. Aborting unlock attempt.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: "It's already unlocked.",
                type: 'info'
            });
            return;
        }

        const requiredKeyId = lockableComponent.keyId;

        if (requiredKeyId !== null) {
            console.debug(`LockSystem: Key required. Required: ${requiredKeyId}, Provided: ${keyItemId}`);
            if (requiredKeyId !== keyItemId) {
                console.warn(`LockSystem: Key mismatch for entity ${targetEntityId}. Required: ${requiredKeyId}, Provided: ${keyItemId}`);
                this.#eventBus.dispatch('ui:message_display', {
                    text: "The key doesn't seem to fit.",
                    type: 'warning'
                });
                return;
            } else {
                console.debug(`LockSystem: Correct key provided (${keyItemId}). Proceeding with unlock...`);
            }
        } else {
            console.debug(`LockSystem: No key required for entity ${targetEntityId}. Proceeding with unlock...`);
        }

        console.debug(`LockSystem: All checks passed. Setting isLocked=false for ${targetEntityId}.`);

        lockableComponent.isLocked = false;

        /** @type {EntityUnlockedEventPayload} */
        const entityUnlockedPayload = {
            userId: userId,
            targetEntityId: targetEntityId,
            keyItemId: keyItemId // Pass the key used, which might be null
        };
        console.debug(`LockSystem: Dispatching event:entity_unlocked`, entityUnlockedPayload);
        this.#eventBus.dispatch('event:entity_unlocked', entityUnlockedPayload);

        // Retrieve display name using the helper
        const entityName = getDisplayName(targetEntity);

        /** @type {UIMessageDisplayPayload} */
        const uiMessagePayload = {
            text: `You unlock the ${entityName}.`,
            type: 'success'
        };
        console.debug(`LockSystem: Dispatching success UI message: "${uiMessagePayload.text}"`);
        this.#eventBus.dispatch('ui:message_display', uiMessagePayload);
    }

    /**
     * Handles entity lock attempts.
     * Extracts identifiers, retrieves the target entity, and performs initial validation.
     * Validates the presence of a LockableComponent on the target.
     * Checks if the target is already locked.
     * Checks if the correct key (if required by component) is provided in the attempt.
     * If all checks pass, updates the LockableComponent state to locked.
     * Dispatches the event:entity_locked event and a success UI message.
     *
     * @private
     * @param {LockEntityAttemptEventPayload} payload - The event data associated with the lock attempt.
     */
    _handleLockAttempt(payload) {
        // AC: Start with debug log
        console.debug("LockSystem: _handleLockAttempt received:", payload);

        // AC: Retrieve payload data
        const {userId, targetEntityId, keyItemId} = payload;
        console.debug(`LockSystem: Extracted - userId: ${userId}, targetId: ${targetEntityId}, keyId: ${keyItemId}`);

        // AC: Get target entity
        /** @type {Entity | undefined} */
        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);

        // AC: Handle entity not found
        if (!targetEntity) {
            console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process lock attempt.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: "You can't find anything like that to lock.", // Specific message for locking
                type: 'warning'
            });
            return; // Stop processing
        }
        console.debug(`LockSystem: Found target entity: ${targetEntity.id}`);

        // AC: Retrieve LockableComponent
        /** @type {LockableComponent | undefined} */
        const lockableComponent = targetEntity.getComponent(LockableComponent);

        // AC: Handle component missing
        if (!lockableComponent) {
            console.error(`LockSystem: Entity ${targetEntityId} lacks a LockableComponent. Cannot process lock attempt.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: "You can't lock that.", // Specific message for non-lockable
                type: 'warning'
            });
            return; // Stop processing
        }
        console.debug(`LockSystem: Found LockableComponent on ${targetEntityId}. State: isLocked=${lockableComponent.isLocked}, keyId=${lockableComponent.keyId}`);

        // AC: Check if already locked (inverse of unlock check)
        // We want to lock something that is currently UNLOCKED
        if (lockableComponent.isLocked) {
            console.debug(`LockSystem: Entity ${targetEntityId} is already locked. Aborting lock attempt.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: "It's already locked.",
                type: 'info'
            });
            return; // Stop processing
        }

        // AC: Check LockableComponent.keyId
        // If keyId is a string, it implies the lock *mechanism* requires a specific key.
        // The AC requires comparing this to the keyItemId from the *attempt*.
        const requiredKeyId = lockableComponent.keyId;

        if (requiredKeyId !== null) {
            // A specific key is associated with this lock mechanism.
            console.debug(`LockSystem: Lock mechanism requires a specific key. Required: ${requiredKeyId}, Provided in attempt: ${keyItemId}`);

            // Compare with the key used in the *attempt* (keyItemId from payload).
            if (requiredKeyId !== keyItemId) {
                // The key used in the attempt doesn't match the key required by the lock mechanism.
                console.warn(`LockSystem: Key mismatch for locking entity ${targetEntityId}. Lock requires: ${requiredKeyId}, Attempt used: ${keyItemId}`);
                this.#eventBus.dispatch('ui:message_display', {
                    text: "You need the right key to lock this.", // Specific message for locking failure due to key
                    type: 'warning'
                });
                return; // Stop processing
            } else {
                // The correct key was provided in the attempt.
                console.debug(`LockSystem: Correct key provided (${keyItemId}) for locking attempt. Proceeding...`);
            }
        } else {
            // keyId is null on the component. This means the lock mechanism itself doesn't require
            // a specific key to operate (even though it might be needed for UNLOCKING later).
            // The lock attempt can proceed regardless of whether a key was used in the attempt payload.
            console.debug(`LockSystem: No specific key required by the lock mechanism itself for entity ${targetEntityId}. Proceeding with lock...`);
        }

        // AC: If all checks pass:
        console.debug(`LockSystem: All checks passed. Setting isLocked=true for ${targetEntityId}.`);

        // Set lock state
        lockableComponent.isLocked = true; // Or lockableComponent.lock() if that method exists/is preferred

        // Dispatch core game event: entity_locked
        /** @type {EntityLockedEventPayload} */
        const entityLockedPayload = {
            userId: userId,
            targetEntityId: targetEntityId,
            keyItemId: keyItemId // Pass the key used in the attempt, which might be null
        };
        console.debug(`LockSystem: Dispatching event:entity_locked`, entityLockedPayload);
        this.#eventBus.dispatch('event:entity_locked', entityLockedPayload);

        // Dispatch success UI message
        // Retrieve display name using the helper
        const entityName = getDisplayName(targetEntity);

        /** @type {UIMessageDisplayPayload} */
        const uiMessagePayload = {
            text: `You lock the ${entityName}.`, // Success message for locking
            type: 'success'
        };
        console.debug(`LockSystem: Dispatching success UI message: "${uiMessagePayload.text}"`);
        this.#eventBus.dispatch('ui:message_display', uiMessagePayload);
    }


    /**
     * Unsubscribes the system from events during shutdown.
     */
    shutdown() {
        // Use the stored bound handlers for correct unsubscription
        this.#eventBus.unsubscribe('event:unlock_entity_attempt', this._boundHandleUnlockAttempt);
        this.#eventBus.unsubscribe('event:lock_entity_attempt', this._boundHandleLockAttempt); // <<< Unsubscribe from the new event
        console.log("LockSystem: Shutdown complete, unsubscribed from events.");
    }
}

export default LockSystem;