// src/systems/lockSystem.js

import LockableComponent from '../components/lockableComponent.js';
// import {ItemComponent} from '../components/itemComponent.js'; // <<< Removed ItemComponent import
import DefinitionRefComponent from '../components/definitionRefComponent.js'; // <<< Added DefinitionRefComponent import
// Import helper for display name
import {getDisplayName} from '../utils/messages.js';

// Type Imports for JSDoc
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
// Define a type for the incoming payload, allowing flexibility but noting expected properties
/** @typedef {{ userId: string, itemInstanceId?: string | null, targetEntityId?: string | null, validatedTargetId?: string | null, [key: string]: any }} ReceivedLockUnlockPayload */
/** @typedef {import('../components/lockableComponent.js').LockAttemptResult} LockAttemptResult */

/** @typedef {import('../components/lockableComponent.js').LockResultReasonCode} LockResultReasonCode */


/**
 * ECS System responsible for handling the logic of locking and unlocking entities
 * (e.g., chests, doors represented as entities).
 * Listens for "event:unlock_entity_attempt" and "event:lock_entity_attempt".
 * Resolves the definition ID of the key used (if any) via DefinitionRefComponent
 * before delegating the core state change and validation logic to LockableComponent.
 */
class LockSystem {
    #eventBus;
    #entityManager;

