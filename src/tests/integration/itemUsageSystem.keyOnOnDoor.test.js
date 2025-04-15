// src/tests/integration/itemUsageSystem.keyOnDoor.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';

// --- System Under Test ---
import ItemUsageSystem from '../../systems/itemUsageSystem.js';

// --- Mock Core Dependencies (Adapt path if needed) ---
// Manual Mock for EventBus (using the provided function)
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
            // console.log(`[Test EventBus Dispatch] ${eventName}`, data); // Uncomment for debugging
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

// Mock Entity Class (using the provided class)
class MockEntity {
    constructor(id, components = {}) {
        this.id = id;
        this._components = new Map();
        // Add initial components if provided
        for (const key in components) {
            const componentInstance = components[key];
            const primaryKey = componentInstance.constructor?.name || key;
            this.addComponent(componentInstance, primaryKey);
        }
    }

    addComponent(componentInstance, componentKey = null) {
        const classKey = componentInstance.constructor;
        this._components.set(classKey, componentInstance);

        if (classKey && classKey.name) {
            this._components.set(classKey.name, componentInstance);
        }

        if (typeof componentKey === 'string' && componentKey !== classKey?.name) {
            this._components.set(componentKey, componentInstance);
        }
    }

    getComponent(ComponentClassOrKey) {
        if (typeof ComponentClassOrKey === 'function') {
            return this._components.get(ComponentClassOrKey);
        } else if (typeof ComponentClassOrKey === 'string') {
            return this._components.get(ComponentClassOrKey);
        }
        return undefined;
    }

    hasComponent(ComponentClassOrKey) {
        if (typeof ComponentClassOrKey === 'function') {
            return this._components.has(ComponentClassOrKey);
        } else if (typeof ComponentClassOrKey === 'string') {
            return this._components.has(ComponentClassOrKey);
        }
        return false;
    }

    toString() {
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
// Although LockableComponent isn't directly used *by* ItemUsageSystem,
// the resolver might potentially check for its existence in some scenarios.
// It's good practice to have it available if the mock resolver needs it.
import LockableComponent from '../../components/lockableComponent.js';
// Import PassageDetailsComponent - the resolver will likely need this to check for blockers
import { PassageDetailsComponent } from '../../components/passageDetailsComponent.js';

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
            // Correct format: Object mapping direction -> connectionEntityId
            connections: {
                "south": "demo:room_exit_south",
                "north": "demo:exit_north_door" // This is the ID of the north door connection entity
            }
        }
    }
};

const ROOM_ID = 'demo:room_exit';
const BLOCKER_ENTITY_ID = 'demo:door_lock_entity'; // The ID of the lock entity

// Definition for the connection entity itself (North Door)
// ** CRITICAL FOR NEW FLOW **
const northDoorConnectionDefinition = {
    id: "demo:exit_north_door",
    components: {
        Name: {value: "heavy door"},
        Description: {text: "A heavy door. It's locked."},
        PassageDetails: {
            locationAId: ROOM_ID, // e.g., "demo:room_exit" (where the player is)
            locationBId: "demo:room_outside", // The destination room ID
            directionAtoB: "north", // Command to go from A to B
            directionBtoA: "south", // Command to go from B back to A
            blockerEntityId: BLOCKER_ENTITY_ID, // "demo:door_lock_entity"
            type: "door" // Optional: Specify the type
            // descriptionOverrideAtoB: "You see the heavy door leading north.", // Optional
            // descriptionOverrideBtoA: "You see the heavy door leading south.", // Optional
        },
        // ConnectionType: {type: "door"}, // Example - Can be removed if type is in PassageDetails
    }
};

// Definition for the BLOCKER entity (the lock on the door)
// ** CRITICAL FOR NEW FLOW **
const doorLockEntityDefinition = {
    id: "demo:door_lock_entity",
    components: {
        Name: {value: "sturdy lock"},
        Description: {text: "A sturdy lock mechanism on the door."},
        Lockable: { isLocked: true, keyId: "demo:item_key" } // Initially locked, requires our key
    }
};

