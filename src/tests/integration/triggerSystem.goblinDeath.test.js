// src/tests/integration/triggerSystem.goblinDeath.test.js


import {beforeEach, describe, expect, it, jest} from "@jest/globals";

import TriggerSystem from '../../systems/triggerSystem.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';

// --- Mocks ---
// Manual Mock for EventBus with handler storage and manual trigger
const createMockEventBus = () => {
    const subscriptions = new Map(); // eventName -> Set<handler>
    return {
        subscribe: jest.fn((eventName, handler) => {
            if (!subscriptions.has(eventName)) {
                subscriptions.set(eventName, new Set());
            }
            subscriptions.get(eventName).add(handler);
            // console.log(`[MockEventBus] Subscribed handler to ${eventName}`);
        }),
        dispatch: jest.fn((eventName, data) => {
            // console.log(`[MockEventBus] Dispatched ${eventName}:`, data);
        }),
        // Helper to manually trigger subscribed handlers for testing
        triggerSubscribedHandlers: (eventName, eventData) => {
            // console.log(`[MockEventBus] Manually triggering handlers for ${eventName}`, eventData);
            if (subscriptions.has(eventName)) {
                subscriptions.get(eventName).forEach(handler => {
                    try {
                        // console.log(`[MockEventBus] Calling handler for ${eventName}`);
                        handler(eventData);
                    } catch (error) {
                        console.error(`[MockEventBus] Error in subscribed handler for ${eventName}:`, error);
                    }
                });
            } else {
                // console.log(`[MockEventBus] No handlers found for ${eventName}`);
            }
        },
        // Helper to clear subscriptions if needed between tests (though beforeEach usually handles this)
        clearSubscriptions: () => subscriptions.clear(),
        // Helper to check subscriptions (for debugging tests)
        getSubscriptions: () => subscriptions,
    };
};

const mockDataManager = {
    getAllTriggers: jest.fn(),
    getEntityDefinition: jest.fn(), // Add if needed by dependencies
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    createEntityInstance: jest.fn((id) => mockEntityManager.getEntityInstance(id)), // Simple passthrough if creation logic isn't tested here
    // Add other methods if TriggerSystem dependencies require them
};

const mockGameStateManager = {
    getPlayer: jest.fn(() => ({id: 'player1'})), // Return a mock player if needed
    setCurrentLocation: jest.fn(),
    // Add other methods if TriggerSystem dependencies require them
};

const mockActionExecutor = {
    executeAction: jest.fn(() => ({success: true, messages: []})), // Mock basic execution if needed
};

// --- Test Suite ---

