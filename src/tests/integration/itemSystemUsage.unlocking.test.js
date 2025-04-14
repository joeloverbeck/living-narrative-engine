// src/tests/integration/itemUsageSystem.unlocking.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';

// --- Systems Under Test ---
import ItemUsageSystem from '../../systems/itemUsageSystem.js';
import LockSystem from '../../systems/lockSystem.js';

import EventBus from "../../core/eventBus.js";

// --- Real Services (Dependencies for ItemUsageSystem or LockSystem) ---
import ConditionEvaluationService from '../../services/conditionEvaluationService.js';
// REMOVED: No longer need real TargetResolutionService instance here for ItemUsageSystem testing
import EffectExecutionService from '../../services/effectExecutionService.js';

// --- Mock Services ---
// ADDED: Define variable for the mock service we will inject into ItemUsageSystem
let mockItemTargetResolverService;

// --- Real Components (Used in Entities/Services) ---
import Component from '../../components/component.js'; // Base component
import LockableComponent from '../../components/lockableComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {HealthComponent} from '../../components/healthComponent.js';
import {StatsComponent} from '../../components/statsComponent.js';
import {AttackComponent} from '../../components/attackComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {QuestLogComponent} from '../../components/questLogComponent.js';
// Add other components as needed by JSON definitions or services

// --- Component Stubs ---
// Stub for EdibleComponent as it's referenced in apple JSON but file wasn't provided
class EdibleComponent extends Component {
    constructor(data = {}) {
        super();
        // Minimal stub implementation
    }
}

// Mock Entity Class
class MockEntity {
    constructor(id, components = {}) {
        this.id = id;
        this._components = new Map();
        // Add initial components if provided
        for (const key in components) {
            // Use the component's class name as the primary key if available, otherwise use the provided key
            const componentInstance = components[key];
            const primaryKey = componentInstance.constructor?.name || key;
            this.addComponent(componentInstance, primaryKey);
        }
    }

    // Adds a component instance, mapping it by its class constructor and optionally a string key
    addComponent(componentInstance, componentKey = null) {
        const classKey = componentInstance.constructor; // Use the actual class as a key
        this._components.set(classKey, componentInstance);

        // Also map by name string if available (e.g., "NameComponent")
        if (classKey && classKey.name) {
            this._components.set(classKey.name, componentInstance);
        }

        // Map by provided string key if it's different and valid
        if (typeof componentKey === 'string' && componentKey !== classKey?.name) {
            this._components.set(componentKey, componentInstance);
        }
    }

    // Retrieves a component instance by its class constructor or string key
    getComponent(ComponentClassOrKey) {
        if (typeof ComponentClassOrKey === 'function') {
            return this._components.get(ComponentClassOrKey); // Prioritize class constructor lookup
        } else if (typeof ComponentClassOrKey === 'string') {
            // Fallback to string key lookup (covers both class name string and explicit string key)
            return this._components.get(ComponentClassOrKey);
        }
        return undefined; // Return undefined if key is invalid type or not found
    }

    // Checks for component existence by class constructor or string key
    hasComponent(ComponentClassOrKey) {
        if (typeof ComponentClassOrKey === 'function') {
            return this._components.has(ComponentClassOrKey); // Prioritize class constructor lookup
        } else if (typeof ComponentClassOrKey === 'string') {
            // Fallback to string key lookup
            return this._components.has(ComponentClassOrKey);
        }
        return false; // Key is invalid type
    }

    toString() {
        // Attempt to get name component for better logging
        const nameComp = this.getComponent(NameComponent) || this.getComponent('Name');
        const name = nameComp?.value || 'Unknown Name';
        return `MockEntity[id=${this.id}, name="${name}"]`;
    }
}

// --- Test Data Definitions ---

const playerDefinition = {
    id: "core:player",
    components: {
        Name: {value: "Player"},
        Position: {locationId: "demo:room_entrance"}, // Example starting room
        Health: {current: 10, max: 10},
        Inventory: {items: []}, // Start with empty inventory for setup
        Stats: {
            attributes: {
                "core:attr_strength": 8,
                "core:attr_agility": 10,
                "core:attr_intelligence": 10,
                "core:attr_constitution": 9
            }
        },
        Attack: {damage: 3},
        Equipment: {
            slots: {
                "core:slot_head": null,
                "core:slot_body": null,
                "core:slot_legs": null,
                "core:slot_feet": null,
                "core:slot_main_hand": null,
                "core:slot_off_hand": null,
                "core:slot_ranged": null,
                "core:slot_amulet": null,
                "core:slot_ring1": null,
                "core:slot_ring2": null
            }
        },
        QuestLog: {}
    }
};

