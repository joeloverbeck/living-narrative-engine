// src/components/inventoryComponent.js

import Component from "./component.js";

export class InventoryComponent extends Component {
    /** @param {{items: string[]}} data */
    constructor(data) {
        super();
        // Default to empty array if items property is missing or not an array
        this.items = (data && Array.isArray(data.items)) ? [...data.items] : [];
    }
    // TODO: Add methods like addItem(itemId), removeItem(itemId), hasItem(itemId)
}