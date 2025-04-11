// src/test/integration/useItemUnlockDoor.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';

// --- Mock Core Dependencies FIRST ---

// Mock DataManager to prevent its constructor (and AJV download) from running.
// We provide a mock constructor that returns an object with jest.fn() for methods.
jest.mock('../../../dataManager.js', () => {
    return jest.fn().mockImplementation(() => {
        // This function simulates the DataManager constructor
        // It returns an object that simulates a DataManager instance
        console.log('[Mock DataManager] Mock constructor called.'); // Add log for verification
        return {
            // Define mock methods expected on a DataManager instance
            getEntityDefinition: jest.fn(),
            getAction: jest.fn(),
            getTrigger: jest.fn(),
            getAllTriggers: jest.fn(() => []),
            getQuestDefinition: jest.fn(),
            getObjectiveDefinition: jest.fn(),
            // Add a mock for any async initialization if the real one has it
            // e.g., if DataManager had an async init method:
            // initialize: jest.fn().mockResolvedValue(undefined),
            // Ensure all methods used by the systems under test are mocked
        };
    });
});

// --- Mock Entity Class ---
// Using the pattern from playerMovement.test.js
jest.mock('../../entities/entity.js', () => {
    return class MockEntity {
        constructor(id) {
            this.id = id;
            this._components = new Map();
        }

        addComponent(componentInstance, componentKey = null) {
            const key = componentKey || componentInstance.constructor;
            this._components.set(key, componentInstance);
            // Allow string key lookup for convenience if needed by services/systems
            if (typeof key === 'function') {
                this._components.set(key.name, componentInstance);
            }
            // Add simple string key support if needed
            if (typeof componentKey === 'string') {
                this._components.set(componentKey, componentInstance);
            }
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
    };
});

// Import the mocked Entity AFTER the jest.mock call
// --- Import Dependencies AFTER Mocks ---
// Now, when DataManager is imported, it will be the mock constructor defined above.
import DataManager from '../../../dataManager.js';
import EntityManager from '../../entities/entityManager.js'; // Assuming this doesn't need mocking itself
import EventBus from '../../../eventBus.js'; // Assuming this doesn't need mocking itself

// Import the mocked Entity AFTER the jest.mock call for Entity
import MockEntity from '../../entities/entity.js'; // This will be MockEntity

// --- Services to Instantiate (with Mocks) ---
import ConditionEvaluationService from '../../services/conditionEvaluationService.js';
import {TargetResolutionService} from '../../services/targetResolutionService.js';
import EffectExecutionService from '../../services/effectExecutionService.js';

// --- Systems Under Test ---
import ItemUsageSystem from '../../systems/itemUsageSystem.js';
import DoorSystem from '../../systems/doorSystem.js';

// --- Components Used ---
// ... (keep all your component imports) ...
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {UsableComponent} from '../../components/usableComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';

// --- Mock Factory Functions ---
const mockGetDataManager = () => ({
    getEntityDefinition: jest.fn(),
    getAction: jest.fn(),
    getTrigger: jest.fn(),
    getAllTriggers: jest.fn(() => []),
    getQuestDefinition: jest.fn(),
    getObjectiveDefinition: jest.fn(),
    // Add other methods if needed by services
});

const mockGetEntityManager = () => ({
    createEntityInstance: jest.fn(),
    getEntityInstance: jest.fn(),
    registerComponent: jest.fn(),
    notifyPositionChange: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()), // Default to empty set
    buildInitialSpatialIndex: jest.fn(),
    clearAll: jest.fn(),
    // --- Methods needed for services/systems ---
    // Mock get/hasComponent directly on the mock EntityManager if services expect it
    // OR rely on MockEntity's implementation (preferred). Ensure MockEntity has getComponent/hasComponent.
    // Example (if needed, but rely on MockEntity first):
    // getComponent: jest.fn((entityId, componentClass) => mockEntityManager.getEntityInstance(entityId)?.getComponent(componentClass)),
    // hasComponent: jest.fn((entityId, componentClass) => mockEntityManager.getEntityInstance(entityId)?.hasComponent(componentClass)),
    componentRegistry: new Map() // Add this to allow registerComponent to actually store mappings if needed for ConditionEval lookup
});