describe('TriggerSystem Core Tests', () => {
    let triggerSystem;
    let mockEventBus;
    let mockHallway;
    let mockConnectionsComponent;

    // Define the test trigger data - **ENSURE one_shot is true for Ticket 5**
    const goblinDeathTrigger = {
        id: 'trigger:goblin_death_unlocks_door', // Matched ID in Ticket 5 optional check
        listen_to: {
            event_type: 'event:entity_died', // Event the system subscribes to
            filters: {
                source_id: 'demo:enemy_goblin' // Filter condition: matches the deceased entity
            }
        },
        actions: [
            {
                type: 'set_connection_state',
                target: {
                    location_id: 'demo:hallway',        // Location containing the connection
                    connection_direction: 'north'       // Direction used by _executeSetConnectionState
                    // Note: _executeSetConnectionState uses direction, not connectionId directly
                    // but we verify using connectionId via ConnectionsComponent methods
                },
                parameters: {
                    state: 'unlocked' // Desired new state
                }
            }
        ],
        one_shot: true // <<<--- IMPORTANT: Set to true for one-shot behavior test
    };

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Create fresh mock instances
        mockEventBus = createMockEventBus();
        // Provide the specific trigger definition needed for these tests
        mockDataManager.getAllTriggers.mockReturnValue([goblinDeathTrigger]);

        // --- Setup Mock Entities and Components ---
        // Create a real ConnectionsComponent instance to test its state changes
        mockConnectionsComponent = new ConnectionsComponent({
            connections: [
                {
                    connectionId: 'demo:treasure_room_door', // **The target connection ID**
                    direction: 'north',                      // Direction referenced in the trigger action
                    target: 'demo:treasure_room',
                    name: 'treasure room door',
                    initial_state: 'locked'                  // **Starts locked**
                },
                {
                    connectionId: 'demo:south_exit',
                    direction: 'south',
                    target: 'demo:outside',
                    initial_state: 'unlocked'
                }
            ]
        });

        // Create a mock Hallway Entity
        mockHallway = {
            id: 'demo:hallway',
            components: new Map(),
            getComponent: (componentClass) => {
                if (componentClass === ConnectionsComponent) {
                    return mockConnectionsComponent;
                }
                return undefined;
            },
        };
        mockHallway.components.set(ConnectionsComponent, mockConnectionsComponent);


        // Configure EntityManager mock to return the mock hallway
        mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
            if (entityId === 'demo:hallway') {
                return mockHallway;
            }
            return undefined; // Return undefined for other IDs
        });

        // Instantiate the system under test with all mocks
        triggerSystem = new TriggerSystem({
            eventBus: mockEventBus,
            dataManager: mockDataManager,
            entityManager: mockEntityManager,
            gameStateManager: mockGameStateManager,
            actionExecutor: mockActionExecutor
        });

        // Initialize the system - this reads triggers and subscribes handlers
        triggerSystem.initialize();
    });

    // =========================================================================
    // == Ticket 4 Test Implementation (Reference)
    // =========================================================================
    it('should unlock the treasure door when the correct goblin dies', () => {
        const eventPayload = {
            deceasedEntityId: 'demo:enemy_goblin',
        };

        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');

        mockEventBus.triggerSubscribedHandlers('event:entity_died', eventPayload);

        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('unlocked');
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({
                text: expect.stringContaining('click from the north'),
                type: 'sound'
            })
        );
        expect(mockEventBus.subscribe).toHaveBeenCalledWith('event:entity_died', expect.any(Function));
    });
    // =========================================================================


    // Note: These existing negative tests partially cover the scenario, but Ticket 6
    // requires a dedicated test with specific assertions.
    /*
    it('should NOT unlock the treasure door if a different entity dies', () => {
        const eventPayload = {
            deceasedEntityId: 'demo:enemy_skeleton',
        };
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');
        mockEventBus.triggerSubscribedHandlers('event:entity_died', eventPayload);
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({text: expect.stringContaining('click')})
        );
    });

    it('should NOT unlock the treasure door if the event has missing data required by filters', () => {
        const eventPayload = {someOtherData: 'value'};
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');
        mockEventBus.triggerSubscribedHandlers('event:entity_died', eventPayload);
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');
    });
    */

    // =========================================================================
    // == Ticket 5 Implementation: Verify one_shot Behavior
    // =========================================================================
    it('should fire a one-shot trigger only once, even if the event is dispatched again', () => {
        // Define the event payload
        const eventPayload = {
            deceasedEntityId: 'demo:enemy_goblin', // Correct goblin ID
        };

        // (Optional but useful) Spy on the internal method BEFORE any events
        // Note: Accessing private methods like this (_execute...) for testing is common
        // but be aware it couples the test to implementation details.
        // Using '#' syntax for private fields/methods is harder to spy on directly.
        const spyExecuteSetConnectionState = jest.spyOn(triggerSystem, '_executeSetConnectionState');

        // --- Pre-assertion: Verify initial state ---
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');

        // --- First Dispatch: Trigger the event the first time ---
        // console.log("--- Dispatching event FIRST time ---");
        mockEventBus.triggerSubscribedHandlers('event:entity_died', eventPayload);

        // --- First Assertion: Verify state changed and action ran ---
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('unlocked');
        expect(spyExecuteSetConnectionState).toHaveBeenCalledTimes(1); // Should have been called once now
        expect(spyExecuteSetConnectionState).toHaveBeenCalledWith(
            goblinDeathTrigger.actions[0].target, // Ensure it was called with the correct args
            goblinDeathTrigger.actions[0].parameters
        );
        // Check the 'click' sound was dispatched the first time
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({text: expect.stringContaining('click from the north')})
        );
        // Clear the mock dispatch calls to specifically check the second dispatch attempt
        mockEventBus.dispatch.mockClear();


        // --- Second Dispatch: Trigger the exact same event again ---
        // console.log("--- Dispatching event SECOND time ---");
        mockEventBus.triggerSubscribedHandlers('event:entity_died', eventPayload);

        // --- Second Assertions: Verify state REMAINS unchanged and action did NOT run again ---
        // Acceptance Criterion: Assert that connectionsComp.getConnectionState('demo:treasure_room_door') remains 'unlocked'.
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('unlocked');

        // Acceptance Criterion (Optional): Assert _executeSetConnectionState was called only once *in total*.
        expect(spyExecuteSetConnectionState).toHaveBeenCalledTimes(1); // Crucial: Still only called once!

        // Optional: Verify no *new* 'click' sound message was dispatched on the second attempt
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({text: expect.stringContaining('click from the north')})
        );

        // Clean up the spy
        spyExecuteSetConnectionState.mockRestore();

        // Acceptance Criterion (Optional - Internal State Check):
        // Accessing the private '#activeOneShotTriggerIds' set directly is difficult and potentially brittle
        // due to JS private field encapsulation and potential build tool name mangling.
        // Relying on the fact that the action (_executeSetConnectionState) wasn't called a second time
        // provides strong evidence that the trigger was correctly deactivated internally.
        // If direct access was possible and reliable, the assertion would look something like:
        // expect(triggerSystem['#activeOneShotTriggerIds'].has('trigger:goblin_death_unlocks_door')).toBe(false);
        // But we will rely on the behavioral test (spy call count) instead.
    });
    // =========================================================================


    // =========================================================================
    // == Ticket 6 Implementation: Verify Filter Rejection
    // =========================================================================
    it('should not unlock the door when a different entity dies', () => {
        // Acceptance Criterion: An it block describes the negative scenario
        // Description: 'should not unlock the door when a different entity dies'

        // Acceptance Criterion: The event:entity_died event payload is defined
        const eventPayload = {
            deceasedEntityId: 'some_other_entity', // Incorrect ID for the trigger filter
        };

        // Spy on the action execution method (Optional assertion target)
        const spyExecuteSetConnectionState = jest.spyOn(triggerSystem, '_executeSetConnectionState');

        // --- Pre-assertion: Verify initial state is locked ---
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');

        // --- Act: Trigger the handler with the incorrect payload ---
        // Acceptance Criterion: The mock EventBus triggers the handler with this payload.
        mockEventBus.triggerSubscribedHandlers('event:entity_died', eventPayload);

        // --- Assertions ---
        // Acceptance Criterion: Assert that connectionsComp.getConnectionState('demo:treasure_room_door') remains 'locked'.
        expect(mockConnectionsComponent.getConnectionState('demo:treasure_room_door')).toBe('locked');

        // Acceptance Criterion (Optional): Assert that the _executeSetConnectionState spy was not called.
        expect(spyExecuteSetConnectionState).not.toHaveBeenCalled();

        // Optional additional check: Assert no 'click' sound message was dispatched
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({text: expect.stringContaining('click from the north')})
        );

        // Clean up the spy
        spyExecuteSetConnectionState.mockRestore();
    });
    // =========================================================================


});