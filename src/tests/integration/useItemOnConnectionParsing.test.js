// src/test/integration/useItemOnConnectionParsing.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';

// --- Mock Core Dependencies FIRST ---
// Mock DataManager (similar to useItemUnlockDoor.test.js)
jest.mock('../../../dataManager.js', () => {
    return jest.fn().mockImplementation(() => ({
        getEntityDefinition: jest.fn(),
        getAction: jest.fn(),
        // ... other methods if needed by dependencies ...
    }));
});

// Mock Entity Class (using standard pattern)
jest.mock('../../entities/entity.js', () => {
    return class MockEntity {
        constructor(id) {
            this.id = id;
            this._components = new Map();
        }

        addComponent(componentInstance, componentKey = null) {
            const key = componentKey || componentInstance.constructor;
            this._components.set(key, componentInstance);
            if (typeof key === 'function') this._components.set(key.name, componentInstance);
            if (typeof componentKey === 'string') this._components.set(componentKey, componentInstance);
            if (typeof componentInstance.setEntity === 'function') componentInstance.setEntity(this);
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

// --- Import Dependencies AFTER Mocks ---
import MockEntity from '../../entities/entity.js'; // Mocked Entity
import DataManager from '../../../dataManager.js'; // Mocked DataManager constructor

// --- System/Functions Under Test ---
import {executeUse} from '../../actions/handlers/useActionHandler.js';

// --- Services & Utilities Used by SUT ---
// Import REAL services/utils - they will use mocked managers/entities provided in context
import {resolveTargetEntity, resolveTargetConnection} from '../../services/targetResolutionService.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';

// --- Components Used ---
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';
// UsableComponent is not strictly needed for *parsing* test, but ItemComponent might be required by resolveTargetEntity
// import {UsableComponent} from '../../components/usableComponent.js';

// --- Mock Factory Functions ---
const mockGetEntityManager = () => ({
    createEntityInstance: jest.fn(),
    getEntityInstance: jest.fn(),
    registerComponent: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()), // Needed by resolveTargetConnection indirectly
    // No need to mock get/hasComponent if MockEntity provides them
});

const mockGetEventBus = () => {
    const subscribers = new Map();
    return {
        dispatch: jest.fn((eventName, data) => {
            console.log(`[Test EventBus Dispatch] ${eventName}`, data);
        }),
        subscribe: jest.fn((eventName, handler) => {
            // Basic subscription mock, no need to store handlers for this test
        }),
        // No need for _trigger in this parsing test
    };
};

// --- Global Test Variables ---
let mockDataManager;
let mockEntityManager;
let mockEventBus;

let mockPlayer;
let mockKey;
let mockRoomExit; // The location entity

let playerInventoryComp;
let playerPositionComp;
let roomConnectionsComp;

// --- Test Setup ---
beforeEach(() => {
    jest.clearAllMocks();

    // --- 1. Create Core Mocks ---
    // We need a mock constructor *instance* for DataManager
    mockDataManager = new DataManager(); // This calls the mock constructor
    mockEntityManager = mockGetEntityManager();
    mockEventBus = mockGetEventBus();

    // --- 2. Instantiate Mock Entities ---
    mockPlayer = new MockEntity('player:test');
    // Use the exact IDs from the problem description
    mockKey = new MockEntity('demo:item_key');
    mockRoomExit = new MockEntity('demo:room_exit');

    // --- 3. Instantiate Components (Based on provided JSON) ---
    playerPositionComp = new PositionComponent({locationId: mockRoomExit.id});
    playerInventoryComp = new InventoryComponent({items: [mockKey.id]}); // Player holds the key
    const playerNameComp = new NameComponent({value: "Test Player"});

    // Key Components
    const keyNameComp = new NameComponent({value: "Iron Key"}); // Crucial for name resolution
    const keyItemComp = new ItemComponent({
        tags: ["key", "iron"], // Include tags if resolveTargetEntity uses definition data
        stackable: false,
        value: 5
        // We don't need the full Usable definition here, just ItemComponent
    });
    // Position component for the key (initially in treasure room, but player has it now)
    const keyPositionComp = new PositionComponent({locationId: mockPlayer.id}); // Indicate it's held

    // Room Components
    const roomNameComp = new NameComponent({value: "Exit"});
    roomConnectionsComp = new ConnectionsComponent({
        connections: [
            {
                direction: "south",
                connectionId: "demo:room_exit_south",
                target: "demo:room_treasure"
            },
            {
                direction: "north", // The target connection
                target: "demo:room_outside",
                description_override: "A heavy door. It's locked.",
                type: "door",
                connectionId: "demo:exit_north_door", // The ID we expect in the event
                initial_state: "locked",
                name: "heavy door" // Add a name for connection resolution testing
            }
        ]
    });

    // --- 4. Assemble Mock Entities ---
    mockPlayer.addComponent(playerPositionComp, PositionComponent);
    mockPlayer.addComponent(playerInventoryComp, InventoryComponent);
    mockPlayer.addComponent(playerNameComp, NameComponent);
    mockPlayer.addComponent(playerPositionComp, 'Position');
    mockPlayer.addComponent(playerInventoryComp, 'Inventory');
    mockPlayer.addComponent(playerNameComp, 'Name');

    mockKey.addComponent(keyNameComp, NameComponent);
    mockKey.addComponent(keyItemComp, ItemComponent);
    mockKey.addComponent(keyPositionComp, PositionComponent); // Key needs position (in inventory)
    mockKey.addComponent(keyNameComp, 'Name');
    mockKey.addComponent(keyItemComp, 'Item');
    mockKey.addComponent(keyPositionComp, 'Position');

    mockRoomExit.addComponent(roomNameComp, NameComponent);
    mockRoomExit.addComponent(roomConnectionsComp, ConnectionsComponent);
    mockRoomExit.addComponent(roomNameComp, 'Name');
    mockRoomExit.addComponent(roomConnectionsComp, 'Connections');


    // --- 5. Set up Mock EntityManager Behavior ---
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockPlayer.id) return mockPlayer;
        if (id === mockKey.id) return mockKey;
        if (id === mockRoomExit.id) return mockRoomExit;
        // Add other rooms if needed by connection resolution during tests
        if (id === 'demo:room_treasure') return new MockEntity('demo:room_treasure');
        if (id === 'demo:room_outside') return new MockEntity('demo:room_outside');
        return undefined;
    });
    // Simulate finding entities in the location (needed by resolveTargetConnection -> findTarget)
    // For this test, the key is *in inventory*, not the location.
    mockEntityManager.getEntitiesInLocation.mockImplementation((locationId) => {
        if (locationId === mockRoomExit.id) {
            // Only player is in the room for this test setup. Key is in inventory.
            return new Set([mockPlayer.id]);
        }
        if (locationId === mockPlayer.id) { // Inventory scope check might use this
            return new Set([mockKey.id]);
        }
        return new Set();
    });

    // --- 6. Set up Mock DataManager Behavior ---
    // Crucial: Provide definition for the key, as executeUse needs itemDefinitionId
    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === mockKey.id || id === 'demo:item_key') { // Match ID
            return {
                id: 'demo:item_key', // The canonical definition ID
                components: {
                    Name: {value: "Iron Key"}, // From keyNameComp
                    Item: {tags: ["key", "iron"], stackable: false, value: 5}, // From keyItemComp
                    // Usable definition not needed for parsing test itself, but good practice
                    // Usable: { target_required: true, ... }
                }
            };
        }
        if (id === mockRoomExit.id) {
            return {
                id: mockRoomExit.id,
                components: {Name: {value: "Exit"}, Connections: {connections: roomConnectionsComp.connections}}
            };
        }
        if (id === mockPlayer.id) {
            return {
                id: mockPlayer.id,
                components: {
                    Name: {value: "Test Player"},
                    Position: {locationId: mockRoomExit.id},
                    Inventory: {items: [mockKey.id]}
                }
            };
        }
        return null; // Default: not found
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

// --- Test Suite ---
describe('Integration Test: Use Action Parsing with Connection Target', () => {

    // --- Test Cases ---
    // Parameterize the test to cover different command variations
    it.each([
        // Command String           Expected Item Name   Expected Target Input
        ["use iron > north", "iron", "north"],
        ["use iron on north", "iron", "north"],
        ["use iron key on north", "iron key", "north"],
        ["use iron key > north", "iron key", "north"],
        ["use key > north", "key", "north"],
        ["use key on north", "key", "north"],
        // Variations targeting the door by name instead of direction
        ["use iron key on heavy door", "iron key", "heavy door"],
        ["use iron > heavy door", "iron", "heavy door"],
        ["use key on door", "key", "door"], // Partial name match
    ])('should correctly parse command "%s" and dispatch event:item_use_attempted',
        (commandString, expectedItemInput, expectedTargetInput) => {

            // 1. Simulate Command Parser Output (targets array)
            // Simple split, assuming parser handles removing the 'use' verb.
            // More robust parsing might handle quotes, but this is sufficient for the examples.
            const commandParts = commandString.split(' ').slice(1); // Remove 'use'
            const targets = commandParts; // e.g., ['iron', '>', 'north']

            // 2. Prepare Action Context
            /** @type {import('../../actions/actionTypes.js').ActionContext} */
            const context = {
                playerEntity: mockPlayer,
                currentLocation: mockRoomExit, // Provide the mock room entity
                targets: targets,
                entityManager: mockEntityManager,
                dataManager: mockDataManager, // Provide the mock DataManager instance
                dispatch: mockEventBus.dispatch, // Use the mock dispatch
                eventBus: mockEventBus,         // Provide the mock EventBus instance
            };

            // 3. Execute the Action Handler
            const actionResult = executeUse(context);

            // 4. Assert Handler Success (parsing succeeded)
            expect(actionResult.success).toBe(true);
            // Optional: Check internal messages if needed for debugging
            // console.log("Action Messages:", actionResult.messages);

            // 5. Assert Event Dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1); // Should only dispatch the attempt event

            // Check the 'event:item_use_attempted' dispatch call
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:item_use_attempted', // Event Name
                expect.objectContaining({ // Payload Structure
                    userEntityId: mockPlayer.id,
                    itemInstanceId: mockKey.id, // The instance ID of the key in inventory
                    itemDefinitionId: 'demo:item_key', // The canonical definition ID from DataManager
                    explicitTargetEntityId: null, // Should be null when targeting a connection
                    explicitTargetConnectionId: 'demo:exit_north_door' // The ID of the resolved connection
                })
            );

            // Optional: Check for UI messages ONLY if parsing FAILED (should not happen here)
            // expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('ui:message_display', expect.any(Object));
        });

    it('should fail parsing if the specific item is not in inventory (but inventory is not empty)', () => {
        // --- Setup Modification: Inventory has SOMETHING, but not the key ---
        const mockOtherItem = new MockEntity('item:useless_rock');
        mockOtherItem.addComponent(new NameComponent({value: "Useless Rock"}));
        mockOtherItem.addComponent(new ItemComponent({}));
        mockOtherItem.addComponent(new PositionComponent({locationId: mockPlayer.id})); // In inventory
        mockEntityManager.getEntityInstance.mockImplementation((id) => { // Override mock for this test
            if (id === mockPlayer.id) return mockPlayer;
            // if (id === mockKey.id) return mockKey; // <<< DON'T return the key
            if (id === mockOtherItem.id) return mockOtherItem; // Return the rock
            if (id === mockRoomExit.id) return mockRoomExit;
            return undefined;
        });
        // Setup inventory with ONLY the rock
        playerInventoryComp.items = [mockOtherItem.id];

        // 1. Simulate Command Parser Output (trying to use the key)
        const targets = ['iron', 'key', 'on', 'north'];

        // 2. Prepare Context (using modified inventory)
        const context = { /* ... */
            playerEntity: mockPlayer, currentLocation: mockRoomExit, targets,
            entityManager: mockEntityManager, dataManager: mockDataManager,
            dispatch: mockEventBus.dispatch, eventBus: mockEventBus,
        };

        // 3. Execute Handler
        const actionResult = executeUse(context);

        // 4. Assert Failure
        expect(actionResult.success).toBe(false);
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_use_attempted', expect.any(Object));
        // NOW expect the specific item not found message
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
            text: expect.stringMatching(/don't have .*'iron key'/i), // Match TARGET_MESSAGES.NOT_FOUND_INVENTORY
            type: 'info'
        }));
    });

    it('should fail parsing if the target connection does not exist', () => {
        // 1. Simulate Command Parser Output for a non-existent direction
        const targets = ['iron', 'key', 'on', 'east']; // Assuming no 'east' connection

        // 2. Prepare Context
        const context = { /* ... same context as above ... */
            playerEntity: mockPlayer, currentLocation: mockRoomExit, targets,
            entityManager: mockEntityManager, dataManager: mockDataManager,
            dispatch: mockEventBus.dispatch, eventBus: mockEventBus,
        };

        // 3. Execute Handler
        const actionResult = executeUse(context);

        // 4. Assert Failure
        expect(actionResult.success).toBe(false);
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_use_attempted', expect.any(Object));
        // Expect a UI message indicating the target wasn't found
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
            text: expect.stringMatching(/don't see .*/i), // Match TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT
            type: 'info'
        }));
    });

    it('should fail parsing if the item name is ambiguous', () => {
        // --- Setup Modification: Add another 'key' item ---
        const mockAnotherKey = new MockEntity('item:brass_key');
        mockAnotherKey.addComponent(new NameComponent({value: "Brass Key"}));
        mockAnotherKey.addComponent(new ItemComponent({}));
        mockAnotherKey.addComponent(new PositionComponent({locationId: mockPlayer.id}));
        mockEntityManager.getEntityInstance.mockImplementation((id) => { // Override mock specifically for this test
            if (id === mockPlayer.id) return mockPlayer;
            if (id === mockKey.id) return mockKey; // Iron Key
            if (id === mockAnotherKey.id) return mockAnotherKey; // Brass Key
            if (id === mockRoomExit.id) return mockRoomExit;
            return undefined;
        });
        playerInventoryComp.addItem(mockAnotherKey.id); // Add second key

        // 1. Simulate Command Parser Output using ambiguous "key"
        const targets = ['key', 'on', 'north'];

        // 2. Prepare Context
        const context = { /* ... same context as above ... */
            playerEntity: mockPlayer, currentLocation: mockRoomExit, targets,
            entityManager: mockEntityManager, dataManager: mockDataManager,
            dispatch: mockEventBus.dispatch, eventBus: mockEventBus,
        };

        // 3. Execute Handler
        const actionResult = executeUse(context);

        // 4. Assert Failure
        expect(actionResult.success).toBe(false);
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:item_use_attempted', expect.any(Object));
        // Expect a UI message indicating ambiguity
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', expect.objectContaining({
            text: expect.stringMatching(/Which key do you want/i), // Match TARGET_MESSAGES.AMBIGUOUS_PROMPT or similar
            type: 'warning'
        }));
    });


}); // End describe block