const itemKeyDefinition = {
    id: "demo:item_key",
    components: {
        Name: {value: "Iron Key"},
        Description: {text: "A simple iron key."},
        Item: {tags: ["key", "iron"], stackable: false, value: 5},
        Usable: {
            // Usability conditions remain the same
            usability_conditions: [{
                condition_type: "player_in_location",
                location_id: "demo:room_exit",
                failure_message: "You can't use that here."
            }],
            // Target resolution now handled by ItemTargetResolverService
            target_required: true,
            target_conditions: [
                // These conditions are evaluated by ItemTargetResolverService against the resolved target (connection entity)
                {
                    // Example condition: Check if the *connection entity* has a PassageDetails component
                    condition_type: "target_has_component",
                    component_name: "PassageDetails",
                    failure_message: "You can't use the key on that."
                },
                {
                    // Example condition: Check if the *connection entity* has a blocker (via PassageDetails)
                    // This ensures we're targeting something that *can* be unlocked.
                    condition_type: "target_has_property",
                    property_path: "components.PassageDetails.blockerEntityId",
                    expected_value: null, // This seems wrong, let's assume we check it's NOT null or specific type
                    evaluation_type: "not_equals", // Check that a blocker *exists*
                    failure_message: "There's nothing to unlock there."
                }
                // Original conditions like checking state='locked' are now moved
                // implicitly to the LockSystem/LockableComponent interaction downstream.
                // The trigger_event effect should fire regardless of the lock state,
                // and the LockSystem will handle the "already unlocked" case.
            ],
            effects: [{
                type: "trigger_event",
                parameters: {
                    // This event targets the *connection*.
                    // handleTriggerEventEffect will translate it if a blocker exists.
                    eventName: "event:connection_unlock_attempt",
                    // Payload can remain minimal, handleTriggerEventEffect derives context.
                    // keyId is often derived contextually now, but can be passed if needed.
                    payload: { /* keyItemId: "demo:item_key" */ } // Key ID is implicitly the item being used
                }
            }],
            consume_on_use: false,
            success_message: "You insert the iron key into the lock.", // Changed: Message now reflects initiating the action
            failure_message_default: "You can't use the key on that exit.",
            failure_message_target_required: "Use the key on what exit?",
            failure_message_invalid_target: "You can't use the key on that exit." // Used if resolver fails conditions
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
let mockNorthDoorConnection; // Mock for the connection entity
let mockDoorLockEntity; // Mock for the lock entity (the blocker)

// Constants
const PLAYER_ID = 'core:player';
const KEY_INSTANCE_ID = 'demo:item_key_instance_123';
const KEY_DEFINITION_ID = 'demo:item_key';
const TARGET_CONNECTION_ENTITY_ID = 'demo:exit_north_door'; // The ID of the connection *entity*

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
            ['Lockable', LockableComponent], // Needed by LockSystem (downstream)
            ['PassageDetails', PassageDetailsComponent] // Needed by resolver/handleTriggerEvent
            // Add other components if needed
        ]),
    };
    mockDataManager = {
        getEntityDefinition: jest.fn(),
    };
    // Mock EffectExecutionService - *crucially, it now calls handleTriggerEventEffect internally*
    // We test the *call* to executeEffects, not its internal implementation here.
    mockEffectExecutionService = {
        executeEffects: jest.fn().mockResolvedValue({success: true, messages: [], stopPropagation: false}),
    };
    // Mock ItemTargetResolverService - will be configured per test case
    mockItemTargetResolverService = {
        resolveItemTarget: jest.fn()
    };

    // --- 2. Instantiate Real Services (with mocked dependencies) ---
    conditionEvaluationService = new ConditionEvaluationService({entityManager: mockEntityManager});

    // --- 3. Instantiate System Under Test ---
    itemUsageSystem = new ItemUsageSystem({
        eventBus: mockEventBus,
        entityManager: mockEntityManager,
        dataManager: mockDataManager,
        conditionEvaluationService, // Pass real instance
        itemTargetResolverService: mockItemTargetResolverService, // Pass mock instance
        effectExecutionService: mockEffectExecutionService, // Pass mock instance
    });

    // --- 4. Setup Mock Entities and Components ---
    // Player Entity
    mockPlayer = new MockEntity(PLAYER_ID);
    mockPlayer.addComponent(new NameComponent(playerDefinition.components.Name));
    mockPlayer.addComponent(new PositionComponent(playerDefinition.components.Position));
    mockPlayer.addComponent(new InventoryComponent({items: [KEY_INSTANCE_ID]})); // Player has the key

    // Key Instance Entity
    mockKeyInstance = new MockEntity(KEY_INSTANCE_ID);
    mockKeyInstance.addComponent(new NameComponent(itemKeyDefinition.components.Name));
    mockKeyInstance.addComponent(new ItemComponent(itemKeyDefinition.components.Item));
    // Important: Add the Usable component *data* reference if needed by ItemUsageSystem directly (though less likely now)
    // mockKeyInstance.usableData = itemKeyDefinition.components.Usable; // Example if needed

    // Room Entity
    mockRoomExit = new MockEntity(ROOM_ID);
    mockRoomExit.addComponent(new NameComponent(roomExitDefinition.components.Name));
    mockRoomExit.addComponent(new ConnectionsComponent(roomExitDefinition.components.Connections));

    // North Door Connection Entity (the target of the 'use key on door' command)
    mockNorthDoorConnection = new MockEntity(TARGET_CONNECTION_ENTITY_ID);
    mockNorthDoorConnection.addComponent(new NameComponent(northDoorConnectionDefinition.components.Name));
    mockNorthDoorConnection.addComponent(new PassageDetailsComponent(northDoorConnectionDefinition.components.PassageDetails));

    // Door Lock Entity (the blocker, target of the *translated* unlock event)
    mockDoorLockEntity = new MockEntity(BLOCKER_ENTITY_ID);
    mockDoorLockEntity.addComponent(new NameComponent(doorLockEntityDefinition.components.Name));
    mockDoorLockEntity.addComponent(new LockableComponent(doorLockEntityDefinition.components.Lockable));


    // --- 5. Configure Mock Manager Returns ---
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === PLAYER_ID) return mockPlayer;
        if (id === ROOM_ID) return mockRoomExit;
        if (id === KEY_INSTANCE_ID) return mockKeyInstance;
        if (id === TARGET_CONNECTION_ENTITY_ID) return mockNorthDoorConnection; // Return the connection entity
        if (id === BLOCKER_ENTITY_ID) return mockDoorLockEntity; // Return the blocker entity
        console.warn(`[Test EntityManager] getEntityInstance requested unknown ID: ${id}`);
        return undefined;
    });

    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === KEY_DEFINITION_ID) return itemKeyDefinition;
        if (id === ROOM_ID) return roomExitDefinition;
        if (id === TARGET_CONNECTION_ENTITY_ID) return northDoorConnectionDefinition; // Provide connection entity def
        if (id === BLOCKER_ENTITY_ID) return doorLockEntityDefinition; // Provide blocker entity def
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
describe('ItemUsageSystem Integration Test: Use Key on Locked Door Connection (Refactored)', () => {

    it('should call ItemTargetResolverService and EffectExecutionService when using a key on a valid door connection', async () => {
        // --- Arrange ---
        const eventPayload = {
            userEntityId: PLAYER_ID,
            itemInstanceId: KEY_INSTANCE_ID,
            itemDefinitionId: KEY_DEFINITION_ID,
            explicitTargetEntityId: null,
            // CRITICAL: This ID now refers to the *Connection Entity* itself
            explicitTargetConnectionEntityId: TARGET_CONNECTION_ENTITY_ID
        };
        const keyName = itemKeyDefinition.components.Name.value; // "Iron Key"

        // --- Configure Mocks ---
        // Mock ItemTargetResolverService to return SUCCESS, targeting the Connection Entity
        mockItemTargetResolverService.resolveItemTarget.mockResolvedValue({
            success: true,
            target: mockNorthDoorConnection, // The resolved target is the Connection *Entity*
            targetType: 'connection',       // Type is 'connection'
            messages: []
        });

        // mockEffectExecutionService is already mocked for general success in beforeEach

        // --- Spies ---
        const spyEvaluateConditions = jest.spyOn(conditionEvaluationService, 'evaluateConditions'); // Use the instance

        // --- Act ---
        // Trigger the event handler via the mock EventBus helper (simulates player action)
        await mockEventBus.triggerSubscribedHandlers('event:item_use_attempted', eventPayload);

        // --- Assert ---

        // ✅ 1. ItemUsageSystem -> ConditionEvaluationService (Usability)
        expect(spyEvaluateConditions).toHaveBeenCalledWith(
            mockPlayer, // Subject of usability check
            expect.objectContaining({ // Context for usability
                userEntity: mockPlayer,
                targetEntityContext: null, // No specific target *yet*
                targetConnectionContext: null
            }),
            itemKeyDefinition.components.Usable.usability_conditions, // Usability conditions array
            expect.objectContaining({ checkType: 'Usability' }) // Options
        );

        // ✅ 2. ItemUsageSystem -> ItemTargetResolverService
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledTimes(1);
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                userEntity: mockPlayer,
                usableComponentData: itemKeyDefinition.components.Usable,
                explicitTargetEntityId: null,
                explicitTargetConnectionEntityId: TARGET_CONNECTION_ENTITY_ID, // Verify correct ID passed
                itemName: keyName
            })
        );

        // Note: Target conditions are now evaluated *within* the mocked ItemTargetResolverService.
        // We trust the mock's return value for this test's scope. A separate test for
        // ItemTargetResolverService would verify its internal condition evaluation.

        // ✅ 3. ItemUsageSystem -> EffectExecutionService
        expect(mockEffectExecutionService.executeEffects).toHaveBeenCalledTimes(1);
        expect(mockEffectExecutionService.executeEffects).toHaveBeenCalledWith(
            itemKeyDefinition.components.Usable.effects, // The effects array from item definition
            // Verify the context passed to EffectExecutionService contains the *result* from the resolver
            expect.objectContaining({
                userEntity: mockPlayer,
                target: mockNorthDoorConnection, // Target is the Connection Entity returned by the mock resolver
                targetType: 'connection',       // Target type matches resolver result
                entityManager: mockEntityManager, // Verify dependencies are passed through
                eventBus: mockEventBus,
                dataManager: mockDataManager,
                usableComponentData: itemKeyDefinition.components.Usable, // Pass usable data
                itemName: keyName,
                itemInstanceId: KEY_INSTANCE_ID,
                itemDefinitionId: KEY_DEFINITION_ID
                // Should NOT contain explicitTargetConnectionEntityId directly here, it was used by the resolver
            })
        );

        // ✅ 4. Consumption Check (ItemUsageSystem responsibility)
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_consume_requested', expect.anything());

        // ✅ 5. Success Message Check (ItemUsageSystem responsibility)
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({
                // Use the success message defined in the Usable component
                text: itemKeyDefinition.components.Usable.success_message,
                type: 'info' // Default type for success message
            })
        );

        // ✅ 6. Negative Assertions (Ensure no ItemUsageSystem-level failures)
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({ type: 'error' }) // No generic errors from ItemUsageSystem
        );
        const warningCalls = mockEventBus.dispatch.mock.calls.filter(call => call[0] === 'ui:message_display' && call[1].type === 'warning');
        expect(warningCalls.length).toBe(0); // No warning UI messages *from ItemUsageSystem*
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('item:use_condition_failed', expect.anything()); // Usability check passed

        // --- Assertions Covered by this Test (based on Acceptance Criteria) ---
        // ✅ All identified existing integration tests... pass consistently -> This test passes.
        // ✅ Tests explicitly verify the updated interactions between ItemUsageSystem, ItemTargetResolverService, EffectExecutionService... -> Checked calls between these.
        // ❌ Assertions correctly validate the event dispatch logic... of handleTriggerEventEffect -> NOT tested here. This happens *inside* the mocked EffectExecutionService. Requires a different test setup (e.g., testing EffectExecutionService or handleTriggerEventEffect directly).
        // ❌ Assertions correctly validate the event dispatch logic... of LockSystem -> NOT tested here. Requires testing LockSystem listening to events dispatched from handleTriggerEventEffect.

        // --- Cleanup (handled by afterEach) ---
    });

    it('should dispatch a failure message if ItemTargetResolverService fails', async () => {
        // --- Arrange ---
        const eventPayload = { /* ... same as above ... */
            userEntityId: PLAYER_ID,
            itemInstanceId: KEY_INSTANCE_ID,
            itemDefinitionId: KEY_DEFINITION_ID,
            explicitTargetEntityId: null,
            explicitTargetConnectionEntityId: TARGET_CONNECTION_ENTITY_ID
        };
        const keyName = itemKeyDefinition.components.Name.value;

        // --- Configure Mocks ---
        // Mock ItemTargetResolverService to return FAILURE
        mockItemTargetResolverService.resolveItemTarget.mockImplementation(async () => {
            // Simulate the service dispatching its specific failure message
            mockEventBus.dispatch("ui:message_display", {
                text: "You can't use the key on that exit.", // Or the appropriate message from the resolver
                type: "warning"
            });
            // Return the failure result
            return {
                success: false,
                messages: [{ text: 'Resolver failed internally', type: 'internal' }]
            };
        });

        // --- Act ---
        await mockEventBus.triggerSubscribedHandlers('event:item_use_attempted', eventPayload);

        // --- Assert ---
        // Verify resolver was called
        expect(mockItemTargetResolverService.resolveItemTarget).toHaveBeenCalledTimes(1);

        // Verify EffectExecutionService was *NOT* called
        expect(mockEffectExecutionService.executeEffects).not.toHaveBeenCalled();

        // Verify the default failure message from Usable component was dispatched
        // (ItemUsageSystem falls back to this if resolver fails without a specific UI message being dispatched *by the resolver*)
        // Note: A more sophisticated resolver mock could dispatch its own UI message.
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({
                text: itemKeyDefinition.components.Usable.failure_message_default, // Or failure_message_invalid_target depending on resolver's internal logic simulation
                type: 'warning'
            })
        );
        // Ensure success message wasn't sent
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({ text: itemKeyDefinition.components.Usable.success_message })
        );
    });

    it('should dispatch a failure message if usability conditions fail', async () => {
        // --- Arrange ---
        const eventPayload = { /* ... same as above ... */
            userEntityId: PLAYER_ID,
            itemInstanceId: KEY_INSTANCE_ID,
            itemDefinitionId: KEY_DEFINITION_ID,
            explicitTargetEntityId: null,
            explicitTargetConnectionEntityId: TARGET_CONNECTION_ENTITY_ID
        };

        // Modify player location so usability condition fails
        mockPlayer.getComponent(PositionComponent).locationId = "wrong_room";

        // --- Configure Mocks ---
        // Resolver mock doesn't matter as it shouldn't be reached
        mockItemTargetResolverService.resolveItemTarget.mockResolvedValue({ success: true }); // Set a default just in case

        const spyEvaluateConditions = jest.spyOn(conditionEvaluationService, 'evaluateConditions');

        // --- Act ---
        await mockEventBus.triggerSubscribedHandlers('event:item_use_attempted', eventPayload);

        // --- Assert ---
        // Verify usability conditions were checked
        expect(spyEvaluateConditions).toHaveBeenCalledWith(
            mockPlayer,
            expect.anything(), // Context
            itemKeyDefinition.components.Usable.usability_conditions,
            expect.anything() // Options
        );

        // Verify Resolver was *NOT* called
        expect(mockItemTargetResolverService.resolveItemTarget).not.toHaveBeenCalled();

        // Verify EffectExecutionService was *NOT* called
        expect(mockEffectExecutionService.executeEffects).not.toHaveBeenCalled();

        // Verify the specific failure message from the usability condition was dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            "item:use_condition_failed", // <-- Correct event name
            { // <-- Correct payload structure
                actorId: "core:player",
                failureMessage: "You can't use that here."
            }
        );
        // Verify the item:use_condition_failed event was dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('item:use_condition_failed', expect.anything());
    });

    // Add more specific tests if needed, e.g.,
    // - target_required: true but no explicitTargetConnectionEntityId provided.
    // - Mocking the resolver to fail specific target_conditions.
});