const mockGetEventBus = () => {
    const subscribers = new Map(); // eventName -> Set<handler>
    return {
        dispatch: jest.fn((eventName, data) => {
            console.log(`[Test EventBus Dispatch] ${eventName}`, data); // Log dispatched events
        }),
        subscribe: jest.fn((eventName, handler) => {
            if (!subscribers.has(eventName)) {
                subscribers.set(eventName, new Set());
            }
            subscribers.get(eventName).add(handler);
            // console.log(`[Test EventBus Subscribe] Handler added for ${eventName}`);
        }),
        unsubscribe: jest.fn((eventName, handler) => {
            if (subscribers.has(eventName)) {
                subscribers.get(eventName).delete(handler);
            }
        }),
        // Manual trigger for testing
        _trigger: (eventName, payload) => {
            let handled = false;
            if (subscribers.has(eventName)) {
                // Iterate over a copy in case handler unsubscribes during loop
                const handlersToCall = new Set(subscribers.get(eventName));
                handlersToCall.forEach(handler => {
                    try {
                        handler(payload);
                        handled = true;
                    } catch (error) {
                        console.error(`[Test EventBus Trigger] Error in handler for ${eventName}:`, error);
                        // Rethrow or handle as needed for test failure
                        throw error;
                    }
                });
            }
            // console.log(`[Test EventBus Trigger] ${eventName} triggered. Handled: ${handled}`);
            return handled; // Indicate if any handler was called
        },
        _getSubscribers: () => subscribers, // Helper for debugging tests
    };
};


// --- Global Test Variables ---
let mockDataManager;
let mockEntityManager;
let mockEventBus;

let conditionEvaluationServiceInstance;
let targetResolutionServiceInstance;
let effectExecutionServiceInstance;

let itemUsageSystemInstance;
let doorSystemInstance;

// Variables to hold the mock entities and key components based on AC
let mockPlayer; // AC 1
let mockKey;    // AC 2
let mockRoom;   // AC 3

let playerInventoryComp; // Related to AC 6, 7
let playerPositionComp;  // Related to AC 8
let keyUsableComp;       // Related to AC 10
let roomConnectionsComp; // Related to AC 9