const doorDefinition = {
    id: "demo:example_door",
    components: {
        Name: {value: "Example Door"},
        Description: {text: "A sturdy wooden example door. It looks locked."},
        Lockable: {isLocked: true, keyId: "demo:item_key_rusty"} // Locked and requires rusty key
    }
};

const rustyKeyDefinition = {
    id: "demo:item_key_rusty",
    components: {
        Name: {value: "Rusty Key"},
        Description: {text: "An old, rusty iron key. It looks like it might fit a specific lock."},
        Item: {tags: ["key", "metal"], stackable: false, value: 5, weight: 0.1},
        Usable: {
            target_required: true,
            usability_conditions: [],
            target_conditions: [ // Note: These conditions are evaluated *inside* ItemTargetResolverService now
                {
                    condition_type: "target_has_component",
                    component_name: "Lockable",
                    failure_message: "You can't unlock that."
                },
                {
                    condition_type: "target_has_property",
                    property_path: "Lockable.isLocked",
                    expected_value: true,
                    failure_message: "It's already unlocked."
                },
                {
                    condition_type: "target_has_property",
                    property_path: "Lockable.keyId",
                    expected_value: "demo:item_key_rusty", // Correct key check
                    failure_message: "This key doesn't seem to fit."
                }
            ],
            effects: [ // Effect used by ItemUsageSystem *after* successful resolution/condition checks
                // Using 'attempt_unlock' type aligns with ItemUsageSystem suppressing its own message
                // {
                //     type: "attempt_unlock"
                // }
                // Using 'trigger_event' type means ItemUsageSystem will *also* show its success message
                {
                    type: "trigger_event",
                    parameters: {
                        eventName: "event:unlock_entity_attempt",
                        // Context should provide userId and targetEntityId
                        eventPayload: {
                            keyItemId: "demo:item_key_rusty" // Pass the key's definition ID
                        }
                    }
                }
            ],
            consume_on_use: false,
            success_message: "You use the rusty key on the {target}.", // Uses interpolation
            failure_message_default: "You can't use the key like that.",
            // Added for clarity from resolver code
            failure_message_target_required: "Use the key on what?",
            failure_message_invalid_target: "You can't use the key on that."
        }
    }
};

// Definition for the "wrong" key
const wrongKeyDefinition = {
    id: "demo:item_key_wrong",
    components: {
        Name: {value: "Bent Key"},
        Description: {text: "A small, bent brass key. Doesn't look very useful."},
        Item: {tags: ["key", "brass"], stackable: false, value: 1, weight: 0.1},
        Usable: {
            target_required: true,
            usability_conditions: [],
            target_conditions: [ // Evaluated inside ItemTargetResolverService
                {
                    condition_type: "target_has_component",
                    component_name: "Lockable",
                    failure_message: "You can't unlock that."
                },
                {
                    condition_type: "target_has_property",
                    property_path: "Lockable.isLocked",
                    expected_value: true,
                    failure_message: "It's already unlocked."
                },
                {
                    condition_type: "target_has_property",
                    property_path: "Lockable.keyId",
                    expected_value: "demo:item_key_wrong", // Will fail on door needing rusty key
                    failure_message: "This key doesn't seem to fit." // This is the expected failure message
                }
            ],
            effects: [ // Only executed if target resolution/conditions pass
                {
                    type: "trigger_event",
                    parameters: {
                        eventName: "event:unlock_entity_attempt",
                        eventPayload: {keyItemId: "demo:item_key_wrong"}
                    }
                }
            ],
            consume_on_use: false,
            success_message: "You try the bent key on the {target}.",
            failure_message_default: "You can't use the bent key like that.",
            failure_message_target_required: "Use the bent key on what?",
            failure_message_invalid_target: "You can't use the bent key on that."
        }
    }
};

const swordDefinition = {
    id: "demo:item_sword",
    components: {
        Name: {value: "Rusty Sword"},
        Description: {text: "A simple short sword, pitted with rust but still serviceable."},
        Item: {tags: ["weapon", "sword", "metal", "melee"]},
        Equippable: {
            slotId: "core:slot_main_hand",
            equipEffects: [{type: "stat_mod", stat: "core:attr_strength", value: 1}]
        }
        // NOTE: No Usable component
    }
};

