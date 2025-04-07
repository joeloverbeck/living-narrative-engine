// src/components/usableComponent.js

import Component from "./component.js";

/**
 * Component indicating an entity can be 'used' via an action,
 * detailing the effect and conditions.
 */
export class UsableComponent extends Component {
    /**
     * @param {object} data - The component data from JSON.
     * @param {string} data.effect_type - The primary type of effect (e.g., 'heal', 'unlock', 'light').
     * @param {object} data.effect_details - Specific details for the effect (e.g., { amount: 5 } for heal).
     * @param {boolean} data.consumable - Whether the item is consumed upon successful use.
     * @param {string} data.use_message - The message displayed to the player on successful use.
     * @param {string[]} [data.required_tags] - Optional list of tags the target needs (e.g., ['locked'] for a key). Not used in MVP 'use' directly.
     * @param {string} [data.required_state] - Optional state the target needs (e.g., 'closed' for a door). Not used in MVP 'use' directly.
     */
    constructor(data) {
        super();

        // Validate required fields more strictly
        if (!data ||
            typeof data.effect_type !== 'string' || !data.effect_type ||
            typeof data.effect_details !== 'object' || data.effect_details === null ||
            typeof data.consumable !== 'boolean' ||
            typeof data.use_message !== 'string' || !data.use_message
        ) {
            console.error("UsableComponent: Invalid or incomplete required data provided.", data);
            // Throw an error during instantiation if core data is missing,
            // preventing invalid items from being created.
            throw new Error("UsableComponent requires valid 'effect_type', 'effect_details', 'consumable', and 'use_message'.");
        }

        this.effect_type = data.effect_type;
        this.effect_details = {...data.effect_details}; // Copy details
        this.consumable = data.consumable;
        this.use_message = data.use_message;

        // Optional fields
        this.required_tags = (Array.isArray(data.required_tags)) ? [...data.required_tags] : [];
        this.required_state = (typeof data.required_state === 'string') ? data.required_state : null;

        // console.log("UsableComponent created:", this); // Optional debug
    }
}