// --- Test Setup ---
beforeEach(() => {
    // Reset mocks and spies for each test
    jest.clearAllMocks(); // Clear mock function call history

    // --- 1. Create Core Mocks ---
    mockDataManager = mockGetDataManager();
    mockEntityManager = mockGetEntityManager();
    mockEventBus = mockGetEventBus();

    // --- 2. Instantiate Mock Entities ---
    mockPlayer = new MockEntity('player:test');
    mockKey = new MockEntity('item:key_rusty');
    mockRoom = new MockEntity('location:locked_room');

    // --- 3. Instantiate Components ---
    playerPositionComp = new PositionComponent({locationId: mockRoom.id});
    playerInventoryComp = new InventoryComponent({items: [mockKey.id]});
    const playerNameComp = new NameComponent({value: "Test Player"});
    const keyNameComp = new NameComponent({value: "Rusty Key"});
    const keyItemComp = new ItemComponent({});
    keyUsableComp = new UsableComponent({ // Keep the detailed config from before
        target_required: true,
        consume_on_use: false, // Set to false to simplify testing the dispatch without worrying about consumption logic here
        effects: [
            {
                effect_type: "trigger_event",
                effect_params: {
                    event_name: "event:connection_unlock_attempt",
                    // Use actual interpolation keys expected by the real handler
                    connection_id: "{target.connectionId}",
                    location_id: "{user.Position.locationId}",
                    user_id: "{user.id}",
                    key_id: "{item.id}" // Assuming item.id refers to itemDefinitionId or instanceId based on context needs
                }
            }
        ],
        target_conditions: [
            {condition_type: "connection_state_is", state: "locked", failure_message: "It's already unlocked."},
            {
                condition_type: "target_has_property",
                property_path: "connectionId",
                expected_value: "door:north_exit",
                failure_message: "This key doesn't fit this lock."
            }
        ],
        usability_conditions: [], // No usability conditions for simplicity in this test focus
        success_message: "You use the {item} on the {target}.",
        failure_message_default: "You can't use the {item} on that."
    });
    const roomNameComp = new NameComponent({value: "Locked Room"});
    roomConnectionsComp = new ConnectionsComponent({ // Keep the detailed config from before
        connections: [
            {
                connectionId: "door:north_exit",
                direction: "north",
                target: "location:hallway",
                name: "sturdy oak door",
                initial_state: "locked"
            },
            {
                connectionId: "door:south_entrance",
                direction: "south",
                target: "location:outside",
                initial_state: "unlocked"
            }
        ]
    });

    // --- 4. Assemble Mock Entities ---
    mockPlayer.addComponent(playerPositionComp, PositionComponent);
    mockPlayer.addComponent(playerInventoryComp, InventoryComponent);
    mockPlayer.addComponent(playerNameComp, NameComponent);
    mockPlayer.addComponent(playerPositionComp, 'Position'); // Add string aliases
    mockPlayer.addComponent(playerInventoryComp, 'Inventory');
    mockPlayer.addComponent(playerNameComp, 'Name');

    mockKey.addComponent(keyNameComp, NameComponent);
    mockKey.addComponent(keyItemComp, ItemComponent);
    mockKey.addComponent(keyUsableComp, UsableComponent);
    mockKey.addComponent(keyNameComp, 'Name'); // Add string aliases
    mockKey.addComponent(keyItemComp, 'Item');
    mockKey.addComponent(keyUsableComp, 'Usable');

    mockRoom.addComponent(roomNameComp, NameComponent);
    mockRoom.addComponent(roomConnectionsComp, ConnectionsComponent);
    mockRoom.addComponent(roomNameComp, 'Name'); // Add string aliases
    mockRoom.addComponent(roomConnectionsComp, 'Connections');


    // --- 5. Set up Mock EntityManager Behavior ---
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockPlayer.id) return mockPlayer;
        if (id === mockKey.id) return mockKey;
        if (id === mockRoom.id) return mockRoom;
        return undefined;
    });
    mockEntityManager.createEntityInstance.mockImplementation((id) => mockEntityManager.getEntityInstance(id));

    // --- 6. Set up Mock DataManager Behavior ---
    // Use the actual component instances/data from setup
    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === mockPlayer.id) return {
            id: mockPlayer.id,
            components: {
                Name: {value: playerNameComp.value},
                Position: {locationId: playerPositionComp.locationId},
                Inventory: {items: playerInventoryComp.items}
            }
        };
        if (id === mockKey.id) return {
            id: mockKey.id,
            components: {Name: {value: keyNameComp.value}, Item: {}, Usable: keyUsableComp}
        }; // Return the usable component *config*
        if (id === mockRoom.id) return {
            id: mockRoom.id,
            components: {Name: {value: roomNameComp.value}, Connections: {connections: roomConnectionsComp.connections}}
        };
        return null;
    });

    // --- 7. Instantiate Services (using real services for this integration slice) ---
    // We spy on methods of the *real* services
    conditionEvaluationServiceInstance = new ConditionEvaluationService({entityManager: mockEntityManager});
    targetResolutionServiceInstance = new TargetResolutionService(); // No deps needed here
    // Instantiate the *real* EffectExecutionService - it needs to call the real handlers
    effectExecutionServiceInstance = new EffectExecutionService(); // Assumes handlers are registered internally

    // --- 8. Instantiate Systems ---
    itemUsageSystemInstance = new ItemUsageSystem({
        eventBus: mockEventBus,
        entityManager: mockEntityManager,
        dataManager: mockDataManager, // Use mock
        // Pass REAL services for ItemUsageSystem to orchestrate
        conditionEvaluationService: conditionEvaluationServiceInstance,
        targetResolutionService: targetResolutionServiceInstance,
        effectExecutionService: effectExecutionServiceInstance
    });

    // DoorSystem needed only for the broader test, not strictly for Ticket 4 focus
    // doorSystemInstance = new DoorSystem({
    //     eventBus: mockEventBus,
    //     entityManager: mockEntityManager
    // });

    // --- 9. Initialize Systems ---
    // ItemUsageSystem subscribes in constructor, no explicit init needed for subscription
    // doorSystemInstance?.initialize(); // Initialize only if needed for other tests

    // --- 10. Register Components with Mock EntityManager ---
    // Important for ConditionEvaluationService lookups
    mockEntityManager.registerComponent('Name', NameComponent);
    mockEntityManager.registerComponent('Description', DescriptionComponent);
    mockEntityManager.registerComponent('Position', PositionComponent);
    mockEntityManager.registerComponent('Item', ItemComponent);
    mockEntityManager.registerComponent('Usable', UsableComponent);
    mockEntityManager.registerComponent('Connections', ConnectionsComponent);
    mockEntityManager.registerComponent('Inventory', InventoryComponent);
    // Populate registry map
    mockEntityManager.componentRegistry.set('Name', NameComponent);
    mockEntityManager.componentRegistry.set('Position', PositionComponent);
    mockEntityManager.componentRegistry.set('Item', ItemComponent);
    mockEntityManager.componentRegistry.set('Usable', UsableComponent);
    mockEntityManager.componentRegistry.set('Connections', ConnectionsComponent);
    mockEntityManager.componentRegistry.set('Inventory', InventoryComponent);

});