const appleDefinition = {
    id: "demo:example_apple",
    components: {
        Name: {value: "Example Apple"},
        Description: {text: "A crisp, red example apple. It looks edible."},
        Item: {tags: ["food", "consumable", "edible", "organic"], stackable: true, value: 1, weight: 0.1},
        Edible: {} // Needs the EdibleComponent stub
    }
};


// --- Global Test Variables ---
let itemUsageSystem;
let lockSystem;
let eventBus;
let mockEntityManager;
let mockDataManager;
let conditionEvaluationService; // Real instance used by ItemUsageSystem directly
// let targetResolutionService; // REMOVED: Old service instance variable
let effectExecutionService;   // Real instance used by ItemUsageSystem directly

// Mock Entities
let mockPlayer;
let mockDoor;
let mockRustyKey;
let mockWrongKey;
let mockSword;
let mockApple;

// Direct component references
let doorLockableComponent;

// Constants
const PLAYER_ID = 'core:player';
const DOOR_ID = 'demo:example_door';
const RUSTY_KEY_INSTANCE_ID = 'itemInstance_rustyKey_1';
const WRONG_KEY_INSTANCE_ID = 'itemInstance_wrongKey_1';
const SWORD_INSTANCE_ID = 'itemInstance_sword_1';
const APPLE_INSTANCE_ID = 'itemInstance_apple_1';
const PLAYER_START_LOCATION = playerDefinition.components.Position.locationId; // 'demo:room_entrance'


