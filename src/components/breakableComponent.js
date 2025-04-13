import Component from './component.js';

/**
 * @typedef {import('../schemas/breakable.schema.json')} BreakableSchema
 */

/**
 * Component for entities that have health and can be broken or destroyed.
 * Manages current/max HP, broken status, and damage resistance.
 */
class BreakableComponent extends Component {
    /**
     * Creates an instance of BreakableComponent.
     * @param {BreakableSchema} data - Component data matching the schema.
     * Expected format: { currentHp: int, maxHp: int, isBroken: boolean, resistance?: string }
     */
    constructor(data) {
        super();

        // Basic validation: Check if data is an object
        if (typeof data !== 'object' || data === null) {
            console.error('BreakableComponent: Invalid or missing data provided to constructor. Cannot initialize.', data);
            // Throw or set invalid state? Depending on desired strictness.
            // Setting invalid state might mask errors. Throwing might be better.
            throw new Error('BreakableComponent requires valid data for initialization.');
        }

        // --- Validation and Initialization ---
        let isValid = true;
        let errorMessages = [];

        // maxHp: Required, must be integer >= 1
        if (typeof data.maxHp !== 'number' || !Number.isInteger(data.maxHp) || data.maxHp < 1) {
            errorMessages.push(`Invalid maxHp: must be an integer >= 1, received ${data.maxHp}.`);
            isValid = false;
            this.maxHp = 1; // Fallback/default if invalid
        } else {
            this.maxHp = data.maxHp;
        }

        // currentHp: Required, must be integer >= 0 and <= maxHp
        if (typeof data.currentHp !== 'number' || !Number.isInteger(data.currentHp) || data.currentHp < 0) {
            errorMessages.push(`Invalid currentHp: must be an integer >= 0, received ${data.currentHp}.`);
            isValid = false;
            this.currentHp = this.maxHp; // Fallback/default
        } else if (isValid && data.currentHp > this.maxHp) { // Check only if maxHp was valid
            errorMessages.push(`Invalid currentHp: ${data.currentHp} cannot exceed maxHp ${this.maxHp}.`);
            isValid = false;
            this.currentHp = this.maxHp; // Fallback/default
        } else {
            this.currentHp = data.currentHp;
        }


        // isBroken: Required, defaults to false
        this.isBroken = typeof data.isBroken === 'boolean' ? data.isBroken : false;
        if (data.hasOwnProperty('isBroken') && typeof data.isBroken !== 'boolean') {
            errorMessages.push(`Invalid type for isBroken. Expected boolean, received ${typeof data.isBroken}. Defaulting to false.`);
            // Default already set above, this is just for warning
        }

        // resistance: Optional, must be string if provided
        this.resistance = null; // Default to null if not provided or invalid
        if (data.hasOwnProperty('resistance')) {
            if (typeof data.resistance === 'string') {
                this.resistance = data.resistance;
            } else if (data.resistance !== undefined && data.resistance !== null) {
                // Only warn if it's defined but not a string
                errorMessages.push(`Invalid type for resistance. Expected string, received ${typeof data.resistance}. Ignoring resistance.`);
            }
        }

        // Log errors if any validation failed
        if (!isValid) {
            console.error('BreakableComponent constructor encountered validation errors:', errorMessages.join(' '));
            // Optionally, re-throw error if strict construction is needed
            // throw new Error('BreakableComponent validation failed: ' + errorMessages.join(' '));
        }

        // Post-validation check: Ensure isBroken state matches HP
        if (isValid && this.currentHp <= 0 && !this.isBroken) {
            console.warn(`BreakableComponent: Initial currentHp (${this.currentHp}) is <= 0, but isBroken is false. Setting isBroken to true.`);
            this.isBroken = true;
        }
        if (isValid && this.currentHp > 0 && this.isBroken) {
            console.warn(`BreakableComponent: Initial currentHp (${this.currentHp}) is > 0, but isBroken is true. Setting isBroken to false.`);
            this.isBroken = false;
        }


    }

    /**
     * Applies damage to the entity.
     * @param {number} amount - The amount of damage to apply (non-negative integer).
     * @param {string} [damageType] - Optional type of damage for resistance checks.
     * @returns {boolean} True if the entity broke as a result of this damage, false otherwise.
     */
    takeDamage(amount, damageType) {
        if (this.isBroken || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
            return this.isBroken; // Cannot damage a broken entity or invalid amount
        }

        // Basic resistance check (example - could be more complex)
        let actualDamage = amount;
        if (this.resistance && damageType === this.resistance) {
            // Example: Halve damage if resistance matches type. Implement specific logic as needed.
            actualDamage = Math.max(0, Math.floor(amount / 2));
            console.log(`BreakableComponent: Resistance '${this.resistance}' reduced damage from ${amount} to ${actualDamage}.`);
        } else if (this.resistance) {
            console.log(`BreakableComponent: Damage type '${damageType}' does not match resistance '${this.resistance}'. Applying full damage.`);
        }


        this.currentHp = Math.max(0, this.currentHp - actualDamage);

        if (this.currentHp <= 0) {
            this.isBroken = true;
            // Optional: Fire an event 'entity_broken'
            // this.eventBus?.dispatch('entity_broken', { entityId: this.parentEntityId }); // Assuming parentEntityId is available
            return true;
        }

        return false;
    }

    /**
     * Heals the entity.
     * @param {number} amount - The amount of health to restore (non-negative integer).
     * @returns {number} The actual amount healed.
     */
    heal(amount) {
        if (this.isBroken || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
            return 0; // Cannot heal broken entity or invalid amount
        }

        const hpBefore = this.currentHp;
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
        return this.currentHp - hpBefore;
    }

    /**
     * Repairs the entity, setting HP to max and isBroken to false.
     */
    repair() {
        this.currentHp = this.maxHp;
        this.isBroken = false;
    }

    /**
     * Sets the HP directly. Use with caution, prefer takeDamage/heal/repair.
     * Automatically updates isBroken status.
     * @param {number} newHp - The desired HP value.
     */
    setHp(newHp) {
        if (typeof newHp !== 'number' || !Number.isInteger(newHp)) {
            console.warn(`BreakableComponent: Invalid HP provided to setHp. Expected integer, received ${typeof newHp}.`);
            return;
        }

        this.currentHp = Math.max(0, Math.min(this.maxHp, newHp));

        if (this.currentHp <= 0 && !this.isBroken) {
            this.isBroken = true;
            // Optional: Fire event
        } else if (this.currentHp > 0 && this.isBroken) {
            this.isBroken = false;
            // Optional: Fire event if needed (e.g., entity_repaired)
        }
    }
}

export default BreakableComponent;