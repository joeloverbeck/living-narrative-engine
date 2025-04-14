// src/config/actionHandlerRegistry.config.js

/**
 * Defines the mapping between Action Definition IDs and their corresponding
 * handler functions. This externalizes the registration logic from main.js.
 */

// Import all necessary action handler functions
import { executeMove } from '../actions/handlers/moveActionHandler.js';
import { executeLook } from '../actions/handlers/lookActionHandler.js';
import { executeTake } from '../actions/handlers/takeActionHandler.js';
import { executeDrop } from '../actions/handlers/dropActionHandler.js';
import { executeInventory } from '../actions/handlers/inventoryActionHandler.js';
import { executeAttack } from '../actions/handlers/attackActionHandler.js';
import { executeUse } from '../actions/handlers/useActionHandler.js';
import { executeEquip } from '../actions/handlers/equipActionHandler.js';
import { executeUnequip } from '../actions/handlers/unequipActionHandler.js';
// Import future handlers here...

// Define and export the registry configuration as a Map
export const actionHandlerRegistryConfig = new Map([
    // Core Actions
    ['core:move', executeMove],
    ['core:look', executeLook],
    ['core:take', executeTake],
    ['core:drop', executeDrop],
    ['core:inventory', executeInventory],
    ['core:attack', executeAttack],
    ['core:use', executeUse],
    ['core:equip', executeEquip],
    ['core:unequip', executeUnequip],

    // Add mappings for new actions here as they are created
    // Example: ['custom:special', executeSpecialAction],
]);

console.log(`Action Handler Registry Config: Loaded ${actionHandlerRegistryConfig.size} handler mappings.`);
