// src/components/lockableComponent.js

import Component from './component.js';

/**
 * @typedef {import('../schemas/lockable.schema.json')} LockableSchema
 */

/**
 * Represents the possible reasons for a lock/unlock attempt failure.
 * @typedef {'ALREADY_LOCKED' | 'ALREADY_UNLOCKED' | 'WRONG_KEY' | 'KEY_REQUIRED' | 'NO_KEY_NEEDED' | 'KEY_MATCH'} LockResultReasonCode
 */

/**
 * Represents the result of a lock or unlock attempt.
 * @typedef {object} LockAttemptResult
 * @property {boolean} success - Indicates whether the operation was successful.
 * @property {LockResultReasonCode} [reasonCode] - A code indicating the reason for success or failure (optional).
 */

/**
 * Component indicating an entity can be locked or unlocked, potentially with a key.
 * Manages 'isLocked' state and associated 'keyId'.
 */
class LockableComponent extends Component {
    #isLocked;
    #keyId; // The ID of the key required to unlock (and potentially lock) this component. Null if no key needed.

    /**
     * Creates an instance of LockableComponent.
     * @param {LockableSchema} data - Component data matching the schema.
     * Expected format: { isLocked: boolean, keyId?: string | null }
     */
    constructor(data) {
        super();

        // Basic validation: Check if data is an object
        if (typeof data !== 'object' || data === null) {
            console.warn('LockableComponent: Invalid data provided to constructor. Expected an object.', data);
            // Apply default state from schema
            this.#isLocked = true;
            this.#keyId = null;
            return;
        }

        // Default value from schema: true
        this.#isLocked = typeof data.isLocked === 'boolean' ? data.isLocked : true;

        // Default value from schema: null
        // Also explicitly check for string type if provided.
        if (data.hasOwnProperty('keyId')) {
            if (typeof data.keyId === 'string' || data.keyId === null) {
                this.#keyId = data.keyId;
            } else {
                console.warn(`LockableComponent: Invalid type for keyId. Expected string or null, received ${typeof data.keyId}. Defaulting to null.`);
                this.#keyId = null;
            }
        } else {
            this.#keyId = null; // Default if not present
        }

        // Additional validation (optional): ensure isLocked is boolean if provided
        if (data.hasOwnProperty('isLocked') && typeof data.isLocked !== 'boolean') {
            console.warn(`LockableComponent: Invalid type for isLocked. Expected boolean, received ${typeof data.isLocked}. Defaulting to true.`);
            this.#isLocked = true;
        }
    }

    /**
     * Gets the current locked state.
     * @returns {boolean} True if locked, false otherwise.
     */
    get isLocked() {
        return this.#isLocked;
    }

    /**
     * Gets the key ID required by this lock (if any).
     * @returns {string | null} The required key ID, or null if no key is needed.
     */
    get keyId() {
        return this.#keyId;
    }

    /**
     * Attempts to unlock the entity using an optional key.
     * Encapsulates the logic for checking the lock state and key requirements.
     *
     * @param {string | null} [providedKeyId=null] - The ID of the key item being used in the unlock attempt.
     * @returns {LockAttemptResult} An object indicating success or failure, with an optional reason code.
     */
    unlock(providedKeyId = null) {
        // 1. Check if already unlocked
        if (!this.#isLocked) {
            return { success: false, reasonCode: 'ALREADY_UNLOCKED' };
        }

        // 2. Check if a key is required by the lock mechanism
        const requiredKeyId = this.#keyId;

        if (requiredKeyId === null) {
            // No key is required by this lock mechanism. Unlock succeeds.
            this.#isLocked = false;
            console.debug(`LockableComponent: Unlocked (no key needed). State is now ${this.#isLocked}`);
            return { success: true, reasonCode: 'NO_KEY_NEEDED' };
        } else {
            // A specific key is required by this lock mechanism.
            if (providedKeyId === null) {
                // Key required, but none was provided in the attempt.
                console.debug(`LockableComponent: Unlock failed. Key required (${requiredKeyId}), none provided.`);
                return { success: false, reasonCode: 'KEY_REQUIRED' };
            } else if (requiredKeyId === providedKeyId) {
                // Correct key provided. Unlock succeeds.
                this.#isLocked = false;
                console.debug(`LockableComponent: Unlocked (key match: ${providedKeyId}). State is now ${this.#isLocked}`);
                return { success: true, reasonCode: 'KEY_MATCH' };
            } else {
                // Incorrect key provided.
                console.debug(`LockableComponent: Unlock failed. Key mismatch. Required: ${requiredKeyId}, Provided: ${providedKeyId}.`);
                return { success: false, reasonCode: 'WRONG_KEY' };
            }
        }
    }

    /**
     * Attempts to lock the entity using an optional key.
     * Encapsulates the logic for checking the lock state and key requirements
     * for the *locking action itself* (if the lock mechanism requires a key to operate).
     *
     * Note: The `keyId` property primarily defines the key needed for UNLOCKING.
     * However, some complex locks might require the same key to also LOCK them.
     * This implementation mirrors the logic moved from LockSystem.
     *
     * @param {string | null} [providedKeyId=null] - The ID of the key item being used in the lock attempt.
     * @returns {LockAttemptResult} An object indicating success or failure, with an optional reason code.
     */
    lock(providedKeyId = null) {
        // 1. Check if already locked
        if (this.#isLocked) {
            return { success: false, reasonCode: 'ALREADY_LOCKED' };
        }

        // 2. Check if the lock mechanism requires a specific key *to be operated* (i.e., to lock it).
        // This mirrors the logic previously in LockSystem._handleLockAttempt
        const requiredKeyId = this.#keyId;

        if (requiredKeyId === null) {
            // No specific key required by the mechanism to lock it. Lock succeeds.
            this.#isLocked = true;
            console.debug(`LockableComponent: Locked (no key needed to operate lock). State is now ${this.#isLocked}`);
            return { success: true, reasonCode: 'NO_KEY_NEEDED' }; // Success, no specific key needed *to lock*
        } else {
            // A specific key is associated with this lock mechanism. Assume it's needed to lock *as well*.
            if (providedKeyId === null) {
                // Key required to operate lock, but none was provided in the attempt.
                console.debug(`LockableComponent: Lock failed. Key required (${requiredKeyId}) to operate lock, none provided.`);
                return { success: false, reasonCode: 'KEY_REQUIRED' };
            } else if (requiredKeyId === providedKeyId) {
                // Correct key provided for locking. Lock succeeds.
                this.#isLocked = true;
                console.debug(`LockableComponent: Locked (key match: ${providedKeyId}). State is now ${this.#isLocked}`);
                return { success: true, reasonCode: 'KEY_MATCH' };
            } else {
                // Incorrect key provided for locking.
                console.debug(`LockableComponent: Lock failed. Key mismatch for operating lock. Required: ${requiredKeyId}, Provided: ${providedKeyId}.`);
                return { success: false, reasonCode: 'WRONG_KEY' };
            }
        }
    }
}

export default LockableComponent;