    // Store bound handlers to ensure correct removal during shutdown
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
            throw new Error("LockSystem requires options.eventBus.");
        }
        if (!entityManager) {
            throw new Error("LockSystem requires options.entityManager.");
        }

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;

        // Bind event handlers to this instance for correct context and removal
        this._boundHandleUnlockAttempt = this._handleUnlockAttempt.bind(this);
        this._boundHandleForceUnlock = this._handleForceUnlock.bind(this);
        this._boundHandleLockAttempt = this._handleLockAttempt.bind(this);

        console.log("LockSystem: Instance created.");
    }

    /**
     * Subscribes the system to relevant lock/unlock events.
     */
    initialize() {
        this.#eventBus.subscribe("event:unlock_entity_attempt", this._boundHandleUnlockAttempt);
        this.#eventBus.subscribe("event:lock_entity_attempt", this._boundHandleLockAttempt);
        this.#eventBus.subscribe("event:unlock_entity_force", this._boundHandleForceUnlock);
        console.log("LockSystem: Initialized and subscribed to \"event:unlock_entity_attempt\" and \"event:lock_entity_attempt\".");
    }

    /**
     * Handles entity unlock attempts. Resolves key definition ID using DefinitionRefComponent
     * before delegating to LockableComponent.unlock(). Dispatches events and UI messages
     * based on the component's result.
     *
     * @private
     * @param {ReceivedLockUnlockPayload} payload - The event data associated with the unlock attempt.
     */
    _handleUnlockAttempt(payload) {
        console.debug("LockSystem: _handleUnlockAttempt received:", payload);

        const {userId, itemInstanceId} = payload;
        // Prioritize validatedTargetId (likely from ItemUsageSystem), fallback to targetEntityId
        const targetEntityId = payload.validatedTargetId ?? payload.targetEntityId ?? null;
        const keyInstanceIdUsed = itemInstanceId || null; // The specific instance ID used in the attempt

        console.debug(`LockSystem: Extracted - userId: ${userId}, targetEntityId: ${targetEntityId}, keyInstanceIdUsed: ${keyInstanceIdUsed}`);

        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);

        if (!targetEntity) {
            console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process unlock attempt.`);
            this.#dispatchUIMessage("You can't find anything like that to unlock.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found target entity: ${targetEntity.id}`);

        const lockableComponent = targetEntity.getComponent(LockableComponent);
        if (!lockableComponent) {
            console.error(`LockSystem: Entity ${targetEntityId} lacks a LockableComponent. Cannot process unlock attempt.`);
            this.#dispatchUIMessage("You can't unlock that.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found LockableComponent on ${targetEntityId}. Required Key Def ID: ${lockableComponent.keyId}`);

        // --- Resolve Key Definition ID from Instance ID using DefinitionRefComponent ---
        let keyDefinitionIdToCompare = null;
        if (keyInstanceIdUsed) {
            const keyEntity = this.#entityManager.getEntityInstance(keyInstanceIdUsed);
            if (keyEntity) {
                // <<< Start Change T-4
                const defRef = keyEntity.getComponent(DefinitionRefComponent);
                keyDefinitionIdToCompare = defRef?.id ?? null; // Use the ID from DefinitionRefComponent

                if (keyDefinitionIdToCompare) {
                    console.debug(`LockSystem: Resolved Key Instance ${keyInstanceIdUsed} to Definition ID: ${keyDefinitionIdToCompare} (via DefinitionRefComponent)`);
                } else { // Key entity exists but lacks component/id
                    console.warn(`LockSystem: Key instance ${keyInstanceIdUsed} found but lacks DefinitionRefComponent or valid id property.`);
                }
                // <<< End Change T-4
            } else {
                console.warn(`LockSystem: Key instance ${keyInstanceIdUsed} not found in EntityManager.`);
            }
        }
        // --- End Key Definition Resolution ---

        // Call the component's unlock method with the RESOLVED DEFINITION ID (or null)
        console.debug(`LockSystem: Calling lockableComponent.unlock(${keyDefinitionIdToCompare})`);
        const unlockResult = lockableComponent.unlock(keyDefinitionIdToCompare);
        console.debug(`LockSystem: lockableComponent.unlock result:`, unlockResult);

        const entityName = getDisplayName(targetEntity);

        if (unlockResult.success) {
            /** @type {EntityUnlockedEventPayload} */
            const entityUnlockedPayload = {
                userId: userId,
                targetEntityId: targetEntityId,
                keyItemId: keyInstanceIdUsed // Report the INSTANCE ID used in the success event
            };
            console.debug(`LockSystem: Dispatching ${"event:entity_unlocked"}`, entityUnlockedPayload);
            // Use await if dispatch is async and subsequent actions depend on it finishing
            this.#eventBus.dispatch("event:entity_unlocked", entityUnlockedPayload);
            this.#dispatchUIMessage(`You unlock the ${entityName}.`, 'success');
        } else {
            this.#handleUnlockFailure(unlockResult.reasonCode, entityName);
        }
    }

    /**
     * Handles entity lock attempts. Resolves key definition ID using DefinitionRefComponent
     * before delegating to LockableComponent.lock(). Dispatches events and UI messages
     * based on the component's result.
     *
     * @private
     * @param {ReceivedLockUnlockPayload} payload - The event data associated with the lock attempt.
     */
    _handleLockAttempt(payload) {
        console.debug("LockSystem: _handleLockAttempt received:", payload);

        const {userId, itemInstanceId} = payload;
        const targetEntityId = payload.validatedTargetId ?? payload.targetEntityId ?? null;
        const keyInstanceIdUsed = itemInstanceId || null;

        console.debug(`LockSystem: Extracted - userId: ${userId}, targetEntityId: ${targetEntityId}, keyInstanceIdUsed: ${keyInstanceIdUsed}`);

        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);
        if (!targetEntity) {
            console.error(`LockSystem: Target entity not found for ID: ${targetEntityId}. Cannot process lock attempt.`);
            this.#dispatchUIMessage("You can't find anything like that to lock.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found target entity: ${targetEntity.id}`);

        const lockableComponent = targetEntity.getComponent(LockableComponent);
        if (!lockableComponent) {
            console.error(`LockSystem: Entity ${targetEntityId} lacks a LockableComponent. Cannot process lock attempt.`);
            this.#dispatchUIMessage("You can't lock that.", 'warning');
            return;
        }
        console.debug(`LockSystem: Found LockableComponent on ${targetEntityId}.`);

        // --- Resolve Key Definition ID from Instance ID using DefinitionRefComponent ---
        let keyDefinitionIdToCompare = null;
        if (keyInstanceIdUsed) {
            const keyEntity = this.#entityManager.getEntityInstance(keyInstanceIdUsed);
            if (keyEntity) {
                // <<< Start Change T-4
                const defRef = keyEntity.getComponent(DefinitionRefComponent);
                keyDefinitionIdToCompare = defRef?.id ?? null; // Use the ID from DefinitionRefComponent

                if (keyDefinitionIdToCompare) {
                    console.debug(`LockSystem (Lock Attempt): Resolved Key Instance ${keyInstanceIdUsed} to Definition ID: ${keyDefinitionIdToCompare} (via DefinitionRefComponent)`);
                } else { // Key entity exists but lacks component/id
                    console.warn(`LockSystem (Lock Attempt): Key instance ${keyInstanceIdUsed} found but lacks DefinitionRefComponent or valid id property.`);
                }
                // <<< End Change T-4
            } else {
                console.warn(`LockSystem (Lock Attempt): Key instance ${keyInstanceIdUsed} not found in EntityManager.`);
            }
        }
        // --- End Key Definition Resolution ---

        // Call lock with the resolved definition ID
        console.debug(`LockSystem: Calling lockableComponent.lock(${keyDefinitionIdToCompare})`);
        const lockResult = lockableComponent.lock(keyDefinitionIdToCompare);
        console.debug(`LockSystem: lockableComponent.lock result:`, lockResult);

        const entityName = getDisplayName(targetEntity);

        if (lockResult.success) {
            /** @type {EntityLockedEventPayload} */
            const entityLockedPayload = {
                userId: userId,
                targetEntityId: targetEntityId,
                keyItemId: keyInstanceIdUsed // Report instance ID used
            };
            console.debug(`LockSystem: Dispatching ${"event:entity_locked"}`, entityLockedPayload);
            // Use await if dispatch is async and subsequent actions depend on it finishing
            this.#eventBus.dispatch("event:entity_locked", entityLockedPayload);
            this.#dispatchUIMessage(`You lock the ${entityName}.`, 'success');
        } else {
            this.#handleLockFailure(lockResult.reasonCode, entityName);
        }
    }

    /**
     * Handles "event:unlock_entity_force".  Ignores key checks and never fails.
     * @private
     * @param {{targetEntityId:string, userId?:string|null, [key:string]:any}} payload
     */
    _handleForceUnlock(payload) {
        const {targetEntityId, userId = null} = payload;
        const targetEntity = this.#entityManager.getEntityInstance(targetEntityId);
        if (!targetEntity) {
            console.warn(`LockSystem: FORCE unlock – target ${targetEntityId} not found.`);
            return;
        }

        const lockableComponent = targetEntity.getComponent(LockableComponent);
        if (!lockableComponent || !lockableComponent.isLocked) {
            // Already unlocked or not lockable – silently succeed
        } else {
            lockableComponent.forceSetLockedState(false);
        }

        // Fire the normal “entity_unlocked” event so every other system stays in sync
        this.#eventBus.dispatch("event:entity_unlocked", {
            userId,                     // null means “environment/script”
            targetEntityId,
            keyItemId: null,
            force: true
        });

        // Optional UI message if *some* user triggered it
        if (userId) {
            const entityName = getDisplayName(targetEntity);
            this.#dispatchUIMessage(`The ${entityName} unlocks with a loud *click*.`, 'info');
        }

        console.debug(`LockSystem: FORCE unlocked ${targetEntityId}`);
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
                message = "The key doesn't seem to fit the lock.";
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
                // Changed message slightly for clarity based on using DefinitionRef
                message = `You need the specific key associated with the ${entityName} to lock it.`;
                type = 'warning';
                break;
            case 'WRONG_KEY':
                // Changed message slightly for clarity based on using DefinitionRef
                message = `That key doesn't seem to be the correct one for locking the ${entityName}.`;
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
        // Use await if dispatch is async and subsequent actions depend on it finishing
        this.#eventBus.dispatch("event:display_message", uiMessagePayload);
    }

    /**
     * Unsubscribes the system from events during shutdown.
     */
    shutdown() {
        // Use the stored bound handlers for correct unsubscription
        this.#eventBus.unsubscribe("event:unlock_entity_attempt", this._boundHandleUnlockAttempt);
        this.#eventBus.unsubscribe("event:lock_entity_attempt", this._boundHandleLockAttempt);
        this.#eventBus.unsubscribe("event:unlock_entity_force", this._boundHandleForceUnlock);
        console.log("LockSystem: Shutdown complete, unsubscribed from events.");
    }
}

export default LockSystem;