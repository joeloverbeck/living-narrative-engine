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
            console.log(`[Test EventBus Dispatch] ${eventName}`, data); // Log dispatched events
        }),
        // Helper to manually trigger subscribed handlers
        triggerSubscribedHandlers: async (eventName, eventData) => { // Make async if handlers can be async
            if (subscriptions.has(eventName)) {
                // Use Promise.all if multiple handlers could be async and need to complete
                await Promise.all(Array.from(subscriptions.get(eventName)).map(async (handler) => {
                    try {
                        await handler(eventData); // Await the handler
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

// Mock Entity Class (reuse from your example or define)
class MockEntity {
    constructor(id, components = {}) {
        this.id = id;
        this._components = new Map();
        // Add initial components if provided
        for (const key in components) {
            // Assume key is Component Class or string name
            const componentInstance = components[key];
            this.addComponent(componentInstance, key);
        }
    }

    addComponent(componentInstance, componentKey = null) {
        const key = componentKey || componentInstance.constructor;
        this._components.set(key, componentInstance);
        // Add common access patterns (by name string)
        if (typeof key === 'function') this._components.set(key.name, componentInstance);
        if (typeof componentKey === 'string') this._components.set(componentKey, componentInstance);
    }

    getComponent(ComponentClassOrKey) {
        return this._components.get(ComponentClassOrKey) || this._components.get(ComponentClassOrKey?.name);
    }

    hasComponent(ComponentClassOrKey) {
        return this._components.has(ComponentClassOrKey) || this._components.has(ComponentClassOrKey?.name);
    }

    toString() {
        return `MockEntity[id=${this.id}]`;
    }
}

// --- Real Services (To Test Interaction) ---
import ConditionEvaluationService from '../../services/conditionEvaluationService.js'; // Assuming path
import {TargetResolutionService} from '../../services/targetResolutionService.js'; // Assuming path
import EffectExecutionService from '../../services/effectExecutionService.js'; // Assuming path

// --- Real Components (Needed by Services/System) ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {ItemComponent} from '../../components/itemComponent.js'; // Needed for Item Instance

// --- JSON Definitions (Simulate DataManager) ---
const playerDefinition = { /* Content from core:player.json */
    id: "core:player",
    components: { /* ... */} // Add relevant components like Name, Position, Inventory
};
const roomExitDefinition = { /* Content from demo:room_exit.json */
    id: "demo:room_exit",
    components: {
        Name: {value: "Exit"},
        Description: {text: "..."},
        Connections: {
            connections: [
                {direction: "south", connectionId: "demo:room_exit_south", target: "demo:room_treasure"},
                {
                    direction: "north",
                    target: "demo:room_outside",
                    description_override: "A heavy door. It's locked.",
                    type: "door",
                    connectionId: "demo:exit_north_door",
                    initial_state: "locked",
                    name: "heavy door"
                }
            ]
        }
    }
};
const itemKeyDefinition = { /* Content from demo:item_key.json */
    id: "demo:item_key",
    components: {
        Name: {value: "Iron Key"},
        Description: {text: "..."},
        Item: {tags: ["key", "iron"], stackable: false, value: 5},
        Usable: {
            usability_conditions: [{
                condition_type: "player_in_location",
                location_id: "demo:room_exit",
                failure_message: "..."
            }],
            target_required: true,
            target_conditions: [
                {
                    condition_type: "target_has_property",
                    property_path: "connectionId",
                    expected_value: "demo:exit_north_door",
                    failure_message: "..."
                },
                {
                    condition_type: "target_has_property",
                    property_path: "state",
                    expected_value: "locked",
                    failure_message: "..."
                }
            ],
            effects: [{
                type: "trigger_event",
                parameters: {
                    event_name: "event:connection_unlock_attempt",
                    payload: {connectionId: "demo:exit_north_door", keyId: "demo:item_key"}
                }
            }],
            consume_on_use: false, // Important!
            success_message: "You insert the iron key into the lock. You hear a click as the lock disengages.",
            failure_message_default: "..."
        }
    }
};

// --- Global Test Variables ---
let itemUsageSystem;
let mockEventBus;
let mockEntityManager;
let mockDataManager;
let mockEffectExecutionService; // Mock this one

let mockPlayer;
let mockRoomExit;
let mockKeyInstance; // The instance of the key the player holds
let roomConnectionsComp; // Direct reference for state checks

const PLAYER_ID = 'core:player';
const KEY_INSTANCE_ID = 'demo:item_key_instance_123'; // Unique ID for the key instance
const KEY_DEFINITION_ID = 'demo:item_key';
const ROOM_ID = 'demo:room_exit';
const TARGET_CONNECTION_ID = 'demo:exit_north_door';

// --- Test Setup ---
beforeEach(() => {
    jest.clearAllMocks();

    // --- 1. Create Mocks ---
    mockEventBus = createMockEventBus();
    mockEntityManager = {
        getEntityInstance: jest.fn(),
        // ***** ADD componentRegistry if needed by ConditionEvaluationService *****
        // Mock the component registry if #evaluateSingleCondition or #getObjectName uses it
        componentRegistry: new Map([
            ['Name', NameComponent], // Assuming NameComponent is imported
            ['Position', PositionComponent], // Assuming PositionComponent is imported
            ['Health', /* Import HealthComponent if used */],
            // Add other components used in conditions
        ]),
        // Add other methods if needed by services
    };
    mockDataManager = {
        getEntityDefinition: jest.fn(),
        // Add other methods if needed
    };
    mockEffectExecutionService = {
        executeEffects: jest.fn().mockResolvedValue({success: true, messages: [], stopPropagation: false}),
    };

    // --- 2. Instantiate Real Services (with mocked dependencies) ---
    // Pass the required entityManager dependency
    const conditionEvaluationService = new ConditionEvaluationService({entityManager: mockEntityManager}); // <--- *** FIX HERE ***

    // TargetResolutionService constructor doesn't take args, deps are passed to methods
    const targetResolutionService = new TargetResolutionService();

    // --- 3. Instantiate System Under Test ---
    itemUsageSystem = new ItemUsageSystem({
        eventBus: mockEventBus,
        entityManager: mockEntityManager,
        dataManager: mockDataManager,
        conditionEvaluationService, // Pass the real instance created above
        targetResolutionService,    // Pass the real instance created above
        effectExecutionService: mockEffectExecutionService,
    });

    // --- 4. Setup Mock Entities and Components ---
    // Player Entity
    mockPlayer = new MockEntity(PLAYER_ID);
    mockPlayer.addComponent(new NameComponent({value: "Player"}));
    mockPlayer.addComponent(new PositionComponent({locationId: ROOM_ID})); // Player is in the correct room
    mockPlayer.addComponent(new InventoryComponent({items: [KEY_INSTANCE_ID]})); // Player has the key instance

    // Key Instance Entity (representing the item in inventory)
    mockKeyInstance = new MockEntity(KEY_INSTANCE_ID);
    mockKeyInstance.addComponent(new NameComponent({value: "Iron Key"})); // Instance name for messages
    mockKeyInstance.addComponent(new ItemComponent({tags: ["key", "iron"]})); // Basic item data
    // No PositionComponent needed, or PositionComponent pointing to player inventory if your model uses that

    // Room Entity
    mockRoomExit = new MockEntity(ROOM_ID);
    mockRoomExit.addComponent(new NameComponent({value: "Exit"}));
    // Use the actual component instance to check state changes
    roomConnectionsComp = new ConnectionsComponent(roomExitDefinition.components.Connections);
    // Initialize state based on initial_state (constructor should handle this)
    expect(roomConnectionsComp.getConnectionState(TARGET_CONNECTION_ID)).toBe('locked'); // Verify initial state
    mockRoomExit.addComponent(roomConnectionsComp); // Add the component instance


    // --- 5. Configure Mock Manager Returns ---
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === PLAYER_ID) return mockPlayer;
        if (id === ROOM_ID) return mockRoomExit;
        if (id === KEY_INSTANCE_ID) return mockKeyInstance;
        console.warn(`[Test EntityManager] getEntityInstance requested unknown ID: ${id}`);
        return undefined;
    });

    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === KEY_DEFINITION_ID) return itemKeyDefinition;
        if (id === ROOM_ID) return roomExitDefinition;
        // Add player definition if needed by services
        // if (id === PLAYER_ID) return playerDefinition;
        console.warn(`[Test DataManager] getEntityDefinition requested unknown ID: ${id}`);
        return undefined;
    });
});

