// src/tests/integration/itemUsageSystem.keyOnDoor.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';

// --- System Under Test ---
import ItemUsageSystem from '../../systems/itemUsageSystem.js';

// --- Mock Core Dependencies (Adapt path if needed) ---
// Manual Mock for EventBus
const createMockEventBus = () => {
    const subscriptions = new Map();
    return {
        subscribe: jest.fn((eventName, handler) => {
            if (!subscriptions.has(eventName)) {
                subscriptions.set(eventName, new Set());
            }
            subscriptions.get(eventName).add(handler);
        }),
        dispatch: jest.fn((eventName, data) => {
            // console.log(`[Test EventBus Dispatch] ${eventName}`, data); // Log dispatched events if needed
        }),
        // Helper to manually trigger subscribed handlers
        triggerSubscribedHandlers: async (eventName, eventData) => {
            if (subscriptions.has(eventName)) {
                await Promise.all(Array.from(subscriptions.get(eventName)).map(async (handler) => {
                    try {
                        await handler(eventData);
                    } catch (error) {
                        console.error(`[Test EventBus] Error in subscribed handler for ${eventName}:`, error);
                    }
                }));
            }
        },
        clearSubscriptions: () => subscriptions.clear(),
        getSubscriptions: () => subscriptions,
    };
};

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

    getComponent(ComponentClassOrKey) {
        if (typeof ComponentClassOrKey === 'function') {
            return this._components.get(ComponentClassOrKey); // Prioritize class constructor lookup
        } else if (typeof ComponentClassOrKey === 'string') {
            // Fallback to string key lookup (covers both class name string and explicit string key)
            return this._components.get(ComponentClassOrKey);
        }
        return undefined; // Return undefined if key is invalid type or not found
    }

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
        const nameComp = this.getComponent('Name') || this.getComponent(NameComponent);
        const name = nameComp?.value || 'Unknown Name';
        return `MockEntity[id=${this.id}, name="${name}"]`;
    }
}


// --- Real Services (Dependencies for ItemUsageSystem) ---
import ConditionEvaluationService from '../../services/conditionEvaluationService.js'; // Assuming path

// --- Mock Services ---
let mockEffectExecutionService; // Mock for EffectExecutionService
let mockItemTargetResolverService; // ADDED: Mock for the new ItemTargetResolverService

// --- Real Components (Needed by Services/System) ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';

// --- JSON Definitions (Simulate DataManager) ---
const playerDefinition = {
    id: "core:player",
    components: {
        Name: {value: "Player"},
        Position: {locationId: "demo:room_exit"},
        Inventory: {items: []} // Populated in setup
    }
};

const roomExitDefinition = {
    id: "demo:room_exit",
    components: {
        Name: {value: "Exit Room"},
        Description: {text: "A room with exits."},
        Connections: {
            // CORRECTED FORMAT: Object mapping direction -> connectionEntityId
            connections: {
                "south": "demo:room_exit_south", // Assuming this is the ID of the south connection entity
                "north": "demo:exit_north_door"  // This is the ID of the north door connection entity
            }
        }
        // Details like 'type', 'initial_state', 'name' for the north door
        // should be part of the definition for the "demo:exit_north_door" entity,
        // not directly inside the Room's Connections component data.
    }
};

// Definition for the connection entity itself (optional but good practice for clarity)
const northDoorConnectionDefinition = {
    id: "demo:exit_north_door",
    components: {
        Name: {value: "heavy door"},
        Description: {text: "A heavy door. It's locked."},
        // Assuming a component manages state for the connection entity itself
        State: {initialState: "locked", possibleStates: ["locked", "unlocked"]},
        ConnectionType: {type: "door"}, // Example component for type
        Target: {targetLocationId: "demo:room_outside"} // Example component for target
        // Add other relevant components for a Connection entity
    }
};