// --- Test Setup ---
beforeEach(() => {
    // 1. Clear Mocks
    jest.clearAllMocks();

    // 2. Instantiate Mocks & Spies
    eventBus = new EventBus();
    jest.spyOn(eventBus, 'dispatch'); // Spy on the dispatch method

    mockEntityManager = {
        getEntityInstance: jest.fn(),
        componentRegistry: new Map([
            ['Name', NameComponent], ['NameComponent', NameComponent],
            ['Description', DescriptionComponent], ['DescriptionComponent', DescriptionComponent],
            ['Position', PositionComponent], ['PositionComponent', PositionComponent],
            ['LockableComponent', LockableComponent], ['Lockable', LockableComponent],
            ['Inventory', InventoryComponent], ['InventoryComponent', InventoryComponent],
            ['Item', ItemComponent], ['ItemComponent', ItemComponent],
            ['Equippable', EquippableComponent], ['EquippableComponent', EquippableComponent],
            ['Edible', EdibleComponent], ['EdibleComponent', EdibleComponent], // Map the stub
            ['Health', HealthComponent], ['HealthComponent', HealthComponent],
            ['Stats', StatsComponent], ['StatsComponent', StatsComponent],
            ['Attack', AttackComponent], ['AttackComponent', AttackComponent],
            ['Equipment', EquipmentComponent], ['EquipmentComponent', EquipmentComponent],
            ['QuestLog', QuestLogComponent], ['QuestLogComponent', QuestLogComponent]
        ]),
        getDefinitionIdFromInstance: jest.fn((instanceId) => {
            // Simple mapping based on our known instances for this test
            if (instanceId === RUSTY_KEY_INSTANCE_ID) return rustyKeyDefinition.id;
            if (instanceId === WRONG_KEY_INSTANCE_ID) return wrongKeyDefinition.id;
            if (instanceId === SWORD_INSTANCE_ID) return swordDefinition.id;
            if (instanceId === APPLE_INSTANCE_ID) return appleDefinition.id;
            if (instanceId === PLAYER_ID) return playerDefinition.id; // Player might be considered an "instance"
            if (instanceId === DOOR_ID) return doorDefinition.id; // Door might be considered an "instance"
            return undefined; // Default case
        }),
    };
    mockDataManager = {
        getEntityDefinition: jest.fn(),
    };

    // ADDED: Instantiate the mock for ItemTargetResolverService
    mockItemTargetResolverService = {
        resolveItemTarget: jest.fn() // Default mock implementation for the method
    };

    // 3. Instantiate Real Services (those needed directly by ItemUsageSystem or LockSystem)
    conditionEvaluationService = new ConditionEvaluationService({entityManager: mockEntityManager});
    // REMOVED: targetResolutionService = new TargetResolutionService(); // No longer instantiate old service here
    effectExecutionService = new EffectExecutionService(); // Dependencies injected via context

    // 4. Instantiate Real Systems (injecting mocks and real services)
    itemUsageSystem = new ItemUsageSystem({
        eventBus: eventBus,
        entityManager: mockEntityManager,
        dataManager: mockDataManager,
        conditionEvaluationService, // Pass real CES for usability checks
        // REMOVED: targetResolutionService, // Remove old service dependency
        itemTargetResolverService: mockItemTargetResolverService, // ADDED: Inject mock resolver
        effectExecutionService,    // Pass real EES for effect execution
    });

    lockSystem = new LockSystem({
        eventBus: eventBus, // Inject real bus
        entityManager: mockEntityManager, // LockSystem needs EM
    });

    // 5. Initialize Systems (Subscribe to Events)
    lockSystem.initialize(); // LockSystem subscribes to event:unlock_entity_attempt etc.

    // 6. Create Mock Entities with Real Components
    // Player
    mockPlayer = new MockEntity(PLAYER_ID);
    mockPlayer.addComponent(new NameComponent(playerDefinition.components.Name));
    mockPlayer.addComponent(new PositionComponent(playerDefinition.components.Position));
    mockPlayer.addComponent(new HealthComponent(playerDefinition.components.Health));
    const playerInv = new InventoryComponent({items: [RUSTY_KEY_INSTANCE_ID, WRONG_KEY_INSTANCE_ID, SWORD_INSTANCE_ID, APPLE_INSTANCE_ID]});
    mockPlayer.addComponent(playerInv);
    mockPlayer.addComponent(new StatsComponent(playerDefinition.components.Stats));
    mockPlayer.addComponent(new AttackComponent(playerDefinition.components.Attack));
    mockPlayer.addComponent(new EquipmentComponent(playerDefinition.components.Equipment));
    mockPlayer.addComponent(new QuestLogComponent(playerDefinition.components.QuestLog));

    // Door (Target Entity)
    mockDoor = new MockEntity(DOOR_ID);
    mockDoor.addComponent(new NameComponent(doorDefinition.components.Name));
    mockDoor.addComponent(new DescriptionComponent(doorDefinition.components.Description));
    doorLockableComponent = new LockableComponent(doorDefinition.components.Lockable); // Use real component
    mockDoor.addComponent(doorLockableComponent);
    // Add PositionComponent if needed for target resolution (handled by resolver now)

    // Rusty Key (Item Instance)
    mockRustyKey = new MockEntity(RUSTY_KEY_INSTANCE_ID);
    mockRustyKey.addComponent(new NameComponent(rustyKeyDefinition.components.Name));
    mockRustyKey.addComponent(new ItemComponent(rustyKeyDefinition.components.Item));
    // Usable component logic comes from definition

    // Wrong Key (Item Instance)
    mockWrongKey = new MockEntity(WRONG_KEY_INSTANCE_ID);
    mockWrongKey.addComponent(new NameComponent(wrongKeyDefinition.components.Name));
    mockWrongKey.addComponent(new ItemComponent(wrongKeyDefinition.components.Item));

    // Sword (Optional)
    mockSword = new MockEntity(SWORD_INSTANCE_ID);
    mockSword.addComponent(new NameComponent(swordDefinition.components.Name));
    mockSword.addComponent(new ItemComponent(swordDefinition.components.Item));
    mockSword.addComponent(new EquippableComponent(swordDefinition.components.Equippable));

    // Apple (Optional)
    mockApple = new MockEntity(APPLE_INSTANCE_ID);
    mockApple.addComponent(new NameComponent(appleDefinition.components.Name));
    mockApple.addComponent(new ItemComponent(appleDefinition.components.Item));
    mockApple.addComponent(new EdibleComponent(appleDefinition.components.Edible)); // Use the stub


    // 7. Configure Mock Manager Returns
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        switch (id) {
            case PLAYER_ID:
                return mockPlayer;
            case DOOR_ID:
                return mockDoor;
            case RUSTY_KEY_INSTANCE_ID:
                return mockRustyKey;
            case WRONG_KEY_INSTANCE_ID:
                return mockWrongKey;
            case SWORD_INSTANCE_ID:
                return mockSword;
            case APPLE_INSTANCE_ID:
                return mockApple;
            default:
                console.warn(`[Test EntityManager] getEntityInstance called for unmocked ID: ${id}`);
                return undefined;
        }
    });

    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        switch (id) {
            case playerDefinition.id:
                return playerDefinition;
            case doorDefinition.id:
                return doorDefinition;
            case rustyKeyDefinition.id:
                return rustyKeyDefinition;
            case wrongKeyDefinition.id:
                return wrongKeyDefinition;
            case swordDefinition.id:
                return swordDefinition;
            case appleDefinition.id:
                return appleDefinition;
            default:
                console.warn(`[Test DataManager] getEntityDefinition called for unknown definition ID: ${id}`);
                return undefined;
        }
    });
});

