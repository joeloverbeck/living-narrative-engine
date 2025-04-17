// src/components/itemComponent.js
import Component from "./component.js";

/**
 * @typedef {object} ItemComponentData - Defines the data structure for ItemComponent initialization.
 * // REMOVED: definitionId property from typedef
 * @property {string} [description='An item.'] - Instance-specific description (can override definition).
 * @property {number} [weight=0] - Instance-specific weight.
 * @property {boolean} [stackable=false] - Whether this item type can stack.
 * @property {number} [quantity=1] - How many of this item are represented by this instance (for stackable items).
 * @property {object | null} [use_effect=null] - Instance-specific use effect data (less common, usually from definition).
 */

export class ItemComponent extends Component {
    // REMOVED: definitionId class property declaration
    // /** @type {string | null} - Link to the item definition ID. */
    // definitionId;

    /** @type {string} - Description of this specific item instance. */
    description;
    /** @type {number} - Weight of this item instance. */
    weight;
    /** @type {boolean} - Whether this item can stack. */
    stackable;
    /** @type {object | null} - Use effect data associated with this instance. */
    useEffect;
    /** @type {number} - The quantity of this item instance. */
    quantity;

    /**
     * Creates an instance of ItemComponent.
     * @param {ItemComponentData} [data={}] - Component data matching the schema or expectations.
     */
    constructor(data = {}) { // Default to empty object
        super();

        // ADDED: Check for legacy 'definitionId' in input data and issue warning
        if ('definitionId' in data) {
            console.warn("[DEPRECATION] ItemComponent.definitionId is obsolete – use DefinitionRefComponent.");
        }
        // Also check for the potential typo 'adefinitionId' found in the original typedef
        if ('adefinitionId' in data) {
            console.warn("[DEPRECATION] ItemComponent received 'adefinitionId', which is obsolete (and likely a typo for 'definitionId') – use DefinitionRefComponent.");
        }

        // --- Assign properties from data, falling back to defaults ---
        // REMOVED: Assignment of this.definitionId
        // this.definitionId = (data && typeof data.definitionId === 'string') ? data.definitionId : null;

        this.description = (data && typeof data.description === 'string') ? data.description : "An item.";
        this.weight = (data && typeof data.weight === 'number' && data.weight >= 0) ? data.weight : 0;
        this.stackable = (data && typeof data.stackable === 'boolean') ? data.stackable : false;
        // Match the property name used in the original code if necessary ('use_effect')
        this.useEffect = (data && typeof data.use_effect === 'object') ? {...data.use_effect} : null;
        // Add quantity, as it's very common for item instances
        this.quantity = (data && typeof data.quantity === 'number' && data.quantity > 0) ? data.quantity : 1;

        // Validate quantity to ensure it's at least 1
        if (this.quantity < 1) {
            console.warn(`ItemComponent: Invalid quantity (${this.quantity}) provided. Setting to 1.`);
            this.quantity = 1;
        }
        // Add more item-specific properties as needed
    }
}