const itemKeyDefinition = {
    id: "demo:item_key",
    components: {
        Name: {value: "Iron Key"},
        Description: {text: "A simple iron key."},
        Item: {tags: ["key", "iron"], stackable: false, value: 5},
        Usable: {
            usability_conditions: [{
                condition_type: "player_in_location",
                location_id: "demo:room_exit",
                failure_message: "You can't use that here."
            }],
            target_required: true,
            target_conditions: [
                {
                    condition_type: "target_has_property",
                    property_path: "connectionId", // Check on the *resolved connection object*
                    expected_value: "demo:exit_north_door",
                    failure_message: "That key doesn't fit this."
                },
                {
                    condition_type: "target_has_property",
                    property_path: "state", // Check on the *resolved connection object*
                    expected_value: "locked",
                    failure_message: "It's already unlocked."
                }
                // NOTE: These target_conditions are now evaluated *inside* the (mocked) ItemTargetResolverService
            ],
            effects: [{
                type: "trigger_event", // Example effect
                parameters: {
                    eventName: "event:connection_unlock_attempt", // Example event (adjust if needed)
                    // Payload might reference the connection ID or the resolved target object properties
                    payload: {connectionId: "demo:exit_north_door", keyId: "demo:item_key"}
                }
            }],
            consume_on_use: false,
            success_message: "You insert the iron key into the lock. You hear a click as the lock disengages.",
            failure_message_default: "You can't use the key that way.",
            failure_message_target_required: "Use the key on what exit?",
            failure_message_invalid_target: "You can't use the key on that exit."
        }
    }
};

// --- Global Test Variables ---
let itemUsageSystem;
let mockEventBus;
let mockEntityManager;
let mockDataManager;
let conditionEvaluationService; // Real instance

let mockPlayer;
let mockRoomExit;
let mockKeyInstance; // The instance of the key the player holds
let roomConnectionsComp; // Direct reference to check mapping

// Constants
const PLAYER_ID = 'core:player';
const KEY_INSTANCE_ID = 'demo:item_key_instance_123';
const KEY_DEFINITION_ID = 'demo:item_key';
const ROOM_ID = 'demo:room_exit';
const TARGET_CONNECTION_ID = 'demo:exit_north_door'; // The ID of the connection entity