// --- Test Teardown ---
afterEach(() => {
    // 1. Shutdown Systems (Unsubscribe etc.)
    if (itemUsageSystem && typeof itemUsageSystem.shutdown === 'function') {
        itemUsageSystem.shutdown();
    }
    if (lockSystem && typeof lockSystem.shutdown === 'function') {
        lockSystem.shutdown();
    }

    // 2. Restore Mocks (This cleans up spies created with jest.spyOn)
    jest.restoreAllMocks();

    // 3. Clear global test variables
    itemUsageSystem = null;
    lockSystem = null;
    eventBus = null;
    mockEntityManager = null;
    mockDataManager = null;
    conditionEvaluationService = null;
    // REMOVED: targetResolutionService = null; // Remove cleanup for old service
    mockItemTargetResolverService = null; // ADDED: Clear the mock service variable
    effectExecutionService = null;
    mockPlayer = null;
    mockDoor = null;
    mockRustyKey = null;
    mockWrongKey = null;
    mockSword = null;
    mockApple = null;
    doorLockableComponent = null;
});

// --- Test Suite ---
describe('Integration Test: ItemUsageSystem <-> LockSystem (Unlocking)', () => {

    // Test the basic setup first (Update to reflect removed service)
    it('should initialize the test environment without errors', () => {
        expect(eventBus).toBeDefined();
        expect(mockEntityManager).toBeDefined();
        expect(mockDataManager).toBeDefined();
        expect(conditionEvaluationService).toBeDefined(); // Real CES
        // REMOVED: expect(targetResolutionService).toBeDefined(); // Old service removed
        expect(mockItemTargetResolverService).toBeDefined(); // ADDED: Check new mock service
        expect(effectExecutionService).toBeDefined(); // Real EES
        expect(itemUsageSystem).toBeDefined();
        expect(lockSystem).toBeDefined();
        expect(mockPlayer).toBeDefined();
        expect(mockDoor).toBeDefined();
        expect(mockRustyKey).toBeDefined();
        expect(mockWrongKey).toBeDefined();
        expect(doorLockableComponent).toBeDefined();

        // Check initial state
        expect(doorLockableComponent.isLocked).toBe(true);
        expect(doorLockableComponent.keyId).toBe(rustyKeyDefinition.id);
    });

    // --- TEST-102 Implementation ---
    it('[TEST-102] should unlock the door when using the correct key', async () => {
        // Arrange
        expect(doorLockableComponent.isLocked).toBe(true);
        const eventData = {
            userEntityId: PLAYER_ID,
            itemInstanceId: RUSTY_KEY_INSTANCE_ID,
            itemDefinitionId: rustyKeyDefinition.id,
            explicitTargetEntityId: DOOR_ID,
            explicitTargetConnectionId: null // Explicitly null for clarity
        };
        const keyName = rustyKeyDefinition.components.Name.value; // "Rusty Key"
        const doorName = mockDoor.getComponent(NameComponent).value;

        // ADDED: Configure mock resolver to return success for this case
        mockItemTargetResolverService.resolveItemTarget.mockResolvedValue({
            success: true,
            target: mockDoor, // The resolved target entity
            targetType: 'entity',
            messages: []
        });

        // Act
        await eventBus.dispatch('event:item_use_attempted', eventData);

        // Assert
        // ADDED: Verify resolveItemTarget was called correctly
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledTimes(1);
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                userEntity: mockPlayer,
                usableComponentData: rustyKeyDefinition.components.Usable,
                explicitTargetEntityId: DOOR_ID,
                explicitTargetConnectionEntityId: null, // Check the correct key name is used
                itemName: keyName
            })
        );

        // 5. Door Unlocked (State change happens via LockSystem handling the unlock attempt event)
        expect(doorLockableComponent.isLocked).toBe(false);

        // 7. Item Usage Message (ItemUsageSystem dispatches this based on definition if effect wasn't attempt_*)
        const expectedItemUsageMsg = rustyKeyDefinition.components.Usable.success_message.replace('{target}', doorName);
        // Since the effect is trigger_event, ItemUsageSystem *should* display its message.
        expect(eventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: expectedItemUsageMsg,
            type: 'info'
        });

        // Check LockSystem's success message (dispatched after handling unlock attempt)
        expect(eventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: `You unlock the ${doorName}.`, // Default message from LockSystem
            type: 'success' // Assuming LockSystem uses 'success'
        });

        // 8. Entity Unlocked Event (Dispatched by LockSystem)
        expect(eventBus.dispatch).toHaveBeenCalledWith('event:entity_unlocked', {
            userId: PLAYER_ID,
            targetEntityId: DOOR_ID,
            keyItemId: rustyKeyDefinition.id // LockSystem uses definition ID
        });

        // 9. No Consumption
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:item_consume_requested', expect.anything());

        // 10. No *Unexpected* Warnings/Errors
        const dispatchCalls = (eventBus.dispatch).mock.calls;
        const unexpectedMessages = dispatchCalls.filter(([eventName, payload]) =>
            eventName === 'ui:message_display' &&
            // Allow the expected info/success messages
            !(payload?.text === expectedItemUsageMsg && payload?.type === 'info') &&
            !(payload?.text === `You unlock the ${doorName}.` && payload?.type === 'success') &&
            // Filter for actual warnings/errors
            (payload?.type === 'warning' || payload?.type === 'error')
        );
        expect(unexpectedMessages).toHaveLength(0);
    });

    // --- TEST-103 Implementation ---
    it('[TEST-103] should fail gracefully when using a non-usable item (sword) on a locked door', async () => {
        // Arrange
        expect(doorLockableComponent.isLocked).toBe(true);
        const eventData = {
            userEntityId: PLAYER_ID,
            itemInstanceId: SWORD_INSTANCE_ID,
            itemDefinitionId: swordDefinition.id,
            explicitTargetEntityId: DOOR_ID
        };
        const swordName = swordDefinition.components.Name.value;

        // Act
        await eventBus.dispatch('event:item_use_attempted', eventData);

        // Assert
        expect(doorLockableComponent.isLocked).toBe(true); // State unchanged

        // ADDED: Assert resolver was NOT called (failure happens before resolution attempt)
        expect(mockItemTargetResolverService.resolveItemTarget).not.toHaveBeenCalled();

        // Check failure message (dispatched by ItemUsageSystem for missing Usable component)
        expect(eventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: `You cannot use ${swordName}.`,
            type: 'info' // Or 'warning', check ItemUsageSystem implementation detail
        });

        // Verify ONLY that message was displayed
        const uiDisplayCalls = (eventBus.dispatch).mock.calls.filter(
            ([eventName]) => eventName === 'ui:message_display'
        );
        expect(uiDisplayCalls).toHaveLength(1); // Ensure no other UI messages

        // Other negative assertions remain valid
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:unlock_entity_attempt', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:entity_unlocked', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:item_consume_requested', expect.anything());
    });


    // --- TEST-104 Implementation ---
    it('[TEST-104] should fail to unlock the door when using the wrong key', async () => {
        // Arrange
        expect(doorLockableComponent.isLocked).toBe(true);
        const eventData = {
            userEntityId: PLAYER_ID,
            itemInstanceId: WRONG_KEY_INSTANCE_ID,
            itemDefinitionId: wrongKeyDefinition.id,
            explicitTargetEntityId: DOOR_ID,
            explicitTargetConnectionId: null
        };
        const wrongKeyName = wrongKeyDefinition.components.Name.value; // "Bent Key"
        const expectedFailureMsg = wrongKeyDefinition.components.Usable.target_conditions.find(
            cond => cond.property_path === 'Lockable.keyId'
        )?.failure_message || "This key doesn't seem to fit.";

        // ADDED: Configure mock resolver to return FAILURE and simulate dispatching the UI message
        mockItemTargetResolverService.resolveItemTarget.mockImplementation(async (args) => {
            // Simulate the real resolver dispatching the failure message on condition fail
            eventBus.dispatch('ui:message_display', {text: expectedFailureMsg, type: 'warning'});
            // Return the failure result structure
            return {
                success: false,
                target: null,
                targetType: 'none',
                messages: [{text: 'Target condition failed (mocked - wrong key)', type: 'internal'}]
            };
        });

        // Act
        await eventBus.dispatch('event:item_use_attempted', eventData);

        // Assert
        // Verify resolver was called
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledTimes(1);
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                userEntity: mockPlayer,
                usableComponentData: wrongKeyDefinition.components.Usable,
                explicitTargetEntityId: DOOR_ID,
                explicitTargetConnectionEntityId: null,
                itemName: wrongKeyName
            })
        );

        // 4a. Door remains locked
        expect(doorLockableComponent.isLocked).toBe(true);

        // 4b. Correct failure message dispatched (Simulated as dispatched by the mock resolver)
        expect(eventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: expectedFailureMsg, // "This key doesn't seem to fit."
            type: 'warning'
        });

        // 4c. ItemUsageSystem's general success message was NOT dispatched (because resolver failed)
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
            text: expect.stringContaining("You try the bent key"),
            type: 'info'
        }));

        // 4d/4e/4f. Unlock attempt/success events and consumption NOT dispatched (flow stopped early)
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:unlock_entity_attempt', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:entity_unlocked', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:item_consume_requested', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
            text: expect.stringMatching(/You unlock the/i), // LockSystem success message
        }));

        // Verify ONLY the expected failure message was displayed
        const allUiCalls = (eventBus.dispatch).mock.calls.filter(([eventName]) => eventName === 'ui:message_display');
        expect(allUiCalls).toHaveLength(1); // Should be just the one failure message dispatched by the mock impl
    });

    // --- TEST-105 Implementation ---
    it('[TEST-105] should fail gracefully when using the correct key on an already unlocked door', async () => {
        // Arrange
        const lockableComp = mockDoor.getComponent(LockableComponent);
        lockableComp.isLocked = false; // Set door to unlocked
        expect(lockableComp.isLocked).toBe(false);

        const eventData = {
            userEntityId: PLAYER_ID,
            itemInstanceId: RUSTY_KEY_INSTANCE_ID, // Correct key
            itemDefinitionId: rustyKeyDefinition.id,
            explicitTargetEntityId: DOOR_ID, // Target the unlocked door
            explicitTargetConnectionId: null
        };
        const keyName = rustyKeyDefinition.components.Name.value;
        const expectedFailureMsg = rustyKeyDefinition.components.Usable.target_conditions.find(
            cond => cond.property_path === 'Lockable.isLocked'
        )?.failure_message || "It's already unlocked.";

        // ADDED: Configure mock resolver to return FAILURE and simulate dispatching the UI message
        mockItemTargetResolverService.resolveItemTarget.mockImplementation(async (args) => {
            // Simulate the real resolver dispatching the failure message
            eventBus.dispatch('ui:message_display', {text: expectedFailureMsg, type: 'warning'});
            // Return the failure result structure
            return {
                success: false,
                target: null,
                targetType: 'none',
                messages: [{text: 'Target condition failed (mocked - already unlocked)', type: 'internal'}]
            };
        });

        // Act
        await eventBus.dispatch('event:item_use_attempted', eventData);

        // Assert
        // Verify resolver was called
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledTimes(1);
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                userEntity: mockPlayer,
                usableComponentData: rustyKeyDefinition.components.Usable,
                explicitTargetEntityId: DOOR_ID,
                explicitTargetConnectionEntityId: null,
                itemName: keyName
            })
        );

        // 4a. Door state remains unlocked
        expect(lockableComp.isLocked).toBe(false);

        // 4b. Correct failure message dispatched (Simulated via mock resolver)
        expect(eventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
            text: expectedFailureMsg, // "It's already unlocked."
            type: 'warning'
        });

        // 4c. ItemUsageSystem's success message NOT dispatched
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
            text: expect.stringContaining("You use the rusty key"),
            type: 'info'
        }));

        // 4d/4e/4f. Unlock attempt/success events and consumption NOT dispatched
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:unlock_entity_attempt', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:entity_unlocked', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('event:item_consume_requested', expect.anything());
        expect(eventBus.dispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
            text: expect.stringMatching(/You unlock the/i), // LockSystem success message
        }));

        // Verify ONLY the expected failure message was displayed
        const allUiCalls = (eventBus.dispatch).mock.calls.filter(([eventName]) => eventName === 'ui:message_display');
        expect(allUiCalls).toHaveLength(1); // Should be just the one failure message dispatched by mock impl
    });

});