// Clean up spies after each test
afterEach(() => {
    jest.restoreAllMocks();
});


// --- Test Suite ---
describe('Integration Test: Use Item to Unlock Door', () => {

    // Test confirming basic setup works
    it('should complete the beforeEach setup without errors and establish initial state', () => {
        expect(mockPlayer).toBeDefined();
        expect(mockKey).toBeDefined();
        expect(mockRoom).toBeDefined();
        expect(mockPlayer.getComponent(InventoryComponent).hasItem(mockKey.id)).toBe(true);
        expect(mockPlayer.getComponent(PositionComponent).locationId).toBe(mockRoom.id);
        expect(mockRoom.getComponent(ConnectionsComponent).getConnectionState('door:north_exit')).toBe('locked');
        expect(mockKey.hasComponent(UsableComponent)).toBe(true);
        expect(mockEntityManager.getEntityInstance(mockPlayer.id)).toBe(mockPlayer);
        expect(mockDataManager.getEntityDefinition(mockKey.id)).toBeDefined();
        expect(itemUsageSystemInstance).toBeDefined();
        // Check that ItemUsageSystem subscribed
        expect(mockEventBus.subscribe).toHaveBeenCalledWith('event:item_use_attempted', expect.any(Function));
    });

    // --- Test Case for Refined Ticket 4 ---
    it('should process item_use_attempted, evaluate conditions, execute effect, and dispatch connection_unlock_attempt', async () => {
        // AC 1: Test description is clear.

        // --- Test Constants ---
        const PLAYER_ID = mockPlayer.id;
        const KEY_INSTANCE_ID = mockKey.id; // Assuming instance ID = definition ID in this mock setup
        const KEY_DEFINITION_ID = mockKey.id;
        const ROOM_ID = mockRoom.id;
        const TARGET_CONNECTION_ID = 'door:north_exit';
        const TARGET_CONNECTION_OBJECT = roomConnectionsComp.getConnectionById(TARGET_CONNECTION_ID); // Get the actual connection object

        // AC 2: Prepare Payload
        const itemUseAttemptPayload = {
            userEntityId: PLAYER_ID,
            itemInstanceId: KEY_INSTANCE_ID,
            itemDefinitionId: KEY_DEFINITION_ID,
            explicitTargetEntityId: null,
            explicitTargetConnectionId: TARGET_CONNECTION_ID
        };

        // --- Setup Spies BEFORE Action ---
        // We spy on the *real* services passed to ItemUsageSystem
        const conditionSpy = jest.spyOn(conditionEvaluationServiceInstance, 'evaluateConditions');
        const effectSpy = jest.spyOn(effectExecutionServiceInstance, 'executeEffects');
        // No mock implementation needed here if we trust the real EffectExecutionService
        // calls the real handlers which use the mock eventBus from the context.

        // AC 3: Invoke Handler
        // Find the handler ItemUsageSystem registered
        const itemUsageHandlerCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'event:item_use_attempted');
        expect(itemUsageHandlerCall).toBeDefined();
        const itemUsageHandler = itemUsageHandlerCall[1];

        // Trigger the system logic by calling the handler directly
        await itemUsageHandler(itemUseAttemptPayload); // Use await as the handler is async

        // AC 4: Assert Condition Evaluation Service Calls
        expect(conditionSpy).toHaveBeenCalledTimes(2);

        // 4a: Usability Check (No conditions defined in this setup, but service still called)
        expect(conditionSpy).toHaveBeenNthCalledWith(
            1,
            mockPlayer, // objectToCheck = userEntity
            expect.objectContaining({userEntity: mockPlayer, targetEntityContext: null, targetConnectionContext: null}), // context
            keyUsableComp.usability_conditions, // conditions array (empty in this test)
            expect.objectContaining({checkType: 'Usability'}) // options
        );

        // 4b: Target Check
        expect(conditionSpy).toHaveBeenNthCalledWith(
            2,
            TARGET_CONNECTION_OBJECT, // objectToCheck = the actual connection object resolved by TargetResolutionService
            expect.objectContaining({
                userEntity: mockPlayer,
                targetEntityContext: null,
                targetConnectionContext: TARGET_CONNECTION_OBJECT
            }), // context (TargetResolutionService provides targetConnectionContext)
            keyUsableComp.target_conditions, // conditions array
            expect.objectContaining({checkType: 'Target'}) // options
        );
        // Note: We assume the real ConditionEvaluationService returned success based on the setup.
        // If we needed to force success/failure, we'd add `.mockReturnValue({ success: true, messages: [] })` to the spy setup.

        // AC 5: Assert Effect Execution Service Call
        expect(effectSpy).toHaveBeenCalledTimes(1);
        expect(effectSpy).toHaveBeenCalledWith(
            keyUsableComp.effects, // The array of effect objects from the Usable component config
            expect.objectContaining({ // The context object
                userEntity: mockPlayer,
                target: TARGET_CONNECTION_OBJECT, // The resolved target connection
                entityManager: mockEntityManager,
                eventBus: mockEventBus, // Crucially, the *mock* event bus
                dataManager: mockDataManager,
                usableComponentData: keyUsableComp, // The component config data
                itemName: "Rusty Key", // Resolved item name
                itemInstanceId: KEY_INSTANCE_ID,
                itemDefinitionId: KEY_DEFINITION_ID
            })
        );
        // Note: We assume the real EffectExecutionService processed the 'trigger_event'
        // and called the real handleTriggerEventEffect, which *should* use the context.eventBus.

        // AC 6: Assert EventBus Dispatch for 'event:connection_unlock_attempt'
        // This assertion implicitly verifies that EffectExecutionService -> handleTriggerEventEffect -> context.eventBus.dispatch worked correctly.
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:connection_unlock_attempt', // Event Name
            expect.objectContaining({ // Payload
                connectionId: TARGET_CONNECTION_ID, // Interpolated from {target.connectionId}
                locationId: ROOM_ID,                 // Interpolated from {user.Position.locationId}
                userId: PLAYER_ID,                   // Interpolated from {user.id}
                keyId: KEY_DEFINITION_ID             // Interpolated from {item.id} - assuming it resolves to definition ID here
            })
        );

        // AC 7: (Optional) Assert EventBus Dispatch for 'ui:message_display' (Success Message)
        const expectedSuccessMessage = `You use the Rusty Key on the sturdy oak door.`; // Manually construct expected message
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({
                text: expectedSuccessMessage,
                type: 'info'
            })
        );

        // --- Test Scope Verification ---
        // Explicitly check that the connection state *was not changed* directly in this test's scope
        // (because we didn't trigger the DoorSystem handler)
        expect(roomConnectionsComp.getConnectionState(TARGET_CONNECTION_ID)).toBe('locked');
    });


    // --- Keep the original broader integration test (optional, or move/refactor) ---
    // This test now overlaps significantly with the Ticket 4 test, but verifies the DoorSystem interaction too.
    it('[Original Test - Broader Scope] should unlock the locked door when the player uses the correct key on it and DoorSystem handles the event', async () => {
        // This test verifies the *entire* flow including DoorSystem processing the event.
        const targetConnectionId = "door:north_exit";
        expect(roomConnectionsComp.getConnectionState(targetConnectionId)).toBe('locked');

        const itemUseAttemptPayload = {
            userEntityId: mockPlayer.id, itemInstanceId: mockKey.id, itemDefinitionId: mockKey.id,
            explicitTargetEntityId: null, explicitTargetConnectionId: targetConnectionId
        };

        // --- Trigger ItemUsageSystem ---
        const itemUsageHandlerCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'event:item_use_attempted');
        const itemUsageHandler = itemUsageHandlerCall[1];
        await itemUsageHandler(itemUseAttemptPayload); // Use await

        // --- Verify ItemUsageSystem dispatched unlock event (checked again for clarity) ---
        const unlockAttemptDispatch = mockEventBus.dispatch.mock.calls.find(call => call[0] === 'event:connection_unlock_attempt');
        expect(unlockAttemptDispatch).toBeDefined();
        const unlockAttemptPayload = unlockAttemptDispatch[1];
        expect(unlockAttemptPayload).toEqual(expect.objectContaining({
            connectionId: targetConnectionId, locationId: mockRoom.id, userId: mockPlayer.id, keyId: mockKey.id
        }));

        // --- Manually trigger DoorSystem handler (Simulating EventBus delivery) ---
        // Re-instantiate DoorSystem here as it wasn't in the standard beforeEach for Ticket 4 focus
        doorSystemInstance = new DoorSystem({
            eventBus: mockEventBus, // Use the same mock bus
            entityManager: mockEntityManager
        });
        doorSystemInstance.initialize(); // Ensure it subscribes

        // Find DoorSystem's handler for the unlock event
        const doorUnlockHandlerCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'event:connection_unlock_attempt');
        expect(doorUnlockHandlerCall).toBeDefined();
        const doorUnlockHandler = doorUnlockHandlerCall[1];

        // Directly call the DoorSystem handler with the payload dispatched by ItemUsageSystem
        doorUnlockHandler(unlockAttemptPayload); // Simulate event handling

        // --- Assert FINAL state ---
        expect(roomConnectionsComp.getConnectionState(targetConnectionId)).toBe('unlocked');

        // Check success message dispatch again (optional here, already covered)
        const keyName = mockKey.getComponent(NameComponent).value;
        const targetName = roomConnectionsComp.getConnectionById(targetConnectionId).name;
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({text: `You use the ${keyName} on the ${targetName}.`}));

        // Check DoorSystem's success message dispatch
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({text: `The ${targetName} clicks open.`})); // Assuming DoorSystem sends this
    });

}); // End describe block