// src/components/usableComponent.js

import Component from "./component.js";

/**
 * Component defining how an item can be used, including conditions,
 * targeting, effects, and feedback. Updated to match the new schema.
 */
export class UsableComponent extends Component {
    /**
     * @param {object} data - The component data from JSON, conforming to the new schema.
     * @param {object[]} [data.usability_conditions=[]] - Conditions related to the user/state required for use.
     * @param {boolean} [data.target_required=false] - Does the item require a target other than the user?
     * @param {object[]} [data.target_conditions=[]] - Conditions the target entity must meet.
     * @param {object[]} data.effects - Sequence of effects that occur upon successful use. Each object has effect_type and effect_params.
     * @param {boolean} [data.consume_on_use=true] - Is the item consumed after successful use?
     * @param {string} [data.success_message] - Optional message displayed on successful use.
     * @param {string} [data.failure_message_default] - Optional default message displayed on failure.
     */
    constructor(data) {
        super();

        // Validate required fields based on the new schema [cite: 500]
        if (!data ||
            !Array.isArray(data.effects) || data.effects.length === 0 || // 'effects' is required and must be a non-empty array
            (data.consume_on_use !== undefined && typeof data.consume_on_use !== 'boolean') // 'consume_on_use' is technically required but check type if provided
        ) {
            console.error("UsableComponent: Invalid or incomplete required data provided (needs 'effects' array).", data);
            // Throw an error during instantiation if core data is missing/invalid according to the new schema.
            throw new Error("UsableComponent requires a valid 'effects' array. 'consume_on_use' is also required (defaults to true if omitted).");
        }

        // Assign properties based on the new schema, providing defaults where applicable [cite: 500]
        this.usability_conditions = Array.isArray(data.usability_conditions) ? [...data.usability_conditions] : []; // Default to empty array
        this.target_required = typeof data.target_required === 'boolean' ? data.target_required : false; // Default to false
        this.target_conditions = Array.isArray(data.target_conditions) ? [...data.target_conditions] : []; // Default to empty array
        this.effects = data.effects.map(effect => ({...effect, effect_params: {...effect.effect_params}})); // Deep copy effects array
        this.consume_on_use = typeof data.consume_on_use === 'boolean' ? data.consume_on_use : true; // Default to true (schema default)
        this.success_message = typeof data.success_message === 'string' ? data.success_message : null; // Optional
        this.failure_message_default = typeof data.failure_message_default === 'string' ? data.failure_message_default : null; // Optional

        // console.log("UsableComponent created (new schema):", this); // Optional debug
    }

    // Add methods here later to handle checking conditions, applying effects, etc.
    // For example:
    // canUse(userEntity, targetEntity) { ... check usability_conditions and target_conditions ... }
    // applyEffects(userEntity, targetEntity) { ... iterate through this.effects and apply them ... }
}