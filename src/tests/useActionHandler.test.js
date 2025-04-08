// src/tests/useActionHandler.js

// Note: We don't strictly need the Component *classes* for the definitions,
// but we do import the handler and dependent *instance* components (Inventory, Health).

// --- Mock Data Definitions ---
import {InventoryComponent} from "../components/inventoryComponent.js";
import {HealthComponent} from "../components/healthComponent.js";
import {executeUse} from "../actions/handlers/useActionHandler.js";

const MOCK_ITEM_DEFS = {
    potion_healing_1: {
        id: 'potion_healing_1',
        name: 'Healing Potion',
        components: {
            Name: {value: 'Healing Potion'},
            Usable: {
                effect_type: 'heal',
                effect_details: {amount: 10},
                consumable: true,
                use_message: 'You drink the potion and feel refreshed.',
            },
            // No Equippable
        },
    },
    sword_rusty_1: {
        id: 'sword_rusty_1',
        name: 'Rusty Sword',
        components: {
            Name: {value: 'Rusty Sword'},
            Equippable: {
                slotId: 'core:slot_main_hand',
                equipEffects: [{type: 'damage_boost', amount: 1}],
            },
            // No Usable
        },
    },
    sword_charged_1: {
        id: 'sword_charged_1',
        name: 'Charged Sword',
        components: {
            Name: {value: 'Charged Sword'},
            Usable: { // Can be activated
                effect_type: 'heal', // Using 'heal' for simplicity, could be 'damage_burst' etc.
                effect_details: {amount: 5},
                consumable: false, // Special ability, doesn't consume sword
                use_message: 'The sword hums with energy.',
            },
            Equippable: { // Can also be equipped
                slotId: 'core:slot_main_hand',
                equipEffects: [{type: 'damage_boost', amount: 3}],
            },
        },
    },
    rock_1: {
        id: 'rock_1',
        name: 'Plain Rock',
        components: {
            Name: {value: 'Plain Rock'},
            // No Usable
            // No Equippable
        },
    },
    potion_fullhealth_1: { // For testing heal at full health
        id: 'potion_fullhealth_1',
        name: 'Full Health Potion',
        components: {
            Name: {value: 'Full Health Potion'},
            Usable: {
                effect_type: 'heal',
                effect_details: {amount: 10},
                consumable: true,
                use_message: 'You drink the potion, but you were already healthy.', // Custom message maybe? Or reuse default. Let's use a distinct one for test clarity.
            },
        },
    },
    potion_misconfigured_1: {
        id: 'potion_misconfigured_1',
        name: 'Odd Potion',
        components: {
            Name: {value: 'Odd Potion'},
            Usable: {
                effect_type: 'heal', // Intends to heal
                effect_details: {amount: "lots"}, // Invalid amount
                consumable: true,
                use_message: 'It bubbles strangely.',
            },
        },
    },
    widget_unknown_effect_1: {
        id: 'widget_unknown_effect_1',
        name: 'Strange Widget',
        components: {
            Name: {value: 'Strange Widget'},
            Usable: {
                effect_type: 'levitate', // Assume this isn't handled yet
                effect_details: {},
                consumable: true,
                use_message: 'You fiddle with the widget.',
            },
        },
    },
};

// --- Mock Setup ---
// Basic Mock Entity Stub
class MockEntity {
    constructor(id, definition) {
        this.id = id;
        this.components = {}; // Instances
        this.definition = definition; // Store definition for reference if needed, though UseHandler uses DataManager
    }

    addComponent(component) {
        this.components[component.constructor.name] = component;
    }

    getComponent(componentClass) {
        return this.components[componentClass.name];
    }

    hasComponent(componentClass) {
        return !!this.components[componentClass.name];
    }
}

// Helper to create a standard mock context
const createMockContext = (playerEntity, targets = [], itemsInInventory = []) => {
    // Setup InventoryComponent on player
    const inventory = new InventoryComponent();
    itemsInInventory.forEach(itemId => inventory.addItem(itemId));
    if (!playerEntity.hasComponent(InventoryComponent)) {
        playerEntity.addComponent(inventory);
    } else {
        // Clear and add specific items if inventory already exists
        const existingInv = playerEntity.getComponent(InventoryComponent);
        existingInv._items = new Set(); // Reset items
        itemsInInventory.forEach(itemId => existingInv.addItem(itemId));
    }


    const mockDataManager = {
        getEntityDefinition: jest.fn((itemId) => MOCK_ITEM_DEFS[itemId] || null),
    };

    const mockDispatch = jest.fn(); // Spy on dispatch calls

    return {
        playerEntity,
        targets,
        dataManager: mockDataManager,
        dispatch: mockDispatch,
        // Mock other context properties if needed by future handler features
        entityManager: {getEntityInstance: jest.fn()},
        gameTime: {delta: 1},
    };
};