// --- Test Setup ---
beforeEach(() => {
    jest.clearAllMocks();

    // --- 1. Create Mocks ---
    mockEventBus = createMockEventBus();
    mockEntityManager = {
        getEntityInstance: jest.fn(),
        componentRegistry: new Map([
            ['Name', NameComponent],
            ['Position', PositionComponent],
            ['Connections', ConnectionsComponent],
            ['Inventory', InventoryComponent],
            ['Item', ItemComponent],
            // Add other components if CES needs them
        ]),
    };
    mockDataManager = {
        getEntityDefinition: jest.fn(),
    };
    mockEffectExecutionService = {
        executeEffects: jest.fn().mockResolvedValue({success: true, messages: [], stopPropagation: false}),
    };
    mockItemTargetResolverService = {
        resolveItemTarget: jest.fn() // Will be configured per test case
    };

    // --- 2. Instantiate Real Services (with mocked dependencies) ---
    conditionEvaluationService = new ConditionEvaluationService({entityManager: mockEntityManager});

    // --- 3. Instantiate System Under Test ---
    itemUsageSystem = new ItemUsageSystem({
        eventBus: mockEventBus,
        entityManager: mockEntityManager,
        dataManager: mockDataManager,
        conditionEvaluationService,
        itemTargetResolverService: mockItemTargetResolverService,
        effectExecutionService: mockEffectExecutionService,
    });

    // --- 4. Setup Mock Entities and Components ---
    // Player Entity
    mockPlayer = new MockEntity(PLAYER_ID);
    mockPlayer.addComponent(new NameComponent(playerDefinition.components.Name));
    mockPlayer.addComponent(new PositionComponent(playerDefinition.components.Position));
    mockPlayer.addComponent(new InventoryComponent({items: [KEY_INSTANCE_ID]})); // Player has the key instance

    // Key Instance Entity
    mockKeyInstance = new MockEntity(KEY_INSTANCE_ID);
    mockKeyInstance.addComponent(new NameComponent(itemKeyDefinition.components.Name));
    mockKeyInstance.addComponent(new ItemComponent(itemKeyDefinition.components.Item));

    // Room Entity
    mockRoomExit = new MockEntity(ROOM_ID);
    mockRoomExit.addComponent(new NameComponent(roomExitDefinition.components.Name));
    // Instantiate ConnectionsComponent with the CORRECTED definition
    roomConnectionsComp = new ConnectionsComponent(roomExitDefinition.components.Connections);
    mockRoomExit.addComponent(roomConnectionsComp);

    // VERIFY the mapping exists in the component, but DON'T get state from it
    expect(roomConnectionsComp.getConnectionByDirection('north')).toBe(TARGET_CONNECTION_ID);
    // REMOVED: These lines assumed ConnectionsComponent held state/details, which it doesn't.
    // const northDoor = roomConnectionsComp.getConnectionById(TARGET_CONNECTION_ID); // <-- Method doesn't exist
    // if (northDoor && northDoor.initial_state === 'locked') { ... } // <-- Logic belongs elsewhere (Connection Entity/Resolver)
    // expect(roomConnectionsComp.getConnectionState(TARGET_CONNECTION_ID)).toBe('locked'); // <-- Method doesn't exist

    // --- 5. Configure Mock Manager Returns ---
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === PLAYER_ID) return mockPlayer;
        if (id === ROOM_ID) return mockRoomExit;
        if (id === KEY_INSTANCE_ID) return mockKeyInstance;
        // You might need to mock the Connection Entity if services need it directly
        // if (id === TARGET_CONNECTION_ID) {
        //    // Return a mock representation of the connection entity if needed
        //    const mockConnectionEntity = new MockEntity(TARGET_CONNECTION_ID);
        //    // Add relevant components based on northDoorConnectionDefinition
        //    mockConnectionEntity.addComponent(new NameComponent(northDoorConnectionDefinition.components.Name));
        //    // ... add StateComponent, etc.
        //    return mockConnectionEntity;
        // }
        console.warn(`[Test EntityManager] getEntityInstance requested unknown ID: ${id}`);
        return undefined;
    });

    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === KEY_DEFINITION_ID) return itemKeyDefinition;
        if (id === ROOM_ID) return roomExitDefinition;
        // Provide the definition if needed by services (e.g., ItemTargetResolverService might read it)
        if (id === TARGET_CONNECTION_ID) return northDoorConnectionDefinition;
        console.warn(`[Test DataManager] getEntityDefinition requested unknown ID: ${id}`);
        return undefined;
    });
});

// Teardown
afterEach(() => {
    jest.restoreAllMocks();
    mockItemTargetResolverService = null;
});