afterEach(() => {
    jest.restoreAllMocks();
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
            explicitTargetConnectionId: TARGET_CONNECTION_ID // Targeting the connection
        };

        // Spy on service methods to ensure they are called correctly (optional but helpful)
        const spyResolveTarget = jest.spyOn(TargetResolutionService.prototype, 'resolveItemTarget');
        const spyEvaluateConditions = jest.spyOn(ConditionEvaluationService.prototype, 'evaluateConditions');

        // --- Act ---
        // Trigger the event handler - MAKE SURE TO AWAIT if handler is async
        await mockEventBus.triggerSubscribedHandlers('event:item_use_attempted', eventPayload);

        // --- Assert ---

        // 1. Target Resolution: Verify TargetResolutionService was called and succeeded
        //    (We expect the real service to succeed given the setup)
        expect(spyResolveTarget).toHaveBeenCalledTimes(1);
        // Check call arguments (simplified check)
        expect(spyResolveTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                userEntity: mockPlayer,
                usableComponentData: itemKeyDefinition.components.Usable,
                explicitTargetConnectionId: TARGET_CONNECTION_ID,
                itemName: expect.any(String) // "Iron Key"
            }),
            expect.objectContaining({ // Dependencies passed correctly
                entityManager: mockEntityManager,
                eventBus: mockEventBus,
                conditionEvaluationService: expect.any(ConditionEvaluationService)
            })
        );
        // We infer success because no targeting failure message should be dispatched

        // 2. Usability Conditions: Verify ConditionEvaluationService was called for usability
        expect(spyEvaluateConditions).toHaveBeenCalledWith(
            mockPlayer, // Subject of usability check
            expect.objectContaining({ // Context
                userEntity: mockPlayer,
                targetEntityContext: null,
                targetConnectionContext: null
            }),
            itemKeyDefinition.components.Usable.usability_conditions, // The conditions array
            expect.objectContaining({checkType: 'Usability'}) // Options
        );
        // We infer success because no usability failure message should be dispatched

        // 3. Target Conditions: Verify ConditionEvaluationService was called for the target *connection*
        const expectedTargetConnection = roomConnectionsComp.getConnectionById(TARGET_CONNECTION_ID);
        expect(spyEvaluateConditions).toHaveBeenCalledWith(
            expectedTargetConnection, // Subject of target check is the *connection object*
            expect.objectContaining({ // Context now includes the connection
                userEntity: mockPlayer,
                targetEntityContext: null,
                targetConnectionContext: expectedTargetConnection // <<< Crucial
            }),
            itemKeyDefinition.components.Usable.target_conditions, // The target conditions array
            expect.objectContaining({checkType: 'Target'}) // Options
        );
        // We infer success because no target validation failure message should be dispatched

        // 4. Effect Execution: Verify EffectExecutionService was called
        expect(mockEffectExecutionService.executeEffects).toHaveBeenCalledTimes(1);
        expect(mockEffectExecutionService.executeEffects).toHaveBeenCalledWith(
            itemKeyDefinition.components.Usable.effects, // The effects array
            expect.objectContaining({ // Context for effects
                userEntity: mockPlayer,
                target: expectedTargetConnection, // Effects get the resolved connection target
                entityManager: mockEntityManager,
                eventBus: mockEventBus,
                dataManager: mockDataManager,
                usableComponentData: itemKeyDefinition.components.Usable,
                itemName: "Iron Key",
                itemInstanceId: KEY_INSTANCE_ID,
                itemDefinitionId: KEY_DEFINITION_ID
            })
        );

        // 5. Consumption: Verify item was NOT consumed
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_consume_requested', expect.anything());

        // 6. Success Message: Verify the success message was dispatched
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
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({type: 'warning'}) // No targeting/condition failure warnings
        );
        // Check specifically no item:use_condition_failed event
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('item:use_condition_failed', expect.anything());


        // --- Cleanup ---
        spyResolveTarget.mockRestore();
        spyEvaluateConditions.mockRestore();
    });

    // Add more tests for failure cases if needed:
    // - Player not in the correct location (usability fails)
    // - Targeting a different connection (target condition fails - connectionId mismatch)
    // - Targeting the correct connection but its state is already 'unlocked' (target condition fails - state mismatch)
    // - Item definition missing Usable component
    // - etc.

});