// --- Test Suite ---

describe('Action Handler: executeUse', () => {

    let player;

    beforeEach(() => {
        // Reset player before each test
        player = new MockEntity('player_1');
        player.addComponent(new HealthComponent({current: 15, max: 20}));
        // InventoryComponent will be added/managed by createMockContext
    });

    // === Test Cases Based on Refined Ticket ===

    test('AC2 (Equippable Only): Should fail to use an item with only EquippableComponent', () => {
        const context = createMockContext(player, ['rusty sword'], ['sword_rusty_1']);
        const result = executeUse(context);

        expect(result.success).toBe(false);
        expect(context.dataManager.getEntityDefinition).toHaveBeenCalledWith('sword_rusty_1');
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: "You can't use the Rusty Sword that way.", // Uses item's actual Name
            type: 'warning',
        });
        // Ensure item was NOT removed from inventory
        expect(player.getComponent(InventoryComponent).hasItem('sword_rusty_1')).toBe(true);
    });

    test('AC3 (Usable Only): Should successfully use an item with only UsableComponent', () => {
        const context = createMockContext(player, ['healing potion'], ['potion_healing_1']);
        const initialHealth = player.getComponent(HealthComponent).current; // 15
        const healAmount = MOCK_ITEM_DEFS.potion_healing_1.components.Usable.effect_details.amount; // 10

        const result = executeUse(context);

        expect(result.success).toBe(true);
        expect(context.dataManager.getEntityDefinition).toHaveBeenCalledWith('potion_healing_1');

        // Check effect
        const finalHealth = player.getComponent(HealthComponent).current;
        expect(finalHealth).toBe(Math.min(player.getComponent(HealthComponent).max, initialHealth + healAmount)); // Should be 20 (15 + 10 > 20 max)

        // Check consumption
        expect(player.getComponent(InventoryComponent).hasItem('potion_healing_1')).toBe(false);

        // Check success message (from item definition)
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: MOCK_ITEM_DEFS.potion_healing_1.components.Usable.use_message,
            type: 'info',
        });

        // Check result message array
        expect(result.messages).toEqual(expect.arrayContaining([
            {text: MOCK_ITEM_DEFS.potion_healing_1.components.Usable.use_message, type: 'info'}
        ]));
    });

    test('AC4 (Both Components): Should successfully use an item with both Usable and Equippable components, based ONLY on Usable', () => {
        const context = createMockContext(player, ['charged sword'], ['sword_charged_1']);
        const initialHealth = player.getComponent(HealthComponent).current; // 15
        const healAmount = MOCK_ITEM_DEFS.sword_charged_1.components.Usable.effect_details.amount; // 5
        const isConsumable = MOCK_ITEM_DEFS.sword_charged_1.components.Usable.consumable; // false

        const result = executeUse(context);

        expect(result.success).toBe(true);
        expect(context.dataManager.getEntityDefinition).toHaveBeenCalledWith('sword_charged_1');

        // Check effect (heal)
        const finalHealth = player.getComponent(HealthComponent).current;
        expect(finalHealth).toBe(initialHealth + healAmount); // Should be 20 (15 + 5 <= 20 max)

        // Check NOT consumed
        expect(isConsumable).toBe(false);
        expect(player.getComponent(InventoryComponent).hasItem('sword_charged_1')).toBe(true);

        // Check success message (from Usable component data)
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: MOCK_ITEM_DEFS.sword_charged_1.components.Usable.use_message,
            type: 'info',
        });
        expect(result.messages).toEqual(expect.arrayContaining([
            {text: MOCK_ITEM_DEFS.sword_charged_1.components.Usable.use_message, type: 'info'}
        ]));
    });

    // === Additional Handler Logic Tests ===

    test('Should fail if target is not specified', () => {
        const context = createMockContext(player, [], ['potion_healing_1']); // No target
        const result = executeUse(context);

        expect(result.success).toBe(false);
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: "Use what?",
            type: 'error',
        });
        expect(result.messages).toEqual([{text: "Use what?", type: 'error'}]);
    });

    test('Should fail if target item is not in inventory', () => {
        const context = createMockContext(player, ['magic stone'], ['potion_healing_1']); // Has potion, targets stone
        const result = executeUse(context);

        expect(result.success).toBe(false);
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: 'You don\'t have anything like "magic stone".',
            type: 'info',
        });
        expect(result.messages).toEqual([{text: 'You don\'t have anything like "magic stone".', type: 'info'}]);
    });

    test('Should handle partial name matching (case-insensitive)', () => {
        const context = createMockContext(player, ['potion'], ['potion_healing_1']); // Target 'potion' matches 'Healing Potion'
        const result = executeUse(context);

        // Should succeed based on the matching logic in the handler
        expect(result.success).toBe(true);
        expect(context.dataManager.getEntityDefinition).toHaveBeenCalledWith('potion_healing_1');
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: MOCK_ITEM_DEFS.potion_healing_1.components.Usable.use_message,
            type: 'info',
        });
        expect(player.getComponent(InventoryComponent).hasItem('potion_healing_1')).toBe(false); // Consumed
    });

    test('Should succeed but not heal if player is already at full health (MVP behavior)', () => {
        player.getComponent(HealthComponent).current = player.getComponent(HealthComponent).max; // Set health to max (20)
        const context = createMockContext(player, ['full health potion'], ['potion_fullhealth_1']);
        const initialHealth = player.getComponent(HealthComponent).current; // 20

        const result = executeUse(context);

        expect(result.success).toBe(true); // Action considered successful as item was targetable and usable
        expect(context.dataManager.getEntityDefinition).toHaveBeenCalledWith('potion_fullhealth_1');

        // Check health unchanged
        const finalHealth = player.getComponent(HealthComponent).current;
        expect(finalHealth).toBe(initialHealth); // Still 20

        // Check message for full health was shown
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: "You are already at full health.",
            type: 'info'
        });

        // Check item WAS consumed (current implementation consumes even if no actual heal)
        expect(player.getComponent(InventoryComponent).hasItem('potion_fullhealth_1')).toBe(false);

        // Check final success message from item data was still shown
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: MOCK_ITEM_DEFS.potion_fullhealth_1.components.Usable.use_message,
            type: 'info',
        });

        // Check result messages
        expect(result.messages).toEqual(expect.arrayContaining([
            {text: "You are already at full health.", type: 'info'},
            {text: MOCK_ITEM_DEFS.potion_fullhealth_1.components.Usable.use_message, type: 'info'}
        ]));
    });

    test('Should fail if the item has an unhandled effect_type', () => {
        const context = createMockContext(player, ['widget'], ['widget_unknown_effect_1']);
        const result = executeUse(context);

        expect(result.success).toBe(false);
        expect(context.dataManager.getEntityDefinition).toHaveBeenCalledWith('widget_unknown_effect_1');
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: 'Using the Strange Widget doesn\'t seem to do anything right now.',
            type: 'warning',
        });
        expect(result.messages).toEqual(expect.arrayContaining([
            {text: 'Using the Strange Widget doesn\'t seem to do anything right now.', type: 'warning'}
        ]));
        // Ensure item was NOT consumed because the effect failed
        expect(player.getComponent(InventoryComponent).hasItem('widget_unknown_effect_1')).toBe(true);
    });

    test('Should fail if heal effect details are invalid', () => {
        const context = createMockContext(player, ['odd potion'], ['potion_misconfigured_1']);
        const initialHealth = player.getComponent(HealthComponent).current; // 15

        const result = executeUse(context);

        expect(result.success).toBe(false); // Failed due to config error during effect application
        expect(context.dataManager.getEntityDefinition).toHaveBeenCalledWith('potion_misconfigured_1');

        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: 'Internal Error: The Odd Potion seems misconfigured.',
            type: 'error',
        });
        expect(result.messages).toEqual(expect.arrayContaining([
            {text: 'Internal Error: The Odd Potion seems misconfigured.', type: 'error'}
        ]));

        // Ensure health did not change
        expect(player.getComponent(HealthComponent).current).toBe(initialHealth);

        // Ensure item was NOT consumed because the effect failed
        expect(player.getComponent(InventoryComponent).hasItem('potion_misconfigured_1')).toBe(true);
    });

    test('Should fail gracefully if player lacks HealthComponent for a heal item', () => {
        // Create player *without* HealthComponent
        const playerNoHealth = new MockEntity('player_nohealth');
        const context = createMockContext(playerNoHealth, ['healing potion'], ['potion_healing_1']);

        const result = executeUse(context);

        expect(result.success).toBe(false);
        expect(context.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: 'Internal Error: Cannot access your health.',
            type: 'error',
        });
        expect(result.messages).toEqual(expect.arrayContaining([
            {text: 'Internal Error: Cannot access your health.', type: 'error'}
        ]));
        expect(playerNoHealth.getComponent(InventoryComponent).hasItem('potion_healing_1')).toBe(true); // Not consumed
    });

});