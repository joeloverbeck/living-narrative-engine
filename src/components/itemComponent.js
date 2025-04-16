// src/components/itemComponent.js

import Component from "./component.js";

export class ItemComponent extends Component {
    /** @param {{description?: string, weight?: number, stackable?: boolean, use_effect?: object}} data */
    constructor(data) {
        super();
        // Initialize with defaults or provided data
        this.description = (data && typeof data.description === 'string') ? data.description : "An item.";
        this.weight = (data && typeof data.weight === 'number' && data.weight >= 0) ? data.weight : 0;
        this.stackable = (data && typeof data.stackable === 'boolean') ? data.stackable : false;
        this.useEffect = (data && typeof data.use_effect === 'object') ? { ...data.use_effect } : null; // Store potential use effect data
        // Add more item-specific properties as needed from schema (value, equip_slot, etc.)
    }
}