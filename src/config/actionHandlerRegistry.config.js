// src/config/actionHandlerRegistry.config.js

/**
 * Defines the mapping between Action Definition IDs and their corresponding
 * handler functions. This externalizes the registration logic from main.js.
 */

// Import all necessary action handler functions
import { executeMove } from '../actions/handlers/moveActionHandler.js';
import { executeLook } from '../actions/handlers/lookActionHandler.js';
import { executeTake } from '../actions/handlers/takeActionHandler.js';
import { executeInventory } from '../actions/handlers/inventoryActionHandler.js';
import { executeAttack } from '../actions/handlers/attackActionHandler.js';
import { executeUse } from '../actions/handlers/useActionHandler.js';
import { executeEquip } from '../actions/handlers/equipActionHandler.js';
import { executeUnequip } from '../actions/handlers/unequipActionHandler.js';
// Import future handlers here...

// Define and export the registry configuration as a Map
export const actionHandlerRegistryConfig = new Map([
    // Core Actions
    ['core:action_move', executeMove],
    ['core:action_look', executeLook],
    ['core:action_take', executeTake],
    ['core:action_inventory', executeInventory],
    ['core:action_attack', executeAttack],
    ['core:action_use', executeUse],
    ['core:action_equip', executeEquip],
    ['core:action_unequip', executeUnequip],

    // Add mappings for new actions here as they are created
    // Example: ['custom:action_special', executeSpecialAction],
]);

console.log(`Action Handler Registry Config: Loaded ${actionHandlerRegistryConfig.size} handler mappings.`);