// --- Test Suite ---
describe('ItemUsageSystem Integration Test: Use Key on Locked Door Connection', () => {

    it('should successfully process using the key on the locked door connection when conditions are met', async () => {
        // --- Arrange ---
        const eventPayload = {
            userEntityId: PLAYER_ID,
            itemInstanceId: KEY_INSTANCE_ID,
            itemDefinitionId: KEY_DEFINITION_ID,
            explicitTargetEntityId: null, // No entity target
            explicitTargetConnectionId: TARGET_CONNECTION_ID // Pass the Connection Entity ID
        };
        const keyName = itemKeyDefinition.components.Name.value; // "Iron Key"

        // --- Configure Mocks ---
        // Manually define the object that represents the resolved *connection details*.
        // This is what ItemUsageSystem / EffectExecutionService expect to receive as the 'target'.
        // Use the details originally present in your (incorrect) test data array structure.
        const expectedResolvedConnectionObject = {
            connectionId: TARGET_CONNECTION_ID, // Should match the constant
            direction: 'north', // Direction might be useful context
            target: 'demo:room_outside', // Target location ID
            description_override: "A heavy door. It's locked.", // Description detail
            type: 'door', // Type detail
            state: 'locked', // Crucially, define the *expected state* for the test conditions
            name: 'heavy door' // Name detail
            // Add any other properties expected by EffectExecutionService or message templating
        };
        // Sanity check
        expect(expectedResolvedConnectionObject.connectionId).toBe(TARGET_CONNECTION_ID);
        expect(expectedResolvedConnectionObject.state).toBe('locked'); // Make sure it matches target_conditions

        // Configure mock resolver to return success with the manually defined connection object
        mockItemTargetResolverService.resolveItemTarget.mockResolvedValue({
            success: true,
            target: expectedResolvedConnectionObject, // Return the manually defined object
            targetType: 'connection', // Ensure this type matches system expectations
            messages: []
        });
        // mockEffectExecutionService already configured in beforeEach for general success

        // --- Spies ---
        const spyEvaluateConditions = jest.spyOn(ConditionEvaluationService.prototype, 'evaluateConditions');

        // --- Act ---
        // Trigger the event handler via the mock EventBus helper
        await mockEventBus.triggerSubscribedHandlers('event:item_use_attempted', eventPayload);

        // --- Assert ---

        // 1. Target Resolution: Verify mockItemTargetResolverService was called correctly
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledTimes(1);
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                userEntity: mockPlayer,
                usableComponentData: itemKeyDefinition.components.Usable,
                explicitTargetEntityId: null,
                // Check the correct Connection Entity ID was passed from the payload
                explicitTargetConnectionEntityId: TARGET_CONNECTION_ID,
                itemName: keyName
            })
            // Note: Don't check the second argument if ItemUsageSystem no longer passes dependencies here
        );

        // 2. Usability Conditions: Verify ConditionEvaluationService was called for usability
        // (Called by ItemUsageSystem *before* the target resolver)
        expect(spyEvaluateConditions).toHaveBeenCalledWith(
            mockPlayer, // Subject of usability check
            expect.objectContaining({ // Context
                userEntity: mockPlayer,
                targetEntityContext: null,
                targetConnectionContext: null // Correct context for usability check
            }),
            itemKeyDefinition.components.Usable.usability_conditions, // The conditions array
            expect.objectContaining({checkType: 'Usability'}) // Options
        );

        // 3. Target Conditions: Now internal to the resolver, so we don't check CES call for them here.

        // 4. Effect Execution: Verify mockEffectExecutionService was called with correct context
        expect(mockEffectExecutionService.executeEffects).toHaveBeenCalledTimes(1);
        expect(mockEffectExecutionService.executeEffects).toHaveBeenCalledWith(
            itemKeyDefinition.components.Usable.effects, // The effects array
            expect.objectContaining({ // Context for effects
                userEntity: mockPlayer,
                // Check target matches the *manually defined object* returned by the mocked resolver
                target: expectedResolvedConnectionObject,
                entityManager: mockEntityManager,
                eventBus: mockEventBus,
                dataManager: mockDataManager,
                usableComponentData: itemKeyDefinition.components.Usable,
                itemName: keyName,
                itemInstanceId: KEY_INSTANCE_ID,
                itemDefinitionId: KEY_DEFINITION_ID
            })
        );

        // 5. Consumption: Verify item was NOT consumed (consume_on_use: false)
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_consume_requested', expect.anything());

        // 6. Success Message: Verify the success message was dispatched by ItemUsageSystem
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({
                // Match the success message from the item definition
                text: itemKeyDefinition.components.Usable.success_message,
                type: 'info'
            })
        );

        // 7. Negative Assertions: Ensure no failure messages were dispatched
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({type: 'error'}) // No generic errors
        );
        // Allow success message, but check no warnings from ItemUsageSystem itself
        const warningCalls = mockEventBus.dispatch.mock.calls.filter(call => call[0] === 'ui:message_display' && call[1].type === 'warning');
        expect(warningCalls.length).toBe(0); // Expect no warning UI messages

        // Check specifically no item:use_condition_failed event (usability check passed)
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('item:use_condition_failed', expect.anything());


        // --- Cleanup ---
        spyEvaluateConditions.mockRestore();
    });

    // Add more tests for failure cases if needed:
    // - Usability condition fails (e.g., player not in location) -> resolver not called
    // - Mock resolver returns success: false -> effect execution not called, failure message expected
    // - Mock resolver returns success: true, but target state is 'unlocked' (target condition fails internally) -> effect exec not called, specific failure message expected
    // - etc.

});