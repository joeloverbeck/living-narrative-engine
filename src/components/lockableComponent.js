import Component from './component.js';

/**
 * @typedef {import('../schemas/lockable.schema.json')} LockableSchema
 */

/**
 * Component indicating an entity can be locked or unlocked, potentially with a key.
 * Manages 'isLocked' state and associated 'keyId'.
 */
class LockableComponent extends Component {
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
            // Apply default state
            this.isLocked = true; // Default from schema
            this.keyId = null;    // Default from schema
            return;
        }

        // Default value from schema: true
        this.isLocked = typeof data.isLocked === 'boolean' ? data.isLocked : true;

        // Default value from schema: null
        // Also explicitly check for string type if provided.
        if (data.hasOwnProperty('keyId')) {
            if (typeof data.keyId === 'string' || data.keyId === null) {
                this.keyId = data.keyId;
            } else {
                console.warn(`LockableComponent: Invalid type for keyId. Expected string or null, received ${typeof data.keyId}. Defaulting to null.`);
                this.keyId = null;
            }
        } else {
            this.keyId = null;
        }

        // Additional validation (optional): ensure isLocked is boolean if provided
        if (data.hasOwnProperty('isLocked') && typeof data.isLocked !== 'boolean') {
            console.warn(`LockableComponent: Invalid type for isLocked. Expected boolean, received ${typeof data.isLocked}. Defaulting to true.`);
            this.isLocked = true;
        }
    }

    /**
     * Attempts to unlock the entity.
     * @param {string | null} [providedKeyId=null] - The ID of the key being used (if any).
     * @returns {boolean} True if successfully unlocked, false otherwise.
     */
    unlock(providedKeyId = null) {
        if (!this.isLocked) {
            return true; // Already unlocked
        }
        // Check if a specific key is required and if the provided key matches
        if (this.keyId === null || this.keyId === providedKeyId) {
            this.isLocked = false;
            return true;
        }
        return false; // Key required and not provided/matched, or no key needed but failed (e.g., needs lockpicking)
    }

    /**
     * Locks the entity.
     * @returns {boolean} True if successfully locked, false otherwise (e.g., already locked).
     */
    lock() {
        if (this.isLocked) {
            return false; // Already locked
        }
        this.isLocked = true;
        return true;
    }

    /**
     * Sets the locked state explicitly. Use with caution, prefer lock/unlock methods.
     * @param {boolean} state - The desired state (true for locked, false for unlocked).
     */
    setState(state) {
        if (typeof state !== 'boolean') {
            console.warn(`LockableComponent: Invalid state provided to setState. Expected boolean, received ${typeof state}.`);
            return;
        }
        this.isLocked = state;
    }
}

export default LockableComponent;